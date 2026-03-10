"use strict";

const request = require("supertest");
const bcrypt = require("bcryptjs");

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

    const password = "StrongPass123!";
    const passwordHash = await bcrypt.hash(password, 12);

    const created = await models.User.create({
      username: `api-user-${counter}`,
      email: `api-user-${counter}@example.com`,
      password_hash: passwordHash
    });

    return {
      id: created.id,
      email: created.email,
      password
    };
  }

  async function signInAs(user) {
    const agent = request.agent(app);
    const loginResponse = await agent.post("/auth/login").send({
      email: user.email,
      password: user.password
    });

    expect(loginResponse.status).toBe(200);

    return agent;
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

  function buildFinancialItemPayload(overrides = {}) {
    return {
      item_type: "FinancialItem",
      title: "Mortgage",
      type: "Commitment",
      frequency: "one_time",
      default_amount: 1500,
      status: "Active",
      confirm_unlinked_asset: true,
      attributes: {
        dueDate: "2026-03-01"
      },
      ...overrides
    };
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
    const outsider = await createUser();
    const agent = await signInAs(user);

    const response = await agent
      .post("/items")
      .send({
        user_id: outsider.id,
        item_type: "RealEstate",
        attributes: {
          address: "22 Oak St"
        }
      });

    expect(response.status).toBe(201);
    expect(Object.keys(response.body).sort()).toEqual([
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
    expect(response.body.id).toEqual(expect.any(String));
    expect(response.body.created_at).toEqual(expect.any(String));
    expect(response.body.updated_at).toEqual(expect.any(String));
    expect(response.body.user_id).toBe(user.id);
    expect(response.body.user_id).not.toBe(outsider.id);
  });

  it("fills defaults by item type and preserves client-provided values", async () => {
    const user = await createUser();
    const agent = await signInAs(user);

    const response = await agent
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
    const agent = await signInAs(user);

    const response = await agent
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
    const agent = await signInAs(user);

    const response = await agent
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
    const outsider = await createUser();
    const agent = await signInAs(user);
    const foreignParentId = await createParentItem(outsider.id);

    const missingParentResponse = await agent
      .post("/items")
      .send({
        user_id: user.id,
        item_type: "FinancialItem",
        title: "Missing parent contract",
        type: "Commitment",
        frequency: "one_time",
        default_amount: 500,
        status: "Active",
        confirm_unlinked_asset: true,
        parent_item_id: "11111111-1111-4111-8111-111111111111",
        attributes: {
          amount: 500,
          dueDate: "2026-03-01"
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

    const foreignParentResponse = await agent
      .post("/items")
      .send({
        user_id: outsider.id,
        item_type: "FinancialItem",
        title: "Cross-owner loan",
        type: "Commitment",
        frequency: "one_time",
        default_amount: 300,
        status: "Active",
        confirm_unlinked_asset: true,
        parent_item_id: foreignParentId,
        attributes: {
          amount: 300,
          name: "Cross-owner loan",
          dueDate: "2026-03-01"
        }
      });

    expect(foreignParentResponse.status).toBe(422);
    expect(foreignParentResponse.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "parent_item_id",
          code: "parent_owner_mismatch",
          category: "parent_link_failure"
        })
      ])
    );

    const scopeOwnedWithoutUserId = await agent
      .post("/items")
      .send({
        item_type: "RealEstate",
        attributes: {
          address: "Scope Derived Address"
        }
      });

    expect(scopeOwnedWithoutUserId.status).toBe(201);
    expect(scopeOwnedWithoutUserId.body.user_id).toBe(user.id);

    const validParentId = await createParentItem(user.id);
    const validResponse = await agent
      .post("/items")
      .send({
        user_id: user.id,
        item_type: "FinancialItem",
        title: "Linked commitment",
        type: "Commitment",
        frequency: "one_time",
        default_amount: 700,
        status: "Active",
        confirm_unlinked_asset: true,
        parent_item_id: validParentId,
        attributes: {
          amount: 700,
          dueDate: "2026-03-01"
        }
      });

    expect(validResponse.status).toBe(201);
    expect(validResponse.body.parent_item_id).toBe(validParentId);
  });

  it("creates a pending event for newly created financial income items", async () => {
    const user = await createUser();
    const agent = await signInAs(user);

    const createResponse = await agent
      .post("/items")
      .send({
        user_id: user.id,
        item_type: "FinancialItem",
        title: "1578 rent",
        type: "Income",
        frequency: "one_time",
        default_amount: 1578,
        status: "Active",
        confirm_unlinked_asset: true,
        attributes: {
          name: "1578 rent",
          amount: 1578,
          dueDate: "2026-02-25"
        }
      });

    expect(createResponse.status).toBe(201);

    const eventsResponse = await agent
      .get("/events")
      .query({ status: "pending" });

    expect(eventsResponse.status).toBe(200);
    expect(eventsResponse.body.total_count).toBe(1);
    expect(eventsResponse.body.groups[0].events[0]).toMatchObject({
      item_id: createResponse.body.id,
      type: "1578 rent",
      status: "Pending"
    });
  });

  it("creates a pending event for newly created financial commitment items", async () => {
    const user = await createUser();
    const agent = await signInAs(user);
    const parentId = await createParentItem(user.id);

    const createResponse = await agent
      .post("/items")
      .send({
        user_id: user.id,
        item_type: "FinancialItem",
        title: "e300 testing payment",
        type: "Commitment",
        frequency: "one_time",
        default_amount: 300,
        status: "Active",
        confirm_unlinked_asset: true,
        parent_item_id: parentId,
        attributes: {
          name: "e300 testing payment",
          amount: 300,
          dueDate: "2026-02-26"
        }
      });

    expect(createResponse.status).toBe(201);

    const eventsResponse = await agent
      .get("/events")
      .query({ status: "pending" });

    expect(eventsResponse.status).toBe(200);
    expect(eventsResponse.body.total_count).toBeGreaterThanOrEqual(1);
    expect(eventsResponse.body.groups.flatMap((group) => group.events)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          item_id: createResponse.body.id,
          type: "e300 testing payment",
          status: "Pending"
        })
      ])
    );
  });

  it("requires FinancialItem contract fields and missing unlinked confirmation", async () => {
    const user = await createUser();
    const agent = await signInAs(user);

    const response = await agent
      .post("/items")
      .send({
        item_type: "FinancialItem",
        attributes: {
          dueDate: "2026-03-01"
        }
      });

    expect(response.status).toBe(422);
    expect(response.body.error.category).toBe("financial_contract_invalid");
    expect(response.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "title", code: "required" }),
        expect.objectContaining({ field: "type", code: "invalid_financial_subtype" }),
        expect.objectContaining({ field: "frequency", code: "invalid_financial_frequency" }),
        expect.objectContaining({ field: "default_amount", code: "invalid_default_amount" }),
        expect.objectContaining({ field: "status", code: "invalid_financial_status" }),
        expect.objectContaining({ field: "confirm_unlinked_asset", code: "linked_asset_confirmation_required" })
      ])
    );
  });

  it("creates one-time FinancialItem parent and first occurrence atomically", async () => {
    const user = await createUser();
    const agent = await signInAs(user);

    const response = await agent.post("/items").send(buildFinancialItemPayload());

    expect(response.status).toBe(201);
    expect(response.body.item_type).toBe("FinancialItem");
    expect(response.body.title).toBe("Mortgage");
    expect(response.body.type).toBe("Commitment");
    expect(response.body.frequency).toBe("one_time");
    expect(Number(response.body.default_amount)).toBe(1500);

    const createdItem = await models.Item.findByPk(response.body.id);
    const createdEvents = await models.Event.findAll({ where: { item_id: response.body.id } });

    expect(createdItem).not.toBeNull();
    expect(createdEvents).toHaveLength(1);
    expect(createdEvents[0].status).toBe("Pending");
    expect(createdEvents[0].event_type).toBe("Mortgage");
  });

  it("persists FinancialItem linked parent context with compatibility attributes", async () => {
    const user = await createUser();
    const agent = await signInAs(user);
    const parentId = await createParentItem(user.id);

    const response = await agent.post("/items").send(
      buildFinancialItemPayload({
        title: "Home electricity",
        type: "Commitment",
        frequency: "weekly",
        default_amount: 240,
        status: "Active",
        linked_asset_item_id: parentId,
        confirm_unlinked_asset: false,
        attributes: {
          dueDate: "2026-03-03"
        }
      })
    );

    expect(response.status).toBe(201);
    expect(response.body.linked_asset_item_id).toBe(parentId);
    expect(response.body.parent_item_id).toBe(parentId);
    expect(response.body.title).toBe("Home electricity");
    expect(Number(response.body.default_amount)).toBe(240);
    expect(response.body.attributes).toMatchObject({
      dueDate: "2026-03-03",
      name: "Home electricity",
      financialSubtype: "Commitment",
      billingCycle: "weekly",
      amount: 240,
      nextPaymentAmount: 240,
      linkedAssetItemId: parentId,
      parentItemId: parentId
    });
  });

  it("surfaces linked FinancialItem in commitments list and parent net-status", async () => {
    const user = await createUser();
    const agent = await signInAs(user);
    const parentId = await createParentItem(user.id);

    const created = await agent.post("/items").send(
      buildFinancialItemPayload({
        title: "Condo water",
        type: "Commitment",
        frequency: "weekly",
        default_amount: 125,
        status: "Active",
        linked_asset_item_id: parentId,
        confirm_unlinked_asset: false,
        attributes: {
          dueDate: "2026-03-03"
        }
      })
    );

    expect(created.status).toBe(201);

    const commitments = await agent.get("/items").query({ filter: "commitments", sort: "recently_updated" });
    expect(commitments.status).toBe(200);
    expect(commitments.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.body.id,
          item_type: "FinancialItem",
          title: "Condo water",
          linked_asset_item_id: parentId
        })
      ])
    );

    const parentNetStatus = await agent.get(`/items/${parentId}/net-status`);
    expect(parentNetStatus.status).toBe(200);
    expect(parentNetStatus.body.child_commitments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.body.id,
          item_type: "FinancialItem",
          linked_asset_item_id: parentId
        })
      ])
    );
  });

  it("rejects invalid linked asset reference and rolls back one-time create", async () => {
    const user = await createUser();
    const agent = await signInAs(user);
    const beforeCount = await models.Item.count({ where: { item_type: "FinancialItem", user_id: user.id } });

    const response = await agent
      .post("/items")
      .send(
        buildFinancialItemPayload({
          linked_asset_item_id: "11111111-1111-4111-8111-111111111111",
          confirm_unlinked_asset: false
        })
      );

    expect(response.status).toBe(422);
    expect(response.body.error.category).toBe("financial_contract_invalid");
    expect(response.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "linked_asset_item_id",
          code: "linked_asset_not_found"
        })
      ])
    );

    const afterCount = await models.Item.count({ where: { item_type: "FinancialItem", user_id: user.id } });
    expect(afterCount).toBe(beforeCount);
  });
});
