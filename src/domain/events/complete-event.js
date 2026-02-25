"use strict";

const { sequelize, models } = require("../../db");
const { EventCompletionError, EVENT_COMPLETION_ERROR_CATEGORIES } = require("./event-completion-errors");

const COMPLETED_STATUS = "Completed";
const AUDIT_ACTION = "event.completed";

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

function toCompletionPayload(eventInstance) {
  const event = normalizeEvent(eventInstance);

  return {
    id: event.id,
    item_id: event.item_id,
    type: event.type,
    due_date: event.due_date,
    amount: event.amount,
    status: event.status,
    recurring: event.recurring,
    created_at: event.created_at,
    updated_at: event.updated_at,
    completed_at: event.completed_at,
    prompt_next_date: true
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
    message: "Event completion is forbidden for this actor.",
    category: EVENT_COMPLETION_ERROR_CATEGORIES.FORBIDDEN,
    issues: [
      {
        field: "event_id",
        code: "forbidden",
        category: EVENT_COMPLETION_ERROR_CATEGORIES.FORBIDDEN,
        message: "Event exists but is not owned by the requesting actor.",
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

async function completeEvent({ eventId, actorUserId, now = new Date() }) {
  const completedAt = now instanceof Date ? now : new Date(now);

  return sequelize.transaction(async (transaction) => {
    const event = await models.Event.findByPk(eventId, { transaction });

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

    if (ownerItem.user_id !== actorUserId) {
      throwForbidden(event.id, actorUserId);
    }

    if (event.status === COMPLETED_STATUS) {
      return toCompletionPayload(event);
    }

    event.status = COMPLETED_STATUS;
    event.completed_at = completedAt;
    await event.save({ transaction });

    await models.AuditLog.create(
      {
        user_id: actorUserId,
        action: AUDIT_ACTION,
        entity: `event:${event.id}`,
        timestamp: completedAt
      },
      { transaction }
    );

    return toCompletionPayload(event);
  });
}

module.exports = {
  completeEvent
};
