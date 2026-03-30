"use strict";

const { Op } = require("sequelize");

const FINANCIAL_ITEM_TYPE = "FinancialItem";
const COMPLETED_STATUS = "completed";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
}

function toFiniteNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeStatus(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function resolveTrackedEventAmount(event) {
  if (!event) {
    return null;
  }

  const status = normalizeStatus(event.status);
  const actualAmount = toFiniteNumber(event.actual_amount);
  if (status === COMPLETED_STATUS && actualAmount !== null) {
    return actualAmount;
  }

  return toFiniteNumber(event.amount);
}

function normalizeSubtype(itemType, attributes) {
  if (itemType === "Income") {
    return "Income";
  }

  if (itemType === "Commitment") {
    return "Commitment";
  }

  const attrs = isPlainObject(attributes) ? attributes : {};
  const candidate = typeof attrs.financialSubtype === "string" ? attrs.financialSubtype.trim() : "";

  if (candidate === "Income") {
    return "Income";
  }

  if (candidate === "Commitment") {
    return "Commitment";
  }

  return null;
}

function resolveCompletedAt(event) {
  if (!event) {
    return null;
  }

  const actualDate = event.actual_date || event.actualDate;
  if (actualDate) {
    const parts = String(actualDate).split("-");
    if (parts.length === 3) {
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      const day = Number(parts[2]);
      if (Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day)) {
        const parsedActualDate = new Date(Date.UTC(year, month - 1, day));
        if (!Number.isNaN(parsedActualDate.getTime())) {
          return parsedActualDate;
        }
      }
    }
  }

  const candidate = event.completed_at || event.completedAt || event.updated_at || event.updatedAt || event.due_date || event.dueDate;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getAttributes(item) {
  if (!item) {
    return {};
  }

  const source = item.attributes;
  return isPlainObject(source) ? source : {};
}

function isRecurringFinancialItem(item) {
  if (!item || item.item_type !== FINANCIAL_ITEM_TYPE) {
    return false;
  }

  return typeof item.frequency === "string" && item.frequency !== "one_time";
}

function isTrackingEnabled(item) {
  if (!isRecurringFinancialItem(item)) {
    return false;
  }

  const attributes = getAttributes(item);
  if (attributes.dynamicTrackingEnabled === false) {
    return false;
  }

  return true;
}

function roundToCents(value) {
  return Number(Number(value).toFixed(2));
}

function deriveFinancialMetrics(item, completedEvents) {
  if (!isTrackingEnabled(item)) {
    return null;
  }

  const subtype = normalizeSubtype(item.type, item.attributes);
  if (!subtype) {
    return null;
  }

  const events = Array.isArray(completedEvents) ? completedEvents : [];
  const completedTotal = roundToCents(
    events.reduce((total, event) => {
      const amount = resolveTrackedEventAmount(event);
      return amount === null ? total : total + amount;
    }, 0)
  );

  const latestCompleted = [...events]
    .sort((left, right) => {
      const leftTime = resolveCompletedAt(left);
      const rightTime = resolveCompletedAt(right);
      const leftTs = leftTime ? leftTime.getTime() : Number.NEGATIVE_INFINITY;
      const rightTs = rightTime ? rightTime.getTime() : Number.NEGATIVE_INFINITY;
      return rightTs - leftTs;
    })
    .at(0);

  const latestDate = resolveCompletedAt(latestCompleted);
  const latestAmount = latestCompleted ? resolveTrackedEventAmount(latestCompleted) : null;
  const attrs = getAttributes(item);

  const base = {
    trackingCompletedCount: events.length,
    trackingCompletedTotal: completedTotal,
    trackingLastCompletedDate: latestDate ? latestDate.toISOString().slice(0, 10) : null,
    trackingLastCompletedAmount: latestAmount
  };

  if (subtype === "Commitment") {
    const startingRemaining = toFiniteNumber(attrs.trackingStartingRemainingBalance)
      ?? toFiniteNumber(attrs.remainingBalance)
      ?? toFiniteNumber(attrs.originalPrincipal);

    return {
      ...base,
      remainingBalance: startingRemaining === null ? null : roundToCents(Math.max(0, startingRemaining - completedTotal)),
      lastPaymentAmount: latestAmount,
      lastPaymentDate: latestDate ? latestDate.toISOString().slice(0, 10) : null
    };
  }

  const startingCollected = toFiniteNumber(attrs.trackingStartingCollectedTotal) ?? toFiniteNumber(attrs.collectedTotal) ?? 0;
  return {
    ...base,
    collectedTotal: roundToCents(startingCollected + completedTotal),
    lastCollectedAmount: latestAmount,
    lastCollectedDate: latestDate ? latestDate.toISOString().slice(0, 10) : null
  };
}

function applyDerivedMetrics(attributes, metrics) {
  const next = {
    ...(isPlainObject(attributes) ? attributes : {})
  };

  if (!metrics) {
    return next;
  }

  next.trackingCompletedCount = metrics.trackingCompletedCount;
  next.trackingCompletedTotal = metrics.trackingCompletedTotal;

  if (metrics.trackingLastCompletedDate) {
    next.trackingLastCompletedDate = metrics.trackingLastCompletedDate;
  } else {
    delete next.trackingLastCompletedDate;
  }

  if (metrics.trackingLastCompletedAmount === null || metrics.trackingLastCompletedAmount === undefined) {
    delete next.trackingLastCompletedAmount;
  } else {
    next.trackingLastCompletedAmount = metrics.trackingLastCompletedAmount;
  }

  if (Object.prototype.hasOwnProperty.call(metrics, "remainingBalance")) {
    if (metrics.remainingBalance === null || metrics.remainingBalance === undefined) {
      delete next.remainingBalance;
    } else {
      next.remainingBalance = metrics.remainingBalance;
    }

    if (metrics.lastPaymentAmount === null || metrics.lastPaymentAmount === undefined) {
      delete next.lastPaymentAmount;
    } else {
      next.lastPaymentAmount = metrics.lastPaymentAmount;
    }

    if (metrics.lastPaymentDate) {
      next.lastPaymentDate = metrics.lastPaymentDate;
    } else {
      delete next.lastPaymentDate;
    }
  }

  if (Object.prototype.hasOwnProperty.call(metrics, "collectedTotal")) {
    next.collectedTotal = metrics.collectedTotal;

    if (metrics.lastCollectedAmount === null || metrics.lastCollectedAmount === undefined) {
      delete next.lastCollectedAmount;
    } else {
      next.lastCollectedAmount = metrics.lastCollectedAmount;
    }

    if (metrics.lastCollectedDate) {
      next.lastCollectedDate = metrics.lastCollectedDate;
    } else {
      delete next.lastCollectedDate;
    }
  }

  return next;
}

async function loadCompletedEventsByItemId({ itemIds, models, transaction }) {
  const ids = Array.isArray(itemIds) ? itemIds.filter((value) => typeof value === "string" && value.trim() !== "") : [];
  if (ids.length === 0) {
    return new Map();
  }

  const rows = await models.Event.findAll({
    where: {
      item_id: {
        [Op.in]: ids
      },
      status: "Completed"
    },
    transaction
  });

  const grouped = new Map();
  rows.forEach((row) => {
    const existing = grouped.get(row.item_id);
    if (existing) {
      existing.push(row);
      return;
    }

    grouped.set(row.item_id, [row]);
  });

  return grouped;
}

async function recalculateAndPersistFinancialProgress({ item, models, transaction }) {
  if (!item || !isTrackingEnabled(item)) {
    return item;
  }

  const grouped = await loadCompletedEventsByItemId({ itemIds: [item.id], models, transaction });
  const completedEvents = grouped.get(item.id) || [];
  const metrics = deriveFinancialMetrics(item, completedEvents);

  if (!metrics) {
    return item;
  }

  item.attributes = applyDerivedMetrics(item.attributes, metrics);
  await item.save({ transaction });
  return item;
}

async function applyComputedFinancialProgress(items, models) {
  const rows = Array.isArray(items) ? items : [];
  const recurringRows = rows.filter((row) => isTrackingEnabled(row));
  if (recurringRows.length === 0) {
    return rows;
  }

  const grouped = await loadCompletedEventsByItemId({ itemIds: recurringRows.map((row) => row.id), models });

  return rows.map((row) => {
    if (!isTrackingEnabled(row)) {
      return row;
    }

    const metrics = deriveFinancialMetrics(row, grouped.get(row.id) || []);
    if (!metrics) {
      return row;
    }

    return {
      ...row,
      attributes: applyDerivedMetrics(row.attributes, metrics)
    };
  });
}

module.exports = {
  applyDerivedMetrics,
  applyComputedFinancialProgress,
  deriveFinancialMetrics,
  recalculateAndPersistFinancialProgress,
  resolveCompletedAt
};
