"use strict";

const { Op } = require("sequelize");
const { models } = require("../../db");
const { ItemQueryError, ITEM_QUERY_ERROR_CATEGORIES } = require("./item-query-errors");

function isPlainObject(value) {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
}

function normalizeInput(input) {
  const payload = isPlainObject(input) ? input : {};
  const issues = [];
  const limit = payload.limit === undefined ? 25 : Number(payload.limit);

  if (typeof payload.itemId !== "string" || payload.itemId.trim() === "") {
    issues.push({
      field: "itemId",
      code: "required",
      category: ITEM_QUERY_ERROR_CATEGORIES.INVALID_REQUEST,
      message: "itemId is required."
    });
  }

  if (typeof payload.actorUserId !== "string" || payload.actorUserId.trim() === "") {
    issues.push({
      field: "actorUserId",
      code: "required",
      category: ITEM_QUERY_ERROR_CATEGORIES.INVALID_REQUEST,
      message: "actorUserId is required."
    });
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    issues.push({
      field: "limit",
      code: "invalid_limit",
      category: ITEM_QUERY_ERROR_CATEGORIES.INVALID_REQUEST,
      message: "limit must be an integer between 1 and 100."
    });
  }

  if (issues.length > 0) {
    throw new ItemQueryError({
      message: "Item activity query is invalid.",
      category: ITEM_QUERY_ERROR_CATEGORIES.INVALID_REQUEST,
      issues
    });
  }

  return {
    itemId: payload.itemId,
    actorUserId: payload.actorUserId,
    limit
  };
}

function throwNotFound(itemId) {
  throw new ItemQueryError({
    message: "Item activity target not found.",
    category: ITEM_QUERY_ERROR_CATEGORIES.NOT_FOUND,
    issues: [
      {
        field: "item_id",
        code: "not_found",
        category: ITEM_QUERY_ERROR_CATEGORIES.NOT_FOUND,
        message: "No item exists for the provided id.",
        meta: { itemId }
      }
    ]
  });
}

function throwForbidden(itemId, actorUserId) {
  throw new ItemQueryError({
    message: "You can only access your own records.",
    category: ITEM_QUERY_ERROR_CATEGORIES.NOT_FOUND,
    issues: [
      {
        field: "item_id",
        code: "not_found",
        category: ITEM_QUERY_ERROR_CATEGORIES.NOT_FOUND,
        message: "You can only access your own records.",
        meta: { itemId, actorUserId }
      }
    ]
  });
}

function parseEntity(entity) {
  if (typeof entity !== "string") {
    return { entity_type: null, entity_id: null };
  }

  const [entityType, ...rest] = entity.split(":");
  if (!entityType || rest.length === 0) {
    return { entity_type: null, entity_id: null };
  }

  return {
    entity_type: entityType,
    entity_id: rest.join(":")
  };
}

function mapActivity(row, eventById) {
  const raw = row.get({ plain: true });
  const parsedEntity = parseEntity(raw.entity);
  const relatedEvent = parsedEntity.entity_type === "event" ? eventById.get(parsedEntity.entity_id) : null;
  const relatedEventRaw = relatedEvent ? relatedEvent.get({ plain: true }) : null;

  return {
    id: raw.id,
    user_id: raw.user_id,
    action: raw.action,
    entity: raw.entity,
    entity_type: parsedEntity.entity_type,
    entity_id: parsedEntity.entity_id,
    timestamp: raw.timestamp,
    event_type: relatedEventRaw ? relatedEventRaw.event_type : null,
    event_status: relatedEventRaw ? relatedEventRaw.status : null,
    event_due_date: relatedEventRaw ? relatedEventRaw.due_date : null,
    event_amount: relatedEventRaw ? relatedEventRaw.amount : null,
    event_completed_at: relatedEventRaw ? relatedEventRaw.completed_at : null,
    created_at: raw.created_at || raw.createdAt,
    updated_at: raw.updated_at || raw.updatedAt
  };
}

async function getItemActivity(input) {
  const payload = normalizeInput(input);
  const rootItem = await models.Item.findByPk(payload.itemId);

  if (!rootItem) {
    throwNotFound(payload.itemId);
  }

  if (rootItem.user_id !== payload.actorUserId) {
    throwForbidden(payload.itemId, payload.actorUserId);
  }

  const itemEvents = await models.Event.findAll({
    attributes: ["id"],
    where: {
      item_id: payload.itemId
    }
  });

  const entities = [`item:${payload.itemId}`, ...itemEvents.map((event) => `event:${event.id}`)];

  const rows = await models.AuditLog.findAll({
    where: {
      entity: {
        [Op.in]: entities
      }
    },
    order: [
      ["timestamp", "DESC"],
      ["created_at", "DESC"],
      ["id", "ASC"]
    ],
    limit: payload.limit
  });

  const eventIds = rows
    .map((row) => parseEntity(row.entity))
    .filter((parsed) => parsed.entity_type === "event" && parsed.entity_id)
    .map((parsed) => parsed.entity_id);

  const uniqueEventIds = [...new Set(eventIds)];
  const relatedEvents = uniqueEventIds.length
    ? await models.Event.findAll({
        where: {
          id: {
            [Op.in]: uniqueEventIds
          }
        }
      })
    : [];

  const eventById = new Map(relatedEvents.map((event) => [event.id, event]));

  return {
    item_id: payload.itemId,
    activity: rows.map((row) => mapActivity(row, eventById))
  };
}

module.exports = {
  getItemActivity
};
