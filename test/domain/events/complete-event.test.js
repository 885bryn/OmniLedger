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
const { completeEvent } = require("../../../src/domain/events/complete-event");
const {
  EventCompletionError,
  EVENT_COMPLETION_ERROR_CATEGORIES
} = require("../../../src/domain/events/event-completion-errors");

describe("completeEvent domain service", () => {
  let counter = 0;

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

  it("throws forbidden category when actor does not own the parent item", async () => {
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
      category: EVENT_COMPLETION_ERROR_CATEGORIES.FORBIDDEN,
      issues: [
        expect.objectContaining({
          field: "event_id",
          code: "forbidden"
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
