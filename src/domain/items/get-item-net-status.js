"use strict";

const { models } = require("../../db");
const { canAccessOwner } = require("../../api/auth/scope-context");
const { ItemNetStatusError, ITEM_NET_STATUS_ERROR_CATEGORIES } = require("./item-net-status-errors");
const { applyComputedFinancialProgress } = require("./financial-metrics");
const { resolveYearlyFactor, roundBankers } = require("./cadence-normalization");

const DAY_MS = 24 * 60 * 60 * 1000;

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

function parseCalendarDateToUtcDayKey(value) {
  if (typeof value !== "string") {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/.exec(value.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dayKey = Date.UTC(year, month - 1, day);
  const parsed = new Date(dayKey);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return dayKey;
}

function toUtcDayKey(value) {
  if (!value) {
    return null;
  }

  const calendarDayKey = parseCalendarDateToUtcDayKey(value);
  if (calendarDayKey !== null) {
    return calendarDayKey;
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
  const weeklyStartDayKey = referenceDayKey - weekOffsetFromMonday * DAY_MS;
  const weeklyEndDayKey = weeklyStartDayKey + 6 * DAY_MS;

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

function addDaysUtcDayKey(dayKey, count) {
  return dayKey + count * DAY_MS;
}

function addMonthsUtcDayKey(dayKey, count) {
  const date = new Date(dayKey);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const targetMonth = month + count;
  const monthAnchor = new Date(Date.UTC(year, targetMonth, 1));
  const lastDay = new Date(
    Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth() + 1, 0)
  ).getUTCDate();
  return Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth(), Math.min(day, lastDay));
}

function advanceDayKeyByFrequency(dayKey, frequency) {
  if (frequency === "weekly") {
    return addDaysUtcDayKey(dayKey, 7);
  }

  if (frequency === "biweekly") {
    return addDaysUtcDayKey(dayKey, 14);
  }

  if (frequency === "monthly") {
    return addMonthsUtcDayKey(dayKey, 1);
  }

  if (frequency === "quarterly") {
    return addMonthsUtcDayKey(dayKey, 3);
  }

  if (frequency === "yearly") {
    return addMonthsUtcDayKey(dayKey, 12);
  }

  return null;
}

function resolveCadenceOccurrencesForPeriod({ seedDayKey, originDayKey, frequency, activePeriod }) {
  if (seedDayKey === null || !activePeriod) {
    return 0;
  }

  const effectiveStartDayKey = originDayKey === null
    ? activePeriod.startDayKey
    : Math.max(originDayKey, activePeriod.startDayKey);

  if (effectiveStartDayKey > activePeriod.endDayKey) {
    return 0;
  }

  let cursor = seedDayKey;
  let guard = 0;

  while (cursor < effectiveStartDayKey && guard < 2000) {
    cursor = advanceDayKeyByFrequency(cursor, frequency);
    if (cursor === null) {
      return 0;
    }
    guard += 1;
  }

  let count = 0;
  while (cursor !== null && cursor <= activePeriod.endDayKey && guard < 4000) {
    count += 1;
    cursor = advanceDayKeyByFrequency(cursor, frequency);
    guard += 1;
  }

  return count;
}

function resolveRecurringCadenceOccurrences({ dueDateDayKey, originDayKey, frequency, activePeriods }) {
  return {
    weekly: resolveCadenceOccurrencesForPeriod({
      seedDayKey: dueDateDayKey,
      originDayKey,
      frequency,
      activePeriod: activePeriods.weekly
    }),
    monthly: resolveCadenceOccurrencesForPeriod({
      seedDayKey: dueDateDayKey,
      originDayKey,
      frequency,
      activePeriod: activePeriods.monthly
    }),
    yearly: resolveCadenceOccurrencesForPeriod({
      seedDayKey: dueDateDayKey,
      originDayKey,
      frequency,
      activePeriod: activePeriods.yearly
    })
  };
}

function resolveOneTimeCadenceOccurrences({ dueDateDayKey, originDayKey, activePeriods }) {
  if (dueDateDayKey === null) {
    return createCadenceBucket();
  }

  if (originDayKey !== null && dueDateDayKey < originDayKey) {
    return createCadenceBucket();
  }

  return {
    weekly: isDueDateInsideActivePeriod(dueDateDayKey, activePeriods.weekly) ? 1 : 0,
    monthly: isDueDateInsideActivePeriod(dueDateDayKey, activePeriods.monthly) ? 1 : 0,
    yearly: isDueDateInsideActivePeriod(dueDateDayKey, activePeriods.yearly) ? 1 : 0
  };
}

function hasCadenceOccurrences(occurrences) {
  return occurrences.weekly > 0 || occurrences.monthly > 0 || occurrences.yearly > 0;
}

function addCadenceAmount(target, occurrences, amount) {
  target.weekly += amount * occurrences.weekly;
  target.monthly += amount * occurrences.monthly;
  target.yearly += amount * occurrences.yearly;
}

function finalizeCadenceBucket(bucket) {
  return {
    weekly: roundBankers(bucket.weekly),
    monthly: roundBankers(bucket.monthly),
    yearly: roundBankers(bucket.yearly)
  };
}

function buildSummary(childCommitments) {
  const activePeriods = resolveActiveCadencePeriods();
  const activePeriod = activePeriods.monthly;
  const summary = childCommitments.reduce(
    (accumulator, child) => {
      const amount = resolveSummaryAmount(child);
      const attributes = isPlainObject(child.attributes) ? child.attributes : {};
      const dueDateDayKey = toUtcDayKey(attributes.dueDate || attributes.due_date);
      const originDayKey = deriveItemOriginDayKey(child);

      if (amount === null || amount === 0) {
        accumulator.excluded_row_count += 1;
        accumulator.cadence_totals.exclusions.invalid_or_zero_amount_count += 1;
        return accumulator;
      }

      if (isOneTimeItem(child)) {
        if (dueDateDayKey === null) {
          accumulator.excluded_row_count += 1;
          accumulator.cadence_totals.exclusions.missing_or_invalid_event_due_date_count += 1;
          return accumulator;
        }

        const oneTimeOccurrences = resolveOneTimeCadenceOccurrences({
          dueDateDayKey,
          originDayKey,
          activePeriods
        });

        if (!hasCadenceOccurrences(oneTimeOccurrences)) {
          accumulator.excluded_row_count += 1;
          accumulator.cadence_totals.exclusions.outside_active_period_count += 1;
          return accumulator;
        }

        if (isIncomeItem(child)) {
          addCadenceAmount(accumulator.cadence_totals.one_time.income, oneTimeOccurrences, amount);
          addCadenceAmount(accumulator.cadence_totals.total.income, oneTimeOccurrences, amount);
        } else {
          addCadenceAmount(accumulator.cadence_totals.one_time.obligations, oneTimeOccurrences, amount);
          addCadenceAmount(accumulator.cadence_totals.total.obligations, oneTimeOccurrences, amount);
        }

        return accumulator;
      }

      const frequency = resolveYearlyFactor(child.frequency);
      if (!frequency.isValid) {
        accumulator.excluded_row_count += 1;
        accumulator.cadence_totals.exclusions.invalid_or_missing_frequency_count += 1;
        return accumulator;
      }

      if (dueDateDayKey === null) {
        accumulator.excluded_row_count += 1;
        accumulator.cadence_totals.exclusions.missing_or_invalid_event_due_date_count += 1;
        return accumulator;
      }

      const recurringOccurrences = resolveRecurringCadenceOccurrences({
        dueDateDayKey,
        originDayKey,
        frequency: frequency.normalizedFrequency,
        activePeriods
      });

      if (!hasCadenceOccurrences(recurringOccurrences)) {
        accumulator.excluded_row_count += 1;
        accumulator.cadence_totals.exclusions.outside_active_period_count += 1;
        return accumulator;
      }

      if (isIncomeItem(child)) {
        addCadenceAmount(accumulator.cadence_totals.recurring.income, recurringOccurrences, amount);
        addCadenceAmount(accumulator.cadence_totals.total.income, recurringOccurrences, amount);
      } else {
        addCadenceAmount(accumulator.cadence_totals.recurring.obligations, recurringOccurrences, amount);
        addCadenceAmount(accumulator.cadence_totals.total.obligations, recurringOccurrences, amount);
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
          total: {
            obligations: createCadenceBucket(),
            income: createCadenceBucket(),
            net_cashflow: createCadenceBucket(),
            active_periods: {
              weekly: activePeriods.weekly.metadata,
              monthly: activePeriods.monthly.metadata,
              yearly: activePeriods.yearly.metadata
            }
          },
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
          one_time: {
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

  summary.cadence_totals.total.obligations = finalizeCadenceBucket(summary.cadence_totals.total.obligations);
  summary.cadence_totals.total.income = finalizeCadenceBucket(summary.cadence_totals.total.income);
  summary.cadence_totals.total.net_cashflow = {
    weekly: roundBankers(summary.cadence_totals.total.income.weekly - summary.cadence_totals.total.obligations.weekly),
    monthly: roundBankers(summary.cadence_totals.total.income.monthly - summary.cadence_totals.total.obligations.monthly),
    yearly: roundBankers(summary.cadence_totals.total.income.yearly - summary.cadence_totals.total.obligations.yearly)
  };
  summary.cadence_totals.recurring.obligations = finalizeCadenceBucket(summary.cadence_totals.recurring.obligations);
  summary.cadence_totals.recurring.income = finalizeCadenceBucket(summary.cadence_totals.recurring.income);
  summary.cadence_totals.recurring.net_cashflow = {
    weekly: roundBankers(summary.cadence_totals.recurring.income.weekly - summary.cadence_totals.recurring.obligations.weekly),
    monthly: roundBankers(summary.cadence_totals.recurring.income.monthly - summary.cadence_totals.recurring.obligations.monthly),
    yearly: roundBankers(summary.cadence_totals.recurring.income.yearly - summary.cadence_totals.recurring.obligations.yearly)
  };

  summary.cadence_totals.one_time.obligations = finalizeCadenceBucket(summary.cadence_totals.one_time.obligations);
  summary.cadence_totals.one_time.income = finalizeCadenceBucket(summary.cadence_totals.one_time.income);
  summary.cadence_totals.one_time.net_cashflow = {
    weekly: roundBankers(summary.cadence_totals.one_time.income.weekly - summary.cadence_totals.one_time.obligations.weekly),
    monthly: roundBankers(summary.cadence_totals.one_time.income.monthly - summary.cadence_totals.one_time.obligations.monthly),
    yearly: roundBankers(summary.cadence_totals.one_time.income.yearly - summary.cadence_totals.one_time.obligations.yearly)
  };

  summary.monthly_obligation_total = summary.cadence_totals.total.obligations.monthly;
  summary.monthly_income_total = summary.cadence_totals.total.income.monthly;
  summary.net_monthly_cashflow = summary.cadence_totals.total.net_cashflow.monthly;

  summary.cadence_totals.one_time_period.monthly_obligation_total = summary.cadence_totals.one_time.obligations.monthly;
  summary.cadence_totals.one_time_period.monthly_income_total = summary.cadence_totals.one_time.income.monthly;
  summary.cadence_totals.one_time_period.net_monthly_cashflow = summary.cadence_totals.one_time.net_cashflow.monthly;
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
