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

  function toDateOnly(value) {
    return new Date(value).toISOString().slice(0, 10);
  }

  function getActiveMonthSampleDates(referenceDate = new Date()) {
    const year = referenceDate.getUTCFullYear();
    const month = referenceDate.getUTCMonth();
    const endOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    return {
      start: toDateOnly(Date.UTC(year, month, 1)),
      middle: toDateOnly(Date.UTC(year, month, Math.max(2, Math.min(15, endOfMonth - 1)))),
      end: toDateOnly(Date.UTC(year, month, endOfMonth))
    };
  }

  async function createUser() {
    counter += 1;

    return models.User.create({
      username: `owner-${counter}`,
      email: `owner-${counter}@example.com`,
      password_hash: "hashed-pass-123"
    });
  }

  async function createItem({ userId, itemType, parentItemId = null, attributes }) {
    const rawAttributes = attributes || {};

    if (itemType === "FinancialCommitment" || itemType === "FinancialIncome") {
      const subtype = itemType === "FinancialIncome" ? "Income" : "Commitment";
      const amountCandidate = Number(rawAttributes.nextPaymentAmount ?? rawAttributes.amount);
      const defaultAmount = Number.isFinite(amountCandidate) ? amountCandidate : null;

      return models.Item.create({
        user_id: userId,
        item_type: "FinancialItem",
        parent_item_id: parentItemId,
        linked_asset_item_id: parentItemId,
        title: rawAttributes.name || (subtype === "Income" ? "Income item" : "Commitment item"),
        type: subtype,
        frequency: "monthly",
        default_amount: defaultAmount,
        status: "Active",
        attributes: {
          ...rawAttributes,
          dueDate: rawAttributes.dueDate || "1970-01-01",
          financialSubtype: subtype
        }
      });
    }

    return models.Item.create({
      user_id: userId,
      item_type: itemType,
      parent_item_id: parentItemId,
      attributes: rawAttributes
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
    const dates = getActiveMonthSampleDates();
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
        dueDate: dates.start
      }
    });

    const dueTieOlder = await createItem({
      userId: owner.id,
      itemType: "FinancialCommitment",
      parentItemId: root.id,
      attributes: {
        amount: 300,
        dueDate: dates.middle
      }
    });

    const dueTieNewer = await createItem({
      userId: owner.id,
      itemType: "FinancialCommitment",
      parentItemId: root.id,
      attributes: {
        amount: 125,
        dueDate: dates.middle
      }
    });

    const invalidAmountDue = await createItem({
      userId: owner.id,
      itemType: "FinancialCommitment",
      parentItemId: root.id,
      attributes: {
        amount: "abc",
        dueDate: dates.end
      }
    });

    const oneTimeStringAmount = await createItem({
      userId: owner.id,
      itemType: "FinancialCommitment",
      parentItemId: root.id,
      attributes: {
        amount: "300",
        dueDate: dates.end
      }
    });

    const linkedRecurringCommitment = await models.Item.create({
      user_id: owner.id,
      item_type: "FinancialItem",
      title: "HOA",
      type: "Commitment",
      frequency: "monthly",
      default_amount: 88,
      status: "Active",
      linked_asset_item_id: root.id,
      attributes: {
        dueDate: dates.end
      }
    });

    const nullDueOlder = await createItem({
      userId: owner.id,
      itemType: "FinancialCommitment",
      parentItemId: root.id,
      attributes: {
        amount: 50,
        dueDate: dates.end
      }
    });

    const nullDueNewerInvalid = await createItem({
      userId: owner.id,
      itemType: "FinancialCommitment",
      parentItemId: root.id,
      attributes: {
        amount: "n/a",
        dueDate: dates.end
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
      "default_amount",
      "frequency",
      "id",
      "item_type",
      "linked_asset_item_id",
      "parent_item_id",
      "status",
      "summary",
      "title",
      "type",
      "updated_at",
      "user_id"
    ]);

    const childIds = result.child_commitments.map((child) => child.id);
    expect(childIds[0]).toBe(dueSoon.id);
    expect(childIds.slice(1, 3).sort()).toEqual([dueTieOlder.id, dueTieNewer.id].sort());
    expect(childIds[3]).toBe(invalidAmountDue.id);
    expect(childIds[4]).toBe(oneTimeStringAmount.id);
    expect(childIds[5]).toBe(linkedRecurringCommitment.id);
    expect(childIds[6]).toBe(nullDueOlder.id);
    expect(childIds[7]).toBe(nullDueNewerInvalid.id);

    result.child_commitments.forEach((child) => {
      expect(Object.keys(child).sort()).toEqual([
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
      ]);
    });

    expect(result.summary).toMatchObject({
      monthly_obligation_total: 1063,
      monthly_income_total: 0,
      net_monthly_cashflow: -1063,
      excluded_row_count: 2,
      active_period: {
        cadence: "monthly",
        boundary: "inclusive"
      }
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

  it("throws not_found category when actor does not own root item", async () => {
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
      category: ITEM_NET_STATUS_ERROR_CATEGORIES.NOT_FOUND,
      issues: [
        expect.objectContaining({
          field: "item_id",
          code: "not_found"
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

  it("excludes soft-deleted child commitments from the net-status payload", async () => {
    const dates = getActiveMonthSampleDates();
    const owner = await createUser();
    const root = await createItem({
      userId: owner.id,
      itemType: "RealEstate",
      attributes: {
        address: "1578 Rochester Ave",
        estimatedValue: 500000
      }
    });

    const activeChild = await createItem({
      userId: owner.id,
      itemType: "FinancialIncome",
      parentItemId: root.id,
      attributes: {
        name: "1578 rent",
        amount: 1578,
        dueDate: dates.middle
      }
    });

    await createItem({
      userId: owner.id,
      itemType: "FinancialIncome",
      parentItemId: root.id,
      attributes: {
        name: "old rent",
        amount: 1200,
        dueDate: dates.start,
        _deleted_at: "2026-02-24T00:00:00.000Z"
      }
    });

    const result = await getItemNetStatus({
      itemId: root.id,
      actorUserId: owner.id
    });

    expect(result.child_commitments).toHaveLength(1);
    expect(result.child_commitments[0].id).toBe(activeChild.id);
    expect(result.summary).toMatchObject({
      monthly_income_total: 1578,
      net_monthly_cashflow: 1578
    });
  });

  it("excludes child commitments owned by a different user", async () => {
    const dates = getActiveMonthSampleDates();
    const owner = await createUser();
    const outsider = await createUser();

    const root = await createItem({
      userId: owner.id,
      itemType: "Vehicle",
      attributes: {
        vin: "VIN-E300",
        estimatedValue: 50000
      }
    });

    const ownedChild = await createItem({
      userId: owner.id,
      itemType: "FinancialCommitment",
      parentItemId: root.id,
      attributes: {
        name: "e300 testing payment",
        amount: 300,
        dueDate: dates.middle
      }
    });

    await createItem({
      userId: outsider.id,
      itemType: "FinancialCommitment",
      parentItemId: root.id,
      attributes: {
        name: "foreign commitment",
        amount: 999,
        dueDate: dates.middle
      }
    });

    const result = await getItemNetStatus({
      itemId: root.id,
      actorUserId: owner.id
    });

    expect(result.child_commitments).toHaveLength(1);
    expect(result.child_commitments[0].id).toBe(ownedChild.id);
    expect(result.summary.monthly_obligation_total).toBe(300);
  });

  it("classifies FinancialItem income subtype in net-status summary totals", async () => {
    const owner = await createUser();
    const root = await createItem({
      userId: owner.id,
      itemType: "Vehicle",
      attributes: {
        vin: "VIN-INCOME",
        estimatedValue: 41000
      }
    });

    await createItem({
      userId: owner.id,
      itemType: "FinancialCommitment",
      parentItemId: root.id,
      attributes: {
        name: "Insurance",
        amount: 500,
        dueDate: "2026-03-03"
      }
    });

    await models.Item.create({
      user_id: owner.id,
      item_type: "FinancialItem",
      title: "Renting out SUV",
      type: "Income",
      frequency: "weekly",
      default_amount: 2000,
      status: "Active",
      linked_asset_item_id: root.id,
      attributes: {
        dueDate: "2026-03-04",
        financialSubtype: "Income",
        amount: 2000
      }
    });

    const result = await getItemNetStatus({
      itemId: root.id,
      actorUserId: owner.id
    });

    expect(result.summary).toMatchObject({
      monthly_obligation_total: 500,
      monthly_income_total: 2000,
      net_monthly_cashflow: 1500
    });
  });
});
