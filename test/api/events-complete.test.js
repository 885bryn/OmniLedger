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

describe("PATCH /events/:id/complete", () => {
  const app = createApp();
  let counter = 0;

  async function createUser() {
    counter += 1;

    return models.User.create({
      username: `event-api-user-${counter}`,
      email: `event-api-user-${counter}@example.com`,
      password_hash: "hashed-password"
    });
  }

  async function createItem({ userId }) {
    return models.Item.create({
      user_id: userId,
      item_type: "RealEstate",
      attributes: {
        address: "19 Ledger Drive",
        estimatedValue: 300000
      }
    });
  }

  async function createEvent({ itemId, recurring = false, dueDate = "2026-07-01T00:00:00.000Z", amount = "1200.50" }) {
    return models.Event.create({
      item_id: itemId,
      event_type: "MortgagePayment",
      due_date: dueDate,
      amount,
      status: "Pending",
      is_recurring: recurring
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

  it("returns 200 with canonical completion payload for first completion", async () => {
    const owner = await createUser();
    const item = await createItem({ userId: owner.id });
    const event = await createEvent({ itemId: item.id, recurring: false });

    const response = await request(app)
      .patch(`/events/${event.id}/complete`)
      .set("x-user-id", owner.id);

    expect(response.status).toBe(200);
    expect(Object.keys(response.body).sort()).toEqual([
      "amount",
      "completed_at",
      "created_at",
      "due_date",
      "id",
      "item_id",
      "prompt_next_date",
      "recurring",
      "status",
      "type",
      "updated_at"
    ]);

    expect(response.body).toMatchObject({
      id: event.id,
      item_id: item.id,
      type: "MortgagePayment",
      status: "Completed",
      recurring: false,
      prompt_next_date: true
    });
    expect(response.body.completed_at).toEqual(expect.any(String));
  });

  it("keeps prompt metadata in recurring completion responses", async () => {
    const owner = await createUser();
    const item = await createItem({ userId: owner.id });
    const recurring = await createEvent({
      itemId: item.id,
      recurring: true,
      dueDate: "2026-08-01T00:00:00.000Z"
    });

    const response = await request(app)
      .patch(`/events/${recurring.id}/complete`)
      .set("x-user-id", owner.id);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: recurring.id,
      recurring: true,
      prompt_next_date: true,
      status: "Completed"
    });
    expect(response.body).toHaveProperty("completed_at");
  });

  it("returns 404 issue envelope for unknown event id without prompt metadata", async () => {
    const owner = await createUser();

    const response = await request(app)
      .patch("/events/11111111-1111-4111-8111-111111111111/complete")
      .set("x-user-id", owner.id);

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({
      code: "event_completion_failed",
      category: "not_found"
    });
    expect(response.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "event_id",
          code: "not_found",
          category: "not_found"
        })
      ])
    );
    expect(response.body).not.toHaveProperty("prompt_next_date");
  });

  it("returns 403 issue envelope for foreign-owned event without prompt metadata", async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const item = await createItem({ userId: owner.id });
    const event = await createEvent({ itemId: item.id });

    const response = await request(app)
      .patch(`/events/${event.id}/complete`)
      .set("x-user-id", outsider.id);

    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({
      code: "event_completion_failed",
      category: "forbidden"
    });
    expect(response.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "event_id",
          code: "forbidden",
          category: "forbidden"
        })
      ])
    );
    expect(response.body).not.toHaveProperty("prompt_next_date");
  });

  it("remains idempotent on repeated completion and does not duplicate audit rows", async () => {
    const owner = await createUser();
    const item = await createItem({ userId: owner.id });
    const event = await createEvent({ itemId: item.id });

    const first = await request(app)
      .patch(`/events/${event.id}/complete`)
      .set("x-user-id", owner.id);

    const second = await request(app)
      .patch(`/events/${event.id}/complete`)
      .set("x-user-id", owner.id);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.status).toBe("Completed");
    expect(second.body.status).toBe("Completed");
    expect(second.body.completed_at).toBe(first.body.completed_at);

    const audits = await models.AuditLog.findAll({
      where: {
        action: "event.completed",
        entity: `event:${event.id}`
      }
    });
    expect(audits).toHaveLength(1);
  });
});
