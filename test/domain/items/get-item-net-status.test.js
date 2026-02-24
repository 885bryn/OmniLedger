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
const { getItemNetStatus } = require("../../../src/domain/items/get-item-net-status");
const { ItemNetStatusError, ITEM_NET_STATUS_ERROR_CATEGORIES } = require("../../../src/domain/items/item-net-status-errors");

describe("getItemNetStatus domain service", () => {
  let counter = 0;

  async function createUser() {
    counter += 1;

    return models.User.create({
      username: `owner-${counter}`,
      email: `owner-${counter}@example.com`,
      password_hash: "hashed-pass-123"
    });
  }

  async function createItem({ userId, itemType, parentItemId = null, attributes }) {
    return models.Item.create({
      user_id: userId,
      item_type: itemType,
      parent_item_id: parentItemId,
      attributes
    });
  }

  async function setItemTimestamps(itemId, isoDate) {
    await models.Item.update(
      {
        created_at: isoDate,
        updated_at: isoDate
      },
      {
        where: { id: itemId },
        silent: true
      }
    );
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

  it("returns canonical root payload with deterministic child ordering and summary exclusions", async () => {
    const owner = await createUser();
    const root = await createItem({
      userId: owner.id,
      itemType: "RealEstate",
      attributes: {
        address: "14 Oak Lane",
        estimatedValue: 420000
      }
    });

    const dueSoon = await createItem({
      userId: owner.id,
      itemType: "FinancialCommitment",
      parentItemId: root.id,
      attributes: {
        amount: 200,
        dueDate: "2026-03-01"
      }
    });

    const dueTieOlder = await createItem({
      userId: owner.id,
      itemType: "FinancialCommitment",
      parentItemId: root.id,
      attributes: {
        amount: 300,
        dueDate: "2026-04-01"
      }
    });

    const dueTieNewer = await createItem({
      userId: owner.id,
      itemType: "FinancialCommitment",
      parentItemId: root.id,
      attributes: {
        amount: 125,
        dueDate: "2026-04-01"
      }
    });

    const invalidAmountDue = await createItem({
      userId: owner.id,
      itemType: "FinancialCommitment",
      parentItemId: root.id,
      attributes: {
        amount: "abc",
        dueDate: "2026-05-01"
      }
    });

    const nullDueOlder = await createItem({
      userId: owner.id,
      itemType: "Subscription",
      parentItemId: root.id,
      attributes: {
        amount: 50,
        billingCycle: "monthly"
      }
    });

    const nullDueNewerInvalid = await createItem({
      userId: owner.id,
      itemType: "Subscription",
      parentItemId: root.id,
      attributes: {
        amount: "n/a",
        billingCycle: "monthly"
      }
    });

    await createItem({
      userId: owner.id,
      itemType: "Vehicle",
      parentItemId: root.id,
      attributes: {
        vin: "VIN-XYZ",
        estimatedValue: 18000
      }
    });

    await setItemTimestamps(dueTieOlder.id, "2026-01-10T00:00:00.000Z");
    await setItemTimestamps(dueTieNewer.id, "2026-01-12T00:00:00.000Z");
    await setItemTimestamps(nullDueOlder.id, "2026-01-01T00:00:00.000Z");
    await setItemTimestamps(nullDueNewerInvalid.id, "2026-01-15T00:00:00.000Z");

    const result = await getItemNetStatus({
      itemId: root.id,
      actorUserId: owner.id
    });

    expect(Object.keys(result).sort()).toEqual([
      "attributes",
      "child_commitments",
      "created_at",
      "id",
      "item_type",
      "parent_item_id",
      "summary",
      "updated_at",
      "user_id"
    ]);

    expect(result.child_commitments.map((child) => child.id)).toEqual([
      dueSoon.id,
      dueTieOlder.id,
      dueTieNewer.id,
      invalidAmountDue.id,
      nullDueOlder.id,
      nullDueNewerInvalid.id
    ]);

    result.child_commitments.forEach((child) => {
      expect(Object.keys(child).sort()).toEqual([
        "attributes",
        "created_at",
        "id",
        "item_type",
        "parent_item_id",
        "updated_at",
        "user_id"
      ]);
    });

    expect(result.summary).toEqual({
      monthly_obligation_total: 675,
      excluded_row_count: 2
    });
  });

  it("throws not_found category when root item id does not exist", async () => {
    const owner = await createUser();

    await expect(
      getItemNetStatus({
        itemId: "11111111-1111-4111-8111-111111111111",
        actorUserId: owner.id
      })
    ).rejects.toMatchObject({
      category: ITEM_NET_STATUS_ERROR_CATEGORIES.NOT_FOUND,
      issues: [
        expect.objectContaining({
          field: "item_id",
          code: "not_found"
        })
      ]
    });
  });

  it("throws forbidden category when actor does not own root item", async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const root = await createItem({
      userId: owner.id,
      itemType: "Vehicle",
      attributes: {
        vin: "VIN-OWNER",
        estimatedValue: 12000
      }
    });

    await expect(
      getItemNetStatus({
        itemId: root.id,
        actorUserId: outsider.id
      })
    ).rejects.toMatchObject({
      category: ITEM_NET_STATUS_ERROR_CATEGORIES.FORBIDDEN,
      issues: [
        expect.objectContaining({
          field: "item_id",
          code: "forbidden"
        })
      ]
    });
  });

  it("throws wrong_root_type category when requested root is a commitment", async () => {
    const owner = await createUser();
    const rootAsset = await createItem({
      userId: owner.id,
      itemType: "RealEstate",
      attributes: {
        address: "1 Root Rd",
        estimatedValue: 300000
      }
    });

    const commitment = await createItem({
      userId: owner.id,
      itemType: "FinancialCommitment",
      parentItemId: rootAsset.id,
      attributes: {
        amount: 900,
        dueDate: "2026-04-02"
      }
    });

    await expect(
      getItemNetStatus({
        itemId: commitment.id,
        actorUserId: owner.id
      })
    ).rejects.toMatchObject({
      category: ITEM_NET_STATUS_ERROR_CATEGORIES.WRONG_ROOT_TYPE,
      issues: [
        expect.objectContaining({
          field: "item_type",
          code: "wrong_root_type"
        })
      ]
    });
  });

  it("emits ItemNetStatusError for guarded domain failures", async () => {
    const owner = await createUser();

    await expect(
      getItemNetStatus({
        itemId: "11111111-1111-4111-8111-111111111111",
        actorUserId: owner.id
      })
    ).rejects.toBeInstanceOf(ItemNetStatusError);
  });
});
