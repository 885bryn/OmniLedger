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
  const originalAdminEmail = process.env.HACT_ADMIN_EMAIL;

  async function createUser(overrides = {}) {
    counter += 1;

    const password = overrides.password || "StrongPass123!";
    const passwordHash = await bcrypt.hash(password, 12);

    const created = await models.User.create({
      username: overrides.username || `net-user-${counter}`,
      email: overrides.email || `net-user-${counter}@example.com`,
      password_hash: passwordHash,
      role: overrides.role
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
        frequency: rawAttributes.frequency || "monthly",
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

  function toDateOnly(value) {
    return new Date(value).toISOString().slice(0, 10);
  }

  function getActiveMonthSampleDates(referenceDate = new Date()) {
    const year = referenceDate.getUTCFullYear();
    const month = referenceDate.getUTCMonth();
    const endOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const middleOfMonth = Math.max(2, Math.min(15, endOfMonth - 1));

    return {
      start: toDateOnly(Date.UTC(year, month, 1)),
      middle: toDateOnly(Date.UTC(year, month, middleOfMonth)),
      end: toDateOnly(Date.UTC(year, month, endOfMonth)),
      prevMonthEnd: toDateOnly(Date.UTC(year, month, 0)),
      nextMonthStart: toDateOnly(Date.UTC(year, month + 1, 1))
    };
  }

  beforeAll(async () => {
    await sequelize.query("PRAGMA foreign_keys = ON");
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    process.env.HACT_ADMIN_EMAIL = "admin@example.com";
    await sequelize.query("PRAGMA foreign_keys = OFF");
    await models.Item.destroy({ where: {}, force: true });
    await models.User.destroy({ where: {}, force: true });
    await sequelize.query("PRAGMA foreign_keys = ON");
  });

  afterAll(async () => {
    if (typeof originalAdminEmail === "string") {
      process.env.HACT_ADMIN_EMAIL = originalAdminEmail;
    } else {
      delete process.env.HACT_ADMIN_EMAIL;
    }

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

    const linkedRecurringCommitment = await models.Item.create({
      user_id: owner.id,
      item_type: "FinancialItem",
      title: "HOA Contract",
      type: "Commitment",
      frequency: "monthly",
      default_amount: 88,
      status: "Active",
      linked_asset_item_id: root.id,
      attributes: {
        dueDate: "2026-04-20"
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

    const childCommitmentIds = response.body.child_commitments.map((child) => child.id);
    expect(childCommitmentIds[0]).toBe(dueSoon.id);
    expect(childCommitmentIds.slice(1, 3).sort()).toEqual([dueTieOlder.id, dueTieNewer.id].sort());
    expect(childCommitmentIds).toContain(nullDueInvalidAmount.id);
    expect(childCommitmentIds).toContain(linkedRecurringCommitment.id);

    response.body.child_commitments.forEach((child) => {
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
      expect(child).not.toHaveProperty("child_commitments");
      expect(child).not.toHaveProperty("events");
      expect(child).not.toHaveProperty("event_previews");
    });

    expect(response.body).not.toHaveProperty("events");
    expect(response.body).not.toHaveProperty("event_previews");
    expect(response.body.summary).toMatchObject({
      monthly_obligation_total: 1033,
      monthly_income_total: 0,
      net_monthly_cashflow: -1033,
      excluded_row_count: 1,
      active_period: {
        cadence: "monthly",
        boundary: "inclusive"
      },
      one_time_rule: {
        frequency: "one_time",
        inclusion: "due_date_inside_active_period",
        boundary: "inclusive"
      }
    });
    expect(response.body.summary.active_period.start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(response.body.summary.active_period.end_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(response.body.summary.active_period.reference_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(response.body.summary.one_time_rule.excludes).toEqual(
      expect.arrayContaining(["outside_active_period", "missing_or_invalid_due_date", "invalid_or_zero_amount"])
    );
  });

  it("includes one-time rows only when due date is inside the active month", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    const root = await createItem({
      userId: owner.id,
      itemType: "RealEstate",
      attributes: {
        address: "One-time active period root",
        estimatedValue: 500000
      }
    });
    const dates = getActiveMonthSampleDates();

    await createItem({
      userId: owner.id,
      itemType: "FinancialCommitment",
      parentItemId: root.id,
      attributes: {
        amount: 900,
        dueDate: dates.middle,
        frequency: "one_time"
      }
    });

    await createItem({
      userId: owner.id,
      itemType: "FinancialIncome",
      parentItemId: root.id,
      attributes: {
        amount: 1500,
        dueDate: dates.middle,
        frequency: "one_time"
      }
    });

    await createItem({
      userId: owner.id,
      itemType: "FinancialCommitment",
      parentItemId: root.id,
      attributes: {
        amount: 333,
        dueDate: dates.nextMonthStart,
        frequency: "one_time"
      }
    });

    await createItem({
      userId: owner.id,
      itemType: "FinancialIncome",
      parentItemId: root.id,
      attributes: {
        amount: 444,
        dueDate: dates.prevMonthEnd,
        frequency: "one_time"
      }
    });

    await createItem({
      userId: owner.id,
      itemType: "FinancialCommitment",
      parentItemId: root.id,
      attributes: {
        amount: 100,
        dueDate: dates.nextMonthStart,
        frequency: "monthly"
      }
    });

    const response = await ownerAgent.get(`/items/${root.id}/net-status`);

    expect(response.status).toBe(200);
    expect(response.body.summary).toMatchObject({
      monthly_obligation_total: 1000,
      monthly_income_total: 1500,
      net_monthly_cashflow: 500,
      excluded_row_count: 2
    });
  });

  it("excludes one-time obligations due in May from March summary while including in-period one-time rows", async () => {
    const marchReference = new Date("2026-03-18T12:00:00.000Z");
    jest.useFakeTimers();
    jest.setSystemTime(marchReference);

    try {
      const owner = await createUser();
      const ownerAgent = await signInAs(owner);
      const root = await createItem({
        userId: owner.id,
        itemType: "RealEstate",
        attributes: {
          address: "Cross-month regression root",
          estimatedValue: 525000
        }
      });

      await createItem({
        userId: owner.id,
        itemType: "FinancialCommitment",
        parentItemId: root.id,
        attributes: {
          amount: 450,
          dueDate: "2026-03-12",
          frequency: "one_time"
        }
      });

      await createItem({
        userId: owner.id,
        itemType: "FinancialCommitment",
        parentItemId: root.id,
        attributes: {
          amount: 700,
          dueDate: "2026-05-03",
          frequency: "one_time"
        }
      });

      await createItem({
        userId: owner.id,
        itemType: "FinancialIncome",
        parentItemId: root.id,
        attributes: {
          amount: 1000,
          dueDate: "2026-03-22",
          frequency: "monthly"
        }
      });

      const response = await ownerAgent.get(`/items/${root.id}/net-status`);

      expect(response.status).toBe(200);
      expect(response.body.summary).toMatchObject({
        monthly_obligation_total: 450,
        monthly_income_total: 1000,
        net_monthly_cashflow: 550,
        excluded_row_count: 1,
        active_period: {
          start_date: "2026-03-01",
          end_date: "2026-03-31",
          reference_date: "2026-03-18",
          cadence: "monthly",
          boundary: "inclusive"
        }
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it("treats active period boundaries as inclusive for one-time rows", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    const root = await createItem({
      userId: owner.id,
      itemType: "Vehicle",
      attributes: {
        vin: "VIN-ONE-TIME-BOUNDARY",
        estimatedValue: 42000
      }
    });
    const dates = getActiveMonthSampleDates();

    await createItem({
      userId: owner.id,
      itemType: "FinancialCommitment",
      parentItemId: root.id,
      attributes: {
        amount: 200,
        dueDate: dates.start,
        frequency: "one_time"
      }
    });

    await createItem({
      userId: owner.id,
      itemType: "FinancialIncome",
      parentItemId: root.id,
      attributes: {
        amount: 500,
        dueDate: dates.end,
        frequency: "one_time"
      }
    });

    const response = await ownerAgent.get(`/items/${root.id}/net-status`);

    expect(response.status).toBe(200);
    expect(response.body.summary).toMatchObject({
      monthly_obligation_total: 200,
      monthly_income_total: 500,
      net_monthly_cashflow: 300,
      excluded_row_count: 0
    });
    expect(response.body.summary.active_period.start_date).toBe(dates.start);
    expect(response.body.summary.active_period.end_date).toBe(dates.end);
  });

  it("excludes malformed, null, and zero amounts so net totals stay stable", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    const root = await createItem({
      userId: owner.id,
      itemType: "RealEstate",
      attributes: {
        address: "Guardrails root",
        estimatedValue: 350000
      }
    });
    const dates = getActiveMonthSampleDates();

    await createItem({
      userId: owner.id,
      itemType: "FinancialCommitment",
      parentItemId: root.id,
      attributes: {
        amount: 600,
        dueDate: dates.middle,
        frequency: "one_time"
      }
    });

    await createItem({
      userId: owner.id,
      itemType: "FinancialIncome",
      parentItemId: root.id,
      attributes: {
        amount: 1000,
        dueDate: dates.middle,
        frequency: "monthly"
      }
    });

    await createItem({
      userId: owner.id,
      itemType: "FinancialCommitment",
      parentItemId: root.id,
      attributes: {
        amount: "n/a",
        dueDate: dates.middle,
        frequency: "one_time"
      }
    });

    await createItem({
      userId: owner.id,
      itemType: "FinancialIncome",
      parentItemId: root.id,
      attributes: {
        amount: null,
        dueDate: dates.middle,
        frequency: "one_time"
      }
    });

    await createItem({
      userId: owner.id,
      itemType: "FinancialIncome",
      parentItemId: root.id,
      attributes: {
        amount: 0,
        dueDate: dates.middle,
        frequency: "one_time"
      }
    });

    await createItem({
      userId: owner.id,
      itemType: "FinancialCommitment",
      parentItemId: root.id,
      attributes: {
        amount: 0,
        dueDate: dates.middle,
        frequency: "monthly"
      }
    });

    const response = await ownerAgent.get(`/items/${root.id}/net-status`);

    expect(response.status).toBe(200);
    expect(response.body.summary).toMatchObject({
      monthly_obligation_total: 600,
      monthly_income_total: 1000,
      net_monthly_cashflow: 400,
      excluded_row_count: 4
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

  it("returns 404 not_found envelope when root item belongs to a different user", async () => {
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

    expect(response.status).toBe(404);
    expect(response.status).not.toBe(403);
    expect(response.body.error).toMatchObject({
      code: "item_net_status_failed",
      category: "not_found",
      message: "You can only access your own records."
    });
    expect(response.body.error.category).not.toBe("forbidden");
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

  it("includes legacy FinancialItem children linked via compatibility attributes", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    const root = await createItem({
      userId: owner.id,
      itemType: "RealEstate",
      attributes: {
        address: "Legacy Link Root",
        estimatedValue: 310000
      }
    });

    const legacyLinkedFinancialItem = await models.Item.create({
      user_id: owner.id,
      item_type: "FinancialItem",
      title: "Legacy water",
      type: "Commitment",
      frequency: "weekly",
      default_amount: 95,
      status: "Active",
      linked_asset_item_id: null,
      parent_item_id: null,
      attributes: {
        dueDate: "2026-03-03",
        financialSubtype: "Commitment",
        parentItemId: root.id,
        linkedAssetItemId: root.id,
        amount: 95,
        nextPaymentAmount: 95
      }
    });

    const response = await ownerAgent.get(`/items/${root.id}/net-status`);

    expect(response.status).toBe(200);
    expect(response.body.child_commitments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: legacyLinkedFinancialItem.id,
          item_type: "FinancialItem",
          title: "Legacy water"
        })
      ])
    );
    expect(response.body.summary.monthly_obligation_total).toBe(95);
  });

  it("counts FinancialItem income subtype as income in summary totals", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    const root = await createItem({
      userId: owner.id,
      itemType: "Vehicle",
      attributes: {
        vin: "VIN-SUV-INCOME",
        estimatedValue: 50000
      }
    });

    await createItem({
      userId: owner.id,
      itemType: "FinancialCommitment",
      parentItemId: root.id,
      attributes: {
        amount: 1200,
        dueDate: "2026-03-01"
      }
    });

    await models.Item.create({
      user_id: owner.id,
      item_type: "FinancialItem",
      title: "Renting out SUV",
      type: "Income",
      frequency: "weekly",
      default_amount: 3333333478,
      status: "Active",
      linked_asset_item_id: root.id,
      attributes: {
        dueDate: "2026-03-02",
        financialSubtype: "Income",
        amount: 3333333478
      }
    });

    const response = await ownerAgent.get(`/items/${root.id}/net-status`);

    expect(response.status).toBe(200);
    expect(response.body.summary).toMatchObject({
      monthly_obligation_total: 1200,
      monthly_income_total: 3333333478,
      net_monthly_cashflow: 3333332278
    });
  });

  it("supports admin all-mode drill-through and preserves owner-lens not_found denials", async () => {
    const admin = await createUser({ email: "admin@example.com" });
    const ownerA = await createUser({ email: "net-owner-a@example.com" });
    const ownerB = await createUser({ email: "net-owner-b@example.com" });
    const adminAgent = await signInAs(admin);

    const ownerARoot = await createItem({
      userId: ownerA.id,
      itemType: "RealEstate",
      attributes: { address: "Owner A Root", estimatedValue: 300000 }
    });
    const ownerBRoot = await createItem({
      userId: ownerB.id,
      itemType: "RealEstate",
      attributes: { address: "Owner B Root", estimatedValue: 340000 }
    });

    await createItem({
      userId: ownerA.id,
      itemType: "FinancialCommitment",
      parentItemId: ownerARoot.id,
      attributes: { amount: 275, dueDate: "2026-03-04" }
    });
    const ownerBCommitment = await createItem({
      userId: ownerB.id,
      itemType: "FinancialCommitment",
      parentItemId: ownerBRoot.id,
      attributes: { amount: 325, dueDate: "2026-03-05" }
    });

    const allModeRead = await adminAgent.get(`/items/${ownerBRoot.id}/net-status`);
    expect(allModeRead.status).toBe(200);
    expect(allModeRead.body.user_id).toBe(ownerB.id);
    expect(allModeRead.body.child_commitments.map((item) => item.id)).toContain(ownerBCommitment.id);

    const setLens = await adminAgent.patch("/auth/admin-scope").send({
      mode: "owner",
      lens_user_id: ownerA.id
    });
    expect(setLens.status).toBe(200);

    const ownerLensAllowed = await adminAgent.get(`/items/${ownerARoot.id}/net-status`);
    expect(ownerLensAllowed.status).toBe(200);
    expect(ownerLensAllowed.body.user_id).toBe(ownerA.id);

    const ownerLensDenied = await adminAgent.get(`/items/${ownerBRoot.id}/net-status`);
    expect(ownerLensDenied.status).toBe(404);
    expect(ownerLensDenied.body.error).toMatchObject({
      code: "item_net_status_failed",
      category: "not_found"
    });
    expect(ownerLensDenied.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "item_id",
          code: "not_found",
          category: "not_found"
        })
      ])
    );
  });
});
