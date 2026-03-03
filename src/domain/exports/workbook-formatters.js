"use strict";

const { toExportDateCell } = require("./workbook-safety");

const EXPLICIT_MARKERS = Object.freeze({
  notAvailable: "N/A",
  unresolved: "UNLINKED",
  invalidDate: "INVALID_DATE"
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
}

function toExplicitMarker(value, marker = EXPLICIT_MARKERS.notAvailable) {
  if (value === null || value === undefined || value === "") {
    return marker;
  }

  return value;
}

function formatEnumLabel(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return EXPLICIT_MARKERS.notAvailable;
  }

  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[\s_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}

function toFiniteNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function formatAmount(value) {
  const amount = toFiniteNumber(value);
  if (amount === null) {
    return EXPLICIT_MARKERS.notAvailable;
  }

  return amount.toFixed(2);
}

function formatDate(value, preferences) {
  const normalized = toExportDateCell(value, preferences);
  if (normalized instanceof Date) {
    return normalized.toISOString().slice(0, 10);
  }

  if (typeof normalized === "string" && /^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  if (normalized === EXPLICIT_MARKERS.notAvailable) {
    return EXPLICIT_MARKERS.notAvailable;
  }

  return EXPLICIT_MARKERS.notAvailable;
}

function normalizeAttributes(attributes) {
  return isPlainObject(attributes) ? attributes : {};
}

function normalizeText(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function flattenAttributes(attributes, baselineMap) {
  const source = normalizeAttributes(attributes);
  const consumedKeys = new Set();
  const flattened = {};

  Object.entries(baselineMap).forEach(([targetKey, sourceKeys]) => {
    const candidates = Array.isArray(sourceKeys) ? sourceKeys : [];
    let matchedValue = null;

    candidates.forEach((sourceKey) => {
      if (matchedValue !== null) {
        return;
      }

      if (Object.prototype.hasOwnProperty.call(source, sourceKey)) {
        const candidate = source[sourceKey];
        if (candidate !== undefined && candidate !== null && candidate !== "") {
          matchedValue = candidate;
          consumedKeys.add(sourceKey);
        }
      }
    });

    flattened[targetKey] = matchedValue;
  });

  const overflow = {};
  Object.keys(source)
    .sort((left, right) => left.localeCompare(right))
    .forEach((key) => {
      if (!consumedKeys.has(key)) {
        overflow[key] = source[key];
      }
    });

  return {
    flattened,
    overflowText: Object.keys(overflow).length === 0 ? EXPLICIT_MARKERS.notAvailable : JSON.stringify(overflow)
  };
}

function resolveReadableReference(linkId, linkedRow) {
  if (!normalizeText(linkId)) {
    return {
      id: EXPLICIT_MARKERS.notAvailable,
      label: EXPLICIT_MARKERS.notAvailable
    };
  }

  if (!linkedRow) {
    return {
      id: linkId,
      label: EXPLICIT_MARKERS.unresolved
    };
  }

  const title = normalizeText(linkedRow.title);
  const attributes = normalizeAttributes(linkedRow.attributes);
  const fallbackName = normalizeText(attributes.name);

  return {
    id: linkId,
    label: toExplicitMarker(title || fallbackName)
  };
}

module.exports = {
  EXPLICIT_MARKERS,
  flattenAttributes,
  formatAmount,
  formatDate,
  formatEnumLabel,
  normalizeAttributes,
  resolveReadableReference,
  toExplicitMarker
};
