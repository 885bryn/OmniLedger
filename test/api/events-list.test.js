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

describe("GET /events", () => {
  const app = createApp();
  let userCount = 0;

  async function createUser() {
    userCount += 1;
    return models.User.create({
      username: `events-user-${userCount}`,
      email: `events-user-${userCount}@example.com`,
      password_hash: "hashed-password"
    });
  }

  async function createItem(userId) {
    return models.Item.create({
      user_id: userId,
      item_type: "RealEstate",
      attributes: {
        address: "21 Due Street",
        estimatedValue: 220000
      }
    });
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

  it("returns due-date groups with deterministic shape", async () => {
    const owner = await createUser();
    const item = await createItem(owner.id);

    await models.Event.create({
      item_id: item.id,
      event_type: "MortgagePayment",
      due_date: "2026-07-01T00:00:00.000Z",
      amount: "1200.00",
      status: "Pending",
      is_recurring: true
    });

    const response = await request(app)
      .get("/events")
      .set("x-user-id", owner.id);

    expect(response.status).toBe(200);
    expect(response.body.total_count).toBe(1);
    expect(response.body.groups).toHaveLength(1);
    expect(response.body.groups[0]).toMatchObject({
      due_date: "2026-07-01"
    });
    expect(response.body.groups[0].events).toHaveLength(1);
  });
});
