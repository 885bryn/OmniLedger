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
const { listEvents } = require("../../../src/domain/events/list-events");
const { EVENT_QUERY_ERROR_CATEGORIES } = require("../../../src/domain/events/event-query-errors");

describe("listEvents domain service", () => {
  let counter = 0;

  async function createUser() {
    counter += 1;
    return models.User.create({
      username: `events-user-${counter}`,
      email: `events-user-${counter}@example.com`,
      password_hash: "hashed-pass-123"
    });
  }

  beforeAll(async () => {
    await sequelize.query("PRAGMA foreign_keys = ON");
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await sequelize.query("PRAGMA foreign_keys = OFF");
    await models.Event.destroy({ where: {}, force: true });
    await models.Item.destroy({ where: {}, force: true });
    await models.User.destroy({ where: {}, force: true });
    await sequelize.query("PRAGMA foreign_keys = ON");
  });

  afterAll(async () => {
    await sequelize.close();
  });

  async function setEventTimestamps(eventId, isoDate) {
    await models.Event.update(
      {
        createdAt: isoDate,
        updatedAt: isoDate
      },
      {
        where: { id: eventId },
        silent: true
      }
    );
  }

  it("returns grouped nearest-due events for actor-owned items", async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const ownerItem = await models.Item.create({
      user_id: owner.id,
      item_type: "RealEstate",
      attributes: { address: "123 Ledger Street", estimatedValue: 400000 }
    });
    const outsiderItem = await models.Item.create({
      user_id: outsider.id,
      item_type: "Vehicle",
      attributes: { vin: "VIN-OUT", estimatedValue: 9000 }
    });

    await models.Event.create({
      item_id: ownerItem.id,
      event_type: "MortgagePayment",
      due_date: "2026-03-15T00:00:00.000Z",
      amount: "1200.00",
      status: "Pending",
      is_recurring: true
    });
    const propertyTax = await models.Event.create({
      item_id: ownerItem.id,
      event_type: "PropertyTax",
      due_date: "2026-03-20T00:00:00.000Z",
      amount: "400.00",
      status: "Pending",
      is_recurring: false
    });
    const tieA = await models.Event.create({
      item_id: ownerItem.id,
      event_type: "WaterBill",
      due_date: "2026-03-20T00:00:00.000Z",
      amount: "70.00",
      status: "Pending",
      is_recurring: false
    });
    const tieB = await models.Event.create({
      item_id: ownerItem.id,
      event_type: "ElectricityBill",
      due_date: "2026-03-20T00:00:00.000Z",
      amount: "90.00",
      status: "Pending",
      is_recurring: false
    });

    await setEventTimestamps(propertyTax.id, "2026-03-05T00:00:00.000Z");
    await setEventTimestamps(tieA.id, "2026-03-06T00:00:00.000Z");
    await setEventTimestamps(tieB.id, "2026-03-07T00:00:00.000Z");
    await models.Event.create({
      item_id: outsiderItem.id,
      event_type: "Insurance",
      due_date: "2026-03-10T00:00:00.000Z",
      amount: "85.00",
      status: "Pending",
      is_recurring: true
    });

    const result = await listEvents({ actorUserId: owner.id });

    expect(result.total_count).toBe(4);
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].due_date).toBe("2026-03-15");
    const secondGroupIds = result.groups[1].events.map((event) => event.id);
    expect(secondGroupIds[2]).toBe(propertyTax.id);
    expect(secondGroupIds.slice(0, 2).sort()).toEqual([tieA.id, tieB.id].sort());

    const completedOnly = await listEvents({ actorUserId: owner.id, status: "completed" });
    expect(completedOnly.total_count).toBe(0);
  });

  it("rejects invalid due ranges", async () => {
    const owner = await createUser();

    await expect(
      listEvents({
        actorUserId: owner.id,
        dueFrom: "2026-04-01T00:00:00.000Z",
        dueTo: "2026-03-01T00:00:00.000Z"
      })
    ).rejects.toMatchObject({
      category: EVENT_QUERY_ERROR_CATEGORIES.INVALID_RANGE
    });
  });
});
