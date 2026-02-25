"use strict";

const ITEM_QUERY_ERROR_CATEGORIES = Object.freeze({
  INVALID_REQUEST: "invalid_request",
  INVALID_FILTER: "invalid_filter",
  INVALID_SORT: "invalid_sort",
  NOT_FOUND: "not_found",
  FORBIDDEN: "forbidden",
  INVALID_STATE: "invalid_state"
});

class ItemQueryError extends Error {
  constructor({ message, category, issues = [] }) {
    super(message);
    this.name = "ItemQueryError";
    this.category = category;
    this.issues = Array.isArray(issues) ? issues : [];
  }
}

module.exports = {
  ITEM_QUERY_ERROR_CATEGORIES,
  ItemQueryError
};
