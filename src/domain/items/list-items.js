"use strict";

const { models } = require("../../db");
const { ItemQueryError, ITEM_QUERY_ERROR_CATEGORIES } = require("./item-query-errors");

const CANONICAL_ITEM_FIELDS = Object.freeze([
  "id",
  "user_id",
  "item_type",
  "attributes",
  "parent_item_id",
  "created_at",
  "updated_at"
]);

const FILTERS = Object.freeze(["all", "assets", "commitments", "active", "deleted"]);
const SORTS = Object.freeze(["recently_updated", "oldest_updated", "due_soon"]);
const ASSET_TYPES = new Set(["RealEstate", "Vehicle"]);
const COMMITMENT_TYPES = new Set(["FinancialCommitment", "Subscription"]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
}

function toComparableTime(value, fallback = Number.POSITIVE_INFINITY) {
  if (!value) {
    return fallback;
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? fallback : time;
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeInput(input) {
  const payload = isPlainObject(input) ? input : {};
  const actorUserId = normalizeString(payload.actorUserId);
  const search = normalizeString(payload.search).toLowerCase();
  const filter = normalizeString(payload.filter) || "all";
  const sort = normalizeString(payload.sort) || "recently_updated";
  const includeDeleted = Boolean(payload.includeDeleted);
  const issues = [];

  if (!actorUserId) {
    issues.push({
      field: "actorUserId",
      code: "required",
      category: ITEM_QUERY_ERROR_CATEGORIES.INVALID_REQUEST,
      message: "actorUserId is required."
    });
  }

  if (!FILTERS.includes(filter)) {
    issues.push({
      field: "filter",
      code: "unsupported_filter",
      category: ITEM_QUERY_ERROR_CATEGORIES.INVALID_FILTER,
      message: `filter must be one of: ${FILTERS.join(", ")}.`
    });
  }

  if (!SORTS.includes(sort)) {
    issues.push({
      field: "sort",
      code: "unsupported_sort",
      category: ITEM_QUERY_ERROR_CATEGORIES.INVALID_SORT,
      message: `sort must be one of: ${SORTS.join(", ")}.`
    });
  }

  if (issues.length > 0) {
    throw new ItemQueryError({
      message: "Item list query is invalid.",
      category: issues[0].category,
      issues
    });
  }

  return {
    actorUserId,
    search,
    filter,
    sort,
    includeDeleted
  };
}

function toCanonicalItem(itemInstance) {
  const raw = itemInstance.get({ plain: true });
  const normalizedRaw = {
    ...raw,
    created_at: raw.created_at || raw.createdAt,
    updated_at: raw.updated_at || raw.updatedAt
  };

  return CANONICAL_ITEM_FIELDS.reduce((output, key) => {
    output[key] = normalizedRaw[key];
    return output;
  }, {});
}

function getDeletedAt(item) {
  const attributes = item.attributes;
  if (!isPlainObject(attributes)) {
    return null;
  }

  if (typeof attributes._deleted_at !== "string") {
    return null;
  }

  const deletedAt = new Date(attributes._deleted_at).getTime();
  return Number.isNaN(deletedAt) ? null : attributes._deleted_at;
}

function isSoftDeleted(item) {
  return Boolean(getDeletedAt(item));
}

function normalizeForSearch(value) {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function matchesSearch(item, search) {
  if (!search) {
    return true;
  }

  const attrs = isPlainObject(item.attributes) ? item.attributes : {};
  const haystacks = [
    normalizeForSearch(item.item_type),
    ...Object.values(attrs).map((value) => normalizeForSearch(String(value || "")))
  ];

  return haystacks.some((value) => value.includes(search));
}

function applyFilter(items, filter) {
  if (filter === "all") {
    return items;
  }

  if (filter === "assets") {
    return items.filter((item) => ASSET_TYPES.has(item.item_type));
  }

  if (filter === "commitments") {
    return items.filter((item) => COMMITMENT_TYPES.has(item.item_type));
  }

  if (filter === "active") {
    return items.filter((item) => !isSoftDeleted(item));
  }

  return items.filter((item) => isSoftDeleted(item));
}

function dueDateKey(item) {
  if (!isPlainObject(item.attributes)) {
    return Number.POSITIVE_INFINITY;
  }

  const rawDueDate = item.attributes.dueDate || item.attributes.due_date;
  return toComparableTime(rawDueDate, Number.POSITIVE_INFINITY);
}

function compareByRecentlyUpdated(left, right) {
  const updatedDiff = toComparableTime(right.updated_at, 0) - toComparableTime(left.updated_at, 0);
  if (updatedDiff !== 0) {
    return updatedDiff;
  }

  const createdDiff = toComparableTime(right.created_at, 0) - toComparableTime(left.created_at, 0);
  if (createdDiff !== 0) {
    return createdDiff;
  }

  return left.id.localeCompare(right.id);
}

function compareByOldestUpdated(left, right) {
  const updatedDiff = toComparableTime(left.updated_at, Number.POSITIVE_INFINITY) - toComparableTime(right.updated_at, Number.POSITIVE_INFINITY);
  if (updatedDiff !== 0) {
    return updatedDiff;
  }

  const createdDiff = toComparableTime(left.created_at, Number.POSITIVE_INFINITY) - toComparableTime(right.created_at, Number.POSITIVE_INFINITY);
  if (createdDiff !== 0) {
    return createdDiff;
  }

  return left.id.localeCompare(right.id);
}

function compareByDueSoon(left, right) {
  const dueDiff = dueDateKey(left) - dueDateKey(right);
  if (dueDiff !== 0) {
    return dueDiff;
  }

  return compareByRecentlyUpdated(left, right);
}

function applySort(items, sort) {
  if (sort === "due_soon") {
    return [...items].sort(compareByDueSoon);
  }

  if (sort === "oldest_updated") {
    return [...items].sort(compareByOldestUpdated);
  }

  return [...items].sort(compareByRecentlyUpdated);
}

async function listItems(input) {
  const query = normalizeInput(input);
  const rows = await models.Item.findAll({
    where: {
      user_id: query.actorUserId
    }
  });

  const canonicalItems = rows.map(toCanonicalItem);
  const visibilityFiltered = query.includeDeleted ? canonicalItems : canonicalItems.filter((item) => !isSoftDeleted(item));
  const filteredItems = applyFilter(visibilityFiltered, query.filter).filter((item) => matchesSearch(item, query.search));
  const sortedItems = applySort(filteredItems, query.sort);

  return {
    items: sortedItems,
    total_count: sortedItems.length
  };
}

module.exports = {
  listItems
};
