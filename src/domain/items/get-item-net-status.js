"use strict";

const { models } = require("../../db");
const { canAccessOwner } = require("../../api/auth/scope-context");
const { ItemNetStatusError, ITEM_NET_STATUS_ERROR_CATEGORIES } = require("./item-net-status-errors");
const { applyComputedFinancialProgress } = require("./financial-metrics");

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
const CASHFLOW_ITEM_TYPES = new Set(["FinancialItem"]);
const ONE_TIME_FREQUENCY = "one_time";
const ONE_TIME_RULE_DESCRIPTOR = Object.freeze({
  frequency: ONE_TIME_FREQUENCY,
  inclusion: "due_date_inside_active_period",
  boundary: "inclusive",
  excludes: ["outside_active_period", "missing_or_invalid_due_date", "invalid_or_zero_amount"]
});

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

function deriveDueDateDayKey(item) {
  const time = deriveDueDateKey(item);
  if (time === null) {
    return null;
  }

  const parsed = new Date(time);
  return Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

function formatDateFromUtcDayKey(dayKey) {
  return new Date(dayKey).toISOString().slice(0, 10);
}

function resolveActiveMonthlyPeriod(referenceDate = new Date()) {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const date = referenceDate.getUTCDate();

  const startDayKey = Date.UTC(year, month, 1);
  const endDayKey = Date.UTC(year, month + 1, 0);
  const referenceDayKey = Date.UTC(year, month, date);

  return {
    startDayKey,
    endDayKey,
    referenceDayKey,
    metadata: {
      cadence: "monthly",
      start_date: formatDateFromUtcDayKey(startDayKey),
      end_date: formatDateFromUtcDayKey(endDayKey),
      reference_date: formatDateFromUtcDayKey(referenceDayKey),
      boundary: "inclusive"
    }
  };
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

function normalizeLower(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isOneTimeItem(child) {
  return normalizeLower(child && child.frequency) === ONE_TIME_FREQUENCY;
}

function isIncomeItem(child) {
  if (!child) {
    return false;
  }

  if (child.item_type !== "FinancialItem") {
    return false;
  }

  const explicitSubtype = normalizeLower(child.type);
  if (explicitSubtype === "income") {
    return true;
  }

  const attributes = isPlainObject(child.attributes) ? child.attributes : {};
  const attributeSubtype = normalizeLower(attributes.financialSubtype || attributes.type);
  return attributeSubtype === "income";
}

function resolveParentLinkId(item) {
  if (!item) {
    return null;
  }

  if (typeof item.parent_item_id === "string" && item.parent_item_id.length > 0) {
    return item.parent_item_id;
  }

  if (typeof item.linked_asset_item_id === "string" && item.linked_asset_item_id.length > 0) {
    return item.linked_asset_item_id;
  }

  const attributes = isPlainObject(item.attributes) ? item.attributes : {};
  if (typeof attributes.parentItemId === "string" && attributes.parentItemId.length > 0) {
    return attributes.parentItemId;
  }

  if (typeof attributes.linkedAssetItemId === "string" && attributes.linkedAssetItemId.length > 0) {
    return attributes.linkedAssetItemId;
  }

  return null;
}

function buildSummary(childCommitments) {
  const activePeriod = resolveActiveMonthlyPeriod();
  const summary = childCommitments.reduce(
    (accumulator, child) => {
      const amount = resolveSummaryAmount(child);

      if (amount === null || amount === 0) {
        accumulator.excluded_row_count += 1;
        return accumulator;
      }

      if (isOneTimeItem(child)) {
        const dueDateDayKey = deriveDueDateDayKey(child);
        const isInsideActivePeriod = dueDateDayKey !== null
          && dueDateDayKey >= activePeriod.startDayKey
          && dueDateDayKey <= activePeriod.endDayKey;

        if (!isInsideActivePeriod) {
          accumulator.excluded_row_count += 1;
          return accumulator;
        }
      }

      if (isIncomeItem(child)) {
        accumulator.monthly_income_total += amount;
      } else {
        accumulator.monthly_obligation_total += amount;
      }

      return accumulator;
    },
    {
      monthly_obligation_total: 0,
      monthly_income_total: 0,
      net_monthly_cashflow: 0,
      excluded_row_count: 0,
      active_period: activePeriod.metadata,
      one_time_rule: ONE_TIME_RULE_DESCRIPTOR
    }
  );

  summary.net_monthly_cashflow = summary.monthly_income_total - summary.monthly_obligation_total;
  return summary;
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

async function getItemNetStatus({ itemId, scope, actorUserId }) {
  const scopeContext = scope && typeof scope === "object" ? scope : { actorUserId };
  const resolvedActorUserId = typeof scopeContext.actorUserId === "string" ? scopeContext.actorUserId : actorUserId;
  const rootItem = await models.Item.findByPk(itemId);

  if (!rootItem) {
    throwNotFound(itemId);
  }

  if (!canAccessOwner(scopeContext, rootItem.user_id)) {
    throwForbidden(itemId, resolvedActorUserId);
  }

  if (isSoftDeleted(rootItem)) {
    throwNotFound(itemId);
  }

  if (!ROOT_ITEM_TYPES.has(rootItem.item_type)) {
    throwWrongRootType(rootItem.item_type);
  }

  const childRows = await models.Item.findAll({
    where: {
      user_id: rootItem.user_id
    }
  });

  const canonicalChildren = (await applyComputedFinancialProgress(childRows.map(toCanonicalItem), models))
    .filter((child) => CASHFLOW_ITEM_TYPES.has(child.item_type))
    .filter((child) => resolveParentLinkId(child) === rootItem.id)
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
