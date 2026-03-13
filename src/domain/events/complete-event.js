"use strict";

const { sequelize, models } = require("../../db");
const { canAccessOwner } = require("../../api/auth/scope-context");
const { EventCompletionError, EVENT_COMPLETION_ERROR_CATEGORIES } = require("./event-completion-errors");
const { syncItemEvent, materializeItemEventForDate } = require("../items/item-event-sync");
const { recalculateAndPersistFinancialProgress } = require("../items/financial-metrics");

const COMPLETED_STATUS = "Completed";
const PENDING_STATUS = "Pending";
const AUDIT_ACTION = "event.completed";
const UNDO_AUDIT_ACTION = "event.reopened";

function normalizeEvent(eventInstance) {
  const raw = eventInstance.get({ plain: true });

  return {
    ...raw,
    created_at: raw.created_at || raw.createdAt,
    updated_at: raw.updated_at || raw.updatedAt,
    completed_at: raw.completed_at || raw.completedAt || null,
    type: raw.event_type,
    recurring: raw.is_recurring === undefined || raw.is_recurring === null ? false : Boolean(raw.is_recurring)
  };
}

function toCompletionPayload(eventInstance, promptNextDate = true) {
  const event = normalizeEvent(eventInstance);

  return {
    id: event.id,
    item_id: event.item_id,
    type: event.type,
    due_date: event.due_date,
    amount: event.amount,
    actual_amount: event.actual_amount,
    actual_date: event.actual_date,
    status: event.status,
    recurring: event.recurring,
    created_at: event.created_at,
    updated_at: event.updated_at,
    completed_at: event.completed_at,
    prompt_next_date: promptNextDate
  };
}

function throwNotFound(eventId) {
  throw new EventCompletionError({
    message: "Event completion target not found.",
    category: EVENT_COMPLETION_ERROR_CATEGORIES.NOT_FOUND,
    issues: [
      {
        field: "event_id",
        code: "not_found",
        category: EVENT_COMPLETION_ERROR_CATEGORIES.NOT_FOUND,
        message: "No event exists for the provided id.",
        meta: { eventId }
      }
    ]
  });
}

function throwForbidden(eventId, actorUserId) {
  throw new EventCompletionError({
    message: "You can only access your own records.",
    category: EVENT_COMPLETION_ERROR_CATEGORIES.NOT_FOUND,
    issues: [
      {
        field: "event_id",
        code: "not_found",
        category: EVENT_COMPLETION_ERROR_CATEGORIES.NOT_FOUND,
        message: "You can only access your own records.",
        meta: { eventId, actorUserId }
      }
    ]
  });
}

function throwInvalidState(eventId) {
  throw new EventCompletionError({
    message: "Event completion transition is invalid.",
    category: EVENT_COMPLETION_ERROR_CATEGORIES.INVALID_STATE,
    issues: [
      {
        field: "event_id",
        code: "invalid_state",
        category: EVENT_COMPLETION_ERROR_CATEGORIES.INVALID_STATE,
        message: "Event cannot be transitioned because ownership context is missing.",
        meta: { eventId }
      }
    ]
  });
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
}

function normalizeActorUserId(value) {
  return typeof value === "string" ? value.trim() : "";
}

function withResolvedActorScope(scope, actorUserId) {
  const normalizedScope = isPlainObject(scope) ? { ...scope } : {};

  if (!normalizeActorUserId(normalizedScope.actorUserId)) {
    normalizedScope.actorUserId = actorUserId;
  }

  return normalizedScope;
}

function hasActualAmountInput(value) {
  return value !== null && value !== undefined && value !== "";
}

function hasActualDateInput(value) {
  return value !== null && value !== undefined && value !== "";
}

function toBusinessDate(value) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
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

function isUuidLike(value) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

function getDeletedAt(attributes) {
  if (!isPlainObject(attributes)) {
    return null;
  }

  if (typeof attributes._deleted_at !== "string") {
    return null;
  }

  const parsed = Date.parse(attributes._deleted_at);
  return Number.isNaN(parsed) ? null : attributes._deleted_at;
}

async function resolveTargetEvent({ eventId, scope, actorUserId, transaction }) {
  if (typeof eventId === "string") {
    const projectedMatch = /^projected-([0-9a-f-]{36})-(\d{4}-\d{2}-\d{2})$/i.exec(eventId);
    if (projectedMatch) {
      const [, itemId, dueDate] = projectedMatch;
      const item = await models.Item.findByPk(itemId, { transaction });

      if (!item) {
        throwNotFound(eventId);
      }

      if (!canAccessOwner(scope, item.user_id)) {
        throwForbidden(eventId, actorUserId);
      }

      if (item.item_type !== "FinancialItem" || item.status === "Closed" || item.frequency === "one_time") {
        throwNotFound(eventId);
      }

      const materialized = await materializeItemEventForDate({
        item,
        dueDate,
        models,
        transaction
      });

      if (!materialized) {
        throwNotFound(eventId);
      }

      return materialized;
    }
  }

  if (typeof eventId === "string" && eventId.startsWith("derived-")) {
    const itemId = eventId.slice("derived-".length);

    if (!isUuidLike(itemId)) {
      throwNotFound(eventId);
    }

    const item = await models.Item.findByPk(itemId, { transaction });
    if (!item) {
      throwNotFound(eventId);
    }

    if (!canAccessOwner(scope, item.user_id)) {
      throwForbidden(eventId, actorUserId);
    }

    if (getDeletedAt(item.attributes)) {
      throwInvalidState(eventId);
    }

    await syncItemEvent({ item, models, transaction });

    const pending = await models.Event.findOne({
      where: {
        item_id: item.id,
        status: "Pending"
      },
      order: [["due_date", "ASC"], ["id", "ASC"]],
      transaction
    });

    if (!pending) {
      throwNotFound(eventId);
    }

    return pending;
  }

  return models.Event.findByPk(eventId, { transaction });
}

