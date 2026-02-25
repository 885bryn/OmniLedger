"use strict";

const EVENT_COMPLETION_ERROR_CATEGORIES = Object.freeze({
  NOT_FOUND: "not_found",
  FORBIDDEN: "forbidden",
  INVALID_STATE: "invalid_state",
  INVALID_REQUEST: "invalid_request"
});

class EventCompletionError extends Error {
  constructor({ message, category, issues = [] }) {
    super(message);
    this.name = "EventCompletionError";
    this.category = category;
    this.issues = Array.isArray(issues) ? issues : [];
  }
}

module.exports = {
  EVENT_COMPLETION_ERROR_CATEGORIES,
  EventCompletionError
};
