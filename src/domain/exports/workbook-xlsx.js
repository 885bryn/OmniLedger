"use strict";

const ExcelJS = require("exceljs");

const SHEET_ORDER = Object.freeze([
  "Assets",
  "Financial Contracts",
  "Event History"
]);

const DEFAULT_DATE_NUMBER_FORMAT = "yyyy-mm-dd";

function toColumnLetter(columnIndex) {
  let index = Number(columnIndex);
  let letter = "";

  while (index > 0) {
    const remainder = (index - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    index = Math.floor((index - 1) / 26);
  }

  return letter;
}

function sortedColumns(columns) {
  return [...columns].sort((left, right) => {
    const leftOrder = Number.isFinite(left.order) ? left.order : Number.MAX_SAFE_INTEGER;
    const rightOrder = Number.isFinite(right.order) ? right.order : Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });
}

function asSheetContract(sheets, sheetName) {
  const source = sheets && typeof sheets === "object" ? sheets[sheetName] : null;
  const columns = source && Array.isArray(source.columns) ? source.columns : [];
  const rows = source && Array.isArray(source.rows) ? source.rows : [];

  return {
    columns: sortedColumns(columns),
    rows
  };
}

function applySheetDefaults(worksheet, columnCount, rowCount) {
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  if (columnCount <= 0) {
    return;
  }

  const lastColumn = toColumnLetter(columnCount);
  const lastRow = Math.max(1, rowCount + 1);
  worksheet.autoFilter = `A1:${lastColumn}${lastRow}`;
}

function applyDateCellFormatting(row, values) {
  values.forEach((value, index) => {
    if (value instanceof Date) {
      row.getCell(index + 1).numFmt = DEFAULT_DATE_NUMBER_FORMAT;
    }
  });
}

async function serializeWorkbookToXlsx(workbookModel) {
  const workbook = new ExcelJS.Workbook();
  const sheets = workbookModel && typeof workbookModel === "object" ? workbookModel.sheets : null;

  SHEET_ORDER.forEach((sheetName) => {
    const contract = asSheetContract(sheets, sheetName);
    const worksheet = workbook.addWorksheet(sheetName);
    const headers = contract.columns.map((column) => column.label);

    if (headers.length > 0) {
      worksheet.addRow(headers);
    }

    contract.rows.forEach((row) => {
      const values = contract.columns.map((column) => row[column.key]);
      const worksheetRow = worksheet.addRow(values);
      applyDateCellFormatting(worksheetRow, values);
    });

    applySheetDefaults(worksheet, contract.columns.length, contract.rows.length);
  });

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

module.exports = {
  serializeWorkbookToXlsx,
  SHEET_ORDER
};
