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

describe("PATCH /events/:id", () => {
  const app = createApp();
  let counter = 0;

  async function createUser() {
    counter += 1;

    const password = "StrongPass123!";
    const passwordHash = await bcrypt.hash(password, 12);

    const created = await models.User.create({
      username: `event-update-user-${counter}`,
      email: `event-update-user-${counter}@example.com`,
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

  async function createFinancialItem({
    userId,
    title = "Recurring financial item",
    frequency = "monthly",
    status = "Active",
    dueDate = "2026-02-03",
    defaultAmount = 42.75
  }) {
    return models.Item.create({
      user_id: userId,
      item_type: "FinancialItem",
      title,
      type: "Commitment",
      frequency,
      default_amount: defaultAmount,
      status,
      attributes: {
        dueDate
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

  it("materializes projected occurrence once and marks it as persisted exception", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    const recurring = await createFinancialItem({ userId: owner.id });
    const projectedId = `projected-${recurring.id}-2026-03-03`;

    const response = await ownerAgent.patch(`/events/${projectedId}`).send({
      amount: 99.45,
      due_date: "2026-03-08"
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      item_id: recurring.id,
      source_state: "persisted",
      is_projected: false,
      is_exception: true,
      status: "Pending"
    });
    expect(response.body.due_date).toContain("2026-03-08");
    expect(Number(response.body.amount)).toBe(99.45);

    const persistedRows = await models.Event.findAll({ where: { item_id: recurring.id } });
    expect(persistedRows).toHaveLength(1);
    expect(persistedRows[0].is_exception).toBe(true);
  });

  it("dedupes repeated projected updates for the same occurrence", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    const recurring = await createFinancialItem({ userId: owner.id });
    const projectedId = `projected-${recurring.id}-2026-03-03`;

    const first = await ownerAgent.patch(`/events/${projectedId}`).send({ amount: 61.2 });
    const second = await ownerAgent.patch(`/events/${projectedId}`).send({ amount: 61.2 });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);

    const sameDateRows = await models.Event.findAll({
      where: {
        item_id: recurring.id,
        due_date: "2026-03-03T00:00:00.000Z"
      }
    });
    expect(sameDateRows).toHaveLength(1);
  });

  it("returns not_found envelope for foreign-owner projected edit attempts", async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const outsiderAgent = await signInAs(outsider);
    const recurring = await createFinancialItem({ userId: owner.id, title: "Owner-only recurring" });
    const projectedId = `projected-${recurring.id}-2026-03-03`;

    const response = await outsiderAgent.patch(`/events/${projectedId}`).send({ amount: 50 });

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({
      code: "event_update_failed",
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

    const persistedRows = await models.Event.findAll({ where: { item_id: recurring.id } });
    expect(persistedRows).toHaveLength(0);
  });

  it("returns validation issues for invalid amount and due_date payload", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    const recurring = await createFinancialItem({ userId: owner.id });
    const projectedId = `projected-${recurring.id}-2026-03-03`;

    const response = await ownerAgent.patch(`/events/${projectedId}`).send({
      amount: -4,
      due_date: "not-a-date"
    });

    expect(response.status).toBe(422);
    expect(response.body.error).toMatchObject({
      code: "event_update_failed",
      category: "invalid_request"
    });
    expect(response.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "amount",
          code: "invalid_amount"
        }),
        expect.objectContaining({
          field: "due_date",
          code: "invalid_due_date"
        })
      ])
    );
  });
});
