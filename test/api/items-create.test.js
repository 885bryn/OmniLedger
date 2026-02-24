"use strict";

const request = require("supertest");

jest.mock("../../src/db", () => {
  const { Sequelize } = require("sequelize");
  const { registerModels } = require("../../src/db/models");
  const sequelize = new Sequelize("sqlite::memory:", { logging: false });
  const models = registerModels(sequelize);

  return {
    sequelize,
    models
  };
});

const { sequelize, models } = require("../../src/db");
const { createApp } = require("../../src/api/app");

describe("POST /items", () => {
  const app = createApp();
  let counter = 0;

  async function createUser() {
    counter += 1;

    return models.User.create({
      username: `api-user-${counter}`,
      email: `api-user-${counter}@example.com`,
      password_hash: "hashed-password"
    });
  }

  async function createParentItem(userId) {
    const created = await models.Item.create({
      user_id: userId,
      item_type: "RealEstate",
      attributes: {
        address: "10 Parent Street",
        estimatedValue: 0
      },
      parent_item_id: null
    });

    return created.id;
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

  it("returns 201 with canonical persisted payload including id and timestamps", async () => {
    const user = await createUser();

    const response = await request(app)
      .post("/items")
      .send({
        user_id: user.id,
        item_type: "RealEstate",
        attributes: {
          address: "22 Oak St"
        }
      });

    expect(response.status).toBe(201);
    expect(Object.keys(response.body).sort()).toEqual([
      "attributes",
      "created_at",
      "id",
      "item_type",
      "parent_item_id",
      "updated_at",
      "user_id"
    ]);
    expect(response.body.id).toEqual(expect.any(String));
    expect(response.body.created_at).toEqual(expect.any(String));
    expect(response.body.updated_at).toEqual(expect.any(String));
  });

  it("fills defaults by item type and preserves client-provided values", async () => {
    const user = await createUser();

    const response = await request(app)
      .post("/items")
      .send({
        user_id: user.id,
        item_type: "Vehicle",
        attributes: {
          vin: "VIN-123",
          estimatedValue: 15500,
          customTag: "garage-b"
        }
      });

    expect(response.status).toBe(201);
    expect(response.body.attributes.vin).toBe("VIN-123");
    expect(response.body.attributes.estimatedValue).toBe(15500);
    expect(response.body.attributes.customTag).toBe("garage-b");
  });

  it("returns distinct validation category for invalid item type", async () => {
    const user = await createUser();

    const response = await request(app)
      .post("/items")
      .send({
        user_id: user.id,
        item_type: "Boat",
        attributes: {}
      });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("item_create_validation_failed");
    expect(response.body.error.category).toBe("invalid_item_type");
    expect(response.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "item_type",
          category: "invalid_item_type",
          code: "invalid_item_type"
        })
      ])
    );
  });

  it("returns distinct validation category for missing minimum attribute keys", async () => {
    const user = await createUser();

    const response = await request(app)
      .post("/items")
      .send({
        user_id: user.id,
        item_type: "RealEstate",
        attributes: {
          address: ""
        }
      });

    expect(response.status).toBe(422);
    expect(response.body.error.category).toBe("missing_minimum_attributes");
    expect(response.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "attributes",
          category: "missing_minimum_attributes",
          code: "missing_minimum_keys"
        })
      ])
    );
  });

  it("returns parent link issue and aggregates multiple validation issues in one response", async () => {
    const user = await createUser();
    const missingParentResponse = await request(app)
      .post("/items")
      .send({
        user_id: user.id,
        item_type: "FinancialCommitment",
        parent_item_id: "11111111-1111-4111-8111-111111111111",
        attributes: {
          amount: 500
        }
      });

    expect(missingParentResponse.status).toBe(422);
    expect(missingParentResponse.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "parent_item_id",
          category: "parent_link_failure",
          code: "parent_not_found"
        })
      ])
    );

    const multipleIssuesResponse = await request(app)
      .post("/items")
      .send({
        item_type: "FinancialCommitment",
        attributes: {
          amount: 200
        }
      });

    expect(multipleIssuesResponse.status).toBe(422);
    expect(multipleIssuesResponse.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "user_id", code: "required" }),
        expect.objectContaining({ field: "parent_item_id", code: "parent_required" })
      ])
    );
    expect(multipleIssuesResponse.body.error.issues.length).toBeGreaterThan(1);

    const validParentId = await createParentItem(user.id);
    const validResponse = await request(app)
      .post("/items")
      .send({
        user_id: user.id,
        item_type: "FinancialCommitment",
        parent_item_id: validParentId,
        attributes: {
          amount: 700
        }
      });

    expect(validResponse.status).toBe(201);
    expect(validResponse.body.parent_item_id).toBe(validParentId);
  });
});
