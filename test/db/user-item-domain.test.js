"use strict";

const { Sequelize } = require("sequelize");
const { User } = require("../../src/db/models/user.model");
const { Item } = require("../../src/db/models/item.model");

describe("user-item domain models", () => {
  let sequelize;

  beforeAll(async () => {
    sequelize = new Sequelize("sqlite::memory:", { logging: false });
    User.initModel(sequelize);
    Item.initModel(sequelize);
    Item.associate({ User });
    await sequelize.query("PRAGMA foreign_keys = ON");
  });

  beforeEach(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("stores user account with UUID identity and password hash", async () => {
    const user = await User.create({
      username: "Owner",
      email: "owner@example.com",
      password_hash: "hashed-password"
    });

    expect(user.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(user.password_hash).toBe("hashed-password");
  });

  it("rejects case-insensitive duplicate username and email", async () => {
    await User.create({
      username: "Owner",
      email: "owner@example.com",
      password_hash: "hashed-password"
    });

    await expect(
      User.create({
        username: "owner",
        email: "OWNER@EXAMPLE.COM",
        password_hash: "another-hash"
      })
    ).rejects.toThrow();
  });

  it("rejects item insert for unknown item type", async () => {
    const user = await User.create({
      username: "owner2",
      email: "owner2@example.com",
      password_hash: "hashed-password"
    });

    await expect(
      Item.create({
        user_id: user.id,
        item_type: "Boat",
        attributes: { address: "123 Main St", estimatedValue: 200000 }
      })
    ).rejects.toThrow();
  });

  it("enforces minimum required attribute keys per item type", async () => {
    const user = await User.create({
      username: "owner3",
      email: "owner3@example.com",
      password_hash: "hashed-password"
    });

    await expect(
      Item.create({
        user_id: user.id,
        item_type: "RealEstate",
        attributes: {
          estimatedValue: 200000
        }
      })
    ).rejects.toThrow(/minimum keys/i);
  });

  it("requires parent item for FinancialCommitment", async () => {
    const user = await User.create({
      username: "owner4",
      email: "owner4@example.com",
      password_hash: "hashed-password"
    });

    await expect(
      Item.create({
        user_id: user.id,
        item_type: "FinancialCommitment",
        attributes: { amount: 1200, dueDate: "2026-03-01" }
      })
    ).rejects.toThrow(/requires parent_item_id/i);
  });

  it("rejects FinancialCommitment with nonexistent parent id", async () => {
    const user = await User.create({
      username: "owner5",
      email: "owner5@example.com",
      password_hash: "hashed-password"
    });

    await expect(
      Item.create({
        user_id: user.id,
        item_type: "FinancialCommitment",
        parent_item_id: "11111111-1111-4111-8111-111111111111",
        attributes: { amount: 1200, dueDate: "2026-03-01" }
      })
    ).rejects.toThrow();
  });

  it("blocks parent deletion while linked commitments exist", async () => {
    const user = await User.create({
      username: "owner6",
      email: "owner6@example.com",
      password_hash: "hashed-password"
    });

    const parent = await Item.create({
      user_id: user.id,
      item_type: "RealEstate",
      attributes: {
        address: "123 Main St",
        estimatedValue: 200000
      }
    });

    await Item.create({
      user_id: user.id,
      item_type: "FinancialCommitment",
      parent_item_id: parent.id,
      attributes: {
        amount: 1800,
        dueDate: "2026-03-01"
      }
    });

    await expect(parent.destroy()).rejects.toThrow();
  });
});
