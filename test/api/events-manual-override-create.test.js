"use strict";

const request = require("supertest");
const bcrypt = require("bcryptjs");

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

describe("POST /events/manual-override", () => {
  const app = createApp();
  let counter = 0;
  const originalAdminEmail = process.env.HACT_ADMIN_EMAIL;

  async function createUser(overrides = {}) {
    counter += 1;

    const password = overrides.password || "StrongPass123!";
    const passwordHash = await bcrypt.hash(password, 12);
    const created = await models.User.create({
      username: overrides.username || `manual-override-user-${counter}`,
      email: overrides.email || `manual-override-user-${counter}@example.com`,
      password_hash: passwordHash,
      role: overrides.role
    });

    return {
      id: created.id,
      email: created.email,
      password
    };
  }

  async function signInAs(user) {
    const agent = request.agent(app);
    const loginResponse = await agent.post("/auth/login").send({
      email: user.email,
      password: user.password
    });

    expect(loginResponse.status).toBe(200);
    return agent;
  }

  async function createFinancialItem({ userId, title = "Manual override item", dueDate = "2026-03-20", originDate = "2026-03-16" }) {
    return models.Item.create({
      user_id: userId,
      item_type: "FinancialItem",
      title,
      type: "Commitment",
      frequency: "monthly",
      default_amount: 125,
      status: "Active",
      attributes: {
        dueDate,
        originDate
      }
    });
  }

  async function createEvent({ itemId, dueDate, amount = "100.00", status = "Completed", recurring = false, manualOverride = false, note = null }) {
    return models.Event.create({
      item_id: itemId,
      event_type: "Existing row",
      due_date: dueDate,
      amount,
      status,
      is_recurring: recurring,
      is_manual_override: manualOverride,
      note,
      completed_at: status === "Completed" ? dueDate : null
    });
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

  it("creates a completed pre-origin manual override with a trimmed note and exposes it through /events", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    const item = await createFinancialItem({ userId: owner.id, originDate: "2026-03-16" });

    const response = await ownerAgent.post("/events/manual-override").send({
      item_id: item.id,
      due_date: "2026-01-10",
      amount: 88.45,
      note: "  Paid from archived paper statement.  "
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      item_id: item.id,
      status: "Completed",
      recurring: false,
      is_projected: false,
      is_manual_override: true,
      note: "Paid from archived paper statement."
    });
    expect(response.body.completed_at).toContain("2026-01-10");
    expect(response.body.warnings).toEqual([]);

    const listed = await ownerAgent.get("/events").query({ status: "all" });
    expect(listed.status).toBe(200);

    const matching = listed.body.groups
      .flatMap((group) => group.events)
      .find((event) => event.id === response.body.id);

    expect(matching).toMatchObject({
      item_id: item.id,
      status: "Completed",
      is_manual_override: true,
      source_state: "persisted",
      note: "Paid from archived paper statement."
    });

    const audit = await models.AuditLog.findOne({
      where: {
        action: "event.manualoverride.created",
        entity: `event:${response.body.id}`
      }
    });
    expect(audit).toBeTruthy();
  });

  it("returns warnings for extreme but valid historical dates without blocking save", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    const item = await createFinancialItem({ userId: owner.id });

    const response = await ownerAgent.post("/events/manual-override").send({
      item_id: item.id,
      due_date: "1900-01-01",
      amount: 45
    });

    expect(response.status).toBe(201);
    expect(response.body.is_manual_override).toBe(true);
    expect(response.body.warnings).toEqual([
      expect.objectContaining({
        field: "due_date",
        code: "extreme_historical_date"
      })
    ]);
  });

  it("rejects malformed dates, future dates, bad amounts, and invalid notes", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    const item = await createFinancialItem({ userId: owner.id });

    const malformed = await ownerAgent.post("/events/manual-override").send({
      item_id: item.id,
      due_date: "not-a-date",
      amount: 20
    });
    expect(malformed.status).toBe(422);
    expect(malformed.body.error.code).toBe("event_manual_override_failed");
    expect(malformed.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "due_date", code: "invalid_due_date" })
      ])
    );

    const future = await ownerAgent.post("/events/manual-override").send({
      item_id: item.id,
      due_date: "2099-01-01",
      amount: 20
    });
    expect(future.status).toBe(422);
    expect(future.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "due_date", code: "future_due_date" })
      ])
    );

    const badAmount = await ownerAgent.post("/events/manual-override").send({
      item_id: item.id,
      due_date: "2026-01-01",
      amount: -5
    });
    expect(badAmount.status).toBe(422);
    expect(badAmount.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "amount", code: "invalid_amount" })
      ])
    );

    const invalidNote = await ownerAgent.post("/events/manual-override").send({
      item_id: item.id,
      due_date: "2026-01-01",
      amount: 20,
      note: 42
    });
    expect(invalidNote.status).toBe(422);
    expect(invalidNote.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "note", code: "invalid_note" })
      ])
    );

    const longNote = await ownerAgent.post("/events/manual-override").send({
      item_id: item.id,
      due_date: "2026-01-02",
      amount: 20,
      note: "x".repeat(281)
    });
    expect(longNote.status).toBe(422);
    expect(longNote.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "note", code: "note_too_long" })
      ])
    );
  });

  it("rejects duplicate rows for the same item and calendar day", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    const item = await createFinancialItem({ userId: owner.id });

    await createEvent({
      itemId: item.id,
      dueDate: "2026-01-10T00:00:00.000Z",
      manualOverride: true
    });

    const response = await ownerAgent.post("/events/manual-override").send({
      item_id: item.id,
      due_date: "2026-01-10",
      amount: 75
    });

    expect(response.status).toBe(409);
    expect(response.body.error).toMatchObject({
      code: "event_manual_override_failed",
      category: "duplicate"
    });
  });

  it("returns not_found for owner-scope violations", async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const outsiderAgent = await signInAs(outsider);
    const item = await createFinancialItem({ userId: owner.id });

    const response = await outsiderAgent.post("/events/manual-override").send({
      item_id: item.id,
      due_date: "2026-01-10",
      amount: 80
    });

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({
      code: "event_manual_override_failed",
      category: "not_found"
    });
  });

  it("supports admin all-mode creation and keeps owner-lens denials hidden as not_found", async () => {
    const admin = await createUser({ email: "admin@example.com" });
    const ownerA = await createUser({ email: "manual-owner-a@example.com" });
    const ownerB = await createUser({ email: "manual-owner-b@example.com" });
    const adminAgent = await signInAs(admin);
    const ownerAItem = await createFinancialItem({ userId: ownerA.id, title: "Owner A item" });
    const ownerBItem = await createFinancialItem({ userId: ownerB.id, title: "Owner B item" });

    const allMode = await adminAgent.post("/events/manual-override").send({
      item_id: ownerBItem.id,
      due_date: "2026-01-11",
      amount: 91,
      note: "Imported from mailed receipt"
    });
    expect(allMode.status).toBe(201);
    expect(allMode.body).toMatchObject({
      item_id: ownerBItem.id,
      note: "Imported from mailed receipt"
    });

    const setLens = await adminAgent.patch("/auth/admin-scope").send({
      mode: "owner",
      lens_user_id: ownerA.id
    });
    expect(setLens.status).toBe(200);

    const ownerLensAllowed = await adminAgent.post("/events/manual-override").send({
      item_id: ownerAItem.id,
      due_date: "2026-01-12",
      amount: 54
    });
    expect(ownerLensAllowed.status).toBe(201);
    expect(ownerLensAllowed.body.item_id).toBe(ownerAItem.id);

    const ownerLensDenied = await adminAgent.post("/events/manual-override").send({
      item_id: ownerBItem.id,
      due_date: "2026-01-13",
      amount: 66
    });
    expect(ownerLensDenied.status).toBe(404);
    expect(ownerLensDenied.body.error).toMatchObject({
      code: "event_manual_override_failed",
      category: "not_found"
    });
  });
});
