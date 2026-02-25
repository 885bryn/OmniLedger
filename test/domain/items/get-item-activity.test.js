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
const { getItemActivity } = require("../../../src/domain/items/get-item-activity");
const { ITEM_QUERY_ERROR_CATEGORIES } = require("../../../src/domain/items/item-query-errors");

describe("getItemActivity domain service", () => {
  let counter = 0;

  async function createUser() {
    counter += 1;
    return models.User.create({
      username: `activity-user-${counter}`,
      email: `activity-user-${counter}@example.com`,
      password_hash: "hashed-pass-123"
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

  it("returns item and related event activity ordered by latest timestamp", async () => {
    const owner = await createUser();
    const item = await models.Item.create({
      user_id: owner.id,
      item_type: "RealEstate",
      attributes: { address: "1 Activity Road", estimatedValue: 320000 }
    });
    const event = await models.Event.create({
      item_id: item.id,
      event_type: "MortgagePayment",
      due_date: "2026-04-01T00:00:00.000Z",
      amount: "1000.00",
      status: "Pending",
      is_recurring: false
    });

    await models.AuditLog.create({ user_id: owner.id, action: "item.updated", entity: `item:${item.id}`, timestamp: "2026-04-01T00:00:00.000Z" });
    await models.AuditLog.create({ user_id: owner.id, action: "event.completed", entity: `event:${event.id}`, timestamp: "2026-04-02T00:00:00.000Z" });

    const result = await getItemActivity({
      itemId: item.id,
      actorUserId: owner.id
    });

    expect(result.item_id).toBe(item.id);
    expect(result.activity).toHaveLength(2);
    expect(result.activity[0].action).toBe("event.completed");
    expect(Object.keys(result.activity[0]).sort()).toEqual([
      "action",
      "created_at",
      "entity",
      "id",
      "timestamp",
      "updated_at",
      "user_id"
    ]);

    const limited = await getItemActivity({
      itemId: item.id,
      actorUserId: owner.id,
      limit: 1
    });
    expect(limited.activity).toHaveLength(1);
  });

  it("guards ownership", async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const item = await models.Item.create({
      user_id: owner.id,
      item_type: "Vehicle",
      attributes: { vin: "VIN-ACT", estimatedValue: 18000 }
    });

    await expect(
      getItemActivity({
        itemId: item.id,
        actorUserId: outsider.id
      })
    ).rejects.toMatchObject({
      category: ITEM_QUERY_ERROR_CATEGORIES.FORBIDDEN
    });
  });
});
