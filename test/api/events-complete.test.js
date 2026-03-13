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
  const originalAdminEmail = process.env.HACT_ADMIN_EMAIL;

  async function createUser(overrides = {}) {
    counter += 1;

    const password = overrides.password || "StrongPass123!";
    const passwordHash = await bcrypt.hash(password, 12);

    const created = await models.User.create({
      username: overrides.username || `event-api-user-${counter}`,
      email: overrides.email || `event-api-user-${counter}@example.com`,
      password_hash: passwordHash,
      role: overrides.role
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
      item_type: "FinancialItem",
      parent_item_id: parentItemId || null,
      linked_asset_item_id: parentItemId || null,
      title: "1578 payment test",
      type: "Commitment",
      frequency: "one_time",
      default_amount: 9,
      status: "Active",
      attributes: {
        name: "1578 payment test",
        amount: 9,
        dueDate: "2026-03-02",
        financialSubtype: "Commitment"
      }
    });
  }

  async function createFinancialItem({
    userId,
    title = "Recurring financial item",
    frequency = "monthly",
    status = "Active",
    dueDate = "2026-02-15",
    defaultAmount = 180.5
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
    process.env.HACT_ADMIN_EMAIL = "admin@example.com";
    await sequelize.query("PRAGMA foreign_keys = OFF");
    await models.AuditLog.destroy({ where: {}, force: true });
    await models.Event.destroy({ where: {}, force: true });
    await models.Item.destroy({ where: {}, force: true });
    await models.User.destroy({ where: {}, force: true });
    await sequelize.query("PRAGMA foreign_keys = ON");
  });

  afterAll(async () => {
    if (typeof originalAdminEmail === "string") {
      process.env.HACT_ADMIN_EMAIL = originalAdminEmail;
    } else {
      delete process.env.HACT_ADMIN_EMAIL;
    }

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
      "actual_amount",
      "actual_date",
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
    expect(Number(response.body.actual_amount)).toBeCloseTo(1200.5, 2);
    expect(response.body.actual_date).toBe(response.body.completed_at.slice(0, 10));
    expect(response.body.completed_at).toEqual(expect.any(String));
  });

  it("persists explicit reconciliation actual amount/date and keeps projected fields unchanged", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    const item = await createItem({ userId: owner.id });
    const event = await createEvent({
      itemId: item.id,
      recurring: false,
      dueDate: "2026-07-01T00:00:00.000Z",
      amount: "1200.50"
    });

    const response = await ownerAgent.patch(`/events/${event.id}/complete`).send({
      actual_amount: "1300.75",
      actual_date: "2026-07-02"
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: event.id,
      item_id: item.id,
      due_date: "2026-07-01T00:00:00.000Z",
      actual_date: "2026-07-02",
      status: "Completed",
      prompt_next_date: true
    });
    expect(Number(response.body.amount)).toBeCloseTo(1200.5, 2);
    expect(Number(response.body.actual_amount)).toBeCloseTo(1300.75, 2);
    expect(response.body.completed_at).toEqual(expect.any(String));

    const persisted = await models.Event.findByPk(event.id);
    expect(Number(persisted.amount)).toBeCloseTo(1200.5, 2);
    expect(persisted.due_date.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(Number(persisted.actual_amount)).toBeCloseTo(1300.75, 2);
    expect(persisted.actual_date).toBe("2026-07-02");
    expect(persisted.completed_at).toBeTruthy();

    const audits = await models.AuditLog.findAll({
      where: {
        action: "event.completed",
        entity: `event:${event.id}`
      }
    });

    expect(audits).toHaveLength(1);
    expect(audits[0].actor_user_id).toBe(owner.id);
    expect(audits[0].lens_user_id).toBe(owner.id);
  });

  it("defaults omitted reconciliation inputs to projected amount and completion business date", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    const item = await createItem({ userId: owner.id });
    const event = await createEvent({
      itemId: item.id,
      recurring: false,
      dueDate: "2026-08-01T00:00:00.000Z",
      amount: "88.40"
    });

    const response = await ownerAgent.patch(`/events/${event.id}/complete`);

    expect(response.status).toBe(200);
    expect(Number(response.body.amount)).toBeCloseTo(88.4, 2);
    expect(Number(response.body.actual_amount)).toBeCloseTo(88.4, 2);
    expect(response.body.actual_date).toEqual(expect.any(String));
    expect(response.body.completed_at).toEqual(expect.any(String));
    expect(response.body.actual_date).toBe(response.body.completed_at.slice(0, 10));

    const persisted = await models.Event.findByPk(event.id);
    expect(Number(persisted.amount)).toBeCloseTo(88.4, 2);
    expect(Number(persisted.actual_amount)).toBeCloseTo(88.4, 2);
    expect(persisted.actual_date).toBe(response.body.actual_date);
    expect(persisted.status).toBe("Completed");
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

  it("returns 200 for one-time financial rows with missing dueDate attributes", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    const legacyCommitment = await models.Item.create(
      {
        user_id: owner.id,
        item_type: "FinancialItem",
        title: "Legacy commitment",
        type: "Commitment",
        frequency: "one_time",
        default_amount: 25,
        status: "Active",
        attributes: {
          amount: 25,
          financialSubtype: "Commitment",
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
      item_type: "FinancialItem",
      parent_item_id: parent.id,
      linked_asset_item_id: parent.id,
      title: "1578 rent test",
      type: "Income",
      frequency: "one_time",
      default_amount: 5.53,
      status: "Active",
      attributes: {
        name: "1578 rent test",
        amount: 5.53,
        dueDate: "2026-02-28",
        financialSubtype: "Income"
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
      item_type: "FinancialItem",
      parent_item_id: parent.id,
      linked_asset_item_id: parent.id,
      title: "Undo test loan",
      type: "Commitment",
      frequency: "monthly",
      default_amount: 100,
      status: "Active",
      attributes: {
        name: "Undo test loan",
        amount: 100,
        remainingBalance: 900,
        trackingStartingRemainingBalance: 900,
        dueDate: "2026-03-10",
        financialSubtype: "Commitment"
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

  it("materializes projected recurring occurrences before completion and dedupes retries", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    const recurring = await createFinancialItem({
      userId: owner.id,
      title: "Water bill",
      frequency: "monthly",
      status: "Active",
      dueDate: "2026-02-03",
      defaultAmount: 42.75
    });

    const projectedId = `projected-${recurring.id}-2026-03-03`;

    const first = await ownerAgent.patch(`/events/${projectedId}/complete`);
    const second = await ownerAgent.patch(`/events/${projectedId}/complete`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.status).toBe("Completed");
    expect(first.body.item_id).toBe(recurring.id);
    expect(second.body.id).toBe(first.body.id);

    const persistedForDate = await models.Event.findAll({
      where: {
        item_id: recurring.id,
        due_date: "2026-03-03T00:00:00.000Z"
      }
    });
    expect(persistedForDate).toHaveLength(1);

    const audits = await models.AuditLog.findAll({
      where: {
        action: "event.completed",
        entity: `event:${first.body.id}`
      }
    });
    expect(audits).toHaveLength(1);
  });

  it("materializes projected occurrences into a stable completed persisted row", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    const recurring = await createFinancialItem({
      userId: owner.id,
      title: "Visibility regression guard",
      frequency: "monthly",
      status: "Active",
      dueDate: "2026-02-03",
      defaultAmount: 73.25
    });

    const projectedId = `projected-${recurring.id}-2026-03-03`;
    const completion = await ownerAgent.patch(`/events/${projectedId}/complete`);

    expect(completion.status).toBe(200);
    expect(completion.body.status).toBe("Completed");
    expect(completion.body.item_id).toBe(recurring.id);

    const persistedCompleted = await models.Event.findByPk(completion.body.id);
    expect(persistedCompleted).toBeTruthy();
    expect(persistedCompleted.item_id).toBe(recurring.id);
    expect(persistedCompleted.status).toBe("Completed");
    expect(persistedCompleted.due_date.toISOString()).toContain("2026-03-03");

    const duplicateRows = await models.Event.findAll({
      where: {
        item_id: recurring.id,
        due_date: "2026-03-03T00:00:00.000Z"
      }
    });
    expect(duplicateRows).toHaveLength(1);
  });

  it("returns 404 when completing projected occurrence for foreign owner", async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const outsiderAgent = await signInAs(outsider);
    const recurring = await createFinancialItem({
      userId: owner.id,
      title: "Foreign recurring",
      frequency: "monthly",
      status: "Active",
      dueDate: "2026-02-05",
      defaultAmount: 75
    });

    const response = await outsiderAgent.patch(`/events/projected-${recurring.id}-2026-03-05/complete`);

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({
      code: "event_completion_failed",
      category: "not_found"
    });

    const materializedRows = await models.Event.findAll({ where: { item_id: recurring.id } });
    expect(materializedRows).toHaveLength(0);
  });

  it("supports admin all-mode complete/undo across owners while owner-lens keeps not_found denials", async () => {
    const admin = await createUser({ email: "admin@example.com" });
    const ownerA = await createUser({ email: "events-owner-a@example.com" });
    const ownerB = await createUser({ email: "events-owner-b@example.com" });
    const adminAgent = await signInAs(admin);

    const ownerAItem = await createItem({ userId: ownerA.id });
    const ownerBItem = await createItem({ userId: ownerB.id });
    const ownerAEvent = await createEvent({ itemId: ownerAItem.id, dueDate: "2026-07-01T00:00:00.000Z" });
    const ownerBEvent = await createEvent({ itemId: ownerBItem.id, dueDate: "2026-07-02T00:00:00.000Z" });

    const ownerBRecurring = await createFinancialItem({
      userId: ownerB.id,
      title: "Owner B recurring",
      dueDate: "2026-02-10",
      defaultAmount: 60
    });

    const allModeComplete = await adminAgent.patch(`/events/${ownerBEvent.id}/complete`);
    expect(allModeComplete.status).toBe(200);
    expect(allModeComplete.body.item_id).toBe(ownerBItem.id);

    const allModeUndo = await adminAgent.patch(`/events/${ownerBEvent.id}/undo-complete`);
    expect(allModeUndo.status).toBe(200);
    expect(allModeUndo.body.status).toBe("Pending");

    const allModeProjected = await adminAgent.patch(`/events/projected-${ownerBRecurring.id}-2026-03-10/complete`);
    expect(allModeProjected.status).toBe(200);
    expect(allModeProjected.body.item_id).toBe(ownerBRecurring.id);

    const setLens = await adminAgent.patch("/auth/admin-scope").send({
      mode: "owner",
      lens_user_id: ownerA.id
    });
    expect(setLens.status).toBe(200);

    const ownerLensAllowed = await adminAgent.patch(`/events/${ownerAEvent.id}/complete`);
    expect(ownerLensAllowed.status).toBe(200);
    expect(ownerLensAllowed.body.item_id).toBe(ownerAItem.id);

    const ownerLensDeniedUndo = await adminAgent.patch(`/events/${ownerBEvent.id}/undo-complete`);
    expect(ownerLensDeniedUndo.status).toBe(404);
    expect(ownerLensDeniedUndo.body.error).toMatchObject({
      code: "event_completion_failed",
      category: "not_found"
    });

    const ownerLensDeniedProjected = await adminAgent.patch(`/events/projected-${ownerBRecurring.id}-2026-04-10/complete`);
    expect(ownerLensDeniedProjected.status).toBe(404);
    expect(ownerLensDeniedProjected.body.error).toMatchObject({
      code: "event_completion_failed",
      category: "not_found"
    });

    const deniedProjectedRows = await models.Event.findAll({
      where: {
        item_id: ownerBRecurring.id,
        due_date: "2026-04-10T00:00:00.000Z"
      }
    });
    expect(deniedProjectedRows).toHaveLength(0);
  });
});
