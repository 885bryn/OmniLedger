"use strict";

const { Sequelize } = require("sequelize");
const { User } = require("../../src/db/models/user.model");
const { Item } = require("../../src/db/models/item.model");
const { Event } = require("../../src/db/models/event.model");
const { AuditLog } = require("../../src/db/models/audit-log.model");

describe("event-audit domain models", () => {
  let sequelize;
  let counter = 0;

  async function createUserAndItem() {
    counter += 1;

    const user = await User.create({
      username: `owner-${counter}`,
      email: `owner-${counter}@example.com`,
      password_hash: "hashed-password"
    });

    const item = await Item.create({
      user_id: user.id,
      item_type: "RealEstate",
      attributes: { address: "123 Main St", estimatedValue: 250000 }
    });

    return { user, item };
  }

  beforeAll(async () => {
    sequelize = new Sequelize("sqlite::memory:", { logging: false });

    User.initModel(sequelize);
    Item.initModel(sequelize);
    Event.initModel(sequelize);
    AuditLog.initModel(sequelize);

    Item.associate({ User });
    Event.associate({ Item });
    AuditLog.associate({ User });

    await sequelize.query("PRAGMA foreign_keys = ON");
  });

  beforeEach(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("requires completed_at when event status is Completed", async () => {
    const { item } = await createUserAndItem();

    await expect(
      Event.create({
        item_id: item.id,
        event_type: "maintenance",
        due_date: "2026-03-01",
        amount: 125.5,
        status: "Completed",
        is_recurring: false
      })
    ).rejects.toThrow(/completed_at is required/i);
  });

  it("accepts canonical status values and explicit completed_at", async () => {
    const { item } = await createUserAndItem();

    const event = await Event.create({
      item_id: item.id,
      event_type: "payment",
      due_date: "2026-03-02",
      amount: 400,
      status: "Completed",
      is_recurring: true,
      completed_at: "2026-03-02T10:00:00.000Z"
    });

    expect(event.status).toBe("Completed");
  });

  it("persists event timeline fields with canonical Pending status", async () => {
    const { item } = await createUserAndItem();

    const event = await Event.create({
      item_id: item.id,
      event_type: "insurance.payment",
      due_date: "2026-04-15",
      amount: 220.35,
      status: "Pending",
      is_recurring: true
    });

    expect(event.event_type).toBe("insurance.payment");
    expect(event.status).toBe("Pending");
    expect(event.is_recurring).toBe(true);
    expect(Number(event.amount)).toBeCloseTo(220.35, 2);
    expect(event.completed_at).toBeUndefined();
  });

  it("rejects non-canonical event status values", async () => {
    const { item } = await createUserAndItem();

    await expect(
      Event.create({
        item_id: item.id,
        event_type: "payment",
        due_date: "2026-03-02",
        amount: 400,
        status: "Cancelled",
        is_recurring: false
      })
    ).rejects.toThrow();
  });

  it("rejects negative event amounts", async () => {
    const { item } = await createUserAndItem();

    await expect(
      Event.create({
        item_id: item.id,
        event_type: "maintenance",
        due_date: "2026-05-01",
        amount: -10,
        status: "Pending",
        is_recurring: false
      })
    ).rejects.toThrow(/cannot be negative/i);
  });

  it("enforces verb-style audit actions", async () => {
    const { user } = await createUserAndItem();

    await expect(
      AuditLog.create({
        user_id: user.id,
        action: "completed-event",
        entity: "Events",
        timestamp: "2026-03-02T10:00:00.000Z"
      })
    ).rejects.toThrow(/verb-style/i);
  });

  it("requires minimum audit metadata fields", async () => {
    const { user } = await createUserAndItem();

    await expect(
      AuditLog.create({
        user_id: user.id,
        action: "event.completed",
        entity: "Events"
      })
    ).rejects.toThrow();
  });

  it("persists valid audit metadata rows", async () => {
    const { user } = await createUserAndItem();

    const audit = await AuditLog.create({
      user_id: user.id,
      action: "event.completed",
      entity: "Events",
      timestamp: "2026-03-02T10:00:00.000Z"
    });

    expect(audit.user_id).toBe(user.id);
    expect(audit.action).toBe("event.completed");
    expect(audit.entity).toBe("Events");
    expect(audit.timestamp).toBeInstanceOf(Date);
  });
});
