"use strict";

const { sequelize, models } = require("../../db");
const { canAccessOwner } = require("../../api/auth/scope-context");
const { ItemQueryError, ITEM_QUERY_ERROR_CATEGORIES } = require("./item-query-errors");
const { syncItemEvent } = require("./item-event-sync");

const FINANCIAL_SUBTYPES = new Set(["Commitment", "Income"]);
const FINANCIAL_FREQUENCIES = new Set(["one_time", "weekly", "monthly", "yearly"]);

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

function getDeletedAt(item) {
  const attributes = isPlainObject(item.attributes) ? item.attributes : {};
  const deletedAt = attributes._deleted_at;

  if (typeof deletedAt !== "string") {
    return null;
  }

  return Number.isNaN(new Date(deletedAt).getTime()) ? null : deletedAt;
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
  const subtype = typeof payload.type === "string" ? payload.type.trim() : "";
  const frequency = typeof payload.frequency === "string" ? payload.frequency.trim().toLowerCase() : "";

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

  if (!isPlainObject(payload.attributes)) {
    issues.push({
      field: "attributes",
      code: "invalid_attributes",
      category: ITEM_QUERY_ERROR_CATEGORIES.INVALID_REQUEST,
      message: "attributes must be a JSON object."
    });
  }

  if (subtype && !FINANCIAL_SUBTYPES.has(subtype)) {
    issues.push({
      field: "type",
      code: "invalid_financial_subtype",
      category: ITEM_QUERY_ERROR_CATEGORIES.INVALID_REQUEST,
      message: "type must be one of: Commitment, Income."
    });
  }

  if (frequency && !FINANCIAL_FREQUENCIES.has(frequency)) {
    issues.push({
      field: "frequency",
      code: "invalid_financial_frequency",
      category: ITEM_QUERY_ERROR_CATEGORIES.INVALID_REQUEST,
      message: "frequency must be one of: one_time, weekly, monthly, yearly."
    });
  }

  if (issues.length > 0) {
    throw new ItemQueryError({
      message: "Item update request is invalid.",
      category: ITEM_QUERY_ERROR_CATEGORIES.INVALID_REQUEST,
      issues
    });
  }

  return {
    itemId: payload.itemId,
    scope,
    actorUserId: ownerUserId,
    attributes: payload.attributes,
    type: subtype || null,
    frequency: frequency || null,
    now: payload.now instanceof Date ? payload.now : payload.now ? new Date(payload.now) : new Date()
  };
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
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

function throwNotFound(itemId) {
  throw new ItemQueryError({
    message: "Item update target not found.",
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

function throwInvalidState(itemId) {
  throw new ItemQueryError({
    message: "Cannot update a soft-deleted item.",
    category: ITEM_QUERY_ERROR_CATEGORIES.INVALID_STATE,
    issues: [
      {
        field: "item_id",
        code: "item_soft_deleted",
        category: ITEM_QUERY_ERROR_CATEGORIES.INVALID_STATE,
        message: "Soft-deleted items are immutable.",
        meta: { itemId }
      }
    ]
  });
}

function throwInvalidSubtypeUsage(itemId) {
  throw new ItemQueryError({
    message: "Financial subtype can only be changed for FinancialItem records.",
    category: ITEM_QUERY_ERROR_CATEGORIES.INVALID_REQUEST,
    issues: [
      {
        field: "type",
        code: "invalid_financial_subtype_target",
        category: ITEM_QUERY_ERROR_CATEGORIES.INVALID_REQUEST,
        message: "type updates are only supported for FinancialItem records.",
        meta: { itemId }
      }
    ]
  });
}

function throwInvalidFrequencyUsage(itemId) {
  throw new ItemQueryError({
    message: "Financial frequency can only be changed for FinancialItem records.",
    category: ITEM_QUERY_ERROR_CATEGORIES.INVALID_REQUEST,
    issues: [
      {
        field: "frequency",
        code: "invalid_financial_frequency_target",
        category: ITEM_QUERY_ERROR_CATEGORIES.INVALID_REQUEST,
        message: "frequency updates are only supported for FinancialItem records.",
        meta: { itemId }
      }
    ]
  });
}

async function updateItem(input) {
  const payload = normalizeInput(input);

  return sequelize.transaction(async (transaction) => {
    const item = await models.Item.findByPk(payload.itemId, { transaction });

    if (!item) {
      throwNotFound(payload.itemId);
    }

    if (!canAccessOwner(payload.scope, item.user_id)) {
      throwForbidden(payload.itemId, payload.actorUserId);
    }

    if (getDeletedAt(item)) {
      throwInvalidState(payload.itemId);
    }

    if (payload.type && item.item_type !== "FinancialItem") {
      throwInvalidSubtypeUsage(payload.itemId);
    }

    if (payload.frequency && item.item_type !== "FinancialItem") {
      throwInvalidFrequencyUsage(payload.itemId);
    }

    item.attributes = {
      ...(isPlainObject(item.attributes) ? item.attributes : {}),
      ...payload.attributes
    };

    if (payload.type) {
      item.type = payload.type;
      item.attributes = {
        ...item.attributes,
        financialSubtype: payload.type
      };
    }

    if (payload.frequency) {
      item.frequency = payload.frequency;
      item.attributes = {
        ...item.attributes,
        billingCycle: payload.frequency
      };
    }

    if (item.item_type === "FinancialItem") {
      const attributes = isPlainObject(item.attributes) ? { ...item.attributes } : {};
      const recurring = typeof item.frequency === "string" && item.frequency !== "one_time";
      const normalizedAmount = toFiniteNumber(attributes.amount) ?? toFiniteNumber(attributes.nextPaymentAmount);

      if (normalizedAmount !== null) {
        attributes.amount = normalizedAmount;
        item.default_amount = normalizedAmount;
      }

      delete attributes.nextPaymentAmount;

      if (recurring && attributes.dynamicTrackingEnabled === undefined) {
        attributes.dynamicTrackingEnabled = true;
      }

      const subtype = item.type || attributes.financialSubtype;

      if (recurring && subtype === "Commitment" && attributes.trackingStartingRemainingBalance === undefined) {
        const startingRemaining = toFiniteNumber(attributes.remainingBalance) ?? toFiniteNumber(attributes.originalPrincipal);
        if (startingRemaining !== null) {
          attributes.trackingStartingRemainingBalance = startingRemaining;
        }
      }

      if (recurring && subtype === "Income" && attributes.trackingStartingCollectedTotal === undefined) {
        attributes.trackingStartingCollectedTotal = toFiniteNumber(attributes.collectedTotal) ?? 0;
      }

      item.attributes = attributes;
    }

    await item.save({ transaction });
    await syncItemEvent({ item, models, transaction });

    const attribution = resolveAuditAttribution(payload);

    await models.AuditLog.create(
      {
        user_id: attribution.actorUserId,
        actor_user_id: attribution.actorUserId,
        lens_user_id: attribution.lensUserId,
        action: "item.updated",
        entity: `item:${item.id}`,
        timestamp: payload.now
      },
      { transaction }
    );

    return toCanonicalItem(item);
  });
}

module.exports = {
  updateItem
};
