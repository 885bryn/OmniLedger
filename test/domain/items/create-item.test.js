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
      item_type: "FinancialCommitment",
      parent_item_id: parentId,
      attributes: { amount: 425 }
    });

    const subscription = await createItem({
      user_id: user.id,
      item_type: "Subscription",
      attributes: { amount: 29.99 }
    });

    expect(realEstate.attributes.estimatedValue).toBe(0);
    expect(vehicle.attributes.estimatedValue).toBe(0);
    expect(commitment.attributes.dueDate).toBe("1970-01-01");
    expect(subscription.attributes.billingCycle).toBe("monthly");

    const expectedKeys = [
      "attributes",
      "created_at",
      "id",
      "item_type",
      "parent_item_id",
      "updated_at",
      "user_id"
    ];

    expect(Object.keys(realEstate).sort()).toEqual(expectedKeys);
    expect(Object.keys(subscription).sort()).toEqual(expectedKeys);
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

  it("returns parent-link validation issues when commitment parent is missing or nonexistent", async () => {
    const user = await createUser();

    await expect(
      createItem({
        user_id: user.id,
        item_type: "FinancialCommitment",
        attributes: { amount: 900 }
      })
    ).rejects.toMatchObject({
      category: ITEM_CREATE_ERROR_CATEGORIES.PARENT_LINK_FAILURE,
      issues: [
        expect.objectContaining({
          field: "parent_item_id",
          code: "parent_required"
        })
      ]
    });

    await expect(
      createItem({
        user_id: user.id,
        item_type: "FinancialCommitment",
        parent_item_id: "11111111-1111-4111-8111-111111111111",
        attributes: { amount: 900 }
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
});
