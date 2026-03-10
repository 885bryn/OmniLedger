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
const { createItem } = require("../../../src/domain/items/create-item");
const { ItemCreateValidationError, ITEM_CREATE_ERROR_CATEGORIES } = require("../../../src/domain/items/item-create-errors");

describe("createItem domain service", () => {
  let counter = 0;

  async function createUser() {
    counter += 1;

    return models.User.create({
      username: `owner-${counter}`,
      email: `owner-${counter}@example.com`,
      password_hash: "hashed-pass-123"
    });
  }

  async function createParentRealEstate(userId) {
    const parent = await createItem({
      user_id: userId,
      item_type: "RealEstate",
      attributes: {
        address: "100 Main St"
      }
    });

    return parent.id;
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

  it("creates each item type with defaults applied and canonical fields only", async () => {
    const user = await createUser();
    const parentId = await createParentRealEstate(user.id);

    const realEstate = await createItem({
      user_id: user.id,
      item_type: "RealEstate",
      attributes: { address: "22 Oak St" }
    });

    const vehicle = await createItem({
      user_id: user.id,
      item_type: "Vehicle",
      attributes: { vin: "VIN-1234" }
    });

    const commitment = await createItem({
      user_id: user.id,
      item_type: "FinancialItem",
      title: "Mortgage",
      type: "Commitment",
      frequency: "monthly",
      default_amount: 425,
      status: "Active",
      linked_asset_item_id: parentId,
      attributes: { amount: 425, dueDate: "2026-08-01" }
    });

    const commitmentNoParent = await createItem({
      user_id: user.id,
      item_type: "FinancialItem",
      title: "Unlinked service",
      type: "Commitment",
      frequency: "monthly",
      default_amount: 29.99,
      status: "Active",
      confirm_unlinked_asset: true,
      attributes: { amount: 29.99, dueDate: "2026-08-01" }
    });

    expect(realEstate.attributes.estimatedValue).toBe(0);
    expect(vehicle.attributes.estimatedValue).toBe(0);
    expect(commitment.attributes.dueDate).toBe("2026-08-01");
    expect(commitmentNoParent.attributes.dueDate).toBe("2026-08-01");

    const expectedKeys = [
      "attributes",
      "created_at",
      "default_amount",
      "frequency",
      "id",
      "item_type",
      "linked_asset_item_id",
      "parent_item_id",
      "status",
      "title",
      "type",
      "updated_at",
      "user_id"
    ];

    expect(Object.keys(realEstate).sort()).toEqual(expectedKeys);
    expect(Object.keys(commitmentNoParent).sort()).toEqual(expectedKeys);
  });

  it("keeps client values when default keys overlap and allows extra attributes", async () => {
    const user = await createUser();

    const created = await createItem({
      user_id: user.id,
      item_type: "Vehicle",
      attributes: {
        vin: "VIN-888",
        estimatedValue: 15500,
        garageSpot: "B12"
      }
    });

    expect(created.attributes.estimatedValue).toBe(15500);
    expect(created.attributes.garageSpot).toBe("B12");
  });

  it("returns field-level validation issues for invalid type and missing minimum keys", async () => {
    const user = await createUser();

    await expect(
      createItem({
        user_id: user.id,
        item_type: "Boat",
        attributes: {}
      })
    ).rejects.toMatchObject({
      category: ITEM_CREATE_ERROR_CATEGORIES.INVALID_ITEM_TYPE,
      issues: [
        expect.objectContaining({
          field: "item_type",
          code: "invalid_item_type"
        })
      ]
    });

    await expect(
      createItem({
        user_id: user.id,
        item_type: "RealEstate",
        attributes: {
          address: null
        }
      })
    ).rejects.toMatchObject({
      category: ITEM_CREATE_ERROR_CATEGORIES.MISSING_MINIMUM_ATTRIBUTES,
      issues: [
        expect.objectContaining({
          field: "attributes",
          code: "missing_minimum_keys"
        })
      ]
    });
  });

  it("allows unlinked financial items with explicit confirmation but rejects nonexistent parent", async () => {
    const user = await createUser();

    await expect(
      createItem({
        user_id: user.id,
        item_type: "FinancialItem",
        title: "Utilities",
        type: "Commitment",
        frequency: "monthly",
        default_amount: 900,
        status: "Active",
        confirm_unlinked_asset: true,
        attributes: { amount: 900, dueDate: "2026-08-01" }
      })
    ).resolves.toMatchObject({
      user_id: user.id,
      item_type: "FinancialItem",
      parent_item_id: null
    });

    await expect(
      createItem({
        user_id: user.id,
        item_type: "FinancialItem",
        title: "Utilities",
        type: "Commitment",
        frequency: "monthly",
        default_amount: 900,
        status: "Active",
        parent_item_id: "11111111-1111-4111-8111-111111111111",
        confirm_unlinked_asset: true,
        attributes: { amount: 900, dueDate: "2026-08-01" }
      })
    ).rejects.toMatchObject({
      category: ITEM_CREATE_ERROR_CATEGORIES.PARENT_LINK_FAILURE,
      issues: [
        expect.objectContaining({
          field: "parent_item_id",
          code: "parent_not_found"
        })
      ]
    });
  });

  it("emits domain validation error type for item create validation problems", async () => {
    const user = await createUser();

    await expect(
      createItem({
        user_id: user.id,
        item_type: "RealEstate",
        attributes: {
          address: ""
        }
      })
    ).rejects.toBeInstanceOf(ItemCreateValidationError);
  });

  it("creates a pending event for cashflow items with due dates", async () => {
    const user = await createUser();

    const created = await createItem({
      user_id: user.id,
      item_type: "FinancialItem",
      title: "Rent collection",
      type: "Income",
      frequency: "one_time",
      default_amount: 1578,
      status: "Active",
      confirm_unlinked_asset: true,
      attributes: {
        name: "Rent collection",
        amount: 1578,
        dueDate: "2026-03-10"
      }
    });

    const events = await models.Event.findAll({ where: { item_id: created.id } });
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe("Rent collection");
    expect(Number(events[0].amount)).toBe(1578);
    expect(events[0].status).toBe("Pending");
  });
});
