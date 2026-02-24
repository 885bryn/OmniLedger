"use strict";

const ITEM_NET_STATUS_ERROR_CATEGORIES = Object.freeze({
  NOT_FOUND: "not_found",
  FORBIDDEN: "forbidden",
  WRONG_ROOT_TYPE: "wrong_root_type",
  INVALID_REQUEST: "invalid_request"
});

class ItemNetStatusError extends Error {
  constructor({ message, category, issues = [] }) {
    super(message);
    this.name = "ItemNetStatusError";
    this.category = category;
    this.issues = Array.isArray(issues) ? issues : [];
  }
}

module.exports = {
  ITEM_NET_STATUS_ERROR_CATEGORIES,
  ItemNetStatusError
};
