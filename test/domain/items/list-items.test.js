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
      item_type: "FinancialItem",
      title: "Archived commitment",
      type: "Commitment",
      frequency: "monthly",
      default_amount: 50,
      status: "Active",
      attributes: { amount: 50, dueDate: "2026-08-01", financialSubtype: "Commitment", _deleted_at: "2026-01-01T00:00:00.000Z" }
    });

    await models.Item.update({ updatedAt: "2026-01-01T00:00:00.000Z" }, { where: { id: oldItem.id }, silent: true });
    await models.Item.update({ updatedAt: "2026-02-01T00:00:00.000Z" }, { where: { id: recentItem.id }, silent: true });
    await models.Item.update({ updatedAt: "2026-03-01T00:00:00.000Z" }, { where: { id: deletedItem.id }, silent: true });

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

  it("supports commitment/income filtering plus due and amount sorts", async () => {
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
      item_type: "FinancialItem",
      title: "Late commitment",
      type: "Commitment",
      frequency: "monthly",
      default_amount: 220,
      status: "Active",
      parent_item_id: rootAsset.id,
      attributes: {
        financialSubtype: "Commitment",
        amount: 220,
        dueDate: "2026-06-15"
      }
    });
    const soonDue = await models.Item.create({
      user_id: owner.id,
      item_type: "FinancialItem",
      title: "Soon commitment",
      type: "Commitment",
      frequency: "monthly",
      default_amount: 120,
      status: "Active",
      parent_item_id: rootAsset.id,
      attributes: {
        financialSubtype: "Commitment",
        amount: 120,
        dueDate: "2026-04-10"
      }
    });
    const income = await models.Item.create({
      user_id: owner.id,
      item_type: "FinancialItem",
      title: "Rent A",
      type: "Income",
      frequency: "monthly",
      default_amount: 1000,
      status: "Active",
      parent_item_id: rootAsset.id,
      attributes: {
        financialSubtype: "Income",
        name: "Rent A",
        amount: 1000,
        collectedTotal: 1200,
        dueDate: "2026-04-01"
      }
    });
    const oneTimeCommitment = await models.Item.create({
      user_id: owner.id,
      item_type: "FinancialItem",
      title: "One-time fee",
      type: "Commitment",
      frequency: "one_time",
      default_amount: 350,
      status: "Active",
      parent_item_id: rootAsset.id,
      attributes: {
        financialSubtype: "Commitment",
        name: "One-time fee",
        amount: 350,
        dueDate: "2026-07-01"
      }
    });
    const recurringFinancialCommitment = await models.Item.create({
      user_id: owner.id,
      item_type: "FinancialItem",
      title: "HOA recurring",
      type: "Commitment",
      frequency: "monthly",
      default_amount: 610,
      status: "Active",
      linked_asset_item_id: rootAsset.id,
      attributes: {
        financialSubtype: "Commitment",
        dueDate: "2026-08-05"
      }
    });
    const recurringFinancialIncome = await models.Item.create({
      user_id: owner.id,
      item_type: "FinancialItem",
      title: "Parking income",
      type: "Income",
      frequency: "monthly",
      default_amount: 1400,
      status: "Active",
      linked_asset_item_id: rootAsset.id,
      attributes: {
        financialSubtype: "Income",
        dueDate: "2026-04-02"
      }
    });
    const loanLowInstallmentHighBalance = await models.Item.create({
      user_id: owner.id,
      item_type: "FinancialItem",
      title: "Loan A",
      type: "Commitment",
      frequency: "monthly",
      default_amount: 50,
      status: "Active",
      parent_item_id: rootAsset.id,
      attributes: {
        financialSubtype: "Commitment",
        name: "Loan A",
        amount: 50,
        remainingBalance: 5000,
        dueDate: "2026-05-01"
      }
    });
    await models.Item.create({
      user_id: owner.id,
      item_type: "FinancialItem",
      title: "Unlinked commitment",
      type: "Commitment",
      frequency: "monthly",
      default_amount: 50,
      status: "Active",
      attributes: {
        financialSubtype: "Commitment",
        amount: 50,
        dueDate: "2026-09-01"
      }
    });

    const result = await listItems({
      actorUserId: owner.id,
      filter: "commitments",
      search: "commitment",
      sort: "due_soon"
    });

    expect(result.items[0].id).toBe(soonDue.id);

    const incomeFiltered = await listItems({
      actorUserId: owner.id,
      filter: "income",
      sort: "alphabetical"
    });
    expect(incomeFiltered.items.map((item) => item.id)).toEqual([recurringFinancialIncome.id, income.id]);

    const amountSorted = await listItems({
      actorUserId: owner.id,
      filter: "commitments",
      sort: "amount_high_to_low"
    });
    expect(amountSorted.items.map((item) => item.id).slice(0, 4)).toEqual([
      loanLowInstallmentHighBalance.id,
      recurringFinancialCommitment.id,
      oneTimeCommitment.id,
      lateDue.id
    ]);

    const incomeAmountSorted = await listItems({
      actorUserId: owner.id,
      filter: "income",
      sort: "amount_high_to_low"
    });
    expect(incomeAmountSorted.items.map((item) => item.id).slice(0, 2)).toEqual([
      recurringFinancialIncome.id,
      income.id
    ]);

    const recurringContract = amountSorted.items.find((item) => item.id === recurringFinancialCommitment.id);
    expect(Object.keys(recurringContract).sort()).toEqual([
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
    expect(Number(recurringContract.default_amount)).toBe(610);
  });
});
