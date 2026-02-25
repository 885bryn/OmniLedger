"use strict";

const { models } = require("../../db");
const { EventQueryError, EVENT_QUERY_ERROR_CATEGORIES } = require("./event-query-errors");

const STATUS_FILTERS = Object.freeze(["all", "pending", "completed"]);

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

function normalizeInput(input) {
  const payload = isPlainObject(input) ? input : {};
  const actorUserId = normalizeString(payload.actorUserId);
  const status = normalizeString(payload.status).toLowerCase() || "pending";
  const dueFrom = payload.dueFrom ? new Date(payload.dueFrom) : null;
  const dueTo = payload.dueTo ? new Date(payload.dueTo) : null;
  const issues = [];

  if (!actorUserId) {
    issues.push({
      field: "actorUserId",
      code: "required",
      category: EVENT_QUERY_ERROR_CATEGORIES.INVALID_REQUEST,
      message: "actorUserId is required."
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
    actorUserId,
    status,
    dueFrom,
    dueTo
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
    completed_at: raw.completed_at || null,
    created_at: raw.created_at || raw.createdAt,
    updated_at: raw.updated_at || raw.updatedAt
  };
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

  const updatedDiff = toTime(right.updated_at, 0) - toTime(left.updated_at, 0);
  if (updatedDiff !== 0) {
    return updatedDiff;
  }

  return left.id.localeCompare(right.id);
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
  const rows = await models.Event.findAll({
    include: [
      {
        model: models.Item,
        as: "item",
        attributes: ["id", "user_id"],
        required: true,
        where: {
          user_id: query.actorUserId
        }
      }
    ]
  });

  const events = rows.map(normalizeEvent);
  const filtered = filterByRange(filterByStatus(events, query.status), query.dueFrom, query.dueTo).sort(compareEvents);

  return {
    groups: groupEvents(filtered),
    total_count: filtered.length
  };
}

module.exports = {
  listEvents
};