async function completeEvent({ eventId, scope, actorUserId, now = new Date(), actual_amount, actual_date }) {
  const initialScope = isPlainObject(scope) ? scope : {};
  const resolvedActorUserId = normalizeActorUserId(initialScope.actorUserId) || normalizeActorUserId(actorUserId);
  if (!resolvedActorUserId) {
    throwInvalidState(eventId);
  }
  const scopeContext = withResolvedActorScope(initialScope, resolvedActorUserId);
  const attribution = resolveAuditAttribution({ scope: scopeContext, fallbackUserId: resolvedActorUserId });
  const completedAt = now instanceof Date ? now : new Date(now);

  return sequelize.transaction(async (transaction) => {
    const event = await resolveTargetEvent({
      eventId,
      scope: scopeContext,
      actorUserId: resolvedActorUserId,
      transaction
    });

    if (!event) {
      throwNotFound(eventId);
    }

    const ownerItem = await models.Item.findByPk(event.item_id, {
      attributes: ["id", "user_id"],
      transaction
    });

    if (!ownerItem) {
      throwInvalidState(event.id);
    }

    if (!canAccessOwner(scopeContext, ownerItem.user_id)) {
      throwForbidden(event.id, resolvedActorUserId);
    }

    if (event.status === COMPLETED_STATUS) {
      return toCompletionPayload(event);
    }

    const resolvedActualAmount = hasActualAmountInput(actual_amount) ? actual_amount : event.amount;
    const resolvedActualDate = hasActualDateInput(actual_date) ? actual_date : toBusinessDate(completedAt);

    event.status = COMPLETED_STATUS;
    event.completed_at = completedAt;
    event.actual_amount = resolvedActualAmount;
    event.actual_date = resolvedActualDate;
    await event.save({ transaction });

    const paymentItem = await models.Item.findByPk(event.item_id, { transaction });
    await recalculateAndPersistFinancialProgress({ item: paymentItem, models, transaction });

    await models.AuditLog.create(
      {
        user_id: attribution.actorUserId,
        actor_user_id: attribution.actorUserId,
        lens_user_id: attribution.lensUserId,
        action: AUDIT_ACTION,
        entity: `event:${event.id}`,
        timestamp: completedAt
      },
      { transaction }
    );

    return toCompletionPayload(event);
  });
}

async function undoEventCompletion({ eventId, scope, actorUserId, now = new Date() }) {
  const initialScope = isPlainObject(scope) ? scope : {};
  const resolvedActorUserId = normalizeActorUserId(initialScope.actorUserId) || normalizeActorUserId(actorUserId);
  if (!resolvedActorUserId) {
    throwInvalidState(eventId);
  }
  const scopeContext = withResolvedActorScope(initialScope, resolvedActorUserId);
  const attribution = resolveAuditAttribution({ scope: scopeContext, fallbackUserId: resolvedActorUserId });
  const undoneAt = now instanceof Date ? now : new Date(now);

  return sequelize.transaction(async (transaction) => {
    const event = await resolveTargetEvent({
      eventId,
      scope: scopeContext,
      actorUserId: resolvedActorUserId,
      transaction
    });

    if (!event) {
      throwNotFound(eventId);
    }

    const ownerItem = await models.Item.findByPk(event.item_id, {
      attributes: ["id", "user_id"],
      transaction
    });

    if (!ownerItem) {
      throwInvalidState(event.id);
    }

    if (!canAccessOwner(scopeContext, ownerItem.user_id)) {
      throwForbidden(event.id, resolvedActorUserId);
    }

    if (event.status !== COMPLETED_STATUS) {
      return toCompletionPayload(event, false);
    }

    const paymentItem = await models.Item.findByPk(event.item_id, { transaction });

    event.status = PENDING_STATUS;
    event.completed_at = null;
    await event.save({ transaction });

    await recalculateAndPersistFinancialProgress({ item: paymentItem, models, transaction });

    await models.AuditLog.create(
      {
        user_id: attribution.actorUserId,
        actor_user_id: attribution.actorUserId,
        lens_user_id: attribution.lensUserId,
        action: UNDO_AUDIT_ACTION,
        entity: `event:${event.id}`,
        timestamp: undoneAt
      },
      { transaction }
    );

    return toCompletionPayload(event, false);
  });
}

module.exports = {
  completeEvent,
  undoEventCompletion
};
