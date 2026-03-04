"use strict";

const request = require("supertest");
const bcrypt = require("bcryptjs");
const ExcelJS = require("exceljs");

jest.mock("../../src/db", () => {
  const { Sequelize } = require("sequelize");
  const { registerModels } = require("../../src/db/models");

  const sequelize = new Sequelize("sqlite::memory:", { logging: false });
  const models = registerModels(sequelize);

  return {
    sequelize,
    models
  };
});

const { sequelize, models } = require("../../src/db");
const { createApp } = require("../../src/api/app");

process.env.SESSION_SECRET = "test-session-secret";
process.env.FRONTEND_ORIGIN = "http://localhost:5173";

function worksheetRowsAsObjects(worksheet) {
  const header = worksheet.getRow(1).values.slice(1);
  const rows = [];

  for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    const rowValues = worksheet.getRow(rowIndex).values.slice(1);
    const rowObject = {};

    header.forEach((columnName, index) => {
      rowObject[columnName] = rowValues[index] == null ? "" : String(rowValues[index]);
    });

    rows.push(rowObject);
  }

  return rows;
}

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

function assertWorkbookUsabilityDefaults(workbook) {
  workbook.worksheets.forEach((worksheet) => {
    expect(worksheet.views[0]).toEqual(expect.objectContaining({ state: "frozen", ySplit: 1 }));

    if (worksheet.columnCount > 0) {
      const lastColumn = toColumnLetter(worksheet.columnCount);
      const lastRow = Math.max(1, worksheet.rowCount);
      expect(worksheet.autoFilter).toBe(`A1:${lastColumn}${lastRow}`);
    }
  });
}

function findHeaderColumnIndex(worksheet, headerName) {
  const headers = worksheet.getRow(1).values.slice(1);
  const headerIndex = headers.findIndex((header) => header === headerName);
  return headerIndex >= 0 ? headerIndex + 1 : -1;
}

function readDateOnlyCell(worksheet, rowIndex, headerName) {
  const columnIndex = findHeaderColumnIndex(worksheet, headerName);
  if (columnIndex < 1) {
    throw new Error(`Missing worksheet header: ${headerName}`);
  }

  const cellValue = worksheet.getRow(rowIndex).getCell(columnIndex).value;
  if (cellValue instanceof Date) {
    return cellValue.toISOString().slice(0, 10);
  }

  return cellValue == null ? "" : String(cellValue);
}

async function parseWorkbookResponse(response) {
  expect(response.headers["content-type"]).toMatch(
    /application\/vnd.openxmlformats-officedocument.spreadsheetml.sheet/
  );
  expect(response.headers["content-disposition"]).toMatch(
    /attachment; filename="?hact-backup-\d{4}-\d{2}-\d{2}\.xlsx"?/
  );

  const payload = Buffer.isBuffer(response.body)
    ? response.body
    : Buffer.from(response.body || "");

  expect(payload.length).toBeGreaterThan(0);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(payload);

  expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
    "Assets",
    "Financial Contracts",
    "Event History"
  ]);

  assertWorkbookUsabilityDefaults(workbook);

  return workbook;
}

function binaryParser(res, callback) {
  res.setEncoding("binary");
  let data = "";

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    callback(null, Buffer.from(data, "binary"));
  });
}

async function fetchLatestExportAudit(action) {
  return models.AuditLog.findOne({
    where: {
      action,
      entity: "export:backup.xlsx"
    },
    order: [["timestamp", "DESC"], ["created_at", "DESC"]]
  });
}

function assertAuditTimestamp(timestampValue) {
  const parsed = Date.parse(String(timestampValue || ""));
  expect(Number.isNaN(parsed)).toBe(false);
}

