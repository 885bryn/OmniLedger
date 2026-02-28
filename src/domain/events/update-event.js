"use strict";

const { sequelize, models } = require("../../db");
const { materializeItemEventForDate } = require("../items/item-event-sync");
const { EventUpdateError, EVENT_UPDATE_ERROR_CATEGORIES } = require("./event-update-errors");

function isPlainObject(value) {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
}

function normalizeActorUserId(value) {
  return typeof value === "string" ? value.trim() : "";
}

function resolveOwnerUserId(input) {
  const payload = isPlainObject(input) ? input : {};
  const scope = isPlainObject(payload.scope) ? payload.scope : {};
  const scopeActorUserId = normalizeActorUserId(scope.actorUserId);
  return scopeActorUserId || normalizeActorUserId(payload.actorUserId);
}

function parseProjectedEventId(value) {
  if (typeof value !== "string") {
    return null;
  }

  const projectedMatch = /^projected-([0-9a-f-]{36})-(\d{4}-\d{2}-\d{2})$/i.exec(value);
  if (!projectedMatch) {
    return null;
  }

  return {
    itemId: projectedMatch[1],
    dueDate: projectedMatch[2]
  };
}

function toUtcDay(value) {
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function throwNotFound(eventId) {
  throw new EventUpdateError({
    message: "You can only access your own records.",
    category: EVENT_UPDATE_ERROR_CATEGORIES.NOT_FOUND,
    issues: [
      {
        field: "event_id",
        code: "not_found",
        category: EVENT_UPDATE_ERROR_CATEGORIES.NOT_FOUND,
        message: "You can only access your own records.",
        meta: { eventId }
      }
    ]
  });
}

function throwInvalidState(eventId) {
  throw new EventUpdateError({
    message: "Event update transition is invalid.",
    category: EVENT_UPDATE_ERROR_CATEGORIES.INVALID_STATE,
    issues: [
      {
        field: "event_id",
        code: "invalid_state",
        category: EVENT_UPDATE_ERROR_CATEGORIES.INVALID_STATE,
        message: "Event cannot be updated because ownership context is missing.",
        meta: { eventId }
      }
    ]
  });
}

function parseAmount(value) {
  if (value === undefined) {
    return { value: undefined, issue: null };
  }

  if (value === null || value === "") {
    return {
      value: null,
      issue: {
        field: "amount",
        code: "invalid_amount",
        category: EVENT_UPDATE_ERROR_CATEGORIES.INVALID_REQUEST,
        message: "amount must be a non-negative number."
      }
    };
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return {
      value: null,
      issue: {
        field: "amount",
        code: "invalid_amount",
        category: EVENT_UPDATE_ERROR_CATEGORIES.INVALID_REQUEST,
        message: "amount must be a non-negative number."
      }
    };
  }

  return {
    value: Number(parsed.toFixed(2)),
    issue: null
  };
}

function parseDueDate(value) {
  if (value === undefined) {
    return { value: undefined, issue: null };
  }

  const parsed = toUtcDay(value);
  if (!parsed) {
    return {
      value: null,
      issue: {
        field: "due_date",
        code: "invalid_due_date",
        category: EVENT_UPDATE_ERROR_CATEGORIES.INVALID_REQUEST,
        message: "due_date must be a valid date."
      }
    };
  }

  return {
    value: parsed,
    issue: null
  };
}

function validateUpdatePayload(payload) {
  const requestBody = isPlainObject(payload) ? payload : {};
  const hasDueDate = Object.prototype.hasOwnProperty.call(requestBody, "due_date");
  const hasAmount = Object.prototype.hasOwnProperty.call(requestBody, "amount");
  const issues = [];

  if (!hasDueDate && !hasAmount) {
    issues.push({
      field: "payload",
      code: "missing_fields",
      category: EVENT_UPDATE_ERROR_CATEGORIES.INVALID_REQUEST,
      message: "At least one editable field is required: due_date or amount."
    });
  }

  const parsedDueDate = parseDueDate(requestBody.due_date);
  if (parsedDueDate.issue) {
    issues.push(parsedDueDate.issue);
  }

  const parsedAmount = parseAmount(requestBody.amount);
  if (parsedAmount.issue) {
    issues.push(parsedAmount.issue);
  }

  if (issues.length > 0) {
    throw new EventUpdateError({
      message: "Event update payload is invalid.",
      category: EVENT_UPDATE_ERROR_CATEGORIES.INVALID_REQUEST,
      issues
    });
  }

  return {
    dueDate: parsedDueDate.value,
    amount: parsedAmount.value
  };
}

function normalizeEvent(eventInstance) {
  const raw = eventInstance.get({ plain: true });

  return {
    id: raw.id,
    item_id: raw.item_id,
    type: raw.event_type,
    due_date: raw.due_date,
    amount: raw.amount,
    status: raw.status,
    recurring: Boolean(raw.is_recurring),
    source_state: "persisted",
    is_projected: false,
    is_exception: Boolean(raw.is_exception),
    completed_at: raw.completed_at || raw.completedAt || null,
    created_at: raw.created_at || raw.createdAt,
    updated_at: raw.updated_at || raw.updatedAt
  };
}

async function resolveTargetEvent({ eventId, actorUserId, transaction }) {
  const projectedTarget = parseProjectedEventId(eventId);
  if (projectedTarget) {
    const item = await models.Item.findByPk(projectedTarget.itemId, { transaction });

    if (!item) {
      throwNotFound(eventId);
    }

    if (item.user_id !== actorUserId) {
      throwNotFound(eventId);
    }

    if (item.item_type !== "FinancialItem" || item.status === "Closed" || item.frequency === "one_time") {
      throwNotFound(eventId);
    }

    const materialized = await materializeItemEventForDate({
      item,
      dueDate: projectedTarget.dueDate,
      models,
      transaction
    });

    if (!materialized) {
      throwNotFound(eventId);
    }

    return {
      event: materialized,
      materializedFromProjection: true
    };
  }

  const persisted = await models.Event.findByPk(eventId, { transaction });
  if (!persisted) {
    throwNotFound(eventId);
  }

  return {
    event: persisted,
    materializedFromProjection: false
  };
}

async function updateEvent({ eventId, payload, scope, actorUserId }) {
  const ownerUserId = resolveOwnerUserId({ scope, actorUserId });
  if (!ownerUserId) {
    throwInvalidState(eventId);
  }

  const updates = validateUpdatePayload(payload);

  return sequelize.transaction(async (transaction) => {
    const resolved = await resolveTargetEvent({
      eventId,
      actorUserId: ownerUserId,
      transaction
    });
    const event = resolved.event;

    const ownerItem = await models.Item.findByPk(event.item_id, {
      attributes: ["id", "user_id"],
      transaction
    });
    if (!ownerItem) {
      throwInvalidState(event.id);
    }

    if (ownerItem.user_id !== ownerUserId) {
      throwNotFound(event.id);
    }

    let changed = false;

    if (updates.dueDate !== undefined) {
      event.due_date = updates.dueDate;
      changed = true;
    }

    if (updates.amount !== undefined) {
      event.amount = updates.amount;
      changed = true;
    }

    if (resolved.materializedFromProjection && event.is_exception !== true) {
      event.is_exception = true;
      changed = true;
    }

    if (changed) {
      await event.save({ transaction });
    }

    return normalizeEvent(event);
  });
}

module.exports = {
  updateEvent
};
