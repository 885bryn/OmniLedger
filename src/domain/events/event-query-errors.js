"use strict";

const EVENT_QUERY_ERROR_CATEGORIES = Object.freeze({
  INVALID_REQUEST: "invalid_request",
  INVALID_FILTER: "invalid_filter",
  INVALID_RANGE: "invalid_range"
});

class EventQueryError extends Error {
  constructor({ message, category, issues = [] }) {
    super(message);
    this.name = "EventQueryError";
    this.category = category;
    this.issues = Array.isArray(issues) ? issues : [];
  }
}

module.exports = {
  EVENT_QUERY_ERROR_CATEGORIES,
  EventQueryError
};
