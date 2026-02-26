"use strict";

const { Op } = require("sequelize");
const { models } = require("../../db");
const { ItemNetStatusError, ITEM_NET_STATUS_ERROR_CATEGORIES } = require("./item-net-status-errors");

const CANONICAL_ITEM_FIELDS = Object.freeze([
  "id",
  "user_id",
  "item_type",
  "title",
  "type",
  "frequency",
  "default_amount",
  "status",
  "linked_asset_item_id",
  "attributes",
  "parent_item_id",
  "created_at",
  "updated_at"
]);

const ROOT_ITEM_TYPES = new Set(["RealEstate", "Vehicle"]);
const CASHFLOW_ITEM_TYPES = new Set(["FinancialCommitment", "FinancialIncome", "FinancialItem"]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
}

function getDeletedAt(item) {
  const attributes = isPlainObject(item.attributes) ? item.attributes : {};
  const deletedAt = attributes._deleted_at;

  if (typeof deletedAt !== "string") {
    return null;
  }

  return Number.isNaN(new Date(deletedAt).getTime()) ? null : deletedAt;
}

function isSoftDeleted(item) {
  return Boolean(getDeletedAt(item));
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

function toComparableTime(value) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function deriveDueDateKey(item) {
  const attributes = item.attributes;

  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
    return null;
  }

  const dueDateValue = attributes.dueDate || attributes.due_date;
  if (!dueDateValue) {
    return null;
  }

  const time = new Date(dueDateValue).getTime();
  if (Number.isNaN(time)) {
    return null;
  }

  return time;
}

function sortChildCommitments(items) {
  return [...items].sort((left, right) => {
    const leftDueDate = deriveDueDateKey(left);
    const rightDueDate = deriveDueDateKey(right);

    if (leftDueDate === null && rightDueDate !== null) {
      return 1;
    }

    if (leftDueDate !== null && rightDueDate === null) {
      return -1;
    }

    if (leftDueDate !== rightDueDate) {
      return leftDueDate - rightDueDate;
    }

    const createdDifference = toComparableTime(left.created_at) - toComparableTime(right.created_at);
    if (createdDifference !== 0) {
      return createdDifference;
    }

    return left.id.localeCompare(right.id);
  });
}

function toValidAmount(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function resolveSummaryAmount(item) {
  const attributes = item.attributes;

  if (!isPlainObject(attributes)) {
    const fallback = toValidAmount(item.default_amount);
    return fallback;
  }

  const amount = toValidAmount(attributes.amount ?? attributes.nextPaymentAmount);
  if (amount !== null) {
    return amount;
  }

  return toValidAmount(item.default_amount);
}

function buildSummary(childCommitments) {
  return childCommitments.reduce(
    (summary, child) => {
      const amount = resolveSummaryAmount(child);

      if (amount === null) {
        summary.excluded_row_count += 1;
        return summary;
      }

      if (child.item_type === "FinancialIncome") {
        summary.monthly_income_total += amount;
      } else {
        summary.monthly_obligation_total += amount;
      }

      summary.net_monthly_cashflow = summary.monthly_income_total - summary.monthly_obligation_total;
      return summary;
    },
    {
      monthly_obligation_total: 0,
      monthly_income_total: 0,
      net_monthly_cashflow: 0,
      excluded_row_count: 0
    }
  );
}

function throwNotFound(itemId) {
  throw new ItemNetStatusError({
    message: "Net-status item not found.",
    category: ITEM_NET_STATUS_ERROR_CATEGORIES.NOT_FOUND,
    issues: [
      {
        field: "item_id",
        code: "not_found",
        category: ITEM_NET_STATUS_ERROR_CATEGORIES.NOT_FOUND,
        message: "No item exists for the provided id.",
        meta: { itemId }
      }
    ]
  });
}

function throwForbidden(itemId, actorUserId) {
  throw new ItemNetStatusError({
    message: "You can only access your own records.",
    category: ITEM_NET_STATUS_ERROR_CATEGORIES.NOT_FOUND,
    issues: [
      {
        field: "item_id",
        code: "not_found",
        category: ITEM_NET_STATUS_ERROR_CATEGORIES.NOT_FOUND,
        message: "You can only access your own records.",
        meta: { itemId, actorUserId }
      }
    ]
  });
}

function throwWrongRootType(rootType) {
  throw new ItemNetStatusError({
    message: "Net-status requires an asset root item type.",
    category: ITEM_NET_STATUS_ERROR_CATEGORIES.WRONG_ROOT_TYPE,
    issues: [
      {
        field: "item_type",
        code: "wrong_root_type",
        category: ITEM_NET_STATUS_ERROR_CATEGORIES.WRONG_ROOT_TYPE,
        message: "Only asset item types can be queried for net-status.",
        meta: {
          allowed_root_item_types: Array.from(ROOT_ITEM_TYPES),
          provided_item_type: rootType
        }
      }
    ]
  });
}

async function getItemNetStatus({ itemId, actorUserId }) {
  const rootItem = await models.Item.findByPk(itemId);

  if (!rootItem) {
    throwNotFound(itemId);
  }

  if (rootItem.user_id !== actorUserId) {
    throwForbidden(itemId, actorUserId);
  }

  if (isSoftDeleted(rootItem)) {
    throwNotFound(itemId);
  }

  if (!ROOT_ITEM_TYPES.has(rootItem.item_type)) {
    throwWrongRootType(rootItem.item_type);
  }

  const childRows = await models.Item.findAll({
    where: {
      [Op.or]: [{ parent_item_id: rootItem.id }, { linked_asset_item_id: rootItem.id }],
      user_id: rootItem.user_id
    }
  });

  const canonicalChildren = childRows
    .map(toCanonicalItem)
    .filter((child) => CASHFLOW_ITEM_TYPES.has(child.item_type))
    .filter((child) => !isSoftDeleted(child));

  const childCommitments = sortChildCommitments(canonicalChildren);
  const summary = buildSummary(childCommitments);

  return {
    ...toCanonicalItem(rootItem),
    child_commitments: childCommitments,
    summary
  };
}

module.exports = {
  getItemNetStatus
};
