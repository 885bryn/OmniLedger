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

  async function createEvent({ itemId, dueDate, status = "Pending", amount = "100.00", recurring = false }) {
    return models.Event.create({
      item_id: itemId,
      event_type: "MortgagePayment",
      due_date: dueDate,
      amount,
      status,
      is_recurring: recurring,
      completed_at: status === "Completed" ? dueDate : null
    });
  }

  async function setEventUpdatedAt(eventId, isoDate) {
    await models.Event.update(
      { updated_at: isoDate },
      {
        where: { id: eventId },
        silent: true
      }
    );
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

  it("returns grouped nearest-due sections with deterministic event ordering", async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const item = await createItem(owner.id);
    const outsiderItem = await createItem(outsider.id);

    const firstDate = await createEvent({
      itemId: item.id,
      dueDate: "2026-07-01T00:00:00.000Z",
      amount: "1200.00",
      recurring: true
    });
    const tieOlder = await createEvent({
      itemId: item.id,
      dueDate: "2026-07-15T00:00:00.000Z",
      amount: "200.00"
    });
    const tieNewer = await createEvent({
      itemId: item.id,
      dueDate: "2026-07-15T00:00:00.000Z",
      amount: "400.00"
    });
    await createEvent({
      itemId: outsiderItem.id,
      dueDate: "2026-07-10T00:00:00.000Z",
      amount: "999.99"
    });

    await setEventUpdatedAt(tieOlder.id, "2026-01-01T00:00:00.000Z");
    await setEventUpdatedAt(tieNewer.id, "2026-01-05T00:00:00.000Z");

    const response = await request(app)
      .get("/events")
      .set("x-user-id", owner.id);

    expect(response.status).toBe(200);
    expect(response.body.total_count).toBe(3);
    expect(response.body.groups).toHaveLength(2);
    expect(response.body.groups.map((group) => group.due_date)).toEqual(["2026-07-01", "2026-07-15"]);
    expect(response.body.groups[0].events[0].id).toBe(firstDate.id);
    expect(response.body.groups[1].events.map((event) => event.id)).toEqual([tieNewer.id, tieOlder.id]);
    expect(response.body.groups[0]).toMatchObject({
      due_date: "2026-07-01"
    });
    expect(Object.keys(response.body.groups[0].events[0]).sort()).toEqual([
      "amount",
      "completed_at",
      "created_at",
      "due_date",
      "id",
      "item_id",
      "recurring",
      "status",
      "type",
      "updated_at"
    ]);
  });

  it("supports status and due range filters for page-level event views", async () => {
    const owner = await createUser();
    const item = await createItem(owner.id);

    await createEvent({
      itemId: item.id,
      dueDate: "2026-06-01T00:00:00.000Z",
      status: "Pending"
    });
    await createEvent({
      itemId: item.id,
      dueDate: "2026-07-10T00:00:00.000Z",
      status: "Completed"
    });

    const pending = await request(app)
      .get("/events")
      .set("x-user-id", owner.id)
      .query({ status: "pending" });
    expect(pending.status).toBe(200);
    expect(pending.body.total_count).toBe(1);

    const completed = await request(app)
      .get("/events")
      .set("x-user-id", owner.id)
      .query({ status: "completed" });
    expect(completed.status).toBe(200);
    expect(completed.body.total_count).toBe(1);

    const ranged = await request(app)
      .get("/events")
      .set("x-user-id", owner.id)
      .query({ due_from: "2026-07-01", due_to: "2026-07-31", status: "all" });
    expect(ranged.status).toBe(200);
    expect(ranged.body.total_count).toBe(1);
    expect(ranged.body.groups[0].due_date).toBe("2026-07-10");
  });

  it("returns issue envelopes for invalid status and due-range inputs", async () => {
    const owner = await createUser();
    await createItem(owner.id);

    const invalidStatus = await request(app)
      .get("/events")
      .set("x-user-id", owner.id)
      .query({ status: "bad" });

    expect(invalidStatus.status).toBe(422);
    expect(invalidStatus.body.error).toMatchObject({
      code: "event_query_failed",
      category: "invalid_filter"
    });
    expect(invalidStatus.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "status",
          code: "unsupported_status_filter",
          category: "invalid_filter"
        })
      ])
    );

    const invalidRange = await request(app)
      .get("/events")
      .set("x-user-id", owner.id)
      .query({ due_from: "2026-08-01", due_to: "2026-07-01" });

    expect(invalidRange.status).toBe(422);
    expect(invalidRange.body.error).toMatchObject({
      code: "event_query_failed",
      category: "invalid_range"
    });
    expect(invalidRange.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "due_range",
          code: "invalid_due_range",
          category: "invalid_range"
        })
      ])
    );
  });
});
