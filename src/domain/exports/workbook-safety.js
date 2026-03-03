"use strict";

const DEFAULT_EXPORT_LOCALE = "en-US";
const DEFAULT_EXPORT_TIMEZONE = "UTC";
const DEFAULT_INVALID_DATE_MARKER = "INVALID_DATE";
const DEFAULT_EMPTY_DATE_MARKER = "N/A";

const FORMULA_TRIGGER_PREFIX = /^[=+\-@]/;

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
    return true;
  } catch (_error) {
    return false;
  }
}

function sanitizeWorkbookTextCell(value) {
  if (typeof value !== "string") {
    return value;
  }

  if (FORMULA_TRIGGER_PREFIX.test(value)) {
    return `'${value}`;
  }

  return value;
}

function resolveExportDatePolicy(preferences = {}) {
  const locale = isNonEmptyString(preferences.locale) ? preferences.locale : DEFAULT_EXPORT_LOCALE;
  const preferredTimeZone =
    preferences.timeZone ||
    preferences.timezone ||
    preferences.tz;

  const timeZone = isNonEmptyString(preferredTimeZone) && isValidTimeZone(preferredTimeZone)
    ? preferredTimeZone
    : DEFAULT_EXPORT_TIMEZONE;

  const invalidDateMarker = isNonEmptyString(preferences.invalidDateMarker)
    ? preferences.invalidDateMarker
    : DEFAULT_INVALID_DATE_MARKER;

  const emptyDateMarker = isNonEmptyString(preferences.emptyDateMarker)
    ? preferences.emptyDateMarker
    : DEFAULT_EMPTY_DATE_MARKER;

  return {
    locale,
    timeZone,
    invalidDateMarker,
    emptyDateMarker
  };
}

function toPolicyDate(value, policy) {
  const parsedDate = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return policy.invalidDateMarker;
  }

  const formatter = new Intl.DateTimeFormat(policy.locale, {
    timeZone: policy.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(parsedDate);
  const yearPart = parts.find((part) => part.type === "year");
  const monthPart = parts.find((part) => part.type === "month");
  const dayPart = parts.find((part) => part.type === "day");

  if (!yearPart || !monthPart || !dayPart) {
    return policy.invalidDateMarker;
  }

  const year = Number(yearPart.value);
  const month = Number(monthPart.value);
  const day = Number(dayPart.value);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return policy.invalidDateMarker;
  }

  return new Date(Date.UTC(year, month - 1, day));
}

function toExportDateCell(value, preferences) {
  const policy = resolveExportDatePolicy(preferences);

  if (value === null || value === undefined || value === "") {
    return policy.emptyDateMarker;
  }

  return toPolicyDate(value, policy);
}

module.exports = {
  sanitizeWorkbookTextCell,
  resolveExportDatePolicy,
  toExportDateCell
};
