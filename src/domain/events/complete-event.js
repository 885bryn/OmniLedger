"use strict";

const { sequelize, models } = require("../../db");
const { Op } = require("sequelize");
const { EventCompletionError, EVENT_COMPLETION_ERROR_CATEGORIES } = require("./event-completion-errors");
const { syncItemEvent } = require("../items/item-event-sync");
const { minimumAttributeKeys } = require("../items/minimum-attribute-keys");

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

function toFiniteNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
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

function hasRequiredAttributes(itemType, attributes) {
  const requiredKeys = minimumAttributeKeys[itemType] || [];

  return requiredKeys.every((key) => {
    const value = attributes[key];
    return value !== undefined && value !== null && value !== "";
  });
}

function applyRounded(value) {
  return Number(Number(value).toFixed(2));
}

function setOrDelete(attributes, key, value) {
  if (value === undefined || value === null || value === "") {
    delete attributes[key];
    return;
  }

  attributes[key] = value;
}

async function getLatestCompletedEvent(itemId, transaction, excludedEventId) {
  return models.Event.findOne({
    where: {
      item_id: itemId,
      status: COMPLETED_STATUS,
      ...(excludedEventId ? { id: { [Op.ne]: excludedEventId } } : {})
    },
    order: [["completed_at", "DESC"], ["updated_at", "DESC"], ["id", "ASC"]],
    transaction
  });
}

async function applyCompletionSideEffects(paymentItem, event, completedAt, transaction) {
  if (paymentItem && paymentItem.item_type === "FinancialCommitment") {
    const attributes = isPlainObject(paymentItem.attributes) ? { ...paymentItem.attributes } : {};
    const remainingBalance = toFiniteNumber(attributes.remainingBalance);
    const paidAmount = toFiniteNumber(event.amount);

    if (remainingBalance !== null && paidAmount !== null && paidAmount > 0) {
      attributes.remainingBalance = applyRounded(Math.max(0, remainingBalance - paidAmount));
      attributes.lastPaymentAmount = paidAmount;
      attributes.lastPaymentDate = completedAt.toISOString().slice(0, 10);

      if (hasRequiredAttributes(paymentItem.item_type, attributes)) {
        paymentItem.attributes = attributes;
        await paymentItem.save({ transaction });
      }
    }
    return;
  }

  if (paymentItem && paymentItem.item_type === "FinancialIncome") {
    const attributes = isPlainObject(paymentItem.attributes) ? { ...paymentItem.attributes } : {};
    const collectedTotal = toFiniteNumber(attributes.collectedTotal) || 0;
    const collectedAmount = toFiniteNumber(event.amount);

    if (collectedAmount !== null && collectedAmount > 0) {
      attributes.collectedTotal = applyRounded(collectedTotal + collectedAmount);
      attributes.lastCollectedAmount = collectedAmount;
      attributes.lastCollectedDate = completedAt.toISOString().slice(0, 10);

      if (hasRequiredAttributes(paymentItem.item_type, attributes)) {
        paymentItem.attributes = attributes;
        await paymentItem.save({ transaction });
      }
    }
  }
}

