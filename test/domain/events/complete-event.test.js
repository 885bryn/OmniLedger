"use strict";

jest.mock("../../../src/db", () => {
  const { Sequelize } = require("sequelize");
  const { registerModels } = require("../../../src/db/models");
  const sequelize = new Sequelize("sqlite::memory:", { logging: false });
  const models = registerModels(sequelize);

  return {
    sequelize,
    models
  };
});

const { sequelize, models } = require("../../../src/db");
const { completeEvent, undoEventCompletion } = require("../../../src/domain/events/complete-event");
const {
  EventCompletionError,
  EVENT_COMPLETION_ERROR_CATEGORIES
} = require("../../../src/domain/events/event-completion-errors");

describe("completeEvent domain service", () => {
  let counter = 0;

  function toBusinessDate(value) {
    return new Date(value).toISOString().slice(0, 10);
  }

  async function createUser() {
    counter += 1;

    return models.User.create({
      username: `event-owner-${counter}`,
      email: `event-owner-${counter}@example.com`,
      password_hash: "hashed-pass-123"
    });
  }

  async function createItem({ userId }) {
    return models.Item.create({
      user_id: userId,
      item_type: "RealEstate",
      attributes: {
        address: "42 Ledger Way",
        estimatedValue: 350000
      }
    });
  }

  async function createCommitment({ userId, remainingBalance = 5000 }) {
    return models.Item.create({
      user_id: userId,
      item_type: "FinancialItem",
      title: "Mortgage - Test",
      type: "Commitment",
      frequency: "monthly",
      default_amount: 1000,
      status: "Active",
      attributes: {
        name: "Mortgage - Test",
        financialSubtype: "Commitment",
        amount: 1000,
        dueDate: "2026-04-01",
        dynamicTrackingEnabled: true,
        trackingStartingRemainingBalance: remainingBalance,
        remainingBalance
      }
    });
  }

  async function createEvent({ itemId, recurring = false, dueDate = "2026-04-01T00:00:00.000Z", amount = "1200.50" }) {
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

  it("completes a pending event once and returns canonical payload with completed_at and prompt metadata", async () => {
    const owner = await createUser();
    const item = await createItem({ userId: owner.id });
    const event = await createEvent({ itemId: item.id, recurring: false });
    const completionTime = new Date("2026-04-03T10:15:00.000Z");

    const result = await completeEvent({
      eventId: event.id,
      actorUserId: owner.id,
      now: completionTime
    });

    expect(Object.keys(result).sort()).toEqual([
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

    expect(result).toMatchObject({
      id: event.id,
      item_id: item.id,
      type: "MortgagePayment",
      status: "Completed",
      recurring: false,
      prompt_next_date: true
    });

    expect(new Date(result.completed_at).toISOString()).toBe(completionTime.toISOString());

    const persisted = await models.Event.findByPk(event.id);
    expect(persisted.status).toBe("Completed");
    expect(new Date(persisted.completed_at).toISOString()).toBe(completionTime.toISOString());

    const audits = await models.AuditLog.findAll({
      where: {
        action: "event.completed",
        entity: `event:${event.id}`
      }
    });

    expect(audits).toHaveLength(1);
    expect(audits[0].user_id).toBe(owner.id);
  });

  it("includes deterministic prompt metadata for both recurring and non-recurring events", async () => {
    const owner = await createUser();
    const item = await createItem({ userId: owner.id });
    const oneOffEvent = await createEvent({ itemId: item.id, recurring: false });
    const recurringEvent = await createEvent({
      itemId: item.id,
      recurring: true,
      dueDate: "2026-05-15T00:00:00.000Z"
    });

    const oneOffResult = await completeEvent({
      eventId: oneOffEvent.id,
      actorUserId: owner.id,
      now: new Date("2026-05-01T08:30:00.000Z")
    });
    const recurringResult = await completeEvent({
      eventId: recurringEvent.id,
      actorUserId: owner.id,
      now: new Date("2026-05-02T08:30:00.000Z")
    });

    expect(oneOffResult.prompt_next_date).toBe(true);
    expect(recurringResult.prompt_next_date).toBe(true);
    expect(oneOffResult.recurring).toBe(false);
    expect(recurringResult.recurring).toBe(true);
  });

  it("throws not_found category when event id does not exist", async () => {
    const owner = await createUser();

    await expect(
      completeEvent({
        eventId: "11111111-1111-4111-8111-111111111111",
        actorUserId: owner.id,
        now: new Date("2026-04-03T10:15:00.000Z")
      })
    ).rejects.toMatchObject({
      category: EVENT_COMPLETION_ERROR_CATEGORIES.NOT_FOUND,
      issues: [
        expect.objectContaining({
          field: "event_id",
          code: "not_found"
        })
      ]
    });
  });

  it("hides forbidden ownership mismatches behind not_found responses", async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const item = await createItem({ userId: owner.id });
    const event = await createEvent({ itemId: item.id });

    await expect(
      completeEvent({
        eventId: event.id,
        actorUserId: outsider.id,
        now: new Date("2026-04-03T10:15:00.000Z")
      })
    ).rejects.toMatchObject({
      category: EVENT_COMPLETION_ERROR_CATEGORIES.NOT_FOUND,
      issues: [
        expect.objectContaining({
          field: "event_id",
          code: "not_found"
        })
      ]
    });
  });

  it("is idempotent for re-complete requests and writes audit at most once", async () => {
    const owner = await createUser();
    const item = await createItem({ userId: owner.id });
    const event = await createEvent({ itemId: item.id });
    const firstCompletionTime = new Date("2026-06-01T11:00:00.000Z");

    const firstResult = await completeEvent({
      eventId: event.id,
      actorUserId: owner.id,
      now: firstCompletionTime
    });

    const secondResult = await completeEvent({
      eventId: event.id,
      actorUserId: owner.id,
      now: new Date("2026-06-02T11:00:00.000Z")
    });

    expect(firstResult.status).toBe("Completed");
    expect(secondResult.status).toBe("Completed");
    expect(new Date(secondResult.completed_at).toISOString()).toBe(firstCompletionTime.toISOString());

    const audits = await models.AuditLog.findAll({
      where: {
        action: "event.completed",
        entity: `event:${event.id}`
      }
    });
    expect(audits).toHaveLength(1);
  });

  it("persists provided reconciliation actuals without mutating projected amount or due_date", async () => {
    const owner = await createUser();
    const commitment = await createCommitment({ userId: owner.id, remainingBalance: 8000 });
    const dueDate = "2026-06-10T00:00:00.000Z";
    const projectedAmount = "1200.50";
    const event = await createEvent({ itemId: commitment.id, dueDate, amount: projectedAmount });

    const result = await completeEvent({
      eventId: event.id,
      actorUserId: owner.id,
      now: new Date("2026-06-11T14:25:00.000Z"),
      actual_amount: "1275.25",
      actual_date: "2026-06-09"
    });

    expect(result.amount).toBe(projectedAmount);
    expect(new Date(result.due_date).toISOString()).toBe(dueDate);
    expect(result.actual_amount).toBe("1275.25");
    expect(toBusinessDate(result.actual_date)).toBe("2026-06-09");

    const persisted = await models.Event.findByPk(event.id);
    expect(persisted.amount).toBe(projectedAmount);
    expect(new Date(persisted.due_date).toISOString()).toBe(dueDate);
    expect(persisted.actual_amount).toBe("1275.25");
    expect(toBusinessDate(persisted.actual_date)).toBe("2026-06-09");
  });

  it("defaults actuals to projected amount and completion business date when omitted", async () => {
    const owner = await createUser();
    const commitment = await createCommitment({ userId: owner.id, remainingBalance: 4000 });
    const event = await createEvent({ itemId: commitment.id, amount: "900.00" });
    const completionTime = new Date("2026-07-02T21:15:00.000Z");

    const result = await completeEvent({
      eventId: event.id,
      actorUserId: owner.id,
      now: completionTime
    });

    expect(result.actual_amount).toBe("900.00");
    expect(toBusinessDate(result.actual_date)).toBe("2026-07-02");

    const persisted = await models.Event.findByPk(event.id);
    expect(persisted.actual_amount).toBe("900.00");
    expect(toBusinessDate(persisted.actual_date)).toBe("2026-07-02");

    const secondResult = await completeEvent({
      eventId: event.id,
      actorUserId: owner.id,
      now: new Date("2026-07-03T10:00:00.000Z"),
      actual_amount: "999.99",
      actual_date: "2026-07-03"
    });

    expect(secondResult.actual_amount).toBe("900.00");
    expect(toBusinessDate(secondResult.actual_date)).toBe("2026-07-02");
  });

  it("materializes projected ids and preserves scope-safe audit attribution tuple", async () => {
    const owner = await createUser();
    const admin = await createUser();
    const commitment = await createCommitment({ userId: owner.id, remainingBalance: 1500 });
    const dueDate = "2026-08-01";

    const result = await completeEvent({
      eventId: `projected-${commitment.id}-${dueDate}`,
      actorUserId: admin.id,
      scope: {
        actorRole: "admin",
        actorUserId: admin.id,
        mode: "owner",
        lensUserId: owner.id
      },
      now: new Date("2026-08-02T12:00:00.000Z")
    });

    const materializedEvent = await models.Event.findByPk(result.id);
    expect(materializedEvent).toBeTruthy();
    expect(materializedEvent.item_id).toBe(commitment.id);
    expect(materializedEvent.actual_amount).toBe(materializedEvent.amount);
    expect(toBusinessDate(materializedEvent.actual_date)).toBe("2026-08-02");
    expect(new Date(materializedEvent.completed_at).toISOString()).toBe("2026-08-02T12:00:00.000Z");

    const completionAudit = await models.AuditLog.findOne({
      where: {
        action: "event.completed",
        entity: `event:${materializedEvent.id}`
      }
    });

    expect(completionAudit).toBeTruthy();
    expect(completionAudit.actor_user_id).toBe(admin.id);
    expect(completionAudit.lens_user_id).toBe(owner.id);
  });

  it("reduces commitment remaining balance when payment event is completed", async () => {
    const owner = await createUser();
    const commitment = await createCommitment({ userId: owner.id, remainingBalance: 5000 });
    const event = await createEvent({ itemId: commitment.id, amount: "1200.50" });

    await completeEvent({
      eventId: event.id,
      actorUserId: owner.id,
      now: new Date("2026-06-03T10:00:00.000Z")
    });

    const updatedCommitment = await models.Item.findByPk(commitment.id);
    expect(updatedCommitment.attributes.remainingBalance).toBe(3799.5);
    expect(updatedCommitment.attributes.lastPaymentAmount).toBe(1200.5);
    expect(updatedCommitment.attributes.lastPaymentDate).toBe("2026-06-03");
  });

  it("does not update rollups when dynamic tracking is disabled", async () => {
    const owner = await createUser();
    const commitment = await models.Item.create({
      user_id: owner.id,
      item_type: "FinancialItem",
      title: "Legacy disabled tracking",
      type: "Commitment",
      frequency: "monthly",
      default_amount: 45,
      status: "Active",
      attributes: {
        amount: 45,
        dueDate: "2026-06-01",
        financialSubtype: "Commitment",
        dynamicTrackingEnabled: false,
        remainingBalance: 200
      }
    });

    const event = await createEvent({ itemId: commitment.id, amount: "40.00" });

    const result = await completeEvent({
      eventId: event.id,
      actorUserId: owner.id,
      now: new Date("2026-06-04T10:00:00.000Z")
    });

    expect(result.status).toBe("Completed");
    expect(result.prompt_next_date).toBe(true);

    const unchanged = await models.Item.findByPk(commitment.id);
    expect(unchanged.attributes.remainingBalance).toBe(200);
    expect(unchanged.attributes.lastPaymentAmount).toBeUndefined();
  });

  it("undoes completion, restores pending status, and reverses totals", async () => {
    const owner = await createUser();
    const commitment = await createCommitment({ userId: owner.id, remainingBalance: 900 });
    const event = await createEvent({ itemId: commitment.id, amount: "100.00" });

    await completeEvent({
      eventId: event.id,
      actorUserId: owner.id,
      now: new Date("2026-06-05T10:00:00.000Z")
    });

    const undone = await undoEventCompletion({
      eventId: event.id,
      actorUserId: owner.id,
      now: new Date("2026-06-05T11:00:00.000Z")
    });

    expect(undone.status).toBe("Pending");
    expect(undone.completed_at).toBeNull();
    expect(undone.prompt_next_date).toBe(false);

    const updatedEvent = await models.Event.findByPk(event.id);
    expect(updatedEvent.status).toBe("Pending");

    const updatedItem = await models.Item.findByPk(commitment.id);
    expect(updatedItem.attributes.remainingBalance).toBe(900);

    const undoAudits = await models.AuditLog.findAll({
      where: {
        action: "event.reopened",
        entity: `event:${event.id}`
      }
    });
    expect(undoAudits).toHaveLength(1);
  });

  it("emits EventCompletionError for guarded domain failures", async () => {
    const owner = await createUser();

    await expect(
      completeEvent({
        eventId: "11111111-1111-4111-8111-111111111111",
        actorUserId: owner.id,
        now: new Date("2026-04-03T10:15:00.000Z")
      })
    ).rejects.toBeInstanceOf(EventCompletionError);
  });
});
