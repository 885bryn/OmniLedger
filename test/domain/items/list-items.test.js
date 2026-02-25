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
const { listItems } = require("../../../src/domain/items/list-items");
const { ItemQueryError } = require("../../../src/domain/items/item-query-errors");

describe("listItems domain service", () => {
  let counter = 0;

  async function createUser() {
    counter += 1;
    return models.User.create({
      username: `list-user-${counter}`,
      email: `list-user-${counter}@example.com`,
      password_hash: "hashed-pass-123"
    });
  }

  beforeAll(async () => {
    await sequelize.query("PRAGMA foreign_keys = ON");
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await sequelize.query("PRAGMA foreign_keys = OFF");
    await models.Item.destroy({ where: {}, force: true });
    await models.User.destroy({ where: {}, force: true });
    await sequelize.query("PRAGMA foreign_keys = ON");
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("returns recently-updated default ordering with deleted rows hidden", async () => {
    const owner = await createUser();
    const oldItem = await models.Item.create({
      user_id: owner.id,
      item_type: "Vehicle",
      attributes: { vin: "VIN-1", estimatedValue: 12000 }
    });
    const recentItem = await models.Item.create({
      user_id: owner.id,
      item_type: "RealEstate",
      attributes: { address: "11 Test Ave", estimatedValue: 500000 }
    });
    const deletedItem = await models.Item.create({
      user_id: owner.id,
      item_type: "Subscription",
      attributes: { amount: 50, billingCycle: "monthly", _deleted_at: "2026-01-01T00:00:00.000Z" }
    });

    await models.Item.update({ updated_at: "2026-01-01T00:00:00.000Z" }, { where: { id: oldItem.id }, silent: true });
    await models.Item.update({ updated_at: "2026-02-01T00:00:00.000Z" }, { where: { id: recentItem.id }, silent: true });
    await models.Item.update({ updated_at: "2026-03-01T00:00:00.000Z" }, { where: { id: deletedItem.id }, silent: true });

    const result = await listItems({ actorUserId: owner.id });
    expect(result.items.map((item) => item.id)).toEqual([recentItem.id, oldItem.id]);
    expect(result.total_count).toBe(2);
  });

  it("throws ItemQueryError for unsupported sort values", async () => {
    const owner = await createUser();

    await expect(
      listItems({
        actorUserId: owner.id,
        sort: "banana"
      })
    ).rejects.toBeInstanceOf(ItemQueryError);
  });

  it("supports debounced-search-compatible filtering and due_soon sorting", async () => {
    const owner = await createUser();
    const rootAsset = await models.Item.create({
      user_id: owner.id,
      item_type: "RealEstate",
      attributes: {
        address: "200 Parent Ln",
        estimatedValue: 700000
      }
    });

    const lateDue = await models.Item.create({
      user_id: owner.id,
      item_type: "FinancialCommitment",
      parent_item_id: rootAsset.id,
      attributes: {
        amount: 220,
        dueDate: "2026-06-15"
      }
    });
    const soonDue = await models.Item.create({
      user_id: owner.id,
      item_type: "FinancialCommitment",
      parent_item_id: rootAsset.id,
      attributes: {
        amount: 120,
        dueDate: "2026-04-10"
      }
    });
    await models.Item.create({
      user_id: owner.id,
      item_type: "Subscription",
      attributes: {
        amount: 50,
        billingCycle: "monthly"
      }
    });

    const result = await listItems({
      actorUserId: owner.id,
      filter: "commitments",
      search: "commitment",
      sort: "due_soon"
    });

    expect(result.items.map((item) => item.id)).toEqual([soonDue.id, lateDue.id]);
  });
});
