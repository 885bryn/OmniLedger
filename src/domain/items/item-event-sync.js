"use strict";

const { Op } = require("sequelize");

const CASHFLOW_ITEM_TYPES = new Set(["FinancialCommitment", "FinancialIncome", "FinancialItem"]);
const ONE_TIME_FREQUENCY = "one_time";
const RECURRING_FREQUENCIES = new Set(["weekly", "monthly", "yearly"]);
const ACTIVE_FINANCIAL_STATUS = "Active";

function toDateKey(value) {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function toUtcDate(value) {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function addDaysUtc(date, count) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + count));
}

function addMonthsUtc(date, count) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const targetMonth = month + count;
  const monthAnchor = new Date(Date.UTC(year, targetMonth, 1));
  const lastDay = new Date(Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth(), Math.min(day, lastDay)));
}

function addYearsUtc(date, count) {
  return addMonthsUtc(date, count * 12);
}

function advanceByFrequency(date, frequency) {
  if (frequency === "weekly") {
    return addDaysUtc(date, 7);
  }

  if (frequency === "monthly") {
    return addMonthsUtc(date, 1);
  }

  if (frequency === "yearly") {
    return addMonthsUtc(date, 12);
  }

  return null;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
}

function getDueDate(attributes, item) {
  if (item && item.item_type === "FinancialItem") {
    const rawDueDate = isPlainObject(attributes) ? attributes.dueDate || attributes.due_date : null;
    if (typeof rawDueDate !== "string" || rawDueDate.trim() === "") {
      return null;
    }

    const financialParsed = new Date(rawDueDate);
    return Number.isNaN(financialParsed.getTime()) ? null : financialParsed;
  }

  const source = isPlainObject(attributes) ? attributes : {};
  const candidate = source.dueDate || source.due_date;

  if (typeof candidate !== "string" || candidate.trim() === "") {
    return null;
  }

  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getAmount(attributes, item) {
  if (item && item.item_type === "FinancialItem") {
    const parsedFinancialAmount = Number(item.default_amount);
    return Number.isFinite(parsedFinancialAmount) && parsedFinancialAmount >= 0 ? parsedFinancialAmount : 0;
  }

  const source = isPlainObject(attributes) ? attributes : {};
  const candidate = source.nextPaymentAmount ?? source.amount ?? 0;
  const parsed = Number(candidate);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function getEventType(itemType, attributes, item) {
  if (item && item.item_type === "FinancialItem") {
    const title = typeof item.title === "string" ? item.title.trim() : "";
    if (title) {
      return title;
    }
  }

  const source = isPlainObject(attributes) ? attributes : {};
  const name = typeof source.name === "string" ? source.name.trim() : "";
  return name || itemType;
}

function shouldProjectRecurringFinancialItem(item) {
  if (!item || item.item_type !== "FinancialItem") {
    return false;
  }

  if (RECURRING_FREQUENCIES.has(item.frequency) === false) {
    return false;
  }

  return item.status === ACTIVE_FINANCIAL_STATUS;
}

function toDateRangeForDay(dayInput) {
  const day = toUtcDate(dayInput);
  if (!day) {
    return null;
  }

  const start = day;
  const end = addDaysUtc(day, 1);
  return { start, end };
}

async function materializeItemEventForDate({ item, dueDate, models, transaction }) {
  if (!item || item.item_type !== "FinancialItem") {
    return null;
  }

  const dueDateRange = toDateRangeForDay(dueDate);
  if (!dueDateRange) {
    return null;
  }

  const existing = await models.Event.findOne({
    where: {
      item_id: item.id,
      due_date: {
        [Op.gte]: dueDateRange.start,
        [Op.lt]: dueDateRange.end
      }
    },
    order: [["updated_at", "DESC"], ["id", "ASC"]],
    transaction
  });

  if (existing) {
    return existing;
  }

  return models.Event.create(
    {
      item_id: item.id,
      event_type: getEventType(item.item_type, item.attributes, item),
      due_date: dueDateRange.start,
      amount: getAmount(item.attributes, item),
      status: "Pending",
      is_recurring: true
    },
    { transaction }
  );
}

function projectItemEvents({
  item,
  persistedEvents,
  now = new Date(),
  windowStart,
  windowEnd
}) {
  if (!shouldProjectRecurringFinancialItem(item)) {
    return [];
  }

  const seedDate = toUtcDate(getDueDate(item.attributes, item));
  const today = toUtcDate(now);
  if (!seedDate || !today) {
    return [];
  }

  const projectionStart = toUtcDate(windowStart || today);
  const projectionEnd = toUtcDate(windowEnd || addYearsUtc(today, 3));
  if (!projectionStart || !projectionEnd || projectionEnd.getTime() < projectionStart.getTime()) {
    return [];
  }

  const existingDateKeys = new Set(
    (Array.isArray(persistedEvents) ? persistedEvents : [])
      .map((event) => toDateKey(event.due_date))
      .filter(Boolean)
  );

  const projected = [];
  let cursor = seedDate;
  let guard = 0;

  while (cursor.getTime() < projectionStart.getTime() && guard < 500) {
    const nextCursor = advanceByFrequency(cursor, item.frequency);
    if (!nextCursor) {
      return [];
    }
    cursor = nextCursor;
    guard += 1;
  }

  while (cursor.getTime() <= projectionEnd.getTime() && guard < 2000) {
    const dateKey = toDateKey(cursor);
    if (dateKey && existingDateKeys.has(dateKey) === false) {
      projected.push({
        id: `projected-${item.id}-${dateKey}`,
        item_id: item.id,
        type: getEventType(item.item_type, item.attributes, item),
        amount: getAmount(item.attributes, item),
        due_date: cursor.toISOString(),
        status: "Pending",
        recurring: true,
        completed_at: null,
        created_at: null,
        updated_at: null
      });
    }

    const nextCursor = advanceByFrequency(cursor, item.frequency);
    if (!nextCursor) {
      break;
    }

    cursor = nextCursor;
    guard += 1;
  }

  return projected;
}

async function syncItemEvent({ item, models, transaction, mode }) {
  if (!item || CASHFLOW_ITEM_TYPES.has(item.item_type) === false) {
    return;
  }

  if (item.item_type === "FinancialItem" && item.frequency !== ONE_TIME_FREQUENCY) {
    return;
  }

  const dueDate = getDueDate(item.attributes, item);
  if (!dueDate) {
    return;
  }

  const amount = getAmount(item.attributes, item);
  const eventType = getEventType(item.item_type, item.attributes, item);
  const dueDateKey = toDateKey(dueDate);

  const pendingEvent = await models.Event.findOne({
    where: {
      item_id: item.id,
      status: "Pending"
    },
    order: [["due_date", "ASC"], ["id", "ASC"]],
    transaction
  });

  if (pendingEvent) {
    if (mode === "create") {
      return;
    }

    pendingEvent.event_type = eventType;
    pendingEvent.due_date = dueDate;
    pendingEvent.amount = amount;
    await pendingEvent.save({ transaction });
    return;
  }

  const completedEvents = await models.Event.findAll({
    where: {
      item_id: item.id,
      status: "Completed"
    },
    attributes: ["due_date"],
    order: [["updated_at", "DESC"]],
    limit: 25,
    transaction
  });

  const completedForSameDueDate = completedEvents.some((event) => toDateKey(event.due_date) === dueDateKey);
  if (completedForSameDueDate) {
    return;
  }

  await models.Event.create(
    {
      item_id: item.id,
      event_type: eventType,
      due_date: dueDate,
      amount,
      status: "Pending",
      is_recurring: false
    },
    { transaction }
  );
}

module.exports = {
  syncItemEvent,
  materializeItemEventForDate,
  projectItemEvents
};
