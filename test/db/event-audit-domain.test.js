"use strict";

const { Sequelize } = require("sequelize");
const { User } = require("../../src/db/models/user.model");
const { Item } = require("../../src/db/models/item.model");
const { Event } = require("../../src/db/models/event.model");
const { AuditLog } = require("../../src/db/models/audit-log.model");

describe("event-audit domain models", () => {
  let sequelize;

  async function createUserAndItem() {
    const user = await User.create({
      username: "owner",
      email: "owner@example.com",
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
});
