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

describe("admin scope lens enforcement", () => {
  const app = createApp();
  let userCounter = 0;
  const originalAdminEmail = process.env.HACT_ADMIN_EMAIL;

  async function createUser(overrides = {}) {
    userCounter += 1;
    const password = overrides.password || "StrongPass123!";
    const passwordHash = await bcrypt.hash(password, 12);

    const created = await models.User.create({
      username: overrides.username || `scope-user-${userCounter}`,
      email: overrides.email || `scope-user-${userCounter}@example.com`,
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
        address: "Scope House",
        estimatedValue: 200000,
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

  it("defaults admin login into all-users scope and allows intentional lens switching", async () => {
    const admin = await createUser({ email: "admin@example.com" });
    const ownerA = await createUser({ email: "owner-a@example.com" });
    const ownerB = await createUser({ email: "owner-b@example.com" });

    const ownerAItem = await createItem(ownerA.id, { address: "A House" });
    const ownerBItem = await createItem(ownerB.id, { address: "B House" });
    await createEvent(ownerAItem.id, "2026-08-01T00:00:00.000Z");
    await createEvent(ownerBItem.id, "2026-08-02T00:00:00.000Z");

    const agent = request.agent(app);
    const login = await signIn(agent, admin.email, admin.password);

    expect(login.body.user.role).toBe("admin");
    expect(login.body.session.scope).toEqual({
      actorUserId: admin.id,
      actorRole: "admin",
      mode: "all",
      lensUserId: null
    });

    const allItems = await agent.get("/items");
    const allEvents = await agent.get("/events").query({ status: "all" });
    const allUsers = await agent.get("/users");
    expect(allItems.status).toBe(200);
    expect(allItems.body.total_count).toBe(2);
    expect(allEvents.status).toBe(200);
    expect(allEvents.body.total_count).toBe(2);
    expect(allUsers.status).toBe(200);
    expect(allUsers.body.total_count).toBe(3);

    const switchToOwnerLens = await agent.patch("/auth/admin-scope").send({
      mode: "owner",
      lens_user_id: ownerA.id
    });

    expect(switchToOwnerLens.status).toBe(200);
    expect(switchToOwnerLens.body.session.scope).toEqual({
      actorUserId: admin.id,
      actorRole: "admin",
      mode: "owner",
      lensUserId: ownerA.id
    });

    const ownerLensItems = await agent.get("/items");
    const ownerLensEvents = await agent.get("/events").query({ status: "all" });
    const ownerLensUsers = await agent.get("/users");
    expect(ownerLensItems.status).toBe(200);
    expect(ownerLensItems.body.total_count).toBe(1);
    expect(ownerLensItems.body.items[0].user_id).toBe(ownerA.id);
    expect(ownerLensEvents.status).toBe(200);
    expect(ownerLensEvents.body.total_count).toBe(1);
    expect(ownerLensEvents.body.groups[0].events[0].item_id).toBe(ownerAItem.id);
    expect(ownerLensUsers.status).toBe(200);
    expect(ownerLensUsers.body.total_count).toBe(3);

    const switchBackToAll = await agent.patch("/auth/admin-scope").send({ mode: "all" });
    expect(switchBackToAll.status).toBe(200);
    expect(switchBackToAll.body.session.scope.mode).toBe("all");
    expect(switchBackToAll.body.session.scope.lensUserId).toBeNull();
  });

  it("rejects non-admin attempts to set admin scope fields", async () => {
    const standardUser = await createUser({ email: "member@example.com" });
    const target = await createUser({ email: "target@example.com" });
    const agent = request.agent(app);

    const login = await signIn(agent, standardUser.email, standardUser.password);
    expect(login.body.user.role).toBe("user");
    expect(login.body.session.scope).toEqual({
      actorUserId: standardUser.id,
      actorRole: "user",
      mode: "owner",
      lensUserId: standardUser.id
    });

    const attempt = await agent.patch("/auth/admin-scope").send({
      mode: "owner",
      lens_user_id: target.id
    });

    expect(attempt.status).toBe(403);
    expect(attempt.body.error.code).toBe("admin_scope_forbidden");
  });

  it("falls back to all-users mode when a selected lens target is removed", async () => {
    const admin = await createUser({ email: "admin@example.com" });
    const lensUser = await createUser({ email: "lens-target@example.com" });
    const other = await createUser({ email: "other-owner@example.com" });

    await createItem(other.id, { address: "Other House" });

    const agent = request.agent(app);
    await signIn(agent, admin.email, admin.password);

    const switched = await agent.patch("/auth/admin-scope").send({
      mode: "owner",
      lens_user_id: lensUser.id
    });

    expect(switched.status).toBe(200);
    expect(switched.body.session.scope.mode).toBe("owner");

    await models.User.destroy({ where: { id: lensUser.id }, force: true });

    const session = await agent.get("/auth/session");
    expect(session.status).toBe(200);
    expect(session.body.session.scope).toEqual({
      actorUserId: admin.id,
      actorRole: "admin",
      mode: "all",
      lensUserId: null
    });

    const listed = await agent.get("/items");
    expect(listed.status).toBe(200);
    expect(listed.body.total_count).toBe(1);
    expect(listed.body.items[0].user_id).toBe(other.id);
  });

  it("ignores query-level scope overrides from non-admin clients", async () => {
    const owner = await createUser({ email: "owner@example.com" });
    const outsider = await createUser({ email: "outsider@example.com" });
    await createItem(owner.id, { address: "Owner House" });
    await createItem(outsider.id, { address: "Outsider House" });

    const agent = request.agent(app);
    await signIn(agent, owner.email, owner.password);

    const listWithOverride = await agent
      .get("/items")
      .query({ mode: "all", lens_user_id: outsider.id });

    expect(listWithOverride.status).toBe(200);
    expect(listWithOverride.body.total_count).toBe(1);
    expect(listWithOverride.body.items[0].user_id).toBe(owner.id);
  });
});
