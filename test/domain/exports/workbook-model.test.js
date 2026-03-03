"use strict";

const {
  ASSETS_COLUMNS,
  FINANCIAL_CONTRACT_COLUMNS
} = require("../../../src/domain/exports/workbook-columns");
const {
  EXPLICIT_MARKERS,
  flattenAttributes,
  formatAmount,
  formatDate,
  formatEnumLabel
} = require("../../../src/domain/exports/workbook-formatters");

describe("workbook column contracts and formatter policy", () => {
  it("defines frozen deterministic Assets and Financial Contracts column order", () => {
    expect(Object.isFrozen(ASSETS_COLUMNS)).toBe(true);
    expect(Object.isFrozen(FINANCIAL_CONTRACT_COLUMNS)).toBe(true);
    expect(ASSETS_COLUMNS.map((column) => column.order)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
      10, 11, 12, 13, 14, 15, 16, 17, 18
    ]);
    expect(FINANCIAL_CONTRACT_COLUMNS.map((column) => column.order)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
      9, 10, 11, 12, 13, 14, 15
    ]);
  });

  it("formats enum labels, dates, amounts, and overflow markers explicitly", () => {
    const flattened = flattenAttributes(
      { address: "11 Oak Lane", unknownZ: "z", unknownA: "a" },
      { address: ["address"], vin: ["vin"] }
    );

    expect(formatEnumLabel("one_time")).toBe("One Time");
    expect(formatAmount("12.5")).toBe("12.50");
    expect(formatDate("2026-05-01T00:00:00.000Z")).toBe("2026-05-01");
    expect(formatDate("bad-date")).toBe(EXPLICIT_MARKERS.notAvailable);
    expect(flattened.flattened).toEqual({ address: "11 Oak Lane", vin: null });
    expect(flattened.overflowText).toBe('{"unknownA":"a","unknownZ":"z"}');
  });
});
