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

  async function setItemTimestamps(itemId, createdAt, updatedAt) {
    await models.Item.update(
      {
        created_at: createdAt,
        updated_at: updatedAt
      },
      {
        where: { id: itemId },
        silent: true
      }
    );
  }

  async function createEvent(itemId, dueDate, status = "Pending") {
    return models.Event.create({
      item_id: itemId,
      event_type: "MortgagePayment",
      due_date: dueDate,
      amount: "500.00",
      status,
      is_recurring: false
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

  it("lists items with deterministic default ordering and query controls", async () => {
    const owner = await createUser();
    const outsider = await createUser();

    const newest = await createItem(owner.id, { address: "Newest" });
    const older = await createItem(owner.id, { address: "Older" });
    const dueSoon = await createItem(owner.id, { address: "Due Soon", dueDate: "2026-03-01" });
    await createItem(outsider.id, { address: "Foreign" });

    await setItemTimestamps(older.id, "2026-01-01T00:00:00.000Z", "2026-01-05T00:00:00.000Z");
    await setItemTimestamps(newest.id, "2026-01-01T00:00:00.000Z", "2026-01-10T00:00:00.000Z");
    await setItemTimestamps(dueSoon.id, "2026-01-01T00:00:00.000Z", "2026-01-08T00:00:00.000Z");

    const listed = await request(app)
      .get("/items")
      .set("x-user-id", owner.id);

    expect(listed.status).toBe(200);
    expect(listed.body.total_count).toBe(3);
    const firstPass = listed.body.items.map((item) => item.id);

    const listedAgain = await request(app)
      .get("/items")
      .set("x-user-id", owner.id);

    expect(listedAgain.status).toBe(200);
    expect(listedAgain.body.items.map((item) => item.id)).toEqual(firstPass);
    expect(new Set(firstPass)).toEqual(new Set([newest.id, dueSoon.id, older.id]));

    const filtered = await request(app)
      .get("/items")
      .set("x-user-id", owner.id)
      .query({ search: "due", sort: "due_soon", filter: "assets" });

    expect(filtered.status).toBe(200);
    expect(filtered.body.total_count).toBe(1);
    expect(filtered.body.items[0].id).toBe(dueSoon.id);
  });

  it("returns field-level issue envelopes for invalid list and mutate requests", async () => {
    const owner = await createUser();
    const item = await createItem(owner.id);

    const invalidList = await request(app)
      .get("/items")
      .set("x-user-id", owner.id)
      .query({ filter: "bad-filter" });

    expect(invalidList.status).toBe(422);
    expect(invalidList.body.error).toMatchObject({
      code: "item_query_failed",
      category: "invalid_filter"
    });
    expect(invalidList.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "filter",
          code: "unsupported_filter",
          category: "invalid_filter"
        })
      ])
    );

    const invalidPatch = await request(app)
      .patch(`/items/${item.id}`)
      .set("x-user-id", owner.id)
      .send({
        attributes: "not-an-object"
      });

    expect(invalidPatch.status).toBe(422);
    expect(invalidPatch.body.error).toMatchObject({
      code: "item_query_failed",
      category: "invalid_request"
    });
    expect(invalidPatch.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "attributes",
          code: "invalid_attributes",
          category: "invalid_request"
        })
      ])
    );
  });

  it("applies patch and soft delete while enforcing deleted visibility semantics", async () => {
    const owner = await createUser();
    const item = await createItem(owner.id, { address: "Deletable", estimatedValue: 100000 });

    const patched = await request(app)
      .patch(`/items/${item.id}`)
      .set("x-user-id", owner.id)
      .send({ attributes: { estimatedValue: 120000 } });

    expect(patched.status).toBe(200);
    expect(patched.body.attributes.estimatedValue).toBe(120000);

    const deleted = await request(app)
      .delete(`/items/${item.id}`)
      .set("x-user-id", owner.id);

    expect(deleted.status).toBe(200);
    expect(deleted.body.is_deleted).toBe(true);
    expect(deleted.body.deleted_at).toEqual(expect.any(String));

    const defaultList = await request(app)
      .get("/items")
      .set("x-user-id", owner.id);

    expect(defaultList.status).toBe(200);
    expect(defaultList.body.total_count).toBe(0);

    const includeDeletedList = await request(app)
      .get("/items")
      .set("x-user-id", owner.id)
      .query({ include_deleted: "true", filter: "deleted" });

    expect(includeDeletedList.status).toBe(200);
    expect(includeDeletedList.body.total_count).toBe(1);
    expect(includeDeletedList.body.items[0].id).toBe(item.id);

    const updateAfterDelete = await request(app)
      .patch(`/items/${item.id}`)
      .set("x-user-id", owner.id)
      .send({ attributes: { estimatedValue: 130000 } });

    expect(updateAfterDelete.status).toBe(422);
    expect(updateAfterDelete.body.error.category).toBe("invalid_state");
  });

  it("returns item activity timeline with deterministic shape and supports limit validation", async () => {
    const owner = await createUser();
    const item = await createItem(owner.id, { address: "Activity House" });

    await request(app)
      .patch(`/items/${item.id}`)
      .set("x-user-id", owner.id)
      .send({ attributes: { estimatedValue: 320000 } });

    const event = await createEvent(item.id, "2026-08-01T00:00:00.000Z");
    await request(app)
      .patch(`/events/${event.id}/complete`)
      .set("x-user-id", owner.id);

    await request(app)
      .delete(`/items/${item.id}`)
      .set("x-user-id", owner.id);

    const activity = await request(app)
      .get(`/items/${item.id}/activity`)
      .query({ limit: "2" })
      .set("x-user-id", owner.id);

    expect(activity.status).toBe(200);
    expect(activity.body.item_id).toBe(item.id);
    expect(activity.body.activity).toHaveLength(2);
    activity.body.activity.forEach((entry) => {
      expect(Object.keys(entry).sort()).toEqual([
        "action",
        "created_at",
        "entity",
        "id",
        "timestamp",
        "updated_at",
        "user_id"
      ]);
    });
    expect(activity.body.activity.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(["item.deleted", "event.completed"])
    );

    const invalidLimit = await request(app)
      .get(`/items/${item.id}/activity`)
      .query({ limit: "0" })
      .set("x-user-id", owner.id);

    expect(invalidLimit.status).toBe(422);
    expect(invalidLimit.body.error).toMatchObject({
      code: "item_query_failed",
      category: "invalid_request"
    });
    expect(invalidLimit.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "limit",
          code: "invalid_limit"
        })
      ])
    );
  });
});
