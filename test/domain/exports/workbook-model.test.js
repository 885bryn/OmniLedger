"use strict";

const {
  ASSETS_COLUMNS,
  FINANCIAL_CONTRACT_COLUMNS,
  EVENT_HISTORY_COLUMNS
} = require("../../../src/domain/exports/workbook-columns");
const {
  EXPLICIT_MARKERS,
  flattenAttributes,
  formatAmount,
  formatDate,
  formatEnumLabel
} = require("../../../src/domain/exports/workbook-formatters");
const { buildWorkbookModel } = require("../../../src/domain/exports/workbook-model");

describe("workbook model domain transform", () => {
  it("defines frozen deterministic Assets, Financial Contracts, and Event History column order", () => {
    expect(Object.isFrozen(ASSETS_COLUMNS)).toBe(true);
    expect(Object.isFrozen(FINANCIAL_CONTRACT_COLUMNS)).toBe(true);
    expect(Object.isFrozen(EVENT_HISTORY_COLUMNS)).toBe(true);
    expect(ASSETS_COLUMNS.map((column) => column.order)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
      10, 11, 12, 13, 14, 15, 16, 17, 18
    ]);
    expect(FINANCIAL_CONTRACT_COLUMNS.map((column) => column.order)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
      9, 10, 11, 12, 13, 14, 15
    ]);
    expect(EVENT_HISTORY_COLUMNS.map((column) => column.order)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
      9, 10, 11, 12, 13, 14, 15, 16
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

  it("builds deterministic Assets and Financial Contracts rows with relationship and marker fidelity", () => {
    const result = buildWorkbookModel({
      datasets: {
        items: {
          rows: [
            {
              id: "asset-1",
              user_id: "owner-1",
              item_type: "RealEstate",
              title: "Oak House",
              status: "active",
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-02T00:00:00.000Z",
              attributes: {
                address: "11 Oak Lane",
                estimatedValue: 500000,
                zip: "10001"
              }
            },
            {
              id: "asset-3",
              user_id: "owner-1",
              item_type: "Vehicle",
              title: "Audi",
              status: "active",
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-02T00:00:00.000Z",
              attributes: {
                vin: "VIN-3",
                estimatedValue: 25000
              }
            },
            {
              id: "asset-2",
              user_id: "owner-1",
              item_type: "Vehicle",
              title: "Audi",
              status: "active",
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-02T00:00:00.000Z",
              attributes: {
                vin: "VIN-2",
                make: "Audi",
                model: "Q5",
                year: 2024,
                estimatedValue: "30000",
                nickname: "Family SUV"
              }
            },
            {
              id: "asset-4",
              user_id: "owner-1",
              item_type: "Vehicle",
              title: "Trailer",
              parent_item_id: "asset-missing",
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-02T00:00:00.000Z",
              attributes: {
                vin: "VIN-4"
              }
            },
            {
              id: "fin-2",
              user_id: "owner-1",
              item_type: "FinancialItem",
              title: "",
              type: "Income",
              frequency: "monthly",
              status: "Active",
              created_at: "2026-01-10T00:00:00.000Z",
              updated_at: "2026-01-11T00:00:00.000Z",
              attributes: {
                linkedAssetItemId: "asset-2",
                dueDate: "2026-03-10",
                amount: 2000,
                name: "Rental Income"
              }
            },
            {
              id: "fin-1",
              user_id: "owner-1",
              item_type: "FinancialItem",
              title: "Mortgage",
              type: "Commitment",
              frequency: "monthly",
              status: "Active",
              default_amount: 1200,
              linked_asset_item_id: "asset-1",
              created_at: "2026-01-10T00:00:00.000Z",
              updated_at: "2026-01-11T00:00:00.000Z",
              attributes: {
                dueDate: "2026-03-10",
                amount: "1200",
                lender: "Bank Co"
              }
            },
            {
              id: "fin-0",
              user_id: "owner-1",
              item_type: "FinancialItem",
              title: "Parking",
              type: "Commitment",
              frequency: "monthly",
              status: "Active",
              linked_asset_item_id: "asset-2",
              created_at: "2026-01-10T00:00:00.000Z",
              updated_at: "2026-01-11T00:00:00.000Z",
              attributes: {
                dueDate: "2026-03-10",
                amount: 40
              }
            },
            {
              id: "fin-3",
              user_id: "owner-1",
              item_type: "FinancialItem",
              title: "Old Note",
              type: "Commitment",
              frequency: "one_time",
              status: "Closed",
              parent_item_id: "asset-ghost",
              created_at: "2026-01-10T00:00:00.000Z",
              updated_at: "2026-01-11T00:00:00.000Z",
              attributes: {
                amount: "oops"
              }
            }
          ]
        },
        events: {
          rows: [
            {
              id: "event-5",
              item_id: "fin-3",
              event_type: "payment_due",
              due_date: "2026-05-01",
              amount: 50,
              status: "scheduled",
              is_recurring: false,
              is_exception: true,
              completed_at: null,
              owner_user_id: "owner-1",
              created_at: "2026-01-09T00:00:00.000Z",
              updated_at: "2026-05-01T00:00:00.000Z"
            },
            {
              id: "event-4",
              item_id: "fin-2",
              event_type: "payment_complete",
              due_date: "2026-03-10",
              amount: 2000,
              status: "completed",
              is_recurring: true,
              is_exception: false,
              completed_at: "2026-04-20",
              owner_user_id: "owner-1",
              created_at: "2026-01-09T00:00:00.000Z",
              updated_at: "2026-04-20T00:00:00.000Z"
            },
            {
              id: "event-2",
              item_id: "fin-1",
              event_type: "payment_due",
              due_date: "2026-04-15",
              amount: 1200,
              status: "due",
              is_recurring: true,
              is_exception: false,
              completed_at: null,
              owner_user_id: "owner-1",
              created_at: "2026-01-09T00:00:00.000Z",
              updated_at: "2026-04-15T00:00:00.000Z"
            },
            {
              id: "event-3",
              item_id: "asset-2",
              event_type: "maintenance_due",
              due_date: "2026-04-15",
              amount: 75,
              status: "due",
              is_recurring: false,
              is_exception: false,
              completed_at: null,
              owner_user_id: "owner-1",
              created_at: "2026-01-09T00:00:00.000Z",
              updated_at: "2026-04-15T00:00:00.000Z"
            },
            {
              id: "event-1",
              item_id: "item-missing",
              event_type: null,
              due_date: null,
              amount: null,
              status: null,
              is_recurring: null,
              is_exception: null,
              completed_at: null,
              owner_user_id: "owner-1",
              created_at: "2026-02-01T00:00:00.000Z",
              updated_at: "2026-02-01T00:00:00.000Z"
            }
          ]
        }
      }
    });

    const assetRows = result.sheets.Assets.rows;
    const financialRows = result.sheets["Financial Contracts"].rows;
    const eventRows = result.sheets["Event History"].rows;

    expect(Object.keys(result.sheets)).toEqual(["Assets", "Financial Contracts", "Event History"]);

    expect(assetRows.map((row) => row.asset_id)).toEqual(["asset-1", "asset-2", "asset-3", "asset-4"]);
    expect(financialRows.map((row) => row.contract_id)).toEqual(["fin-0", "fin-1", "fin-2", "fin-3"]);
    expect(eventRows.map((row) => row.event_id)).toEqual(["event-5", "event-4", "event-2", "event-3", "event-1"]);

    assetRows.forEach((row) => {
      expect(Object.keys(row)).toEqual(ASSETS_COLUMNS.map((column) => column.key));
    });
    financialRows.forEach((row) => {
      expect(Object.keys(row)).toEqual(FINANCIAL_CONTRACT_COLUMNS.map((column) => column.key));
    });
    eventRows.forEach((row) => {
      expect(Object.keys(row)).toEqual(EVENT_HISTORY_COLUMNS.map((column) => column.key));
    });

    expect(assetRows[0]).toMatchObject({
      asset_type: "Real Estate",
      asset_title: "Oak House",
      linked_contract_ids: "fin-1",
      linked_contract_titles: "Mortgage",
      status: "Active",
      estimated_value: "500000.00",
      attributes_overflow: '{"zip":"10001"}'
    });

    expect(assetRows[1]).toMatchObject({
      linked_contract_ids: "fin-0, fin-2",
      linked_contract_titles: "Parking | Rental Income",
      estimated_value: "30000.00",
      attributes_overflow: '{"nickname":"Family SUV"}'
    });

    expect(assetRows[3]).toMatchObject({
      parent_item_id: "asset-missing",
      parent_item_title: EXPLICIT_MARKERS.unresolved,
      status: EXPLICIT_MARKERS.notAvailable,
      estimated_value: EXPLICIT_MARKERS.notAvailable
    });

    expect(financialRows[0]).toMatchObject({
      linked_asset_item_id: "asset-2",
      linked_asset_title: "Audi",
      contract_subtype: "Commitment",
      frequency: "Monthly",
      default_amount: "40.00",
      next_due_date: "2026-03-10"
    });

    expect(financialRows[1]).toMatchObject({
      linked_asset_item_id: "asset-1",
      linked_asset_title: "Oak House",
      default_amount: "1200.00",
      attributes_overflow: '{"lender":"Bank Co"}'
    });

    expect(financialRows[2]).toMatchObject({
      contract_title: "Rental Income",
      contract_subtype: "Income",
      linked_asset_item_id: "asset-2",
      linked_asset_title: "Audi",
      default_amount: "2000.00"
    });

    expect(financialRows[3]).toMatchObject({
      linked_asset_item_id: "asset-ghost",
      linked_asset_title: EXPLICIT_MARKERS.unresolved,
      parent_item_id: "asset-ghost",
      parent_item_title: EXPLICIT_MARKERS.unresolved,
      frequency: "One Time",
      default_amount: EXPLICIT_MARKERS.notAvailable,
      next_due_date: EXPLICIT_MARKERS.notAvailable
    });

    expect(eventRows[0]).toMatchObject({
      status: "Scheduled",
      due_date: "2026-05-01",
      completed_at: EXPLICIT_MARKERS.notAvailable,
      amount: "50.00",
      is_recurring: "No",
      is_exception: "Yes",
      item_id: "fin-3",
      contract_id: "fin-3",
      contract_title: "Old Note",
      asset_id: "asset-ghost",
      asset_title: EXPLICIT_MARKERS.unresolved
    });

    expect(eventRows[1]).toMatchObject({
      status: "Completed",
      due_date: "2026-03-10",
      completed_at: "2026-04-20",
      amount: "2000.00",
      contract_id: "fin-2",
      contract_title: "Rental Income",
      asset_id: "asset-2",
      asset_title: "Audi"
    });

    expect(eventRows[2]).toMatchObject({
      event_id: "event-2",
      due_date: "2026-04-15",
      contract_id: "fin-1",
      contract_title: "Mortgage",
      asset_id: "asset-1",
      asset_title: "Oak House"
    });

    expect(eventRows[3]).toMatchObject({
      event_id: "event-3",
      contract_id: EXPLICIT_MARKERS.notAvailable,
      contract_title: EXPLICIT_MARKERS.notAvailable,
      asset_id: "asset-2",
      asset_title: "Audi"
    });

    expect(eventRows[4]).toMatchObject({
      status: EXPLICIT_MARKERS.notAvailable,
      event_type: EXPLICIT_MARKERS.notAvailable,
      due_date: EXPLICIT_MARKERS.notAvailable,
      completed_at: EXPLICIT_MARKERS.notAvailable,
      amount: EXPLICIT_MARKERS.notAvailable,
      is_recurring: EXPLICIT_MARKERS.notAvailable,
      is_exception: EXPLICIT_MARKERS.notAvailable,
      item_id: "item-missing",
      contract_id: EXPLICIT_MARKERS.notAvailable,
      contract_title: EXPLICIT_MARKERS.notAvailable,
      asset_id: EXPLICIT_MARKERS.notAvailable,
      asset_title: EXPLICIT_MARKERS.notAvailable
    });
  });

  it("enforces cross-sheet sanitization and deterministic date policy behavior", () => {
    const sharedDatasets = {
      items: {
        rows: [
          {
            id: "asset-policy",
            user_id: "owner-1",
            item_type: "Vehicle",
            title: "=Injected Asset",
            status: "active",
            created_at: new Date("2026-06-01T01:00:00.000Z"),
            updated_at: "2026-06-01T01:00:00.000Z",
            attributes: {
              make: "+Tesla",
              model: "Model S",
              year: 2026,
              nickname: "@House Car"
            }
          },
          {
            id: "fin-policy",
            user_id: "owner-1",
            item_type: "FinancialItem",
            title: "-Lease",
            type: "Commitment",
            frequency: "monthly",
            status: "Active",
            linked_asset_item_id: "asset-policy",
            created_at: "2026-06-01T01:00:00.000Z",
            updated_at: "2026-06-01T01:00:00.000Z",
            attributes: {
              dueDate: "bad-date",
              amount: 900
            }
          }
        ]
      },
      events: {
        rows: [
          {
            id: "event-policy",
            item_id: "fin-policy",
            event_type: "payment_due",
            due_date: "2026-06-01T01:00:00.000Z",
            amount: 75,
            status: "scheduled",
            is_recurring: true,
            is_exception: false,
            completed_at: null,
            owner_user_id: "owner-1",
            created_at: "2026-06-01T01:00:00.000Z",
            updated_at: "2026-06-01T01:00:00.000Z"
          }
        ]
      }
    };

    const fallbackResult = buildWorkbookModel({ datasets: sharedDatasets });
    const preferredResult = buildWorkbookModel({
      datasets: sharedDatasets,
      exportPreferences: {
        locale: "en-US",
        timeZone: "America/Los_Angeles"
      }
    });

    const fallbackAsset = fallbackResult.sheets.Assets.rows[0];
    const fallbackFinancial = fallbackResult.sheets["Financial Contracts"].rows[0];
    const fallbackEvent = fallbackResult.sheets["Event History"].rows[0];

    expect(fallbackAsset.asset_title).toBe("'=Injected Asset");
    expect(fallbackAsset.make).toBe("'+Tesla");
    expect(fallbackAsset.attributes_overflow).toContain("@House Car");
    expect(fallbackAsset.created_at).toBeInstanceOf(Date);
    expect(fallbackAsset.year).toBe(2026);

    expect(fallbackFinancial.contract_title).toBe("'-Lease");
    expect(fallbackFinancial.next_due_date).toBe(EXPLICIT_MARKERS.invalidDate);

    expect(fallbackEvent.due_date).toBe("2026-06-01");
    expect(preferredResult.sheets["Event History"].rows[0].due_date).toBe("2026-05-31");
  });
});
