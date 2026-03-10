"use strict";

const { sequelize, models } = require("../../db");
const { defaultAttributesByType } = require("./default-attributes");
const { minimumAttributeKeys } = require("./minimum-attribute-keys");
const { ItemCreateValidationError, ITEM_CREATE_ERROR_CATEGORIES } = require("./item-create-errors");
const { syncItemEvent } = require("./item-event-sync");

const FINANCIAL_ITEM_TYPE = "FinancialItem";
const SUPPORTED_ITEM_TYPES = Object.freeze(["RealEstate", "Vehicle", "FinancialItem"]);
const FINANCIAL_SUBTYPES = Object.freeze(["Commitment", "Income"]);
const FINANCIAL_FREQUENCIES = Object.freeze(["one_time", "weekly", "monthly", "yearly"]);
const FINANCIAL_STATUSES = Object.freeze(["Active", "Closed"]);
const ASSET_ITEM_TYPES = new Set(["RealEstate", "Vehicle"]);

const CANONICAL_ITEM_FIELDS = Object.freeze([
  "id",
  "user_id",
  "item_type",
  "attributes",
  "parent_item_id",
  "title",
  "type",
  "frequency",
  "default_amount",
  "status",
  "linked_asset_item_id",
  "created_at",
  "updated_at"
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
}

function isUuidLike(value) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
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

function buildValidationError(issues) {
  const categories = issues.map((issue) => issue.category);

  if (categories.includes(ITEM_CREATE_ERROR_CATEGORIES.INVALID_ITEM_TYPE)) {
    return new ItemCreateValidationError({
      message: "Item create validation failed: invalid item_type.",
      category: ITEM_CREATE_ERROR_CATEGORIES.INVALID_ITEM_TYPE,
      issues
    });
  }

  if (categories.includes(ITEM_CREATE_ERROR_CATEGORIES.PARENT_LINK_FAILURE)) {
    return new ItemCreateValidationError({
      message: "Item create validation failed: parent link is invalid.",
      category: ITEM_CREATE_ERROR_CATEGORIES.PARENT_LINK_FAILURE,
      issues
    });
  }

  if (categories.includes(ITEM_CREATE_ERROR_CATEGORIES.MISSING_MINIMUM_ATTRIBUTES)) {
    return new ItemCreateValidationError({
      message: "Item create validation failed: required attributes are missing.",
      category: ITEM_CREATE_ERROR_CATEGORIES.MISSING_MINIMUM_ATTRIBUTES,
      issues
    });
  }

  if (categories.includes(ITEM_CREATE_ERROR_CATEGORIES.FINANCIAL_CONTRACT_INVALID)) {
    return new ItemCreateValidationError({
      message: "Item create validation failed: financial contract fields are invalid.",
      category: ITEM_CREATE_ERROR_CATEGORIES.FINANCIAL_CONTRACT_INVALID,
      issues
    });
  }

  return new ItemCreateValidationError({
    message: "Item create validation failed.",
    category: ITEM_CREATE_ERROR_CATEGORIES.INVALID_PAYLOAD,
    issues
  });
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
  const scopeActorUserId = typeof scope.actorUserId === "string" ? scope.actorUserId.trim() : "";
  const ownerUserId = scopeActorUserId || (typeof payload.user_id === "string" ? payload.user_id.trim() : "");
  const issues = [];
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const subtype = typeof payload.type === "string" ? payload.type.trim() : "";
  const frequency = typeof payload.frequency === "string" ? payload.frequency.trim().toLowerCase() : "";
  const status = typeof payload.status === "string" ? payload.status.trim() : "";
  const defaultAmount = payload.default_amount;
  const linkedAssetItemId = payload.linked_asset_item_id;
  const confirmUnlinkedAsset = payload.confirm_unlinked_asset === true;

  if (ownerUserId === "") {
    issues.push({
      field: "user_id",
      code: "required",
      category: ITEM_CREATE_ERROR_CATEGORIES.INVALID_PAYLOAD,
      message: "user_id is required."
    });
  }

  if (SUPPORTED_ITEM_TYPES.includes(payload.item_type) === false) {
    issues.push({
      field: "item_type",
      code: "invalid_item_type",
      category: ITEM_CREATE_ERROR_CATEGORIES.INVALID_ITEM_TYPE,
      message: `item_type must be one of: ${SUPPORTED_ITEM_TYPES.join(", ")}.`
    });
  }

  if (payload.attributes !== undefined && isPlainObject(payload.attributes) === false) {
    issues.push({
      field: "attributes",
      code: "invalid_attributes",
      category: ITEM_CREATE_ERROR_CATEGORIES.INVALID_PAYLOAD,
      message: "attributes must be a JSON object."
    });
  }

  if (payload.parent_item_id !== undefined && payload.parent_item_id !== null && isUuidLike(payload.parent_item_id) === false) {
    issues.push({
      field: "parent_item_id",
      code: "invalid_parent_item_id",
      category: ITEM_CREATE_ERROR_CATEGORIES.PARENT_LINK_FAILURE,
      message: "parent_item_id must be a valid UUID."
    });
  }

  if (linkedAssetItemId !== undefined && linkedAssetItemId !== null && isUuidLike(linkedAssetItemId) === false) {
    issues.push({
      field: "linked_asset_item_id",
      code: "invalid_linked_asset_item_id",
      category: ITEM_CREATE_ERROR_CATEGORIES.FINANCIAL_CONTRACT_INVALID,
      message: "linked_asset_item_id must be a valid UUID."
    });
  }

  const defaults = defaultAttributesByType[payload.item_type] || {};
  const attributes = isPlainObject(payload.attributes) ? payload.attributes : {};
  const mergedAttributes = { ...defaults, ...attributes };

  if (SUPPORTED_ITEM_TYPES.includes(payload.item_type)) {
    const requiredKeys = minimumAttributeKeys[payload.item_type] || [];
    const missingKeys = requiredKeys.filter((key) => mergedAttributes[key] === undefined || mergedAttributes[key] === null || mergedAttributes[key] === "");

    if (missingKeys.length > 0) {
      issues.push({
        field: "attributes",
        code: "missing_minimum_keys",
        category: ITEM_CREATE_ERROR_CATEGORIES.MISSING_MINIMUM_ATTRIBUTES,
        message: `attributes missing minimum keys: ${missingKeys.join(", ")}`,
        meta: { missingKeys }
      });
    }
  }

  if (payload.item_type === FINANCIAL_ITEM_TYPE) {
    const isRecurringContract = frequency && frequency !== "one_time";

    if (title === "") {
      issues.push({
        field: "title",
        code: "required",
        category: ITEM_CREATE_ERROR_CATEGORIES.FINANCIAL_CONTRACT_INVALID,
        message: "title is required for FinancialItem."
      });
    }

    if (FINANCIAL_SUBTYPES.includes(subtype) === false) {
      issues.push({
        field: "type",
        code: "invalid_financial_subtype",
        category: ITEM_CREATE_ERROR_CATEGORIES.FINANCIAL_CONTRACT_INVALID,
        message: `type must be one of: ${FINANCIAL_SUBTYPES.join(", ")}.`
      });
    }

    if (FINANCIAL_FREQUENCIES.includes(frequency) === false) {
      issues.push({
        field: "frequency",
        code: "invalid_financial_frequency",
        category: ITEM_CREATE_ERROR_CATEGORIES.FINANCIAL_CONTRACT_INVALID,
        message: `frequency must be one of: ${FINANCIAL_FREQUENCIES.join(", ")}.`
      });
    }

    if (FINANCIAL_STATUSES.includes(status) === false) {
      issues.push({
        field: "status",
        code: "invalid_financial_status",
        category: ITEM_CREATE_ERROR_CATEGORIES.FINANCIAL_CONTRACT_INVALID,
        message: `status must be one of: ${FINANCIAL_STATUSES.join(", ")}.`
      });
    }

    if (!Number.isFinite(Number(defaultAmount)) || Number(defaultAmount) < 0) {
      issues.push({
        field: "default_amount",
        code: "invalid_default_amount",
        category: ITEM_CREATE_ERROR_CATEGORIES.FINANCIAL_CONTRACT_INVALID,
        message: "default_amount must be a non-negative number."
      });
    }

    if (!linkedAssetItemId && !confirmUnlinkedAsset) {
      issues.push({
        field: "confirm_unlinked_asset",
        code: "linked_asset_confirmation_required",
        category: ITEM_CREATE_ERROR_CATEGORIES.FINANCIAL_CONTRACT_INVALID,
        message: "confirm_unlinked_asset must be true when linked_asset_item_id is omitted."
      });
    }

    if (title !== "" && (mergedAttributes.name === undefined || mergedAttributes.name === null || String(mergedAttributes.name).trim() === "")) {
      mergedAttributes.name = title;
    }

    if (subtype && (mergedAttributes.financialSubtype === undefined || mergedAttributes.financialSubtype === null || String(mergedAttributes.financialSubtype).trim() === "")) {
      mergedAttributes.financialSubtype = subtype;
    }

    if (frequency && (mergedAttributes.billingCycle === undefined || mergedAttributes.billingCycle === null || String(mergedAttributes.billingCycle).trim() === "")) {
      mergedAttributes.billingCycle = frequency;
    }

    if (status && (mergedAttributes.status === undefined || mergedAttributes.status === null || String(mergedAttributes.status).trim() === "")) {
      mergedAttributes.status = status;
    }

    if (linkedAssetItemId && (mergedAttributes.linkedAssetItemId === undefined || mergedAttributes.linkedAssetItemId === null || String(mergedAttributes.linkedAssetItemId).trim() === "")) {
      mergedAttributes.linkedAssetItemId = linkedAssetItemId;
    }

    if (linkedAssetItemId && (mergedAttributes.parentItemId === undefined || mergedAttributes.parentItemId === null || String(mergedAttributes.parentItemId).trim() === "")) {
      mergedAttributes.parentItemId = linkedAssetItemId;
    }

    if (Number.isFinite(Number(defaultAmount))) {
      const normalizedDefaultAmount = Number(defaultAmount);

      if (mergedAttributes.amount === undefined || mergedAttributes.amount === null || Number.isFinite(Number(mergedAttributes.amount)) === false) {
        mergedAttributes.amount = normalizedDefaultAmount;
      }
    }

    if (isRecurringContract && mergedAttributes.dynamicTrackingEnabled === undefined) {
      mergedAttributes.dynamicTrackingEnabled = true;
    }

    if (isRecurringContract && subtype === "Commitment" && mergedAttributes.trackingStartingRemainingBalance === undefined) {
      const startingRemaining = toFiniteNumber(mergedAttributes.remainingBalance)
        ?? toFiniteNumber(mergedAttributes.originalPrincipal);

      if (startingRemaining !== null) {
        mergedAttributes.trackingStartingRemainingBalance = startingRemaining;
      }
    }

    if (isRecurringContract && subtype === "Income" && mergedAttributes.trackingStartingCollectedTotal === undefined) {
      const startingCollected = toFiniteNumber(mergedAttributes.collectedTotal) ?? 0;
      mergedAttributes.trackingStartingCollectedTotal = startingCollected;
    }
  }

  if (issues.length > 0) {
    throw buildValidationError(issues);
  }

  const parentItemId = payload.parent_item_id || null;
  const effectiveParentItemId = payload.item_type === FINANCIAL_ITEM_TYPE ? parentItemId || linkedAssetItemId || null : parentItemId;

  return {
    scope,
    user_id: ownerUserId,
    item_type: payload.item_type,
    attributes: mergedAttributes,
    parent_item_id: effectiveParentItemId,
    title: title || null,
    type: subtype || null,
    frequency: frequency || null,
    default_amount: defaultAmount === undefined || defaultAmount === null ? null : Number(defaultAmount),
    status: status || null,
    linked_asset_item_id: linkedAssetItemId || null,
    confirm_unlinked_asset: confirmUnlinkedAsset,
    now: payload.now instanceof Date ? payload.now : payload.now ? new Date(payload.now) : new Date()
  };
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function resolveAuditAttribution(payload) {
  const scope = isPlainObject(payload.scope) ? payload.scope : {};
  const actorUserId = normalizeString(scope.actorUserId) || normalizeString(payload.user_id);
  const mode = scope.mode === "all" ? "all" : "owner";
  const scopedLensUserId = normalizeString(scope.lensUserId) || null;
  const lensUserId = scopedLensUserId || (mode === "owner" ? actorUserId : null);

  return {
    actorUserId,
    lensUserId
  };
}

function mapSequelizeValidationError(error) {
  if (!error || error.name !== "SequelizeValidationError" || Array.isArray(error.errors) === false) {
    return null;
  }

  const issues = error.errors.map((issue) => {
    let category = ITEM_CREATE_ERROR_CATEGORIES.INVALID_PAYLOAD;

    if (issue.path === "item_type") {
      category = ITEM_CREATE_ERROR_CATEGORIES.INVALID_ITEM_TYPE;
    } else if (issue.path === "parent_item_id") {
      category = ITEM_CREATE_ERROR_CATEGORIES.PARENT_LINK_FAILURE;
    } else if (issue.path === "attributes" && /minimum keys/i.test(issue.message)) {
      category = ITEM_CREATE_ERROR_CATEGORIES.MISSING_MINIMUM_ATTRIBUTES;
    } else if (["title", "type", "frequency", "default_amount", "status", "linked_asset_item_id"].includes(issue.path)) {
      category = ITEM_CREATE_ERROR_CATEGORIES.FINANCIAL_CONTRACT_INVALID;
    }

    return {
      field: issue.path || "unknown",
      code: issue.validatorKey || "validation_error",
      category,
      message: issue.message
    };
  });

  return buildValidationError(issues);
}

async function createItem(input) {
  const payload = normalizeInput(input);

  try {
    return await sequelize.transaction(async (transaction) => {
      const parentDerivedFromLinkedAsset =
        payload.item_type === FINANCIAL_ITEM_TYPE &&
        payload.parent_item_id &&
        payload.linked_asset_item_id &&
        payload.parent_item_id === payload.linked_asset_item_id;

      if (payload.parent_item_id && !parentDerivedFromLinkedAsset) {
        const parent = await models.Item.findByPk(payload.parent_item_id, { transaction });

        if (!parent) {
          throw new ItemCreateValidationError({
            message: "Item create validation failed: parent link is invalid.",
            category: ITEM_CREATE_ERROR_CATEGORIES.PARENT_LINK_FAILURE,
            issues: [
              {
                field: "parent_item_id",
                code: "parent_not_found",
                category: ITEM_CREATE_ERROR_CATEGORIES.PARENT_LINK_FAILURE,
                message: "parent_item_id does not reference an existing item."
              }
            ]
          });
        }

        if (parent.user_id !== payload.user_id) {
          throw new ItemCreateValidationError({
            message: "Item create validation failed: parent link is invalid.",
            category: ITEM_CREATE_ERROR_CATEGORIES.PARENT_LINK_FAILURE,
            issues: [
              {
                field: "parent_item_id",
                code: "parent_owner_mismatch",
                category: ITEM_CREATE_ERROR_CATEGORIES.PARENT_LINK_FAILURE,
                message: "parent_item_id does not reference an existing item."
              }
            ]
          });
        }
      }

      if (payload.item_type === FINANCIAL_ITEM_TYPE && payload.linked_asset_item_id) {
        const linkedAssetItem = await models.Item.findByPk(payload.linked_asset_item_id, { transaction });

        if (!linkedAssetItem) {
          throw new ItemCreateValidationError({
            message: "Item create validation failed: linked asset is invalid.",
            category: ITEM_CREATE_ERROR_CATEGORIES.FINANCIAL_CONTRACT_INVALID,
            issues: [
              {
                field: "linked_asset_item_id",
                code: "linked_asset_not_found",
                category: ITEM_CREATE_ERROR_CATEGORIES.FINANCIAL_CONTRACT_INVALID,
                message: "linked_asset_item_id does not reference an existing asset item."
              }
            ]
          });
        }

        if (linkedAssetItem.user_id !== payload.user_id) {
          throw new ItemCreateValidationError({
            message: "Item create validation failed: linked asset is invalid.",
            category: ITEM_CREATE_ERROR_CATEGORIES.FINANCIAL_CONTRACT_INVALID,
            issues: [
              {
                field: "linked_asset_item_id",
                code: "linked_asset_owner_mismatch",
                category: ITEM_CREATE_ERROR_CATEGORIES.FINANCIAL_CONTRACT_INVALID,
                message: "linked_asset_item_id does not reference an existing asset item."
              }
            ]
          });
        }

        if (!ASSET_ITEM_TYPES.has(linkedAssetItem.item_type)) {
          throw new ItemCreateValidationError({
            message: "Item create validation failed: linked asset is invalid.",
            category: ITEM_CREATE_ERROR_CATEGORIES.FINANCIAL_CONTRACT_INVALID,
            issues: [
              {
                field: "linked_asset_item_id",
                code: "linked_asset_wrong_type",
                category: ITEM_CREATE_ERROR_CATEGORIES.FINANCIAL_CONTRACT_INVALID,
                message: "linked_asset_item_id must reference an asset item."
              }
            ]
          });
        }
      }

      const created = await models.Item.create(payload, { transaction });
      await syncItemEvent({ item: created, models, transaction, mode: "create" });

      const attribution = resolveAuditAttribution(payload);
      await models.AuditLog.create(
        {
          user_id: attribution.actorUserId,
          actor_user_id: attribution.actorUserId,
          lens_user_id: attribution.lensUserId,
          action: "item.created",
          entity: `item:${created.id}`,
          timestamp: payload.now
        },
        { transaction }
      );

      return toCanonicalItem(created);
    });
  } catch (error) {
    if (error instanceof ItemCreateValidationError) {
      throw error;
    }

    const mapped = mapSequelizeValidationError(error);
    if (mapped) {
      throw mapped;
    }

    throw error;
  }
}

module.exports = {
  createItem
};
