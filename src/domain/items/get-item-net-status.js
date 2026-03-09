"use strict";

const { Op } = require("sequelize");
const { models } = require("../../db");
const { canAccessOwner } = require("../../api/auth/scope-context");
const { ItemNetStatusError, ITEM_NET_STATUS_ERROR_CATEGORIES } = require("./item-net-status-errors");
const { applyComputedFinancialProgress } = require("./financial-metrics");
const { resolveYearlyFactor, roundBankers } = require("./cadence-normalization");

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
  inclusion: "event_occurs_inside_active_period",
  boundary: "inclusive",
  excludes: ["outside_active_period", "missing_or_invalid_event_due_date", "invalid_or_zero_amount"]
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

function formatDateFromUtcDayKey(dayKey) {
  return new Date(dayKey).toISOString().slice(0, 10);
}

function deriveEventDueDateDayKey(event) {
  if (!event || typeof event !== "object") {
    return null;
  }

  const dueDateValue = event.due_date || event.dueDate;
  if (!dueDateValue) {
    return null;
  }

  const dueDateTime = new Date(dueDateValue).getTime();
  if (Number.isNaN(dueDateTime)) {
    return null;
  }

  const parsed = new Date(dueDateTime);
  return Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

function toUtcDayKey(value) {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

function deriveItemOriginDayKey(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const createdDayKey = toUtcDayKey(item.created_at || item.createdAt);
  const attributes = isPlainObject(item.attributes) ? item.attributes : {};
  const explicitOriginDayKey = toUtcDayKey(
    attributes.originDate || attributes.origin_date || attributes.originAt || attributes.origin_at
  );
  const dueDateDayKey = toUtcDayKey(attributes.dueDate || attributes.due_date);

  if (explicitOriginDayKey !== null) {
    return dueDateDayKey === null ? explicitOriginDayKey : Math.max(explicitOriginDayKey, dueDateDayKey);
  }

  if (dueDateDayKey !== null) {
    return dueDateDayKey;
  }

  if (createdDayKey === null) {
    return null;
  }

  return createdDayKey;
}

function createActivePeriodMetadata({ cadence, startDayKey, endDayKey, referenceDayKey }) {
  return {
    cadence,
    start_date: formatDateFromUtcDayKey(startDayKey),
    end_date: formatDateFromUtcDayKey(endDayKey),
    reference_date: formatDateFromUtcDayKey(referenceDayKey),
    boundary: "inclusive"
  };
}

function resolveActiveCadencePeriods(referenceDate = new Date()) {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const date = referenceDate.getUTCDate();
  const referenceDayKey = Date.UTC(year, month, date);

  const weekDay = referenceDate.getUTCDay();
  const weekOffsetFromMonday = (weekDay + 6) % 7;
  const weeklyStartDayKey = referenceDayKey - weekOffsetFromMonday * 24 * 60 * 60 * 1000;
  const weeklyEndDayKey = weeklyStartDayKey + 6 * 24 * 60 * 60 * 1000;

  const monthlyStartDayKey = Date.UTC(year, month, 1);
  const monthlyEndDayKey = Date.UTC(year, month + 1, 0);

  const yearlyStartDayKey = Date.UTC(year, 0, 1);
  const yearlyEndDayKey = Date.UTC(year, 11, 31);

  return {
    weekly: {
      startDayKey: weeklyStartDayKey,
      endDayKey: weeklyEndDayKey,
      referenceDayKey,
      metadata: createActivePeriodMetadata({
        cadence: "weekly",
        startDayKey: weeklyStartDayKey,
        endDayKey: weeklyEndDayKey,
        referenceDayKey
      })
    },
    monthly: {
      startDayKey: monthlyStartDayKey,
      endDayKey: monthlyEndDayKey,
      referenceDayKey,
      metadata: createActivePeriodMetadata({
        cadence: "monthly",
        startDayKey: monthlyStartDayKey,
        endDayKey: monthlyEndDayKey,
        referenceDayKey
      })
    },
    yearly: {
      startDayKey: yearlyStartDayKey,
      endDayKey: yearlyEndDayKey,
      referenceDayKey,
      metadata: createActivePeriodMetadata({
        cadence: "yearly",
        startDayKey: yearlyStartDayKey,
        endDayKey: yearlyEndDayKey,
        referenceDayKey
      })
    }
  };
}

function resolveActiveMonthlyPeriod(referenceDate = new Date()) {
  return resolveActiveCadencePeriods(referenceDate).monthly;
}

function isDueDateInsideActivePeriod(dueDateDayKey, activePeriod) {
  if (dueDateDayKey === null) {
    return false;
  }

  return dueDateDayKey >= activePeriod.startDayKey && dueDateDayKey <= activePeriod.endDayKey;
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

function createCadenceBucket() {
  return {
    weekly: 0,
    monthly: 0,
    yearly: 0
  };
}

function applyCadenceTotals(target, cadenceTotals) {
  target.weekly += cadenceTotals.weekly;
  target.monthly += cadenceTotals.monthly;
  target.yearly += cadenceTotals.yearly;
}

function finalizeCadenceBucket(bucket) {
  return {
    weekly: roundBankers(bucket.weekly),
    monthly: roundBankers(bucket.monthly),
    yearly: roundBankers(bucket.yearly)
  };
}

function buildEventOccurrenceLookup(events, activePeriods, originDayKeyByItemId) {
  const lookup = new Map();

  events.forEach((event) => {
    if (!event || typeof event.item_id !== "string") {
      return;
    }

    const dueDateDayKey = deriveEventDueDateDayKey(event);
    if (dueDateDayKey === null) {
      return;
    }

    const originDayKey = originDayKeyByItemId.get(event.item_id);
    if (originDayKey !== null && originDayKey !== undefined && dueDateDayKey < originDayKey) {
      return;
    }

    const existing = lookup.get(event.item_id) || {
      weekly: 0,
      monthly: 0,
      yearly: 0
    };

    if (isDueDateInsideActivePeriod(dueDateDayKey, activePeriods.weekly)) {
      existing.weekly += 1;
    }

    if (isDueDateInsideActivePeriod(dueDateDayKey, activePeriods.monthly)) {
      existing.monthly += 1;
    }

    if (isDueDateInsideActivePeriod(dueDateDayKey, activePeriods.yearly)) {
      existing.yearly += 1;
    }

    lookup.set(event.item_id, existing);
  });

  return lookup;
}

function buildSummary(childCommitments, childEvents = []) {
  const activePeriods = resolveActiveCadencePeriods();
  const activePeriod = activePeriods.monthly;
  const originDayKeyByItemId = new Map(
    childCommitments.map((child) => [child.id, deriveItemOriginDayKey(child)])
  );
  const eventOccurrenceByItemId = buildEventOccurrenceLookup(childEvents, activePeriods, originDayKeyByItemId);
  const summary = childCommitments.reduce(
    (accumulator, child) => {
      const amount = resolveSummaryAmount(child);

      if (amount === null || amount === 0) {
        accumulator.excluded_row_count += 1;
        accumulator.cadence_totals.exclusions.invalid_or_zero_amount_count += 1;
        return accumulator;
      }

      const includedInCadence = eventOccurrenceByItemId.get(child.id) || {
        weekly: 0,
        monthly: 0,
        yearly: 0
      };

      if (includedInCadence.weekly === 0 && includedInCadence.monthly === 0 && includedInCadence.yearly === 0) {
        accumulator.excluded_row_count += 1;
        accumulator.cadence_totals.exclusions.outside_active_period_count += 1;
        return accumulator;
      }

      if (isOneTimeItem(child)) {
        if (includedInCadence.monthly === 0) {
          accumulator.excluded_row_count += 1;
          accumulator.cadence_totals.exclusions.outside_active_period_count += 1;
          return accumulator;
        }

        if (isIncomeItem(child)) {
          accumulator.monthly_income_total += amount;
          accumulator.cadence_totals.one_time_period.monthly_income_total += amount;
        } else {
          accumulator.monthly_obligation_total += amount;
          accumulator.cadence_totals.one_time_period.monthly_obligation_total += amount;
        }

        return accumulator;
      }

      if (!resolveYearlyFactor(child.frequency).isValid) {
        accumulator.excluded_row_count += 1;
        accumulator.cadence_totals.exclusions.invalid_or_missing_frequency_count += 1;
        return accumulator;
      }

      const weeklyOccurrenceTotal = amount * includedInCadence.weekly;
      const monthlyOccurrenceTotal = amount * includedInCadence.monthly;
      const yearlyOccurrenceTotal = amount * includedInCadence.yearly;

      if (isIncomeItem(child)) {
        if (includedInCadence.monthly > 0) {
          accumulator.monthly_income_total += monthlyOccurrenceTotal;
        }

        if (includedInCadence.weekly > 0) {
          accumulator.cadence_totals.recurring.income.weekly += weeklyOccurrenceTotal;
        }

        if (includedInCadence.monthly > 0) {
          accumulator.cadence_totals.recurring.income.monthly += monthlyOccurrenceTotal;
        }

        if (includedInCadence.yearly > 0) {
          accumulator.cadence_totals.recurring.income.yearly += yearlyOccurrenceTotal;
        }
      } else {
        if (includedInCadence.monthly > 0) {
          accumulator.monthly_obligation_total += monthlyOccurrenceTotal;
        }

        if (includedInCadence.weekly > 0) {
          accumulator.cadence_totals.recurring.obligations.weekly += weeklyOccurrenceTotal;
        }

        if (includedInCadence.monthly > 0) {
          accumulator.cadence_totals.recurring.obligations.monthly += monthlyOccurrenceTotal;
        }

        if (includedInCadence.yearly > 0) {
          accumulator.cadence_totals.recurring.obligations.yearly += yearlyOccurrenceTotal;
        }
      }

      return accumulator;
    },
    {
      monthly_obligation_total: 0,
      monthly_income_total: 0,
      net_monthly_cashflow: 0,
      excluded_row_count: 0,
      active_period: activePeriod.metadata,
      one_time_rule: ONE_TIME_RULE_DESCRIPTOR,
      cadence_totals: {
        recurring: {
          obligations: createCadenceBucket(),
          income: createCadenceBucket(),
          net_cashflow: createCadenceBucket(),
          active_periods: {
            weekly: activePeriods.weekly.metadata,
            monthly: activePeriods.monthly.metadata,
            yearly: activePeriods.yearly.metadata
          }
        },
        one_time_period: {
          cadence: "monthly",
          monthly_obligation_total: 0,
          monthly_income_total: 0,
          net_monthly_cashflow: 0,
          active_period: activePeriod.metadata
        },
        exclusions: {
          invalid_or_zero_amount_count: 0,
          invalid_or_missing_frequency_count: 0,
          missing_or_invalid_event_due_date_count: 0,
          outside_active_period_count: 0,
          total_excluded_row_count: 0
        }
      }
    }
  );

  summary.net_monthly_cashflow = summary.monthly_income_total - summary.monthly_obligation_total;

  summary.cadence_totals.recurring.obligations = finalizeCadenceBucket(summary.cadence_totals.recurring.obligations);
  summary.cadence_totals.recurring.income = finalizeCadenceBucket(summary.cadence_totals.recurring.income);
  summary.cadence_totals.recurring.net_cashflow = {
    weekly: roundBankers(summary.cadence_totals.recurring.income.weekly - summary.cadence_totals.recurring.obligations.weekly),
    monthly: roundBankers(summary.cadence_totals.recurring.income.monthly - summary.cadence_totals.recurring.obligations.monthly),
    yearly: roundBankers(summary.cadence_totals.recurring.income.yearly - summary.cadence_totals.recurring.obligations.yearly)
  };

  summary.cadence_totals.one_time_period.monthly_obligation_total = roundBankers(
    summary.cadence_totals.one_time_period.monthly_obligation_total
  );
  summary.cadence_totals.one_time_period.monthly_income_total = roundBankers(
    summary.cadence_totals.one_time_period.monthly_income_total
  );
  summary.cadence_totals.one_time_period.net_monthly_cashflow = roundBankers(
    summary.cadence_totals.one_time_period.monthly_income_total - summary.cadence_totals.one_time_period.monthly_obligation_total
  );
  summary.cadence_totals.exclusions.total_excluded_row_count = summary.excluded_row_count;

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
  const childIds = childCommitments.map((child) => child.id);
  const childEvents = childIds.length
    ? await models.Event.findAll({
      where: {
        item_id: {
          [Op.in]: childIds
        }
      },
      attributes: ["item_id", "due_date"]
    })
    : [];

  const summary = buildSummary(
    childCommitments,
    childEvents.map((event) => (typeof event.get === "function" ? event.get({ plain: true }) : event))
  );

  return {
    ...toCanonicalItem(rootItem),
    child_commitments: childCommitments,
    summary
  };
}

module.exports = {
  getItemNetStatus
};
