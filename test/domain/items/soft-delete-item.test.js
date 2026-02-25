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
const { softDeleteItem } = require("../../../src/domain/items/soft-delete-item");
const { listItems } = require("../../../src/domain/items/list-items");

describe("softDeleteItem domain service", () => {
  let counter = 0;

  async function createUser() {
    counter += 1;
    return models.User.create({
      username: `delete-user-${counter}`,
      email: `delete-user-${counter}@example.com`,
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

  it("marks item as deleted and is idempotent", async () => {
    const owner = await createUser();
    const item = await models.Item.create({
      user_id: owner.id,
      item_type: "RealEstate",
      attributes: { address: "10 Delete Way", estimatedValue: 250000 }
    });

    const first = await softDeleteItem({ itemId: item.id, actorUserId: owner.id, now: new Date("2026-01-02T00:00:00.000Z") });
    const second = await softDeleteItem({ itemId: item.id, actorUserId: owner.id, now: new Date("2026-01-03T00:00:00.000Z") });

    expect(first.is_deleted).toBe(true);
    expect(second.deleted_at).toBe(first.deleted_at);

    const logs = await models.AuditLog.findAll({ where: { entity: `item:${item.id}`, action: "item.deleted" } });
    expect(logs).toHaveLength(1);

    const activeOnly = await listItems({ actorUserId: owner.id });
    const deletedOnly = await listItems({ actorUserId: owner.id, includeDeleted: true, filter: "deleted" });
    expect(activeOnly.total_count).toBe(0);
    expect(deletedOnly.items[0].id).toBe(item.id);
  });
});
