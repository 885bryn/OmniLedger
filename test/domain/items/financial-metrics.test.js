"use strict";

const { deriveFinancialMetrics, resolveCompletedAt } = require("../../../src/domain/items/financial-metrics");

function createTrackedItem({ subtype = "Commitment" } = {}) {
  return {
    item_type: "FinancialItem",
    type: subtype,
    frequency: "monthly",
    attributes: {
      financialSubtype: subtype,
      dynamicTrackingEnabled: true,
      trackingStartingRemainingBalance: 5000,
      trackingStartingCollectedTotal: 0
    }
  };
}

describe("financial-metrics resolveCompletedAt", () => {
  it("prefers actual_date over completed_at when both are present", () => {
    const resolved = resolveCompletedAt({
      actual_date: "2026-03-15",
      completed_at: "2026-03-14T22:30:00.000Z"
    });

    expect(resolved).toBeInstanceOf(Date);
    expect(resolved.toISOString().slice(0, 10)).toBe("2026-03-15");
  });

  it("falls back to completed_at when actual_date is null", () => {
    const resolved = resolveCompletedAt({
      actual_date: null,
      completed_at: "2026-03-14T22:30:00.000Z"
    });

    expect(resolved).toBeInstanceOf(Date);
    expect(resolved.toISOString().slice(0, 10)).toBe("2026-03-14");
  });

  it("uses actual_date when completed_at is missing", () => {
    const resolved = resolveCompletedAt({
      actual_date: "2026-03-15"
    });

    expect(resolved).toBeInstanceOf(Date);
    expect(resolved.toISOString().slice(0, 10)).toBe("2026-03-15");
  });

  it("returns null when event is null", () => {
    expect(resolveCompletedAt(null)).toBeNull();
  });

  it("parses DATEONLY actual_date without timezone shift", () => {
    const resolved = resolveCompletedAt({
      actual_date: "2026-03-15",
      completed_at: "2026-03-14T23:59:00.000Z"
    });

    expect(resolved).toBeInstanceOf(Date);
    expect(resolved.toISOString().slice(0, 10)).toBe("2026-03-15");
  });
});

describe("financial-metrics deriveFinancialMetrics", () => {
  it("uses actual_date for commitment lastPaymentDate", () => {
    const metrics = deriveFinancialMetrics(createTrackedItem({ subtype: "Commitment" }), [
      {
        status: "Completed",
        amount: 1200,
        actual_amount: 1275.25,
        actual_date: "2026-03-20",
        completed_at: "2026-03-19T23:00:00.000Z"
      }
    ]);

    expect(metrics.lastPaymentDate).toBe("2026-03-20");
    expect(metrics.trackingLastCompletedDate).toBe("2026-03-20");
  });

  it("uses actual_date for income lastCollectedDate", () => {
    const metrics = deriveFinancialMetrics(createTrackedItem({ subtype: "Income" }), [
      {
        status: "Completed",
        amount: 900,
        actual_amount: 910,
        actual_date: "2026-03-20",
        completed_at: "2026-03-19T23:00:00.000Z"
      }
    ]);

    expect(metrics.lastCollectedDate).toBe("2026-03-20");
    expect(metrics.trackingLastCompletedDate).toBe("2026-03-20");
  });
});
