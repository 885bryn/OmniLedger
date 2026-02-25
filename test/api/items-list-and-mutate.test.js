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

describe("items list and mutate contracts", () => {
  const app = createApp();
  let userCount = 0;

  async function createUser() {
    userCount += 1;
    return models.User.create({
      username: `items-user-${userCount}`,
      email: `items-user-${userCount}@example.com`,
      password_hash: "hashed-password"
    });
  }

  async function createItem(userId, attributes = {}) {
    return models.Item.create({
      user_id: userId,
      item_type: "RealEstate",
      attributes: {
        address: "20 Test Avenue",
        estimatedValue: 300000,
        ...attributes
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

  it("supports GET, PATCH, DELETE, and activity retrieval", async () => {
    const owner = await createUser();
    const created = await createItem(owner.id);

    const listed = await request(app)
      .get("/items")
      .set("x-user-id", owner.id);
    expect(listed.status).toBe(200);
    expect(listed.body.total_count).toBe(1);
    expect(listed.body.items[0].id).toBe(created.id);

    const patched = await request(app)
      .patch(`/items/${created.id}`)
      .set("x-user-id", owner.id)
      .send({
        attributes: {
          estimatedValue: 310000
        }
      });
    expect(patched.status).toBe(200);
    expect(patched.body.attributes.estimatedValue).toBe(310000);

    const deleted = await request(app)
      .delete(`/items/${created.id}`)
      .set("x-user-id", owner.id);
    expect(deleted.status).toBe(200);
    expect(deleted.body.is_deleted).toBe(true);

    const activity = await request(app)
      .get(`/items/${created.id}/activity`)
      .set("x-user-id", owner.id);
    expect(activity.status).toBe(200);
    expect(activity.body.item_id).toBe(created.id);
    expect(Array.isArray(activity.body.activity)).toBe(true);
  });
});
