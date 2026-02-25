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

describe("session authorization enforcement", () => {
  const app = createApp();
  let userCounter = 0;

  async function createUser(overrides = {}) {
    userCounter += 1;
    const password = overrides.password || "StrongPass123!";
    const passwordHash = await bcrypt.hash(password, 12);

    const created = await models.User.create({
      username: overrides.username || `authz-user-${userCounter}`,
      email: overrides.email || `authz-user-${userCounter}@example.com`,
      password_hash: passwordHash
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
        address: "42 Session Lane",
        estimatedValue: 450000,
        ...attributes
      }
    });
  }

  async function signIn(agent, email, password) {
    const response = await agent.post("/auth/login").send({
      email,
      password
    });

    expect(response.status).toBe(200);
  }

  beforeAll(async () => {
    await sequelize.query("PRAGMA foreign_keys = ON");
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await sequelize.query("PRAGMA foreign_keys = OFF");
    await models.AuditLog.destroy({ where: {}, force: true });
    await models.Event.destroy({ where: {}, force: true });
    await models.Item.destroy({ where: {}, force: true });
    await models.User.destroy({ where: {}, force: true });
    await sequelize.query("PRAGMA foreign_keys = ON");
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("returns 401 for unauthenticated access to protected items, events, and users routes", async () => {
    const [itemsResponse, eventsResponse, usersResponse] = await Promise.all([
      request(app).get("/items"),
      request(app).get("/events"),
      request(app).get("/users")
    ]);

    [itemsResponse, eventsResponse, usersResponse].forEach((response) => {
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: {
          code: "authentication_required",
          message: "Authentication required."
        }
      });
    });
  });

  it("ignores forged x-user-id headers and uses the authenticated session actor", async () => {
    const sessionUser = await createUser({ email: "session-user@example.com" });
    const forgedUser = await createUser({ email: "forged-user@example.com" });
    const ownedBySessionUser = await createItem(sessionUser.id, { address: "Session Owner Home" });
    const ownedByForgedUser = await createItem(forgedUser.id, { address: "Forged Owner Home" });

    const agent = request.agent(app);
    await signIn(agent, sessionUser.email, sessionUser.password);

    const listWithForgedHeader = await agent
      .get("/items")
      .set("x-user-id", forgedUser.id);

    expect(listWithForgedHeader.status).toBe(200);
    expect(listWithForgedHeader.body.total_count).toBe(1);
    expect(listWithForgedHeader.body.items.map((item) => item.id)).toEqual([ownedBySessionUser.id]);
    expect(listWithForgedHeader.body.items.find((item) => item.id === ownedByForgedUser.id)).toBeUndefined();

    const forgedMutationAttempt = await agent
      .patch(`/items/${ownedByForgedUser.id}`)
      .set("x-user-id", forgedUser.id)
      .send({ attributes: { estimatedValue: 999999 } });

    expect(forgedMutationAttempt.status).toBe(403);
  });
});