describe("exports backup scope enforcement", () => {
  const app = createApp();
  let userCounter = 0;
  const originalAdminEmail = process.env.HACT_ADMIN_EMAIL;

  async function createUser(overrides = {}) {
    userCounter += 1;
    const password = overrides.password || "StrongPass123!";
    const passwordHash = await bcrypt.hash(password, 12);

    const created = await models.User.create({
      username: overrides.username || `export-user-${userCounter}`,
      email: overrides.email || `export-user-${userCounter}@example.com`,
      password_hash: passwordHash,
      role: overrides.role
    });

    return {
      id: created.id,
      username: created.username,
      email: created.email,
      password
    };
  }

  async function createItem(userId, attributes = {}) {
    return models.Item.create({
      user_id: userId,
      item_type: "RealEstate",
      title: attributes.title || null,
      attributes: {
        address: "Export Scope House",
        estimatedValue: 250000,
        ...attributes
      }
    });
  }

  async function createFinancialContract(userId, options = {}) {
    const {
      linkedAssetItemId = null,
      title = "Contract",
      type = "Commitment",
      frequency = "monthly",
      status = "Active",
      defaultAmount = "100.00",
      attributes = {}
    } = options;

    return models.Item.create({
      user_id: userId,
      item_type: "FinancialItem",
      title,
      type,
      frequency,
      status,
      default_amount: defaultAmount,
      linked_asset_item_id: linkedAssetItemId,
      attributes: {
        dueDate: "2026-07-15",
        amount: Number(defaultAmount),
        ...attributes
      }
    });
  }

  async function createEvent(itemId, dueDate) {
    return models.Event.create({
      item_id: itemId,
      event_type: "MortgagePayment",
      due_date: dueDate,
      amount: "100.00",
      status: "Pending",
      is_recurring: false
    });
  }

  async function signIn(agent, email, password) {
    const login = await agent.post("/auth/login").send({ email, password });
    expect(login.status).toBe(200);
    return login;
  }

  beforeAll(async () => {
    await sequelize.query("PRAGMA foreign_keys = ON");
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    process.env.HACT_ADMIN_EMAIL = "admin@example.com";
    await sequelize.query("PRAGMA foreign_keys = OFF");
    await models.AuditLog.destroy({ where: {}, force: true });
    await models.Event.destroy({ where: {}, force: true });
    await models.Item.destroy({ where: {}, force: true });
    await models.User.destroy({ where: {}, force: true });
    await sequelize.query("PRAGMA foreign_keys = ON");
  });

  afterAll(async () => {
    if (typeof originalAdminEmail === "string") {
      process.env.HACT_ADMIN_EMAIL = originalAdminEmail;
    } else {
      delete process.env.HACT_ADMIN_EMAIL;
    }

    await sequelize.close();
  });

  it("returns only owner-scoped workbook rows for standard users", async () => {
    const owner = await createUser({ email: "owner@example.com" });
    const outsider = await createUser({ email: "outsider@example.com" });

    const ownerItem = await createItem(owner.id, { address: "Owner Home" });
    const outsiderItem = await createItem(outsider.id, { address: "Outsider Home" });
    const ownerContract = await createFinancialContract(owner.id, {
      linkedAssetItemId: ownerItem.id,
      title: "Owner Mortgage"
    });
    const ownerLegacyContract = await createFinancialContract(owner.id, {
      title: "Owner Legacy Contract",
      attributes: {
        linkedAssetItemId: "00000000-0000-0000-0000-000000000999"
      }
    });
    await createFinancialContract(outsider.id, {
      linkedAssetItemId: outsiderItem.id,
      title: "Outsider Mortgage"
    });
    const ownerEvent = await createEvent(ownerItem.id, "2026-07-01T00:00:00.000Z");
    const outsiderEvent = await createEvent(outsiderItem.id, "2026-07-02T00:00:00.000Z");

    const agent = request.agent(app);
    await signIn(agent, owner.email, owner.password);

    const response = await agent.get("/exports/backup.xlsx").buffer(true).parse(binaryParser);

    expect(response.status).toBe(200);
    const workbook = await parseWorkbookResponse(response);

    const assetRows = worksheetRowsAsObjects(workbook.getWorksheet("Assets"));
    const financialRows = worksheetRowsAsObjects(workbook.getWorksheet("Financial Contracts"));
    const eventRows = worksheetRowsAsObjects(workbook.getWorksheet("Event History"));

    expect(assetRows.map((row) => row["Asset ID"])).toEqual([ownerItem.id]);
    expect(new Set(financialRows.map((row) => row["Contract ID"]))).toEqual(
      new Set([ownerContract.id, ownerLegacyContract.id])
    );
    expect(new Set(eventRows.map((row) => row["Event ID"]))).toEqual(new Set([ownerEvent.id]));
    expect(new Set(eventRows.map((row) => row["Event ID"]))).not.toContain(outsiderEvent.id);

    const auditRow = await fetchLatestExportAudit("export.backup.succeeded");
    expect(auditRow).not.toBeNull();
    expect(auditRow.user_id).toBe(owner.id);
    expect(auditRow.actor_user_id).toBe(owner.id);
    expect(auditRow.lens_user_id).toBe(owner.id);
    assertAuditTimestamp(auditRow.timestamp);
  });

  it("uses request locale/timezone preferences when present", async () => {
    const owner = await createUser({ email: "owner-preference@example.com" });
    const ownerItem = await createItem(owner.id, { title: "Preference Home" });
    await createEvent(ownerItem.id, "2026-07-01T00:30:00.000Z");

    const agent = request.agent(app);
    await signIn(agent, owner.email, owner.password);

    const response = await agent
      .get("/exports/backup.xlsx")
      .set("accept-language", "fr-CA,fr;q=0.8")
      .set("x-timezone", "America/Los_Angeles")
      .buffer(true)
      .parse(binaryParser);

    expect(response.status).toBe(200);
    const workbook = await parseWorkbookResponse(response);
    const eventSheet = workbook.getWorksheet("Event History");

    expect(readDateOnlyCell(eventSheet, 2, "Due Date")).toBe("2026-06-30");
  });

  it("uses deterministic fallback date preferences when none are provided", async () => {
    const owner = await createUser({ email: "owner-fallback@example.com" });
    const ownerItem = await createItem(owner.id, { title: "Fallback Home" });
    await createEvent(ownerItem.id, "2026-07-01T00:30:00.000Z");

    const agent = request.agent(app);
    await signIn(agent, owner.email, owner.password);

    const response = await agent
      .get("/exports/backup.xlsx")
      .set("x-timezone", "Not/A_Real_Timezone")
      .buffer(true)
      .parse(binaryParser);

    expect(response.status).toBe(200);
    const workbook = await parseWorkbookResponse(response);
    const eventSheet = workbook.getWorksheet("Event History");

    expect(readDateOnlyCell(eventSheet, 2, "Due Date")).toBe("2026-07-01");
  });

  it("keeps workbook text cells sanitized in final binary export values", async () => {
    const owner = await createUser({ email: "owner-sanitized@example.com" });
    const ownerItem = await createItem(owner.id, {
      title: "=SUM(1,2)",
      model: "@InjectedModel"
    });
    const ownerContract = await createFinancialContract(owner.id, {
      linkedAssetItemId: ownerItem.id,
      title: "+InjectedContract"
    });
    await createEvent(ownerItem.id, "2026-07-01T00:30:00.000Z");

    const agent = request.agent(app);
    await signIn(agent, owner.email, owner.password);

    const response = await agent.get("/exports/backup.xlsx").buffer(true).parse(binaryParser);
    expect(response.status).toBe(200);

    const workbook = await parseWorkbookResponse(response);
    const assetRows = worksheetRowsAsObjects(workbook.getWorksheet("Assets"));
    const contractRows = worksheetRowsAsObjects(workbook.getWorksheet("Financial Contracts"));

    expect(assetRows.map((row) => row["Asset Title"])).toEqual(["'=SUM(1,2)"]);
    expect(assetRows.map((row) => row.Model)).toEqual(["'@InjectedModel"]);
    expect(contractRows.find((row) => row["Contract ID"] === ownerContract.id)["Contract Title"])
      .toBe("'+InjectedContract");
  });

  it("returns cross-owner workbook rows for admin all-data mode", async () => {
    const admin = await createUser({ email: "admin@example.com" });
    const ownerA = await createUser({ email: "owner-a@example.com" });
    const ownerB = await createUser({ email: "owner-b@example.com" });

    const ownerAItem = await createItem(ownerA.id, { address: "A Home" });
    const ownerBItem = await createItem(ownerB.id, { address: "B Home" });
    const ownerAContract = await createFinancialContract(ownerA.id, {
      linkedAssetItemId: ownerAItem.id,
      title: "A Mortgage"
    });
    const ownerBContract = await createFinancialContract(ownerB.id, {
      linkedAssetItemId: ownerBItem.id,
      title: "B Mortgage"
    });
    const ownerAEvent = await createEvent(ownerAItem.id, "2026-08-01T00:00:00.000Z");
    const ownerBEvent = await createEvent(ownerBItem.id, "2026-08-02T00:00:00.000Z");

    const agent = request.agent(app);
    const login = await signIn(agent, admin.email, admin.password);
    expect(login.body.session.scope.mode).toBe("all");

    const response = await agent.get("/exports/backup.xlsx").buffer(true).parse(binaryParser);

    expect(response.status).toBe(200);
    const workbook = await parseWorkbookResponse(response);

    const assetRows = worksheetRowsAsObjects(workbook.getWorksheet("Assets"));
    const financialRows = worksheetRowsAsObjects(workbook.getWorksheet("Financial Contracts"));
    const eventRows = worksheetRowsAsObjects(workbook.getWorksheet("Event History"));

    expect(new Set(assetRows.map((row) => row["Asset ID"]))).toEqual(new Set([ownerAItem.id, ownerBItem.id]));
    expect(new Set(financialRows.map((row) => row["Contract ID"]))).toEqual(new Set([ownerAContract.id, ownerBContract.id]));
    expect(new Set(eventRows.map((row) => row["Event ID"]))).toEqual(new Set([ownerAEvent.id, ownerBEvent.id]));

    const auditRow = await fetchLatestExportAudit("export.backup.succeeded");
    expect(auditRow).not.toBeNull();
    expect(auditRow.user_id).toBe(admin.id);
    expect(auditRow.actor_user_id).toBe(admin.id);
    expect(auditRow.lens_user_id).toBeNull();
    assertAuditTimestamp(auditRow.timestamp);
  });

  it("enforces admin owner-lens filtering for workbook rows", async () => {
    const admin = await createUser({ email: "admin@example.com" });
    const ownerA = await createUser({ email: "lens-owner-a@example.com" });
    const ownerB = await createUser({ email: "lens-owner-b@example.com" });

    const ownerAItem = await createItem(ownerA.id, { address: "Lens A Home" });
    const ownerBItem = await createItem(ownerB.id, { address: "Lens B Home" });
    const ownerAContract = await createFinancialContract(ownerA.id, {
      linkedAssetItemId: ownerAItem.id,
      title: "Lens A Mortgage"
    });
    await createFinancialContract(ownerB.id, {
      linkedAssetItemId: ownerBItem.id,
      title: "Lens B Mortgage"
    });
    const ownerAEvent = await createEvent(ownerAItem.id, "2026-09-01T00:00:00.000Z");
    await createEvent(ownerBItem.id, "2026-09-02T00:00:00.000Z");

    const agent = request.agent(app);
    await signIn(agent, admin.email, admin.password);
    const setLens = await agent.patch("/auth/admin-scope").send({
      mode: "owner",
      lens_user_id: ownerA.id
    });
    expect(setLens.status).toBe(200);

    const response = await agent.get("/exports/backup.xlsx").buffer(true).parse(binaryParser);

    expect(response.status).toBe(200);
    const workbook = await parseWorkbookResponse(response);

    const assetRows = worksheetRowsAsObjects(workbook.getWorksheet("Assets"));
    const financialRows = worksheetRowsAsObjects(workbook.getWorksheet("Financial Contracts"));
    const eventRows = worksheetRowsAsObjects(workbook.getWorksheet("Event History"));

    expect(assetRows.map((row) => row["Asset ID"])).toEqual([ownerAItem.id]);
    expect(financialRows.map((row) => row["Contract ID"])).toEqual([ownerAContract.id]);
    expect(eventRows.map((row) => row["Event ID"])).toEqual([ownerAEvent.id]);
  });

  it("ignores client query scope overrides for standard users", async () => {
    const owner = await createUser({ email: "owner@example.com" });
    const outsider = await createUser({ email: "outsider@example.com" });
    const ownerItem = await createItem(owner.id, { address: "Owner Home" });
    const outsiderItem = await createItem(outsider.id, { address: "Outsider Home" });
    const ownerContract = await createFinancialContract(owner.id, {
      linkedAssetItemId: ownerItem.id,
      title: "Owner Contract"
    });
    await createFinancialContract(outsider.id, {
      linkedAssetItemId: outsiderItem.id,
      title: "Outsider Contract"
    });
    const ownerEvent = await createEvent(ownerItem.id, "2026-10-01T00:00:00.000Z");
    await createEvent(outsiderItem.id, "2026-10-02T00:00:00.000Z");

    const agent = request.agent(app);
    await signIn(agent, owner.email, owner.password);

    const response = await agent
      .get("/exports/backup.xlsx")
      .buffer(true)
      .parse(binaryParser)
      .query({
        user_id: outsider.id,
        owner_id: outsider.id,
        scope_mode: "all",
        lens_user_id: outsider.id
      });

    expect(response.status).toBe(200);
    const workbook = await parseWorkbookResponse(response);

    const assetRows = worksheetRowsAsObjects(workbook.getWorksheet("Assets"));
    const financialRows = worksheetRowsAsObjects(workbook.getWorksheet("Financial Contracts"));
    const eventRows = worksheetRowsAsObjects(workbook.getWorksheet("Event History"));

    expect(assetRows.map((row) => row["Asset ID"])).toEqual([ownerItem.id]);
    expect(financialRows.map((row) => row["Contract ID"])).toEqual([ownerContract.id]);
    expect(eventRows.map((row) => row["Event ID"])).toEqual([ownerEvent.id]);
  });

  it("ignores client query and body override attempts in admin owner-lens mode", async () => {
    const admin = await createUser({ email: "admin@example.com" });
    const lensOwner = await createUser({ email: "lens-owner@example.com" });
    const outsider = await createUser({ email: "outsider@example.com" });

    const lensItem = await createItem(lensOwner.id, { address: "Lens Home" });
    const outsiderItem = await createItem(outsider.id, { address: "Outsider Home" });
    const lensContract = await createFinancialContract(lensOwner.id, {
      linkedAssetItemId: lensItem.id,
      title: "Lens Contract"
    });
    await createFinancialContract(outsider.id, {
      linkedAssetItemId: outsiderItem.id,
      title: "Outsider Contract"
    });
    const lensEvent = await createEvent(lensItem.id, "2026-11-01T00:00:00.000Z");
    await createEvent(outsiderItem.id, "2026-11-02T00:00:00.000Z");

    const agent = request.agent(app);
    await signIn(agent, admin.email, admin.password);
    const setLens = await agent.patch("/auth/admin-scope").send({
      mode: "owner",
      lens_user_id: lensOwner.id
    });
    expect(setLens.status).toBe(200);

    const response = await agent
      .get("/exports/backup.xlsx")
      .buffer(true)
      .parse(binaryParser)
      .query({
        user_id: outsider.id,
        owner_id: outsider.id,
        scope_mode: "all",
        lens_user_id: outsider.id
      })
      .send({
        user_id: outsider.id,
        owner_id: outsider.id,
        scope_mode: "all",
        lens_user_id: outsider.id
      });

    expect(response.status).toBe(200);
    const workbook = await parseWorkbookResponse(response);

    const assetRows = worksheetRowsAsObjects(workbook.getWorksheet("Assets"));
    const financialRows = worksheetRowsAsObjects(workbook.getWorksheet("Financial Contracts"));
    const eventRows = worksheetRowsAsObjects(workbook.getWorksheet("Event History"));

    expect(assetRows.map((row) => row["Asset ID"])).toEqual([lensItem.id]);
    expect(financialRows.map((row) => row["Contract ID"])).toEqual([lensContract.id]);
    expect(eventRows.map((row) => row["Event ID"])).toEqual([lensEvent.id]);
  });

  it("records failed export attempts with scope attribution", async () => {
    const owner = await createUser({ email: "owner-failed-export@example.com" });
    await createItem(owner.id, { address: "Failure Lane" });

    const itemFindAllSpy = jest.spyOn(models.Item, "findAll").mockRejectedValueOnce(new Error("db read failed"));

    const agent = request.agent(app);
    await signIn(agent, owner.email, owner.password);

    const response = await agent.get("/exports/backup.xlsx").buffer(true).parse(binaryParser);
    expect(response.status).toBe(500);

    itemFindAllSpy.mockRestore();

    const auditRow = await fetchLatestExportAudit("export.backup.failed");
    expect(auditRow).not.toBeNull();
    expect(auditRow.user_id).toBe(owner.id);
    expect(auditRow.actor_user_id).toBe(owner.id);
    expect(auditRow.lens_user_id).toBe(owner.id);
    assertAuditTimestamp(auditRow.timestamp);
  });

  it("surfaces export audit entries in item activity with readable labels and stable IDs", async () => {
    const owner = await createUser({ email: "owner-activity-export@example.com" });
    const item = await createItem(owner.id, { address: "Activity Export Home" });

    const itemFindAllSpy = jest.spyOn(models.Item, "findAll").mockRejectedValueOnce(new Error("db read failed"));

    const agent = request.agent(app);
    await signIn(agent, owner.email, owner.password);

    const failedExport = await agent.get("/exports/backup.xlsx").buffer(true).parse(binaryParser);
    expect(failedExport.status).toBe(500);
    itemFindAllSpy.mockRestore();

    const successfulExport = await agent.get("/exports/backup.xlsx").buffer(true).parse(binaryParser);
    expect(successfulExport.status).toBe(200);

    const activity = await agent.get(`/items/${item.id}/activity`).query({ limit: "10" });
    expect(activity.status).toBe(200);

    const exportRows = activity.body.activity.filter((row) => row.entity === "export:backup.xlsx");
    expect(exportRows).toHaveLength(2);
    expect(new Set(exportRows.map((row) => row.action))).toEqual(
      new Set(["export.backup.succeeded", "export.backup.failed"])
    );

    exportRows.forEach((row) => {
      expect(row.actor_user_id).toBe(owner.id);
      expect(row.actor_label).toBe(owner.username);
      expect(row.lens_user_id).toBe(owner.id);
      expect(row.lens_label).toBe(owner.username);
      expect(row.lens_attribution_state).toBe("attributed");
      assertAuditTimestamp(row.timestamp);
    });
  });

  it("returns all-data lens exports with explicit all-users label in item activity", async () => {
    const admin = await createUser({ email: "admin@example.com", role: "admin" });
    const owner = await createUser({ email: "owner-activity-all@example.com" });
    const item = await createItem(owner.id, { address: "Admin Activity Home" });

    const adminAgent = request.agent(app);
    const login = await signIn(adminAgent, admin.email, admin.password);
    expect(login.body.session.scope.mode).toBe("all");

    const exportResponse = await adminAgent.get("/exports/backup.xlsx").buffer(true).parse(binaryParser);
    expect(exportResponse.status).toBe(200);

    const activity = await adminAgent.get(`/items/${item.id}/activity`).query({ limit: "10" });
    expect(activity.status).toBe(200);

    const exportRow = activity.body.activity.find((row) => row.action === "export.backup.succeeded");
    expect(exportRow).toBeDefined();
    expect(exportRow.actor_user_id).toBe(admin.id);
    expect(exportRow.actor_label).toBe(admin.username);
    expect(exportRow.lens_user_id).toBeNull();
    expect(exportRow.lens_label).toBe("All users");
    expect(exportRow.lens_attribution_state).toBe("all_data");
    assertAuditTimestamp(exportRow.timestamp);
  });
});
