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

describe("GET /users", () => {
  const app = createApp();
  const originalAdminEmail = process.env.HACT_ADMIN_EMAIL;
  let userCounter = 0;

  async function createUser(overrides = {}) {
    userCounter += 1;
    const password = overrides.password || "StrongPass123!";
    const passwordHash = await bcrypt.hash(password, 12);

    const created = await models.User.create({
      username: overrides.username || `users-api-${userCounter}`,
      email: overrides.email || `users-api-${userCounter}@example.com`,
      password_hash: passwordHash
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

  beforeAll(async () => {
    await sequelize.query("PRAGMA foreign_keys = ON");
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    delete process.env.HACT_ADMIN_EMAIL;
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

  async function setUserCreatedAt(userId, createdAt) {
    await models.User.update(
      {
        created_at: createdAt,
        updated_at: createdAt
      },
      {
        where: { id: userId },
        silent: true
      }
    );
  }

  it("returns deterministic actor options payload for local user switching", async () => {
    process.env.HACT_ADMIN_EMAIL = "admin-users@example.com";
    const beta = await models.User.create({
      username: "beta",
      email: "beta@example.com",
      password_hash: "hashed-password"
    });
    const alphaEarly = await models.User.create({
      username: "Alpha",
      email: "alpha-early@example.com",
      password_hash: "hashed-password"
    });
    const charlie = await models.User.create({
      username: "Charlie",
      email: "charlie@example.com",
      password_hash: "hashed-password"
    });

    await setUserCreatedAt(alphaEarly.id, "2026-01-01T00:00:00.000Z");
    await setUserCreatedAt(charlie.id, "2026-01-05T00:00:00.000Z");
    await setUserCreatedAt(beta.id, "2026-01-02T00:00:00.000Z");

    const authUser = await createUser({ username: "ZuluAuth", email: "admin-users@example.com" });
    const agent = await signInAs(authUser);

    const response = await agent.get("/users");

    expect(response.status).toBe(200);
    expect(response.body.total_count).toBe(4);
    expect(response.body.users.map((user) => user.id)).toEqual([alphaEarly.id, beta.id, charlie.id, authUser.id]);
    expect(Object.keys(response.body.users[0]).sort()).toEqual([
      "created_at",
      "email",
      "id",
      "updated_at",
      "username"
    ]);
    expect(response.body.users[0]).toEqual(
      expect.objectContaining({
        id: alphaEarly.id,
        username: "Alpha",
        email: "alpha-early@example.com"
      })
    );
  });

  it("returns owner-only user payload for non-admin actors", async () => {
    const authUser = await createUser();
    await createUser({ username: "Another", email: "another@example.com" });
    const agent = await signInAs(authUser);

    const response = await agent.get("/users");

    expect(response.status).toBe(200);
    expect(response.body.total_count).toBe(1);
    expect(response.body.users).toHaveLength(1);
    expect(response.body.users[0].id).toBe(authUser.id);
  });
});
