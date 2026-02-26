"use strict";

const { sequelize, models } = require("../../db");
const { ITEM_TYPES } = require("../../db/models/item.model");
const { defaultAttributesByType } = require("./default-attributes");
const { minimumAttributeKeys } = require("./minimum-attribute-keys");
const { ItemCreateValidationError, ITEM_CREATE_ERROR_CATEGORIES } = require("./item-create-errors");
const { syncItemEvent } = require("./item-event-sync");

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

function isUuidLike(value) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
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

  if (ownerUserId === "") {
    issues.push({
      field: "user_id",
      code: "required",
      category: ITEM_CREATE_ERROR_CATEGORIES.INVALID_PAYLOAD,
      message: "user_id is required."
    });
  }

  if (ITEM_TYPES.includes(payload.item_type) === false) {
    issues.push({
      field: "item_type",
      code: "invalid_item_type",
      category: ITEM_CREATE_ERROR_CATEGORIES.INVALID_ITEM_TYPE,
      message: `item_type must be one of: ${ITEM_TYPES.join(", ")}.`
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

  const defaults = defaultAttributesByType[payload.item_type] || {};
  const attributes = isPlainObject(payload.attributes) ? payload.attributes : {};
  const mergedAttributes = { ...defaults, ...attributes };

  if (ITEM_TYPES.includes(payload.item_type)) {
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

  if (issues.length > 0) {
    throw buildValidationError(issues);
  }

  return {
    user_id: ownerUserId,
    item_type: payload.item_type,
    attributes: mergedAttributes,
    parent_item_id: payload.parent_item_id || null
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
      if (payload.parent_item_id) {
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

      const created = await models.Item.create(payload, { transaction });
      await syncItemEvent({ item: created, models, transaction });
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
