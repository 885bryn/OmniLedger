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
const { updateItem } = require("../../../src/domain/items/update-item");
const { ITEM_QUERY_ERROR_CATEGORIES } = require("../../../src/domain/items/item-query-errors");

describe("updateItem domain service", () => {
  let counter = 0;

  async function createUser() {
    counter += 1;
    return models.User.create({
      username: `update-user-${counter}`,
      email: `update-user-${counter}@example.com`,
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
    await models.Item.destroy({ where: {}, force: true });
    await models.User.destroy({ where: {}, force: true });
    await sequelize.query("PRAGMA foreign_keys = ON");
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("updates attributes and records audit log", async () => {
    const owner = await createUser();
    const item = await models.Item.create({
      user_id: owner.id,
      item_type: "Vehicle",
      attributes: { vin: "VIN-22", estimatedValue: 11000 }
    });

    const result = await updateItem({
      itemId: item.id,
      actorUserId: owner.id,
      attributes: { estimatedValue: 21000 }
    });

    expect(result.attributes.estimatedValue).toBe(21000);

    const logs = await models.AuditLog.findAll({ where: { entity: `item:${item.id}`, action: "item.updated" } });
    expect(logs).toHaveLength(1);
  });

  it("guards ownership", async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const item = await models.Item.create({
      user_id: owner.id,
      item_type: "Vehicle",
      attributes: { vin: "VIN-99", estimatedValue: 9000 }
    });

    await expect(
      updateItem({
        itemId: item.id,
        actorUserId: outsider.id,
        attributes: { estimatedValue: 999 }
      })
    ).rejects.toMatchObject({
      category: ITEM_QUERY_ERROR_CATEGORIES.FORBIDDEN
    });
  });

  it("rejects updates for soft-deleted items", async () => {
    const owner = await createUser();
    const item = await models.Item.create({
      user_id: owner.id,
      item_type: "Vehicle",
      attributes: {
        vin: "VIN-DELETED",
        estimatedValue: 7500,
        _deleted_at: "2026-03-01T00:00:00.000Z"
      }
    });

    await expect(
      updateItem({
        itemId: item.id,
        actorUserId: owner.id,
        attributes: { estimatedValue: 8000 }
      })
    ).rejects.toMatchObject({
      category: ITEM_QUERY_ERROR_CATEGORIES.INVALID_STATE
    });
  });
});
