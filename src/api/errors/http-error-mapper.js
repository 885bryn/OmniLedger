"use strict";

const { ItemCreateValidationError, ITEM_CREATE_ERROR_CATEGORIES } = require("../../domain/items/item-create-errors");
const { ItemNetStatusError, ITEM_NET_STATUS_ERROR_CATEGORIES } = require("../../domain/items/item-net-status-errors");

const CATEGORY_MESSAGES = Object.freeze({
  [ITEM_CREATE_ERROR_CATEGORIES.INVALID_ITEM_TYPE]: "item_type is invalid. Choose one of the supported item types.",
  [ITEM_CREATE_ERROR_CATEGORIES.MISSING_MINIMUM_ATTRIBUTES]: "Some required attributes are missing for this item type.",
  [ITEM_CREATE_ERROR_CATEGORIES.PARENT_LINK_FAILURE]: "parent_item_id is invalid for this create request.",
  [ITEM_CREATE_ERROR_CATEGORIES.INVALID_PAYLOAD]: "Request payload is invalid."
});

const NET_STATUS_CATEGORY_MESSAGES = Object.freeze({
  [ITEM_NET_STATUS_ERROR_CATEGORIES.NOT_FOUND]: "No item exists for the provided id.",
  [ITEM_NET_STATUS_ERROR_CATEGORIES.FORBIDDEN]: "Item exists but is not owned by the requesting actor.",
  [ITEM_NET_STATUS_ERROR_CATEGORIES.WRONG_ROOT_TYPE]: "Only asset item types can be queried for net-status.",
  [ITEM_NET_STATUS_ERROR_CATEGORIES.INVALID_REQUEST]: "Request payload is invalid."
});

const NET_STATUS_CATEGORY_TO_STATUS = Object.freeze({
  [ITEM_NET_STATUS_ERROR_CATEGORIES.NOT_FOUND]: 404,
  [ITEM_NET_STATUS_ERROR_CATEGORIES.FORBIDDEN]: 403,
  [ITEM_NET_STATUS_ERROR_CATEGORIES.WRONG_ROOT_TYPE]: 422,
  [ITEM_NET_STATUS_ERROR_CATEGORIES.INVALID_REQUEST]: 422
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

function mapItemNetStatusError(error) {
  if (!(error instanceof ItemNetStatusError)) {
    return null;
  }

  const category = error.category || ITEM_NET_STATUS_ERROR_CATEGORIES.INVALID_REQUEST;
  const issues = Array.isArray(error.issues) ? error.issues.map(mapValidationIssue) : [];

  return {
    status: NET_STATUS_CATEGORY_TO_STATUS[category] || 422,
    body: {
      error: {
        code: "item_net_status_failed",
        category,
        message: error.message || NET_STATUS_CATEGORY_MESSAGES[category] || "Item net-status request failed.",
        issues
      }
    }
  };
}

module.exports = {
  mapItemCreateError,
  mapItemNetStatusError
};
