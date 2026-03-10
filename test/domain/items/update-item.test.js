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
    await models.Event.destroy({ where: {}, force: true });
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
      category: ITEM_QUERY_ERROR_CATEGORIES.NOT_FOUND
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

  it("does not rewrite recurring FinancialItem pending event rows during contract edits", async () => {
    const owner = await createUser();
    const item = await models.Item.create({
      user_id: owner.id,
      item_type: "FinancialItem",
      title: "Rent",
      type: "Income",
      frequency: "monthly",
      default_amount: 1200,
      status: "Active",
      attributes: {
        financialSubtype: "Income",
        name: "Rent",
        amount: 1200,
        dueDate: "2026-03-01"
      }
    });

    await models.Event.create({
      item_id: item.id,
      event_type: "Rent",
      due_date: "2026-03-01",
      amount: 1200,
      status: "Pending",
      is_recurring: false
    });

    await updateItem({
      itemId: item.id,
      actorUserId: owner.id,
      attributes: {
        amount: 1578,
        dueDate: "2026-03-15",
        name: "Rent collection"
      }
    });

    const pendingEvents = await models.Event.findAll({ where: { item_id: item.id, status: "Pending" } });
    expect(pendingEvents).toHaveLength(1);
    expect(pendingEvents[0].event_type).toBe("Rent");
    expect(Number(pendingEvents[0].amount)).toBe(1200);
    expect(new Date(pendingEvents[0].due_date).toISOString().slice(0, 10)).toBe("2026-03-01");
  });

  it("allows changing FinancialItem subtype and mirrors financialSubtype attribute", async () => {
    const owner = await createUser();
    const item = await models.Item.create({
      user_id: owner.id,
      item_type: "FinancialItem",
      title: "Utility bill",
      type: "Commitment",
      frequency: "monthly",
      default_amount: 125,
      status: "Active",
      attributes: {
        dueDate: "2026-04-01",
        financialSubtype: "Commitment",
        amount: 125
      }
    });

    const result = await updateItem({
      itemId: item.id,
      actorUserId: owner.id,
      type: "Income",
      attributes: { amount: 125 }
    });

    expect(result.attributes.financialSubtype).toBe("Income");

    const refreshed = await models.Item.findByPk(item.id);
    expect(refreshed.type).toBe("Income");
    expect(refreshed.attributes.financialSubtype).toBe("Income");
  });

  it("rejects invalid financial subtype updates", async () => {
    const owner = await createUser();
    const item = await models.Item.create({
      user_id: owner.id,
      item_type: "FinancialItem",
      title: "Utility bill",
      type: "Commitment",
      frequency: "monthly",
      default_amount: 125,
      status: "Active",
      attributes: {
        dueDate: "2026-04-01",
        financialSubtype: "Commitment",
        amount: 125
      }
    });

    await expect(
      updateItem({
        itemId: item.id,
        actorUserId: owner.id,
        type: "SomethingElse",
        attributes: { amount: 125 }
      })
    ).rejects.toMatchObject({
      category: ITEM_QUERY_ERROR_CATEGORIES.INVALID_REQUEST
    });
  });

  it("rejects subtype updates for non-FinancialItem records", async () => {
    const owner = await createUser();
    const item = await models.Item.create({
      user_id: owner.id,
      item_type: "Vehicle",
      attributes: { vin: "VIN-22", estimatedValue: 11000 }
    });

    await expect(
      updateItem({
        itemId: item.id,
        actorUserId: owner.id,
        type: "Income",
        attributes: { estimatedValue: 12000 }
      })
    ).rejects.toMatchObject({
      category: ITEM_QUERY_ERROR_CATEGORIES.INVALID_REQUEST
    });
  });

  it("allows changing FinancialItem frequency and mirrors billingCycle attribute", async () => {
    const owner = await createUser();
    const item = await models.Item.create({
      user_id: owner.id,
      item_type: "FinancialItem",
      title: "Gym membership",
      type: "Commitment",
      frequency: "monthly",
      default_amount: 75,
      status: "Active",
      attributes: {
        dueDate: "2026-04-01",
        billingCycle: "monthly",
        amount: 75
      }
    });

    const result = await updateItem({
      itemId: item.id,
      actorUserId: owner.id,
      frequency: "yearly",
      attributes: { amount: 75 }
    });

    expect(result.attributes.billingCycle).toBe("yearly");

    const refreshed = await models.Item.findByPk(item.id);
    expect(refreshed.frequency).toBe("yearly");
    expect(refreshed.attributes.billingCycle).toBe("yearly");
  });

  it("rejects frequency updates for non-FinancialItem records", async () => {
    const owner = await createUser();
    const item = await models.Item.create({
      user_id: owner.id,
      item_type: "Vehicle",
      attributes: { vin: "VIN-31", estimatedValue: 14000 }
    });

    await expect(
      updateItem({
        itemId: item.id,
        actorUserId: owner.id,
        frequency: "monthly",
        attributes: { estimatedValue: 15000 }
      })
    ).rejects.toMatchObject({
      category: ITEM_QUERY_ERROR_CATEGORIES.INVALID_REQUEST
    });
  });
});
