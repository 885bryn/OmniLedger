"use strict";

const { ItemCreateValidationError, ITEM_CREATE_ERROR_CATEGORIES } = require("../../domain/items/item-create-errors");
const { ItemNetStatusError, ITEM_NET_STATUS_ERROR_CATEGORIES } = require("../../domain/items/item-net-status-errors");
const { ItemQueryError, ITEM_QUERY_ERROR_CATEGORIES } = require("../../domain/items/item-query-errors");
const { EventCompletionError, EVENT_COMPLETION_ERROR_CATEGORIES } = require("../../domain/events/event-completion-errors");
const { EventQueryError, EVENT_QUERY_ERROR_CATEGORIES } = require("../../domain/events/event-query-errors");

const CATEGORY_MESSAGES = Object.freeze({
  [ITEM_CREATE_ERROR_CATEGORIES.INVALID_ITEM_TYPE]: "item_type is invalid. Choose one of the supported item types.",
  [ITEM_CREATE_ERROR_CATEGORIES.MISSING_MINIMUM_ATTRIBUTES]: "Some required attributes are missing for this item type.",
  [ITEM_CREATE_ERROR_CATEGORIES.PARENT_LINK_FAILURE]: "parent_item_id is invalid for this create request.",
  [ITEM_CREATE_ERROR_CATEGORIES.FINANCIAL_CONTRACT_INVALID]: "Financial item contract fields are invalid for this create request.",
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

const EVENT_COMPLETION_CATEGORY_MESSAGES = Object.freeze({
  [EVENT_COMPLETION_ERROR_CATEGORIES.NOT_FOUND]: "No event exists for the provided id.",
  [EVENT_COMPLETION_ERROR_CATEGORIES.FORBIDDEN]: "Event exists but is not owned by the requesting actor.",
  [EVENT_COMPLETION_ERROR_CATEGORIES.INVALID_STATE]: "Event completion transition is invalid for the current state.",
  [EVENT_COMPLETION_ERROR_CATEGORIES.INVALID_REQUEST]: "Request payload is invalid."
});

const EVENT_COMPLETION_CATEGORY_TO_STATUS = Object.freeze({
  [EVENT_COMPLETION_ERROR_CATEGORIES.NOT_FOUND]: 404,
  [EVENT_COMPLETION_ERROR_CATEGORIES.FORBIDDEN]: 403,
  [EVENT_COMPLETION_ERROR_CATEGORIES.INVALID_STATE]: 422,
  [EVENT_COMPLETION_ERROR_CATEGORIES.INVALID_REQUEST]: 422
});

const ITEM_QUERY_CATEGORY_MESSAGES = Object.freeze({
  [ITEM_QUERY_ERROR_CATEGORIES.INVALID_REQUEST]: "Item request is invalid.",
  [ITEM_QUERY_ERROR_CATEGORIES.INVALID_FILTER]: "One or more item filters are invalid.",
  [ITEM_QUERY_ERROR_CATEGORIES.INVALID_SORT]: "One or more item sort values are invalid.",
  [ITEM_QUERY_ERROR_CATEGORIES.NOT_FOUND]: "No item exists for the provided id.",
  [ITEM_QUERY_ERROR_CATEGORIES.FORBIDDEN]: "Item exists but is not owned by the requesting actor.",
  [ITEM_QUERY_ERROR_CATEGORIES.INVALID_STATE]: "Item request is invalid for the current item state."
});

const ITEM_QUERY_CATEGORY_TO_STATUS = Object.freeze({
  [ITEM_QUERY_ERROR_CATEGORIES.INVALID_REQUEST]: 422,
  [ITEM_QUERY_ERROR_CATEGORIES.INVALID_FILTER]: 422,
  [ITEM_QUERY_ERROR_CATEGORIES.INVALID_SORT]: 422,
  [ITEM_QUERY_ERROR_CATEGORIES.NOT_FOUND]: 404,
  [ITEM_QUERY_ERROR_CATEGORIES.FORBIDDEN]: 403,
  [ITEM_QUERY_ERROR_CATEGORIES.INVALID_STATE]: 422
});

const EVENT_QUERY_CATEGORY_MESSAGES = Object.freeze({
  [EVENT_QUERY_ERROR_CATEGORIES.INVALID_REQUEST]: "Event request is invalid.",
  [EVENT_QUERY_ERROR_CATEGORIES.INVALID_FILTER]: "One or more event filters are invalid.",
  [EVENT_QUERY_ERROR_CATEGORIES.INVALID_RANGE]: "One or more event range parameters are invalid."
});

const EVENT_QUERY_CATEGORY_TO_STATUS = Object.freeze({
  [EVENT_QUERY_ERROR_CATEGORIES.INVALID_REQUEST]: 422,
  [EVENT_QUERY_ERROR_CATEGORIES.INVALID_FILTER]: 422,
  [EVENT_QUERY_ERROR_CATEGORIES.INVALID_RANGE]: 422
});

const OWNERSHIP_DENIAL_MESSAGE = "You can only access your own records.";

function mapValidationIssue(issue) {
  return {
    field: issue.field || "unknown",
    code: issue.code || "validation_error",
    category: issue.category || ITEM_CREATE_ERROR_CATEGORIES.INVALID_PAYLOAD,
    message: issue.message || "Invalid value."
  };
}

function normalizeIssue(issue, category, fallbackCode) {
  return {
    field: issue.field || "unknown",
    code: issue.code || fallbackCode,
    category,
    message: issue.message || "Invalid value."
  };
}

function normalizeOwnershipIssue(issue) {
  return {
    field: issue.field || "unknown",
    code: "not_found",
    category: "not_found",
    message: OWNERSHIP_DENIAL_MESSAGE
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
  const isOwnershipDenied = category === ITEM_NET_STATUS_ERROR_CATEGORIES.FORBIDDEN;
  const responseCategory = isOwnershipDenied ? ITEM_NET_STATUS_ERROR_CATEGORIES.NOT_FOUND : category;
  const status = isOwnershipDenied ? 404 : NET_STATUS_CATEGORY_TO_STATUS[category] || 422;
  const issues = Array.isArray(error.issues)
    ? error.issues.map((issue) => (isOwnershipDenied ? normalizeOwnershipIssue(issue) : normalizeIssue(issue, responseCategory, "validation_error")))
    : [];

  return {
    status,
    body: {
      error: {
        code: "item_net_status_failed",
        category: responseCategory,
        message: isOwnershipDenied
          ? OWNERSHIP_DENIAL_MESSAGE
          : error.message || NET_STATUS_CATEGORY_MESSAGES[responseCategory] || "Item net-status request failed.",
        issues
      }
    }
  };
}

function mapEventCompletionError(error) {
  if (!(error instanceof EventCompletionError)) {
    return null;
  }

  const category = error.category || EVENT_COMPLETION_ERROR_CATEGORIES.INVALID_REQUEST;
  const isOwnershipDenied = category === EVENT_COMPLETION_ERROR_CATEGORIES.FORBIDDEN;
  const responseCategory = isOwnershipDenied ? EVENT_COMPLETION_ERROR_CATEGORIES.NOT_FOUND : category;
  const status = isOwnershipDenied ? 404 : EVENT_COMPLETION_CATEGORY_TO_STATUS[category] || 422;
  const issues = Array.isArray(error.issues)
    ? error.issues.map((issue) => (isOwnershipDenied ? normalizeOwnershipIssue(issue) : normalizeIssue(issue, responseCategory, "validation_error")))
    : [];

  return {
    status,
    body: {
      error: {
        code: "event_completion_failed",
        category: responseCategory,
        message: isOwnershipDenied
          ? OWNERSHIP_DENIAL_MESSAGE
          : error.message || EVENT_COMPLETION_CATEGORY_MESSAGES[responseCategory] || "Event completion request failed.",
        issues
      }
    }
  };
}

function mapItemQueryError(error) {
  if (!(error instanceof ItemQueryError)) {
    return null;
  }

  const category = error.category || ITEM_QUERY_ERROR_CATEGORIES.INVALID_REQUEST;
  const isOwnershipDenied = category === ITEM_QUERY_ERROR_CATEGORIES.FORBIDDEN;
  const responseCategory = isOwnershipDenied ? ITEM_QUERY_ERROR_CATEGORIES.NOT_FOUND : category;
  const status = isOwnershipDenied ? 404 : ITEM_QUERY_CATEGORY_TO_STATUS[category] || 422;
  const issues = Array.isArray(error.issues)
    ? error.issues.map((issue) => (isOwnershipDenied ? normalizeOwnershipIssue(issue) : normalizeIssue(issue, responseCategory, "validation_error")))
    : [];

  return {
    status,
    body: {
      error: {
        code: "item_query_failed",
        category: responseCategory,
        message: isOwnershipDenied
          ? OWNERSHIP_DENIAL_MESSAGE
          : error.message || ITEM_QUERY_CATEGORY_MESSAGES[responseCategory] || "Item request failed.",
        issues
      }
    }
  };
}

function mapEventQueryError(error) {
  if (!(error instanceof EventQueryError)) {
    return null;
  }

  const category = error.category || EVENT_QUERY_ERROR_CATEGORIES.INVALID_REQUEST;
  const issues = Array.isArray(error.issues) ? error.issues.map(mapValidationIssue) : [];

  return {
    status: EVENT_QUERY_CATEGORY_TO_STATUS[category] || 422,
    body: {
      error: {
        code: "event_query_failed",
        category,
        message: error.message || EVENT_QUERY_CATEGORY_MESSAGES[category] || "Event query failed.",
        issues
      }
    }
  };
}

module.exports = {
  mapItemCreateError,
  mapItemNetStatusError,
  mapEventCompletionError,
  mapItemQueryError,
  mapEventQueryError
};
