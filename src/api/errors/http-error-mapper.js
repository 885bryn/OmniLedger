"use strict";

const { ItemCreateValidationError, ITEM_CREATE_ERROR_CATEGORIES } = require("../../domain/items/item-create-errors");

const CATEGORY_MESSAGES = Object.freeze({
  [ITEM_CREATE_ERROR_CATEGORIES.INVALID_ITEM_TYPE]: "item_type is invalid. Choose one of the supported item types.",
  [ITEM_CREATE_ERROR_CATEGORIES.MISSING_MINIMUM_ATTRIBUTES]: "Some required attributes are missing for this item type.",
  [ITEM_CREATE_ERROR_CATEGORIES.PARENT_LINK_FAILURE]: "parent_item_id is invalid for this create request.",
  [ITEM_CREATE_ERROR_CATEGORIES.INVALID_PAYLOAD]: "Request payload is invalid."
});

function mapValidationIssue(issue) {
  return {
    field: issue.field || "unknown",
    code: issue.code || "validation_error",
    category: issue.category || ITEM_CREATE_ERROR_CATEGORIES.INVALID_PAYLOAD,
    message: issue.message || "Invalid value."
  };
}

function mapItemCreateError(error) {
  if (!(error instanceof ItemCreateValidationError)) {
    return null;
  }

  const issues = Array.isArray(error.issues) ? error.issues.map(mapValidationIssue) : [];
  const category = error.category || ITEM_CREATE_ERROR_CATEGORIES.INVALID_PAYLOAD;

  return {
    status: 422,
    body: {
      error: {
        code: "item_create_validation_failed",
        category,
        message: CATEGORY_MESSAGES[category] || "Item create validation failed.",
        issues
      }
    }
  };
}

module.exports = {
  mapItemCreateError
};
