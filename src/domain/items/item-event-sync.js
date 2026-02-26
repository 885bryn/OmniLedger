"use strict";

const CASHFLOW_ITEM_TYPES = new Set(["FinancialCommitment", "FinancialIncome", "FinancialItem"]);
const ONE_TIME_FREQUENCY = "one_time";

function toDateKey(value) {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
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
  syncItemEvent
};
