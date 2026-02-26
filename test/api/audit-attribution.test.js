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

describe("audit attribution persistence", () => {
  const app = createApp();
  let userCount = 0;

  async function createUser() {
    userCount += 1;

    return models.User.create({
      username: `audit-user-${userCount}`,
      email: `audit-user-${userCount}@example.com`,
      password_hash: await bcrypt.hash("StrongPass123!", 12)
    });
  }

  async function signInAs(user) {
    const agent = request.agent(app);
    const login = await agent.post("/auth/login").send({
      email: user.email,
      password: "StrongPass123!"
    });

    expect(login.status).toBe(200);

    return agent;
  }

  async function createItem(userId) {
    return models.Item.create({
      user_id: userId,
      item_type: "RealEstate",
      attributes: {
        address: "21 Attribution Lane",
        estimatedValue: 450000
      }
    });
  }

  async function createEvent(itemId) {
    return models.Event.create({
      item_id: itemId,
      event_type: "MortgagePayment",
      due_date: "2026-08-01T00:00:00.000Z",
      amount: "1200.50",
      status: "Pending",
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

  it("keeps legacy audit writes readable by backfilling actor and lens", async () => {
    const user = await createUser();

    const created = await models.AuditLog.create({
      user_id: user.id,
      action: "item.created",
      entity: "item:abc",
      timestamp: new Date("2026-02-26T00:00:00.000Z")
    });

    expect(created.user_id).toBe(user.id);
    expect(created.actor_user_id).toBe(user.id);
    expect(created.lens_user_id).toBe(user.id);
  });

  it("persists explicit actor and lens tuple when provided", async () => {
    const actor = await createUser();
    const lens = await createUser();

    const created = await models.AuditLog.create({
      user_id: actor.id,
      actor_user_id: actor.id,
      lens_user_id: lens.id,
      action: "event.completed",
      entity: "event:abc",
      timestamp: new Date("2026-02-26T01:00:00.000Z")
    });

    expect(created.user_id).toBe(actor.id);
    expect(created.actor_user_id).toBe(actor.id);
    expect(created.lens_user_id).toBe(lens.id);
  });

  it("persists scope-derived actor+lens tuple for create, update, and delete actions", async () => {
    const actor = await createUser();
    const outsider = await createUser();
    const agent = await signInAs(actor);

    const createdResponse = await agent.post("/items").send({
      user_id: outsider.id,
      actor_user_id: outsider.id,
      lens_user_id: outsider.id,
      item_type: "RealEstate",
      attributes: {
        address: "Tuple House",
        estimatedValue: 700000
      }
    });

    expect(createdResponse.status).toBe(201);

    const updatedResponse = await agent.patch(`/items/${createdResponse.body.id}`).send({
      attributes: {
        estimatedValue: 710000
      },
      actor_user_id: outsider.id,
      lens_user_id: outsider.id
    });

    expect(updatedResponse.status).toBe(200);

    const deletedResponse = await agent.delete(`/items/${createdResponse.body.id}`);

    expect(deletedResponse.status).toBe(200);

    const audits = await models.AuditLog.findAll({
      where: {
        entity: `item:${createdResponse.body.id}`
      }
    });

    expect(audits.map((row) => row.action)).toEqual(
      expect.arrayContaining(["item.created", "item.updated", "item.deleted"])
    );

    audits.forEach((row) => {
      expect(row.user_id).toBe(actor.id);
      expect(row.actor_user_id).toBe(actor.id);
      expect(row.lens_user_id).toBe(actor.id);
    });
  });

  it("persists scope-derived actor+lens tuple for complete and undo actions", async () => {
    const actor = await createUser();
    const agent = await signInAs(actor);
    const item = await createItem(actor.id);
    const event = await createEvent(item.id);

    const completed = await agent.patch(`/events/${event.id}/complete`);
    expect(completed.status).toBe(200);

    const undone = await agent.patch(`/events/${event.id}/undo-complete`);
    expect(undone.status).toBe(200);

    const audits = await models.AuditLog.findAll({
      where: {
        entity: `event:${event.id}`
      }
    });

    expect(audits.map((row) => row.action)).toEqual(
      expect.arrayContaining(["event.completed", "event.reopened"])
    );

    audits.forEach((row) => {
      expect(row.user_id).toBe(actor.id);
      expect(row.actor_user_id).toBe(actor.id);
      expect(row.lens_user_id).toBe(actor.id);
    });
  });

  it("supports restore-category attribution rows for delete lifecycle coverage", async () => {
    const actor = await createUser();
    const item = await createItem(actor.id);

    const restoredAudit = await models.AuditLog.create({
      user_id: actor.id,
      actor_user_id: actor.id,
      lens_user_id: actor.id,
      action: "item.restored",
      entity: `item:${item.id}`,
      timestamp: new Date("2026-02-26T02:00:00.000Z")
    });

    expect(restoredAudit.action).toBe("item.restored");
    expect(restoredAudit.actor_user_id).toBe(actor.id);
    expect(restoredAudit.lens_user_id).toBe(actor.id);
  });
});
