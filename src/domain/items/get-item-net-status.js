"use strict";

const { models } = require("../../db");
const { ItemNetStatusError, ITEM_NET_STATUS_ERROR_CATEGORIES } = require("./item-net-status-errors");

const CANONICAL_ITEM_FIELDS = Object.freeze([
  "id",
  "user_id",
  "item_type",
  "attributes",
  "parent_item_id",
  "created_at",
  "updated_at"
]);

const ROOT_ITEM_TYPES = new Set(["RealEstate", "Vehicle"]);
const COMMITMENT_ITEM_TYPES = new Set(["FinancialCommitment", "Subscription"]);

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
  if (typeof value !== "number") {
    return null;
  }

  return Number.isFinite(value) ? value : null;
}

function buildSummary(childCommitments) {
  return childCommitments.reduce(
    (summary, child) => {
      const amount = toValidAmount(child.attributes && child.attributes.amount);

      if (amount === null) {
        summary.excluded_row_count += 1;
        return summary;
      }

      summary.monthly_obligation_total += amount;
      return summary;
    },
    {
      monthly_obligation_total: 0,
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
    message: "Net-status access forbidden for this item.",
    category: ITEM_NET_STATUS_ERROR_CATEGORIES.FORBIDDEN,
    issues: [
      {
        field: "item_id",
        code: "forbidden",
        category: ITEM_NET_STATUS_ERROR_CATEGORIES.FORBIDDEN,
        message: "Item exists but is not owned by the requesting actor.",
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

  if (!ROOT_ITEM_TYPES.has(rootItem.item_type)) {
    throwWrongRootType(rootItem.item_type);
  }

  const childRows = await models.Item.findAll({
    where: {
      parent_item_id: rootItem.id
    }
  });

  const canonicalChildren = childRows
    .map(toCanonicalItem)
    .filter((child) => COMMITMENT_ITEM_TYPES.has(child.item_type));

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
