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

process.env.SESSION_SECRET = "test-session-secret";
process.env.FRONTEND_ORIGIN = "http://localhost:5173";

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
      email: created.email,
      password
    };
  }

  async function createItem(userId, attributes = {}) {
    return models.Item.create({
      user_id: userId,
      item_type: "RealEstate",
      attributes: {
        address: "Export Scope House",
        estimatedValue: 250000,
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

  it("returns only owner-scoped records for standard users", async () => {
    const owner = await createUser({ email: "owner@example.com" });
    const outsider = await createUser({ email: "outsider@example.com" });

    const ownerItem = await createItem(owner.id, { address: "Owner Home" });
    const outsiderItem = await createItem(outsider.id, { address: "Outsider Home" });
    const ownerEvent = await createEvent(ownerItem.id, "2026-07-01T00:00:00.000Z");
    const outsiderEvent = await createEvent(outsiderItem.id, "2026-07-02T00:00:00.000Z");

    const agent = request.agent(app);
    await signIn(agent, owner.email, owner.password);

    const response = await agent.get("/exports/backup.xlsx");

    expect(response.status).toBe(200);
    expect(response.body.export.scope.mode).toBe("owner");
    expect(response.body.export.scope.owner_filter).toBe(owner.id);
    expect(response.body.datasets.items.total_count).toBe(1);
    expect(response.body.datasets.items.rows.map((row) => row.id)).toEqual([ownerItem.id]);
    expect(response.body.datasets.items.rows.find((row) => row.id === outsiderItem.id)).toBeUndefined();
    expect(response.body.datasets.events.total_count).toBe(1);
    expect(response.body.datasets.events.rows.map((row) => row.id)).toEqual([ownerEvent.id]);
    expect(response.body.datasets.events.rows.find((row) => row.id === outsiderEvent.id)).toBeUndefined();
  });

  it("returns cross-owner records for admin all-data mode", async () => {
    const admin = await createUser({ email: "admin@example.com" });
    const ownerA = await createUser({ email: "owner-a@example.com" });
    const ownerB = await createUser({ email: "owner-b@example.com" });

    const ownerAItem = await createItem(ownerA.id, { address: "A Home" });
    const ownerBItem = await createItem(ownerB.id, { address: "B Home" });
    const ownerAEvent = await createEvent(ownerAItem.id, "2026-08-01T00:00:00.000Z");
    const ownerBEvent = await createEvent(ownerBItem.id, "2026-08-02T00:00:00.000Z");

    const agent = request.agent(app);
    const login = await signIn(agent, admin.email, admin.password);
    expect(login.body.session.scope.mode).toBe("all");

    const response = await agent.get("/exports/backup.xlsx");

    expect(response.status).toBe(200);
    expect(response.body.export.scope.mode).toBe("all");
    expect(response.body.export.scope.owner_filter).toBeNull();
    expect(response.body.datasets.items.total_count).toBe(2);
    expect(new Set(response.body.datasets.items.rows.map((row) => row.id))).toEqual(new Set([ownerAItem.id, ownerBItem.id]));
    expect(response.body.datasets.events.total_count).toBe(2);
    expect(new Set(response.body.datasets.events.rows.map((row) => row.id))).toEqual(new Set([ownerAEvent.id, ownerBEvent.id]));
  });

  it("enforces admin owner-lens filtering for export datasets", async () => {
    const admin = await createUser({ email: "admin@example.com" });
    const ownerA = await createUser({ email: "lens-owner-a@example.com" });
    const ownerB = await createUser({ email: "lens-owner-b@example.com" });

    const ownerAItem = await createItem(ownerA.id, { address: "Lens A Home" });
    const ownerBItem = await createItem(ownerB.id, { address: "Lens B Home" });
    const ownerAEvent = await createEvent(ownerAItem.id, "2026-09-01T00:00:00.000Z");
    const ownerBEvent = await createEvent(ownerBItem.id, "2026-09-02T00:00:00.000Z");

    const agent = request.agent(app);
    await signIn(agent, admin.email, admin.password);
    const setLens = await agent.patch("/auth/admin-scope").send({
      mode: "owner",
      lens_user_id: ownerA.id
    });
    expect(setLens.status).toBe(200);

    const response = await agent.get("/exports/backup.xlsx");

    expect(response.status).toBe(200);
    expect(response.body.export.scope.mode).toBe("owner");
    expect(response.body.export.scope.lens_user_id).toBe(ownerA.id);
    expect(response.body.export.scope.owner_filter).toBe(ownerA.id);
    expect(response.body.datasets.items.total_count).toBe(1);
    expect(response.body.datasets.items.rows[0].id).toBe(ownerAItem.id);
    expect(response.body.datasets.items.rows.find((row) => row.id === ownerBItem.id)).toBeUndefined();
    expect(response.body.datasets.events.total_count).toBe(1);
    expect(response.body.datasets.events.rows[0].id).toBe(ownerAEvent.id);
    expect(response.body.datasets.events.rows.find((row) => row.id === ownerBEvent.id)).toBeUndefined();
  });

  it("ignores client query scope overrides for standard users", async () => {
    const owner = await createUser({ email: "owner@example.com" });
    const outsider = await createUser({ email: "outsider@example.com" });
    const ownerItem = await createItem(owner.id, { address: "Owner Home" });
    const outsiderItem = await createItem(outsider.id, { address: "Outsider Home" });
    const ownerEvent = await createEvent(ownerItem.id, "2026-10-01T00:00:00.000Z");
    const outsiderEvent = await createEvent(outsiderItem.id, "2026-10-02T00:00:00.000Z");

    const agent = request.agent(app);
    await signIn(agent, owner.email, owner.password);

    const response = await agent.get("/exports/backup.xlsx").query({
      user_id: outsider.id,
      owner_id: outsider.id,
      scope_mode: "all",
      lens_user_id: outsider.id
    });

    expect(response.status).toBe(200);
    expect(response.body.export.scope.mode).toBe("owner");
    expect(response.body.export.scope.owner_filter).toBe(owner.id);
    expect(response.body.datasets.items.total_count).toBe(1);
    expect(response.body.datasets.items.rows.map((row) => row.id)).toEqual([ownerItem.id]);
    expect(response.body.datasets.items.rows.find((row) => row.id === outsiderItem.id)).toBeUndefined();
    expect(response.body.datasets.events.total_count).toBe(1);
    expect(response.body.datasets.events.rows.map((row) => row.id)).toEqual([ownerEvent.id]);
    expect(response.body.datasets.events.rows.find((row) => row.id === outsiderEvent.id)).toBeUndefined();
  });

  it("ignores client query and body override attempts in admin owner-lens mode", async () => {
    const admin = await createUser({ email: "admin@example.com" });
    const lensOwner = await createUser({ email: "lens-owner@example.com" });
    const outsider = await createUser({ email: "outsider@example.com" });

    const lensItem = await createItem(lensOwner.id, { address: "Lens Home" });
    const outsiderItem = await createItem(outsider.id, { address: "Outsider Home" });
    const lensEvent = await createEvent(lensItem.id, "2026-11-01T00:00:00.000Z");
    const outsiderEvent = await createEvent(outsiderItem.id, "2026-11-02T00:00:00.000Z");

    const agent = request.agent(app);
    await signIn(agent, admin.email, admin.password);
    const setLens = await agent.patch("/auth/admin-scope").send({
      mode: "owner",
      lens_user_id: lensOwner.id
    });
    expect(setLens.status).toBe(200);

    const response = await agent
      .get("/exports/backup.xlsx")
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
    expect(response.body.export.scope.mode).toBe("owner");
    expect(response.body.export.scope.lens_user_id).toBe(lensOwner.id);
    expect(response.body.export.scope.owner_filter).toBe(lensOwner.id);
    expect(response.body.datasets.items.total_count).toBe(1);
    expect(response.body.datasets.items.rows.map((row) => row.id)).toEqual([lensItem.id]);
    expect(response.body.datasets.items.rows.find((row) => row.id === outsiderItem.id)).toBeUndefined();
    expect(response.body.datasets.events.total_count).toBe(1);
    expect(response.body.datasets.events.rows.map((row) => row.id)).toEqual([lensEvent.id]);
    expect(response.body.datasets.events.rows.find((row) => row.id === outsiderEvent.id)).toBeUndefined();
  });
});
