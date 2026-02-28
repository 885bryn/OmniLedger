"use strict";

const EVENT_UPDATE_ERROR_CATEGORIES = Object.freeze({
  NOT_FOUND: "not_found",
  INVALID_REQUEST: "invalid_request",
  INVALID_STATE: "invalid_state"
});

class EventUpdateError extends Error {
  constructor({ message, category, issues = [] }) {
    super(message);
    this.name = "EventUpdateError";
    this.category = category;
    this.issues = Array.isArray(issues) ? issues : [];
  }
}

module.exports = {
  EVENT_UPDATE_ERROR_CATEGORIES,
  EventUpdateError
};
