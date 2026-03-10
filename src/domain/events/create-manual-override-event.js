"use strict";

const { Op } = require("sequelize");

const { sequelize, models } = require("../../db");
const { canAccessOwner } = require("../../api/auth/scope-context");

const COMPLETED_STATUS = "Completed";
const AUDIT_ACTION = "event.manualoverride.created";
const EXTREME_HISTORY_WARNING_YEARS = 25;

const MANUAL_OVERRIDE_ERROR_CATEGORIES = Object.freeze({
  NOT_FOUND: "not_found",
  INVALID_REQUEST: "invalid_request",
  DUPLICATE: "duplicate",
  INVALID_STATE: "invalid_state"
});

class ManualOverrideEventError extends Error {
  constructor({ message, category, issues = [] }) {
    super(message);
    this.name = "ManualOverrideEventError";
    this.category = category;
    this.issues = Array.isArray(issues) ? issues : [];
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toUtcDay(value) {
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function addDaysUtc(date, count) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + count));
}

function normalizeActorUserId(value) {
  return typeof value === "string" ? value.trim() : "";
}

function resolveAuditAttribution({ scope, fallbackUserId }) {
  const normalizedScope = isPlainObject(scope) ? scope : {};
  const actorUserId = normalizeActorUserId(normalizedScope.actorUserId) || normalizeActorUserId(fallbackUserId);
  const mode = normalizedScope.mode === "all" ? "all" : "owner";
  const scopedLensUserId = normalizeActorUserId(normalizedScope.lensUserId) || null;
  const lensUserId = scopedLensUserId || (mode === "owner" ? actorUserId : null);

  return {
    actorUserId,
    lensUserId
  };
}

function createIssue(field, code, category, message, meta) {
  return {
    field,
    code,
    category,
    message,
    meta
  };
}

function throwManualOverrideError(message, category, issues) {
  throw new ManualOverrideEventError({
    message,
    category,
    issues
  });
}

function parseAmount(value) {
  if (value === undefined || value === null || value === "") {
    return createIssue(
      "amount",
      "invalid_amount",
      MANUAL_OVERRIDE_ERROR_CATEGORIES.INVALID_REQUEST,
      "amount must be a positive number."
    );
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return createIssue(
      "amount",
      "invalid_amount",
      MANUAL_OVERRIDE_ERROR_CATEGORIES.INVALID_REQUEST,
      "amount must be a positive number."
    );
  }

  return Number(parsed.toFixed(2));
}

function validateInput(payload, now) {
  const body = isPlainObject(payload) ? payload : {};
  const issues = [];
  const itemId = normalizeString(body.item_id || body.itemId);

  if (!itemId) {
    issues.push(
      createIssue(
        "item_id",
        "required",
        MANUAL_OVERRIDE_ERROR_CATEGORIES.INVALID_REQUEST,
        "item_id is required."
      )
    );
  }

  const dueDate = toUtcDay(body.due_date || body.dueDate);
  if (!dueDate) {
    issues.push(
      createIssue(
        "due_date",
        "invalid_due_date",
        MANUAL_OVERRIDE_ERROR_CATEGORIES.INVALID_REQUEST,
        "due_date must be a valid date."
      )
    );
  }

  const amount = parseAmount(body.amount);
  if (typeof amount !== "number") {
    issues.push(amount);
  }

  const today = toUtcDay(now) || toUtcDay(new Date());
  if (dueDate && today && dueDate.getTime() > today.getTime()) {
    issues.push(
      createIssue(
        "due_date",
        "future_due_date",
        MANUAL_OVERRIDE_ERROR_CATEGORIES.INVALID_REQUEST,
        "due_date cannot be in the future."
      )
    );
  }

  if (issues.length > 0) {
    throwManualOverrideError(
      "Manual override event payload is invalid.",
      MANUAL_OVERRIDE_ERROR_CATEGORIES.INVALID_REQUEST,
      issues
    );
  }

  return {
    itemId,
    dueDate,
    amount
  };
}

function getEventType(item) {
  const title = normalizeString(item && item.title);
  if (title) {
    return title;
  }

  const attributes = isPlainObject(item && item.attributes) ? item.attributes : {};
  return normalizeString(attributes.name) || "FinancialItem";
}

function buildWarnings(dueDate, now) {
  const normalizedDueDate = toUtcDay(dueDate);
  const normalizedNow = toUtcDay(now) || toUtcDay(new Date());
  if (!normalizedDueDate || !normalizedNow) {
    return [];
  }

  const threshold = new Date(Date.UTC(
    normalizedNow.getUTCFullYear() - EXTREME_HISTORY_WARNING_YEARS,
    normalizedNow.getUTCMonth(),
    normalizedNow.getUTCDate()
  ));

  if (normalizedDueDate.getTime() >= threshold.getTime()) {
    return [];
  }

  return [
    {
      field: "due_date",
      code: "extreme_historical_date",
      message: "due_date is far in the past. Please confirm this manual override is intentional."
    }
  ];
}