async function applyUndoCompletionSideEffects(paymentItem, event, transaction) {
  const eventAmount = toFiniteNumber(event.amount);

  if (paymentItem && paymentItem.item_type === "FinancialCommitment") {
    const attributes = isPlainObject(paymentItem.attributes) ? { ...paymentItem.attributes } : {};
    const remainingBalance = toFiniteNumber(attributes.remainingBalance);

    if (remainingBalance !== null && eventAmount !== null && eventAmount > 0) {
      attributes.remainingBalance = applyRounded(Math.max(0, remainingBalance + eventAmount));
    }

    const latestCompleted = await getLatestCompletedEvent(paymentItem.id, transaction, event.id);
    const lastAmount = latestCompleted ? toFiniteNumber(latestCompleted.amount) : null;
    const lastDateSource = latestCompleted && (latestCompleted.completed_at || latestCompleted.due_date);
    const lastDate = lastDateSource ? new Date(lastDateSource).toISOString().slice(0, 10) : null;

    setOrDelete(attributes, "lastPaymentAmount", lastAmount);
    setOrDelete(attributes, "lastPaymentDate", lastDate);

    if (hasRequiredAttributes(paymentItem.item_type, attributes)) {
      paymentItem.attributes = attributes;
      await paymentItem.save({ transaction });
    }
    return;
  }

  if (paymentItem && paymentItem.item_type === "FinancialIncome") {
    const attributes = isPlainObject(paymentItem.attributes) ? { ...paymentItem.attributes } : {};
    const collectedTotal = toFiniteNumber(attributes.collectedTotal) || 0;

    if (eventAmount !== null && eventAmount > 0) {
      attributes.collectedTotal = applyRounded(Math.max(0, collectedTotal - eventAmount));
    }

    const latestCompleted = await getLatestCompletedEvent(paymentItem.id, transaction, event.id);
    const lastAmount = latestCompleted ? toFiniteNumber(latestCompleted.amount) : null;
    const lastDateSource = latestCompleted && (latestCompleted.completed_at || latestCompleted.due_date);
    const lastDate = lastDateSource ? new Date(lastDateSource).toISOString().slice(0, 10) : null;

    setOrDelete(attributes, "lastCollectedAmount", lastAmount);
    setOrDelete(attributes, "lastCollectedDate", lastDate);

    if (hasRequiredAttributes(paymentItem.item_type, attributes)) {
      paymentItem.attributes = attributes;
      await paymentItem.save({ transaction });
    }
  }
}

async function resolveTargetEvent({ eventId, actorUserId, transaction }) {
  if (typeof eventId === "string" && eventId.startsWith("derived-")) {
    const itemId = eventId.slice("derived-".length);

    if (!isUuidLike(itemId)) {
      throwNotFound(eventId);
    }

    const item = await models.Item.findByPk(itemId, { transaction });
    if (!item) {
      throwNotFound(eventId);
    }

    if (item.user_id !== actorUserId) {
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

async function completeEvent({ eventId, scope, actorUserId, now = new Date() }) {
  const ownerUserId = resolveOwnerUserId({ actorUserId, scope });
  if (!ownerUserId) {
    throwInvalidState(eventId);
  }
  const completedAt = now instanceof Date ? now : new Date(now);

  return sequelize.transaction(async (transaction) => {
    const event = await resolveTargetEvent({ eventId, actorUserId: ownerUserId, transaction });

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

    if (ownerItem.user_id !== ownerUserId) {
      throwForbidden(event.id, ownerUserId);
    }

    if (event.status === COMPLETED_STATUS) {
      return toCompletionPayload(event);
    }

    event.status = COMPLETED_STATUS;
    event.completed_at = completedAt;
    await event.save({ transaction });

    const paymentItem = await models.Item.findByPk(event.item_id, { transaction });
    await applyCompletionSideEffects(paymentItem, event, completedAt, transaction);

    await models.AuditLog.create(
      {
        user_id: ownerUserId,
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
  const ownerUserId = resolveOwnerUserId({ actorUserId, scope });
  if (!ownerUserId) {
    throwInvalidState(eventId);
  }
  const undoneAt = now instanceof Date ? now : new Date(now);

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

    if (ownerItem.user_id !== ownerUserId) {
      throwForbidden(event.id, ownerUserId);
    }

    if (event.status !== COMPLETED_STATUS) {
      return toCompletionPayload(event, false);
    }

    const paymentItem = await models.Item.findByPk(event.item_id, { transaction });

    event.status = PENDING_STATUS;
    event.completed_at = null;
    await event.save({ transaction });

    await applyUndoCompletionSideEffects(paymentItem, event, transaction);

    await models.AuditLog.create(
      {
        user_id: ownerUserId,
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
