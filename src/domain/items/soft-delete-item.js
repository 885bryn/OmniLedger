"use strict";

const { sequelize, models } = require("../../db");
const { ItemQueryError, ITEM_QUERY_ERROR_CATEGORIES } = require("./item-query-errors");

const CANONICAL_ITEM_FIELDS = Object.freeze([
  "id",
  "user_id",
  "item_type",
  "attributes",
  "parent_item_id",
  "created_at",
  "updated_at"
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
}

function toCanonicalItem(itemInstance) {
  const raw = itemInstance.get({ plain: true });
  const normalizedRaw = {
    ...raw,
    created_at: raw.created_at || raw.createdAt,
    updated_at: raw.updated_at || raw.updatedAt
  };

  return CANONICAL_ITEM_FIELDS.reduce((output, key) => {
    output[key] = normalizedRaw[key];
    return output;
  }, {});
}

function normalizeInput(input) {
  const payload = isPlainObject(input) ? input : {};
  const scope = isPlainObject(payload.scope) ? payload.scope : {};
  const ownerUserId = typeof scope.actorUserId === "string" && scope.actorUserId.trim() !== ""
    ? scope.actorUserId.trim()
    : typeof payload.actorUserId === "string"
      ? payload.actorUserId.trim()
      : "";
  const issues = [];

  if (typeof payload.itemId !== "string" || payload.itemId.trim() === "") {
    issues.push({
      field: "itemId",
      code: "required",
      category: ITEM_QUERY_ERROR_CATEGORIES.INVALID_REQUEST,
      message: "itemId is required."
    });
  }

  if (ownerUserId === "") {
    issues.push({
      field: "scope.actorUserId",
      code: "required",
      category: ITEM_QUERY_ERROR_CATEGORIES.INVALID_REQUEST,
      message: "scope.actorUserId is required."
    });
  }

  if (issues.length > 0) {
    throw new ItemQueryError({
      message: "Item delete request is invalid.",
      category: ITEM_QUERY_ERROR_CATEGORIES.INVALID_REQUEST,
      issues
    });
  }

  return {
    itemId: payload.itemId,
    scope,
    actorUserId: ownerUserId,
    now: payload.now instanceof Date ? payload.now : payload.now ? new Date(payload.now) : new Date()
  };
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function resolveAuditAttribution(payload) {
  const scope = isPlainObject(payload.scope) ? payload.scope : {};
  const actorUserId = normalizeString(scope.actorUserId) || normalizeString(payload.actorUserId);
  const mode = scope.mode === "all" ? "all" : "owner";
  const scopedLensUserId = normalizeString(scope.lensUserId) || null;
  const lensUserId = scopedLensUserId || (mode === "owner" ? actorUserId : null);

  return {
    actorUserId,
    lensUserId
  };
}

function getDeletedAt(item) {
  const attrs = isPlainObject(item.attributes) ? item.attributes : {};
  const deletedAt = attrs._deleted_at;

  if (typeof deletedAt !== "string") {
    return null;
  }

  return Number.isNaN(new Date(deletedAt).getTime()) ? null : deletedAt;
}

function throwNotFound(itemId) {
  throw new ItemQueryError({
    message: "Item delete target not found.",
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

async function softDeleteItem(input) {
  const payload = normalizeInput(input);

  return sequelize.transaction(async (transaction) => {
    const item = await models.Item.findByPk(payload.itemId, { transaction });

    if (!item) {
      throwNotFound(payload.itemId);
    }

    if (item.user_id !== payload.actorUserId) {
      throwForbidden(payload.itemId, payload.actorUserId);
    }

    const existingDeletedAt = getDeletedAt(item);
    if (existingDeletedAt) {
      return {
        ...toCanonicalItem(item),
        deleted_at: existingDeletedAt,
        is_deleted: true
      };
    }

    const deletedAt = payload.now.toISOString();
    item.attributes = {
      ...(isPlainObject(item.attributes) ? item.attributes : {}),
      _deleted_at: deletedAt,
      _deleted_by: payload.actorUserId
    };
    await item.save({ transaction });

    const attribution = resolveAuditAttribution(payload);

    await models.AuditLog.create(
      {
        user_id: attribution.actorUserId,
        actor_user_id: attribution.actorUserId,
        lens_user_id: attribution.lensUserId,
        action: "item.deleted",
        entity: `item:${item.id}`,
        timestamp: payload.now
      },
      { transaction }
    );

    return {
      ...toCanonicalItem(item),
      deleted_at: deletedAt,
      is_deleted: true
    };
  });
}

module.exports = {
  softDeleteItem
};