function toManualOverridePayload(eventInstance, warnings) {
  const raw = eventInstance.get({ plain: true });

  return {
    id: raw.id,
    item_id: raw.item_id,
    type: raw.event_type,
    amount: raw.amount,
    due_date: raw.due_date,
    status: raw.status,
    recurring: Boolean(raw.is_recurring),
    source_state: "persisted",
    is_projected: false,
    is_manual_override: Boolean(raw.is_manual_override),
    completed_at: raw.completed_at || raw.completedAt || null,
    created_at: raw.created_at || raw.createdAt,
    updated_at: raw.updated_at || raw.updatedAt,
    warnings: Array.isArray(warnings) ? warnings : []
  };
}

async function createManualOverrideEvent({ payload, scope, actorUserId, now = new Date() }) {
  const scopeContext = isPlainObject(scope) ? scope : {};
  const resolvedActorUserId = normalizeActorUserId(scopeContext.actorUserId) || normalizeActorUserId(actorUserId);
  if (!resolvedActorUserId) {
    throwManualOverrideError(
      "Manual override event state is invalid.",
      MANUAL_OVERRIDE_ERROR_CATEGORIES.INVALID_STATE,
      [
        createIssue(
          "scope.actorUserId",
          "required",
          MANUAL_OVERRIDE_ERROR_CATEGORIES.INVALID_STATE,
          "scope.actorUserId is required."
        )
      ]
    );
  }

  const input = validateInput(payload, now);
  const warnings = buildWarnings(input.dueDate, now);
  const attribution = resolveAuditAttribution({ scope: scopeContext, fallbackUserId: resolvedActorUserId });

  return sequelize.transaction(async (transaction) => {
    const item = await models.Item.findByPk(input.itemId, { transaction });
    if (!item || item.item_type !== "FinancialItem") {
      throwManualOverrideError(
        "Manual override target not found.",
        MANUAL_OVERRIDE_ERROR_CATEGORIES.NOT_FOUND,
        [
          createIssue(
            "item_id",
            "not_found",
            MANUAL_OVERRIDE_ERROR_CATEGORIES.NOT_FOUND,
            "No accessible financial item exists for the provided item_id.",
            { itemId: input.itemId }
          )
        ]
      );
    }

    if (!canAccessOwner(scopeContext, item.user_id)) {
      throwManualOverrideError(
        "You can only access your own records.",
        MANUAL_OVERRIDE_ERROR_CATEGORIES.NOT_FOUND,
        [
          createIssue(
            "item_id",
            "not_found",
            MANUAL_OVERRIDE_ERROR_CATEGORIES.NOT_FOUND,
            "You can only access your own records.",
            { itemId: input.itemId }
          )
        ]
      );
    }

    const duplicate = await models.Event.findOne({
      where: {
        item_id: item.id,
        due_date: {
          [Op.gte]: input.dueDate,
          [Op.lt]: addDaysUtc(input.dueDate, 1)
        }
      },
      order: [["updated_at", "DESC"], ["id", "ASC"]],
      transaction
    });

    if (duplicate) {
      throwManualOverrideError(
        "A completed or projected event already exists for this item on that date.",
        MANUAL_OVERRIDE_ERROR_CATEGORIES.DUPLICATE,
        [
          createIssue(
            "due_date",
            "duplicate_due_date",
            MANUAL_OVERRIDE_ERROR_CATEGORIES.DUPLICATE,
            "An event already exists for this item on that date.",
            { itemId: item.id, dueDate: input.dueDate.toISOString().slice(0, 10) }
          )
        ]
      );
    }

    const created = await models.Event.create(
      {
        item_id: item.id,
        event_type: getEventType(item),
        due_date: input.dueDate,
        amount: input.amount,
        status: COMPLETED_STATUS,
        is_recurring: false,
        is_manual_override: true,
        completed_at: input.dueDate
      },
      { transaction }
    );

    await models.AuditLog.create(
      {
        user_id: attribution.actorUserId,
        actor_user_id: attribution.actorUserId,
        lens_user_id: attribution.lensUserId,
        action: AUDIT_ACTION,
        entity: `event:${created.id}`,
        timestamp: input.dueDate
      },
      { transaction }
    );

    return toManualOverridePayload(created, warnings);
  });
}

module.exports = {
  MANUAL_OVERRIDE_ERROR_CATEGORIES,
  ManualOverrideEventError,
  createManualOverrideEvent
};
