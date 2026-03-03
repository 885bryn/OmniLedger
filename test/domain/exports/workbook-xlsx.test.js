"use strict";

const ExcelJS = require("exceljs");
const {
  serializeWorkbookToXlsx,
  SHEET_ORDER
} = require("../../../src/domain/exports/workbook-xlsx");

describe("workbook xlsx serializer", () => {
  it("serializes deterministic sheet order with headers and rows", async () => {
    const workbookModel = {
      sheets: {
        "Event History": {
          columns: [
            { key: "event_id", label: "Event ID", order: 2 },
            { key: "status", label: "Status", order: 1 }
          ],
          rows: [{ status: "Completed", event_id: "event-1" }]
        },
        Assets: {
          columns: [
            { key: "asset_id", label: "Asset ID", order: 1 },
            { key: "asset_title", label: "Asset Title", order: 2 }
          ],
          rows: [{ asset_id: "asset-1", asset_title: "Oak House" }]
        },
        "Financial Contracts": {
          columns: [
            { key: "contract_id", label: "Contract ID", order: 1 },
            { key: "contract_title", label: "Contract Title", order: 2 }
          ],
          rows: [{ contract_id: "contract-1", contract_title: "Mortgage" }]
        }
      }
    };

    const buffer = await serializeWorkbookToXlsx(workbookModel);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(SHEET_ORDER);

    const assetSheet = workbook.getWorksheet("Assets");
    expect(assetSheet.getRow(1).values.slice(1)).toEqual(["Asset ID", "Asset Title"]);
    expect(assetSheet.getRow(2).values.slice(1)).toEqual(["asset-1", "Oak House"]);

    const contractSheet = workbook.getWorksheet("Financial Contracts");
    expect(contractSheet.getRow(1).values.slice(1)).toEqual(["Contract ID", "Contract Title"]);
    expect(contractSheet.getRow(2).values.slice(1)).toEqual(["contract-1", "Mortgage"]);

    const eventSheet = workbook.getWorksheet("Event History");
    expect(eventSheet.getRow(1).values.slice(1)).toEqual(["Status", "Event ID"]);
    expect(eventSheet.getRow(2).values.slice(1)).toEqual(["Completed", "event-1"]);
  });

  it("applies frozen headers and auto-filter ranges across all sheets", async () => {
    const workbookModel = {
      sheets: {
        Assets: {
          columns: [
            { key: "asset_id", label: "Asset ID", order: 1 },
            { key: "updated_at", label: "Updated At", order: 2 }
          ],
          rows: [
            { asset_id: "asset-1", updated_at: "2026-02-01" },
            { asset_id: "asset-2", updated_at: "2026-02-02" }
          ]
        },
        "Financial Contracts": {
          columns: [{ key: "contract_id", label: "Contract ID", order: 1 }],
          rows: []
        },
        "Event History": {
          columns: [{ key: "event_id", label: "Event ID", order: 1 }],
          rows: [{ event_id: "event-1" }]
        }
      }
    };

    const buffer = await serializeWorkbookToXlsx(workbookModel);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const assetSheet = workbook.getWorksheet("Assets");
    expect(assetSheet.views[0]).toEqual(expect.objectContaining({ state: "frozen", ySplit: 1 }));
    expect(assetSheet.autoFilter).toEqual("A1:B3");

    const contractSheet = workbook.getWorksheet("Financial Contracts");
    expect(contractSheet.views[0]).toEqual(expect.objectContaining({ state: "frozen", ySplit: 1 }));
    expect(contractSheet.autoFilter).toEqual("A1:A1");

    const eventSheet = workbook.getWorksheet("Event History");
    expect(eventSheet.views[0]).toEqual(expect.objectContaining({ state: "frozen", ySplit: 1 }));
    expect(eventSheet.autoFilter).toEqual("A1:A2");
  });
});
