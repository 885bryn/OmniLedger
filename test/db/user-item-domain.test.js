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
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("creates a user and an item", async () => {
    const user = await User.create({
      username: "Owner",
      email: "owner@example.com",
      password_hash: "hashed-password"
    });

    const item = await Item.create({
      user_id: user.id,
      item_type: "RealEstate",
      attributes: {
        address: "123 Main St",
        estimatedValue: 200000
      }
    });

    expect(item.id).toBeTruthy();
  });
});
