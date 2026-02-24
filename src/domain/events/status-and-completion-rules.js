"use strict";

const EVENT_STATUSES = Object.freeze(["Pending", "Completed"]);

function isValidDateValue(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) === false;
  }

  if (typeof value === "string" || typeof value === "number") {
    return Number.isNaN(new Date(value).getTime()) === false;
  }

  return false;
}

function assertValidDueDate(value) {
  if (isValidDateValue(value) === false) {
    throw new Error("due_date must be a valid date");
  }
}

function assertNonNegativeAmount(value) {
  const amount = Number(value);

  if (Number.isFinite(amount) === false) {
    throw new Error("amount must be a valid number");
  }

  if (amount < 0) {
    throw new Error("amount cannot be negative");
  }
}

function assertCompletionTimestamp(status, completedAt) {
  if (status === "Completed" && isValidDateValue(completedAt) === false) {
    throw new Error("completed_at is required when status is Completed");
  }
}

function isVerbStyleAuditAction(value) {
  return typeof value === "string" && /^[a-z]+(?:\.[a-z]+)+$/.test(value);
}

function assertVerbStyleAuditAction(value) {
  if (isVerbStyleAuditAction(value) === false) {
    throw new Error("action must use verb-style dot notation (for example event.completed)");
  }
}

module.exports = {
  EVENT_STATUSES,
  assertValidDueDate,
  assertNonNegativeAmount,
  assertCompletionTimestamp,
  assertVerbStyleAuditAction,
  isVerbStyleAuditAction
};
