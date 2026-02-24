"use strict";

const ITEM_CREATE_ERROR_CATEGORIES = Object.freeze({
  INVALID_ITEM_TYPE: "invalid_item_type",
  MISSING_MINIMUM_ATTRIBUTES: "missing_minimum_attributes",
  PARENT_LINK_FAILURE: "parent_link_failure",
  INVALID_PAYLOAD: "invalid_payload"
});

class ItemCreateValidationError extends Error {
  constructor({ message, category, issues = [] }) {
    super(message);
    this.name = "ItemCreateValidationError";
    this.category = category;
    this.issues = Array.isArray(issues) ? issues : [];
  }
}

module.exports = {
  ITEM_CREATE_ERROR_CATEGORIES,
  ItemCreateValidationError
};
