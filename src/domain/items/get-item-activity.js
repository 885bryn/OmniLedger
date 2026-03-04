"use strict";

const { Op } = require("sequelize");
const { models } = require("../../db");
const { canAccessOwner } = require("../../api/auth/scope-context");
const { ItemQueryError, ITEM_QUERY_ERROR_CATEGORIES } = require("./item-query-errors");

const EXPORT_AUDIT_ACTIONS = ["export.backup.succeeded", "export.backup.failed"];
const EXPORT_ENTITY = "export:backup.xlsx";

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
    scope: isPlainObject(payload.scope) ? payload.scope : null,
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

function normalizeScopeContext(payload) {
  const scope = payload.scope && typeof payload.scope === "object" ? payload.scope : {};
  const actorUserId = typeof scope.actorUserId === "string" && scope.actorUserId.trim() !== ""
    ? scope.actorUserId.trim()
    : payload.actorUserId;
  const actorRole = scope.actorRole === "admin" ? "admin" : "user";
  const mode = scope.mode === "all" ? "all" : "owner";
  const lensUserId = mode === "all"
    ? null
    : typeof scope.lensUserId === "string" && scope.lensUserId.trim() !== ""
      ? scope.lensUserId.trim()
      : actorUserId;

  return {
    actorUserId,
    actorRole,
    mode,
    lensUserId
  };
}

function resolveUserLabel(rawUser) {
  if (!rawUser || typeof rawUser !== "object") {
    return null;
  }

  const username = typeof rawUser.username === "string" && rawUser.username.trim() !== "" ? rawUser.username.trim() : null;
  if (username) {
    return username;
  }

  const email = typeof rawUser.email === "string" && rawUser.email.trim() !== "" ? rawUser.email.trim() : null;
  if (email) {
    return email;
  }

  const id = typeof rawUser.id === "string" && rawUser.id.trim() !== "" ? rawUser.id.trim() : null;
  return id;
}

function resolveLensAttributionState(raw, parsedEntity) {
  if (raw.lens_user_id) {
    return "attributed";
  }

  if (parsedEntity.entity_type === "export" && EXPORT_AUDIT_ACTIONS.includes(raw.action)) {
    return "all_data";
  }

  return "legacy_missing";
}

function mapActivity(row, eventById) {
  const raw = row.get({ plain: true });
  const parsedEntity = parseEntity(raw.entity);
  const relatedEvent = parsedEntity.entity_type === "event" ? eventById.get(parsedEntity.entity_id) : null;
  const relatedEventRaw = relatedEvent ? relatedEvent.get({ plain: true }) : null;
  const actorUserId = raw.actor_user_id || raw.user_id || null;
  const lensUserId = raw.lens_user_id || null;
  const actorLabel = resolveUserLabel(raw.actorUser || raw.user) || actorUserId;
  const lensAttributionState = resolveLensAttributionState(raw, parsedEntity);
  const lensLabel = resolveUserLabel(raw.lensUser) || (lensAttributionState === "all_data" ? "All users" : null);

  return {
    id: raw.id,
    user_id: raw.user_id,
    actor_user_id: actorUserId,
    actor_label: actorLabel,
    lens_user_id: lensUserId,
    lens_label: lensLabel,
    lens_attribution_state: lensAttributionState,
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

function createActivityInclude() {
  return [
    {
      model: models.User,
      as: "user",
      attributes: ["id", "username", "email"],
      required: false
    },
    {
      model: models.User,
      as: "actorUser",
      attributes: ["id", "username", "email"],
      required: false
    },
    {
      model: models.User,
      as: "lensUser",
      attributes: ["id", "username", "email"],
      required: false
    }
  ];
}

function compareActivityRows(left, right) {
  const leftTimestamp = Date.parse(left.timestamp || "");
  const rightTimestamp = Date.parse(right.timestamp || "");
  const leftTs = Number.isNaN(leftTimestamp) ? 0 : leftTimestamp;
  const rightTs = Number.isNaN(rightTimestamp) ? 0 : rightTimestamp;

  if (leftTs !== rightTs) {
    return rightTs - leftTs;
  }

  const leftCreatedAt = Date.parse(left.created_at || left.createdAt || "");
  const rightCreatedAt = Date.parse(right.created_at || right.createdAt || "");
  const leftCreated = Number.isNaN(leftCreatedAt) ? 0 : leftCreatedAt;
  const rightCreated = Number.isNaN(rightCreatedAt) ? 0 : rightCreatedAt;

  if (leftCreated !== rightCreated) {
    return rightCreated - leftCreated;
  }

  const leftId = typeof left.id === "string" ? left.id : "";
  const rightId = typeof right.id === "string" ? right.id : "";
  return leftId.localeCompare(rightId);
}

function buildExportWhere(scopeContext) {
  const where = {
    entity: EXPORT_ENTITY,
    action: {
      [Op.in]: EXPORT_AUDIT_ACTIONS
    }
  };

  if (scopeContext.mode === "all") {
    where.lens_user_id = null;
    return where;
  }

  where.lens_user_id = scopeContext.lensUserId || scopeContext.actorUserId;
  return where;
}

async function getItemActivity(input) {
  const payload = normalizeInput(input);
  const scopeContext = normalizeScopeContext(payload);
  const rootItem = await models.Item.findByPk(payload.itemId);

  if (!rootItem) {
    throwNotFound(payload.itemId);
  }

  if (!canAccessOwner(scopeContext, rootItem.user_id)) {
    throwForbidden(payload.itemId, scopeContext.actorUserId);
  }

  const itemEvents = await models.Event.findAll({
    attributes: ["id"],
    where: {
      item_id: payload.itemId
    }
  });

  const entities = [`item:${payload.itemId}`, ...itemEvents.map((event) => `event:${event.id}`)];

  const rows = await models.AuditLog.findAll({
    include: createActivityInclude(),
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

  const exportRows = await models.AuditLog.findAll({
    include: createActivityInclude(),
    where: buildExportWhere(scopeContext),
    order: [
      ["timestamp", "DESC"],
      ["created_at", "DESC"],
      ["id", "ASC"]
    ],
    limit: payload.limit
  });

  const mergedRows = [...rows, ...exportRows].sort((left, right) => compareActivityRows(left, right)).slice(0, payload.limit);

  const eventIds = mergedRows
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
    activity: mergedRows.map((row) => mapActivity(row, eventById))
  };
}

module.exports = {
  getItemActivity
};
