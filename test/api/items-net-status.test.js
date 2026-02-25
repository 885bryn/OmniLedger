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

describe("GET /items/:id/net-status", () => {
  const app = createApp();
  let counter = 0;

  async function createUser() {
    counter += 1;

    const password = "StrongPass123!";
    const passwordHash = await bcrypt.hash(password, 12);

    const created = await models.User.create({
      username: `net-user-${counter}`,
      email: `net-user-${counter}@example.com`,
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

  it("returns canonical root and deterministic child commitments with summary", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    const root = await createItem({
      userId: owner.id,
      itemType: "RealEstate",
      attributes: {
        address: "22 Oak Street",
        estimatedValue: 450000
      }
    });

    const dueSoon = await createItem({
      userId: owner.id,
      itemType: "FinancialCommitment",
      parentItemId: root.id,
      attributes: {
        amount: 220,
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

    const nullDueInvalidAmount = await createItem({
      userId: owner.id,
      itemType: "FinancialCommitment",
      parentItemId: root.id,
      attributes: {
        amount: "n/a",
        dueDate: "2026-05-01"
      }
    });

    await createItem({
      userId: owner.id,
      itemType: "FinancialCommitment",
      parentItemId: root.id,
      attributes: {
        amount: "300",
        dueDate: "2026-04-15"
      }
    });

    await createItem({
      userId: owner.id,
      itemType: "Vehicle",
      parentItemId: root.id,
      attributes: {
        vin: "VIN-CHILD-ASSET",
        estimatedValue: 12000
      }
    });

    await setItemTimestamps(dueTieOlder.id, "2026-01-10T00:00:00.000Z");
    await setItemTimestamps(dueTieNewer.id, "2026-01-12T00:00:00.000Z");
    await setItemTimestamps(nullDueInvalidAmount.id, "2026-01-15T00:00:00.000Z");

    const response = await ownerAgent.get(`/items/${root.id}/net-status`);

    expect(response.status).toBe(200);
    expect(Object.keys(response.body).sort()).toEqual([
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

    const childCommitmentIds = response.body.child_commitments.map((child) => child.id);
    expect(childCommitmentIds[0]).toBe(dueSoon.id);
    expect(childCommitmentIds.slice(1, 3).sort()).toEqual([dueTieOlder.id, dueTieNewer.id].sort());
    expect(childCommitmentIds).toContain(nullDueInvalidAmount.id);

    response.body.child_commitments.forEach((child) => {
      expect(Object.keys(child).sort()).toEqual([
        "attributes",
        "created_at",
        "id",
        "item_type",
        "parent_item_id",
        "updated_at",
        "user_id"
      ]);
      expect(child).not.toHaveProperty("child_commitments");
      expect(child).not.toHaveProperty("events");
      expect(child).not.toHaveProperty("event_previews");
    });

    expect(response.body).not.toHaveProperty("events");
    expect(response.body).not.toHaveProperty("event_previews");
    expect(response.body.summary).toEqual({
      monthly_obligation_total: 945,
      monthly_income_total: 0,
      net_monthly_cashflow: -945,
      excluded_row_count: 1
    });
  });

  it("returns 404 issue envelope for unknown item id", async () => {
    const actor = await createUser();
    const actorAgent = await signInAs(actor);

    const response = await actorAgent.get("/items/11111111-1111-4111-8111-111111111111/net-status");

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({
      code: "item_net_status_failed",
      category: "not_found"
    });
    expect(response.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "item_id",
          code: "not_found",
          category: "not_found"
        })
      ])
    );
  });

  it("returns 403 issue envelope when root item belongs to a different user", async () => {
    const owner = await createUser();
    const actor = await createUser();
    const actorAgent = await signInAs(actor);
    const root = await createItem({
      userId: owner.id,
      itemType: "Vehicle",
      attributes: {
        vin: "VIN-OWNER-403",
        estimatedValue: 10000
      }
    });

    const response = await actorAgent.get(`/items/${root.id}/net-status`);

    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({
      code: "item_net_status_failed",
      category: "forbidden"
    });
    expect(response.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "item_id",
          code: "forbidden",
          category: "forbidden"
        })
      ])
    );
  });

  it("returns 422 issue envelope when requested root item is a commitment", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    const asset = await createItem({
      userId: owner.id,
      itemType: "RealEstate",
      attributes: {
        address: "Commitment Root Test",
        estimatedValue: 200000
      }
    });

    const commitment = await createItem({
      userId: owner.id,
      itemType: "FinancialCommitment",
      parentItemId: asset.id,
      attributes: {
        amount: 800,
        dueDate: "2026-04-02"
      }
    });

    const response = await ownerAgent.get(`/items/${commitment.id}/net-status`);

    expect(response.status).toBe(422);
    expect(response.body.error).toMatchObject({
      code: "item_net_status_failed",
      category: "wrong_root_type"
    });
    expect(response.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "item_type",
          code: "wrong_root_type",
          category: "wrong_root_type"
        })
      ])
    );
  });
});
