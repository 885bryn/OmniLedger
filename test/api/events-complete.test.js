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

describe("PATCH /events/:id/complete", () => {
  const app = createApp();
  let counter = 0;

  async function createUser() {
    counter += 1;

    const password = "StrongPass123!";
    const passwordHash = await bcrypt.hash(password, 12);

    const created = await models.User.create({
      username: `event-api-user-${counter}`,
      email: `event-api-user-${counter}@example.com`,
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

  async function createCommitment({ userId, parentItemId }) {
    return models.Item.create({
      user_id: userId,
      item_type: "FinancialCommitment",
      parent_item_id: parentItemId || null,
      attributes: {
        name: "1578 payment test",
        amount: 9,
        dueDate: "2026-03-02"
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
    const ownerAgent = await signInAs(owner);
    const item = await createItem({ userId: owner.id });
    const event = await createEvent({ itemId: item.id, recurring: false });

    const response = await ownerAgent.patch(`/events/${event.id}/complete`);

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
    const ownerAgent = await signInAs(owner);
    const item = await createItem({ userId: owner.id });
    const recurring = await createEvent({
      itemId: item.id,
      recurring: true,
      dueDate: "2026-08-01T00:00:00.000Z"
    });

    const response = await ownerAgent.patch(`/events/${recurring.id}/complete`);

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
    const ownerAgent = await signInAs(owner);

    const response = await ownerAgent.patch("/events/11111111-1111-4111-8111-111111111111/complete");

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

  it("returns 404 for foreign-owned event and ignores payload owner overrides", async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const outsiderAgent = await signInAs(outsider);
    const item = await createItem({ userId: owner.id });
    const event = await createEvent({ itemId: item.id });

    const response = await outsiderAgent
      .patch(`/events/${event.id}/complete`)
      .send({
        user_id: owner.id,
        actorUserId: owner.id,
        scope: {
          actorUserId: owner.id
        }
      });

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

  it("returns 404 for foreign-owned undo completion and keeps event completed", async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const ownerAgent = await signInAs(owner);
    const outsiderAgent = await signInAs(outsider);
    const item = await createItem({ userId: owner.id });
    const event = await createEvent({ itemId: item.id });

    const completed = await ownerAgent.patch(`/events/${event.id}/complete`);
    expect(completed.status).toBe(200);

    const forbiddenUndo = await outsiderAgent
      .patch(`/events/${event.id}/undo-complete`)
      .send({
        user_id: owner.id,
        actorUserId: owner.id,
        scope: {
          actorUserId: owner.id
        }
      });

    expect(forbiddenUndo.status).toBe(404);
    expect(forbiddenUndo.status).not.toBe(403);
    expect(forbiddenUndo.body.error).toMatchObject({
      code: "event_completion_failed",
      category: "not_found",
      message: "You can only access your own records."
    });
    expect(forbiddenUndo.body.error.category).not.toBe("forbidden");
    expect(forbiddenUndo.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "event_id",
          code: "not_found",
          category: "not_found"
        })
      ])
    );

    const refreshed = await models.Event.findByPk(event.id);
    expect(refreshed.status).toBe("Completed");
  });

  it("remains idempotent on repeated completion and does not duplicate audit rows", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    const item = await createItem({ userId: owner.id });
    const event = await createEvent({ itemId: item.id });

    const first = await ownerAgent.patch(`/events/${event.id}/complete`);

    const second = await ownerAgent.patch(`/events/${event.id}/complete`);

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

  it("completes derived event ids by creating a pending event from item attributes", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    const parent = await createItem({ userId: owner.id });
    const commitment = await createCommitment({ userId: owner.id, parentItemId: parent.id });

    const response = await ownerAgent.patch(`/events/derived-${commitment.id}/complete`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      item_id: commitment.id,
      status: "Completed",
      type: "1578 payment test"
    });

    const persisted = await models.Event.findAll({ where: { item_id: commitment.id } });
    expect(persisted).toHaveLength(1);
    expect(persisted[0].status).toBe("Completed");
  });

  it("returns 200 for legacy commitment rows with missing dueDate attributes", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    const legacyCommitment = await models.Item.create(
      {
        user_id: owner.id,
        item_type: "FinancialCommitment",
        attributes: {
          amount: 25,
          billingCycle: "monthly",
          remainingBalance: 150
        }
      },
      { validate: false }
    );

    const event = await createEvent({ itemId: legacyCommitment.id, amount: "25.00" });

    const response = await ownerAgent.patch(`/events/${event.id}/complete`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: event.id,
      item_id: legacyCommitment.id,
      status: "Completed"
    });

    const persistedItem = await models.Item.findByPk(legacyCommitment.id);
    expect(persistedItem.attributes.remainingBalance).toBe(150);
    expect(persistedItem.attributes.lastPaymentAmount).toBeUndefined();
  });

  it("does not immediately recreate pending event for same due date after completion", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    const parent = await createItem({ userId: owner.id });
    const rentItem = await models.Item.create({
      user_id: owner.id,
      item_type: "FinancialIncome",
      parent_item_id: parent.id,
      attributes: {
        name: "1578 rent test",
        amount: 5.53,
        dueDate: "2026-02-28"
      }
    });

    const firstCompletion = await ownerAgent.patch(`/events/derived-${rentItem.id}/complete`);

    expect(firstCompletion.status).toBe(200);

    const pendingAfterComplete = await ownerAgent.get("/events?status=pending");

    expect(pendingAfterComplete.status).toBe(200);
    const matchingPending = pendingAfterComplete.body.groups
      .flatMap((group) => group.events)
      .filter((event) => event.item_id === rentItem.id);
    expect(matchingPending).toHaveLength(0);
  });

  it("undoes completion and restores pending event plus financial totals", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    const parent = await createItem({ userId: owner.id });
    const commitment = await models.Item.create({
      user_id: owner.id,
      item_type: "FinancialCommitment",
      parent_item_id: parent.id,
      attributes: {
        name: "Undo test loan",
        amount: 100,
        remainingBalance: 900,
        dueDate: "2026-03-10"
      }
    });
    const event = await createEvent({ itemId: commitment.id, dueDate: "2026-03-10T00:00:00.000Z", amount: "100.00" });

    const completed = await ownerAgent.patch(`/events/${event.id}/complete`);
    expect(completed.status).toBe(200);

    const undone = await ownerAgent.patch(`/events/${event.id}/undo-complete`);

    expect(undone.status).toBe(200);
    expect(undone.body.status).toBe("Pending");
    expect(undone.body.completed_at).toBeNull();

    const refreshed = await models.Item.findByPk(commitment.id);
    expect(refreshed.attributes.remainingBalance).toBe(900);

    const pendingList = await ownerAgent.get("/events?status=pending");
    const pendingIds = pendingList.body.groups.flatMap((group) => group.events).map((row) => row.id);
    expect(pendingIds).toContain(event.id);

    const undoAudit = await models.AuditLog.findOne({
      where: {
        action: "event.reopened",
        entity: `event:${event.id}`
      }
    });
    expect(undoAudit).toBeTruthy();
  });
});
