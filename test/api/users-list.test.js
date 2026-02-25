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

  it("returns users sorted by normalized username", async () => {
    const beta = await models.User.create({
      username: "beta",
      email: "beta@example.com",
      password_hash: "hashed-password"
    });
    const alpha = await models.User.create({
      username: "Alpha",
      email: "alpha@example.com",
      password_hash: "hashed-password"
    });

    const response = await request(app).get("/users");

    expect(response.status).toBe(200);
    expect(response.body.total_count).toBe(2);
    expect(response.body.users.map((user) => user.id)).toEqual([alpha.id, beta.id]);
    expect(response.body.users[0]).toEqual(
      expect.objectContaining({
        id: alpha.id,
        username: "Alpha",
        email: "alpha@example.com"
      })
    );
  });
});
