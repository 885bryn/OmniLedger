"use strict";

const { models } = require("../../db");
const { EventQueryError, EVENT_QUERY_ERROR_CATEGORIES } = require("./event-query-errors");
const { syncItemEvent, projectItemEvents } = require("../items/item-event-sync");
const { resolveOwnerFilter } = require("../../api/auth/scope-context");

const STATUS_FILTERS = Object.freeze(["all", "pending", "completed"]);
const CASHFLOW_ITEM_TYPES = new Set(["FinancialCommitment", "FinancialIncome"]);
const FINANCIAL_ITEM_TYPE = "FinancialItem";

function getDeletedAt(attributes) {
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
    return null;
  }

  if (typeof attributes._deleted_at !== "string") {
    return null;
  }

  const parsed = new Date(attributes._deleted_at).getTime();
  return Number.isNaN(parsed) ? null : attributes._deleted_at;
}

function getDueDate(attributes) {
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
    return null;
  }

  const raw = attributes.dueDate || attributes.due_date;
  if (typeof raw !== "string" || raw.trim() === "") {
    return null;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function ensurePendingEventsForScope(ownerFilter) {
  const where = {};
  if (ownerFilter) {
    where.user_id = ownerFilter;
  }

  const items = await models.Item.findAll({ where });

  for (const item of items) {
    if (!CASHFLOW_ITEM_TYPES.has(item.item_type)) {
      continue;
    }

    if (getDeletedAt(item.attributes)) {
      continue;
    }

    const dueDate = getDueDate(item.attributes);
    if (!dueDate) {
      continue;
    }

    await syncItemEvent({ item, models });
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toTime(value, fallback = Number.POSITIVE_INFINITY) {
  if (!value) {
    return fallback;
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? fallback : time;
}

function startOfUtcDay(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addYearsUtc(date, count) {
  return new Date(Date.UTC(date.getUTCFullYear() + count, date.getUTCMonth(), date.getUTCDate()));
}

function normalizeInput(input) {
  const payload = isPlainObject(input) ? input : {};
  const scope = isPlainObject(payload.scope) ? payload.scope : {};
  const ownerFilter = resolveOwnerFilter(scope);
  const hasActor = normalizeString(scope.actorUserId).length > 0 || normalizeString(payload.actorUserId).length > 0;
  const status = normalizeString(payload.status).toLowerCase() || "pending";
  const dueFrom = payload.dueFrom ? new Date(payload.dueFrom) : null;
  const dueTo = payload.dueTo ? new Date(payload.dueTo) : null;
  const issues = [];

  if (!hasActor) {
    issues.push({
      field: "scope.actorUserId",
      code: "required",
      category: EVENT_QUERY_ERROR_CATEGORIES.INVALID_REQUEST,
      message: "scope.actorUserId is required."
    });
  }

  if (!STATUS_FILTERS.includes(status)) {
    issues.push({
      field: "status",
      code: "unsupported_status_filter",
      category: EVENT_QUERY_ERROR_CATEGORIES.INVALID_FILTER,
      message: `status must be one of: ${STATUS_FILTERS.join(", ")}.`
    });
  }

  if (payload.dueFrom !== undefined && Number.isNaN(dueFrom.getTime())) {
    issues.push({
      field: "dueFrom",
      code: "invalid_due_from",
      category: EVENT_QUERY_ERROR_CATEGORIES.INVALID_RANGE,
      message: "dueFrom must be a valid date."
    });
  }

  if (payload.dueTo !== undefined && Number.isNaN(dueTo.getTime())) {
    issues.push({
      field: "dueTo",
      code: "invalid_due_to",
      category: EVENT_QUERY_ERROR_CATEGORIES.INVALID_RANGE,
      message: "dueTo must be a valid date."
    });
  }

  if (dueFrom && dueTo && dueFrom.getTime() > dueTo.getTime()) {
    issues.push({
      field: "due_range",
      code: "invalid_due_range",
      category: EVENT_QUERY_ERROR_CATEGORIES.INVALID_RANGE,
      message: "dueFrom cannot be after dueTo."
    });
  }

  if (issues.length > 0) {
    throw new EventQueryError({
      message: "Event list query is invalid.",
      category: issues[0].category,
      issues
    });
  }

  return {
    ownerFilter,
    status,
    dueFrom,
    dueTo,
    now: payload.now instanceof Date ? payload.now : payload.now ? new Date(payload.now) : new Date()
  };
}

function normalizeEvent(eventInstance) {
  const raw = eventInstance.get({ plain: true });

  return {
    id: raw.id,
    item_id: raw.item_id,
    type: raw.event_type,
    amount: raw.amount,
    due_date: raw.due_date,
    status: raw.status,
    recurring: Boolean(raw.is_recurring),
    source_state: "persisted",
    is_projected: false,
    completed_at: raw.completed_at || null,
    created_at: raw.created_at || raw.createdAt,
    updated_at: raw.updated_at || raw.updatedAt
  };
}

function sourceRank(event) {
  return event && event.source_state === "projected" ? 1 : 0;
}

function filterByStatus(events, status) {
  if (status === "all") {
    return events;
  }

  if (status === "completed") {
    return events.filter((event) => event.status === "Completed");
  }

  return events.filter((event) => event.status !== "Completed");
}

function filterByRange(events, dueFrom, dueTo) {
  if (!dueFrom && !dueTo) {
    return events;
  }

  return events.filter((event) => {
    const dueTime = toTime(event.due_date);

    if (dueFrom && dueTime < dueFrom.getTime()) {
      return false;
    }

    if (dueTo && dueTime > dueTo.getTime()) {
      return false;
    }

    return true;
  });
}

function compareEvents(left, right) {
  const dueDiff = toTime(left.due_date) - toTime(right.due_date);
  if (dueDiff !== 0) {
    return dueDiff;
  }

  const sourceDiff = sourceRank(left) - sourceRank(right);
  if (sourceDiff !== 0) {
    return sourceDiff;
  }

  const updatedDiff = toTime(right.updated_at, 0) - toTime(left.updated_at, 0);
  if (updatedDiff !== 0) {
    return updatedDiff;
  }

  return left.id.localeCompare(right.id);
}

function compareEventsDescending(left, right) {
  const dueDiff = toTime(right.due_date) - toTime(left.due_date);
  if (dueDiff !== 0) {
    return dueDiff;
  }

  const sourceDiff = sourceRank(left) - sourceRank(right);
  if (sourceDiff !== 0) {
    return sourceDiff;
  }

  const updatedDiff = toTime(right.updated_at, 0) - toTime(left.updated_at, 0);
  if (updatedDiff !== 0) {
    return updatedDiff;
  }

  return left.id.localeCompare(right.id);
}

function eventDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function mergePersistedAndProjectedEvents(persistedEvents, projectedEvents) {
  const persisted = Array.isArray(persistedEvents) ? persistedEvents : [];
  const projected = Array.isArray(projectedEvents) ? projectedEvents : [];
  const persistedKeys = new Set(
    persisted
      .map((event) => {
        const dueKey = eventDateKey(event.due_date);
        return dueKey ? `${event.item_id}:${dueKey}` : null;
      })
      .filter(Boolean)
  );

  const nonOverlappingProjected = projected.filter((event) => {
    const dueKey = eventDateKey(event.due_date);
    if (!dueKey) {
      return false;
    }

    return persistedKeys.has(`${event.item_id}:${dueKey}`) === false;
  });

  return [...persisted, ...nonOverlappingProjected];
}

function sortUpcomingThenHistory(events, now) {
  const reference = now instanceof Date ? now : new Date(now);
  const todayStart = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate())).getTime();

  const upcoming = [];
  const history = [];

  events.forEach((event) => {
    const dueTime = toTime(event.due_date, Number.NEGATIVE_INFINITY);
    if (dueTime >= todayStart) {
      upcoming.push(event);
      return;
    }
    history.push(event);
  });

  upcoming.sort(compareEvents);
  history.sort(compareEventsDescending);

  return [...upcoming, ...history];
}

function dueGroupKey(event) {
  return new Date(event.due_date).toISOString().slice(0, 10);
}

function groupEvents(events) {
  const map = new Map();

  events.forEach((event) => {
    const key = dueGroupKey(event);
    const existing = map.get(key);

    if (existing) {
      existing.events.push(event);
      return;
    }

    map.set(key, {
      due_date: key,
      events: [event]
    });
  });

  return Array.from(map.values()).sort((left, right) => left.due_date.localeCompare(right.due_date));
}

async function listEvents(input) {
  const query = normalizeInput(input);
  const today = startOfUtcDay(query.now) || startOfUtcDay(new Date());
  const projectionWindowEnd = addYearsUtc(today, 3);
  await ensurePendingEventsForScope(query.ownerFilter);

  const itemWhere = {};
  if (query.ownerFilter) {
    itemWhere.user_id = query.ownerFilter;
  }

  const [rows, financialItems] = await Promise.all([
    models.Event.findAll({
      include: [
        {
          model: models.Item,
          as: "item",
          attributes: ["id", "user_id", "attributes"],
          required: true,
          where: itemWhere
        }
      ]
    }),
    models.Item.findAll({
      where: {
        ...itemWhere,
        item_type: FINANCIAL_ITEM_TYPE
      }
    })
  ]);

  const persistedEvents = rows
    .filter((row) => !getDeletedAt(row.item && row.item.attributes))
    .map(normalizeEvent);
  const persistedByItem = new Map();

  persistedEvents.forEach((event) => {
    const existing = persistedByItem.get(event.item_id);
    if (existing) {
      existing.push(event);
      return;
    }

    persistedByItem.set(event.item_id, [event]);
  });

  const projectedEvents = financialItems
    .filter((item) => !getDeletedAt(item.attributes))
    .flatMap((item) => {
      const existingRows = persistedByItem.get(item.id) || [];
      return projectItemEvents({
        item,
        persistedEvents: existingRows,
        now: query.now,
        windowStart: today,
        windowEnd: projectionWindowEnd
      }).map((event) => ({
        ...event,
        source_state: "projected",
        is_projected: true
      }));
    });

  const allEvents = mergePersistedAndProjectedEvents(persistedEvents, projectedEvents);
  const filtered = sortUpcomingThenHistory(filterByRange(filterByStatus(allEvents, query.status), query.dueFrom, query.dueTo), query.now);

  return {
    groups: groupEvents(filtered),
    total_count: filtered.length
  };
}

module.exports = {
  listEvents
};
