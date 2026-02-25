"use strict";

const request = require("supertest");

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

    const response = await request(app).get("/users");

    expect(response.status).toBe(200);
    expect(response.body.total_count).toBe(3);
    expect(response.body.users.map((user) => user.id)).toEqual([alphaEarly.id, beta.id, charlie.id]);
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

  it("returns empty contract shape when no users exist", async () => {
    const response = await request(app).get("/users");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      users: [],
      total_count: 0
    });
  });
});
