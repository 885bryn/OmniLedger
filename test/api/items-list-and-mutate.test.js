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

describe("items list and mutate contracts", () => {
  const app = createApp();
  let userCount = 0;
  const originalAdminEmail = process.env.HACT_ADMIN_EMAIL;

  async function createUser(overrides = {}) {
    userCount += 1;
    const password = overrides.password || "StrongPass123!";
    const passwordHash = await bcrypt.hash(password, 12);

    const created = await models.User.create({
      username: overrides.username || `items-user-${userCount}`,
      email: overrides.email || `items-user-${userCount}@example.com`,
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

  async function createItem(userId, attributes = {}) {
    return models.Item.create({
      user_id: userId,
      item_type: "RealEstate",
      attributes: {
        address: "20 Test Avenue",
        estimatedValue: 300000,
        ...attributes
      }
    });
  }

  async function createCommitment(userId, parentItemId, amount, dueDate) {
    return models.Item.create({
      user_id: userId,
      item_type: "FinancialItem",
      parent_item_id: parentItemId,
      linked_asset_item_id: parentItemId,
      title: `Commitment ${amount}`,
      type: "Commitment",
      frequency: "monthly",
      default_amount: amount,
      status: "Active",
      attributes: {
        name: `Commitment ${amount}`,
        amount,
        dueDate,
        financialSubtype: "Commitment"
      }
    });
  }

  async function createIncome(userId, parentItemId, amount, collectedTotal, dueDate) {
    return models.Item.create({
      user_id: userId,
      item_type: "FinancialItem",
      parent_item_id: parentItemId,
      linked_asset_item_id: parentItemId,
      title: `Income ${amount}`,
      type: "Income",
      frequency: "monthly",
      default_amount: amount,
      status: "Active",
      attributes: {
        name: `Income ${amount}`,
        amount,
        collectedTotal,
        dueDate,
        financialSubtype: "Income"
      }
    });
  }

  async function createFinancialItem({ userId, linkedAssetItemId, type, title, defaultAmount, dueDate }) {
    return models.Item.create({
      user_id: userId,
      item_type: "FinancialItem",
      title,
      type,
      frequency: "monthly",
      default_amount: defaultAmount,
      status: "Active",
      linked_asset_item_id: linkedAssetItemId,
      attributes: {
        dueDate
      }
    });
  }

  async function setItemTimestamps(itemId, createdAt, updatedAt) {
    await models.Item.update(
      {
        created_at: createdAt,
        updated_at: updatedAt
      },
      {
        where: { id: itemId },
        silent: true
      }
    );
  }

  async function createEvent(itemId, dueDate, status = "Pending") {
    return models.Event.create({
      item_id: itemId,
      event_type: "MortgagePayment",
      due_date: dueDate,
      amount: "500.00",
      status,
      is_recurring: false
    });
  }

  beforeAll(async () => {
    await sequelize.query("PRAGMA foreign_keys = ON");
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    process.env.HACT_ADMIN_EMAIL = "admin@example.com";
    await sequelize.query("PRAGMA foreign_keys = OFF");
    await models.AuditLog.destroy({ where: {}, force: true });
    await models.Event.destroy({ where: {}, force: true });
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

  it("lists items with deterministic default ordering and query controls", async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const ownerAgent = await signInAs(owner);

    const newest = await createItem(owner.id, { address: "Newest" });
    const older = await createItem(owner.id, { address: "Older" });
    const dueSoon = await createItem(owner.id, { address: "Due Soon", dueDate: "2026-03-01" });
    await createItem(outsider.id, { address: "Foreign" });

    await setItemTimestamps(older.id, "2026-01-01T00:00:00.000Z", "2026-01-05T00:00:00.000Z");
    await setItemTimestamps(newest.id, "2026-01-01T00:00:00.000Z", "2026-01-10T00:00:00.000Z");
    await setItemTimestamps(dueSoon.id, "2026-01-01T00:00:00.000Z", "2026-01-08T00:00:00.000Z");

    const listed = await ownerAgent
      .get("/items")

    expect(listed.status).toBe(200);
    expect(listed.body.total_count).toBe(3);
    const firstPass = listed.body.items.map((item) => item.id);

    const listedAgain = await ownerAgent
      .get("/items")

    expect(listedAgain.status).toBe(200);
    expect(listedAgain.body.items.map((item) => item.id)).toEqual(firstPass);
    expect(new Set(firstPass)).toEqual(new Set([newest.id, dueSoon.id, older.id]));

    const filtered = await ownerAgent
      .get("/items")
      .query({ search: "due", sort: "due_soon", filter: "assets" });

    expect(filtered.status).toBe(200);
    expect(filtered.body.total_count).toBe(1);
    expect(filtered.body.items[0].id).toBe(dueSoon.id);

    const commitmentA = await createCommitment(owner.id, newest.id, 200, "2026-04-01");
    const commitmentB = await createCommitment(owner.id, newest.id, 900, "2026-03-01");
    const recurringCommitment = await createFinancialItem({
      userId: owner.id,
      linkedAssetItemId: newest.id,
      type: "Commitment",
      title: "HOA Contract",
      defaultAmount: 650,
      dueDate: "2026-03-15"
    });

    const amountSorted = await ownerAgent
      .get("/items")
      .query({ filter: "commitments", sort: "amount_high_to_low" });

    expect(amountSorted.status).toBe(200);
    expect(amountSorted.body.items.map((item) => item.id).slice(0, 3)).toEqual([commitmentB.id, recurringCommitment.id, commitmentA.id]);

    const incomeA = await createIncome(owner.id, newest.id, 500, 2000, "2026-03-05");
    const incomeB = await createIncome(owner.id, newest.id, 900, 100, "2026-03-06");
    const recurringIncome = await createFinancialItem({
      userId: owner.id,
      linkedAssetItemId: newest.id,
      type: "Income",
      title: "Solar rebate",
      defaultAmount: 1500,
      dueDate: "2026-03-07"
    });

    const incomeSorted = await ownerAgent
      .get("/items")
      .query({ filter: "income", sort: "amount_low_to_high" });

    expect(incomeSorted.status).toBe(200);
    expect(incomeSorted.body.items.map((item) => item.id).slice(0, 3)).toEqual([incomeA.id, incomeB.id, recurringIncome.id]);
    const recurringIncomeRow = incomeSorted.body.items.find((item) => item.id === recurringIncome.id);
    expect(recurringIncomeRow).toMatchObject({
      item_type: "FinancialItem",
      title: "Solar rebate",
      type: "Income",
      frequency: "monthly",
      status: "Active",
      linked_asset_item_id: newest.id
    });
  });

  it("keeps list scope locked to authenticated owner when foreign owner queries are supplied", async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const ownerAgent = await signInAs(owner);

    const ownerItem = await createItem(owner.id, { address: "Owner Scoped Home" });
    const outsiderItem = await createItem(outsider.id, { address: "Foreign Home" });

    const response = await ownerAgent
      .get("/items")
      .query({
        user_id: outsider.id,
        actorUserId: outsider.id,
        owner: outsider.id,
        search: "home"
      });

    expect(response.status).toBe(200);
    expect(response.body.total_count).toBe(1);
    expect(response.body.items.map((item) => item.id)).toEqual([ownerItem.id]);
    expect(response.body.items.map((item) => item.id)).not.toContain(outsiderItem.id);
  });

  it("returns 404 not_found for foreign-owned item mutations and activity access", async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const outsiderAgent = await signInAs(outsider);
    const ownerItem = await createItem(owner.id, { address: "Foreign Access Target", estimatedValue: 420000 });

    const patched = await outsiderAgent
      .patch(`/items/${ownerItem.id}`)
      .send({ attributes: { estimatedValue: 430000 } });

    expect(patched.status).toBe(404);
    expect(patched.status).not.toBe(403);
    expect(patched.body.error).toMatchObject({
      code: "item_query_failed",
      category: "not_found",
      message: "You can only access your own records."
    });
    expect(patched.body.error.category).not.toBe("forbidden");

    const activity = await outsiderAgent.get(`/items/${ownerItem.id}/activity`);

    expect(activity.status).toBe(404);
    expect(activity.status).not.toBe(403);
    expect(activity.body.error).toMatchObject({
      code: "item_query_failed",
      category: "not_found",
      message: "You can only access your own records."
    });
    expect(activity.body.error.category).not.toBe("forbidden");

    const deleted = await outsiderAgent.delete(`/items/${ownerItem.id}`);

    expect(deleted.status).toBe(404);
    expect(deleted.status).not.toBe(403);
    expect(deleted.body.error).toMatchObject({
      code: "item_query_failed",
      category: "not_found",
      message: "You can only access your own records."
    });
    expect(deleted.body.error.category).not.toBe("forbidden");

    const persisted = await models.Item.findByPk(ownerItem.id);
    expect(persisted.attributes.estimatedValue).toBe(420000);
    expect(persisted.attributes._deleted_at).toBeUndefined();
  });

  it("allows admin all-mode cross-owner mutate/restore and enforces owner-lens not_found boundaries", async () => {
    const admin = await createUser({ email: "admin@example.com" });
    const ownerA = await createUser({ email: "items-owner-a@example.com" });
    const ownerB = await createUser({ email: "items-owner-b@example.com" });
    const adminAgent = await signInAs(admin);
    const ownerAItem = await createItem(ownerA.id, { address: "Lens Owner A House" });
    const ownerBItem = await createItem(ownerB.id, { address: "Lens Owner B House", estimatedValue: 225000 });

    const allModePatch = await adminAgent
      .patch(`/items/${ownerBItem.id}`)
      .send({ attributes: { estimatedValue: 235000 } });

    expect(allModePatch.status).toBe(200);
    expect(allModePatch.body.user_id).toBe(ownerB.id);
    expect(allModePatch.body.attributes.estimatedValue).toBe(235000);

    const allModeDelete = await adminAgent.delete(`/items/${ownerBItem.id}`);
    expect(allModeDelete.status).toBe(200);
    expect(allModeDelete.body.is_deleted).toBe(true);

    const lensSet = await adminAgent.patch("/auth/admin-scope").send({
      mode: "owner",
      lens_user_id: ownerA.id
    });
    expect(lensSet.status).toBe(200);

    const ownerLensAllowed = await adminAgent
      .patch(`/items/${ownerAItem.id}`)
      .send({ attributes: { estimatedValue: 410000 } });
    expect(ownerLensAllowed.status).toBe(200);
    expect(ownerLensAllowed.body.user_id).toBe(ownerA.id);

    const ownerLensRestoreDenied = await adminAgent.patch(`/items/${ownerBItem.id}/restore`);
    expect(ownerLensRestoreDenied.status).toBe(404);
    expect(ownerLensRestoreDenied.body.error).toMatchObject({
      code: "item_query_failed",
      category: "not_found"
    });

    const ownerLensPatchDenied = await adminAgent
      .patch(`/items/${ownerBItem.id}`)
      .send({ attributes: { estimatedValue: 250000 } });
    expect(ownerLensPatchDenied.status).toBe(404);
    expect(ownerLensPatchDenied.body.error).toMatchObject({
      code: "item_query_failed",
      category: "not_found"
    });

    const switchBackAll = await adminAgent.patch("/auth/admin-scope").send({ mode: "all" });
    expect(switchBackAll.status).toBe(200);

    const allModeRestore = await adminAgent.patch(`/items/${ownerBItem.id}/restore`);
    expect(allModeRestore.status).toBe(200);
    expect(allModeRestore.body.was_deleted).toBe(true);
    expect(allModeRestore.body.user_id).toBe(ownerB.id);
  });

  it("returns field-level issue envelopes for invalid list and mutate requests", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    const item = await createItem(owner.id);

    const invalidList = await ownerAgent
      .get("/items")
      .query({ filter: "bad-filter" });

    expect(invalidList.status).toBe(422);
    expect(invalidList.body.error).toMatchObject({
      code: "item_query_failed",
      category: "invalid_filter"
    });
    expect(invalidList.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "filter",
          code: "unsupported_filter",
          category: "invalid_filter"
        })
      ])
    );

    const invalidPatch = await ownerAgent
      .patch(`/items/${item.id}`)
      .send({
        attributes: "not-an-object"
      });

    expect(invalidPatch.status).toBe(422);
    expect(invalidPatch.body.error).toMatchObject({
      code: "item_query_failed",
      category: "invalid_request"
    });
    expect(invalidPatch.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "attributes",
          code: "invalid_attributes",
          category: "invalid_request"
        })
      ])
    );
  });

  it("applies patch and soft delete while enforcing deleted visibility semantics", async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const ownerAgent = await signInAs(owner);
    const item = await createItem(owner.id, { address: "Deletable", estimatedValue: 100000 });

    const patched = await ownerAgent
      .patch(`/items/${item.id}`)
      .send({
        user_id: outsider.id,
        owner: outsider.id,
        attributes: { estimatedValue: 120000 }
      });

    expect(patched.status).toBe(200);
    expect(patched.body.attributes.estimatedValue).toBe(120000);
    expect(patched.body.user_id).toBe(owner.id);
    expect(patched.body.user_id).not.toBe(outsider.id);

    const deleted = await ownerAgent
      .delete(`/items/${item.id}`)

    expect(deleted.status).toBe(200);
    expect(deleted.body.is_deleted).toBe(true);
    expect(deleted.body.deleted_at).toEqual(expect.any(String));

    const defaultList = await ownerAgent.get("/items");

    expect(defaultList.status).toBe(200);
    expect(defaultList.body.total_count).toBe(0);

    const includeDeletedList = await ownerAgent
      .get("/items")
      .query({ include_deleted: "true", filter: "deleted" });

    expect(includeDeletedList.status).toBe(200);
    expect(includeDeletedList.body.total_count).toBe(1);
    expect(includeDeletedList.body.items[0].id).toBe(item.id);

    const updateAfterDelete = await ownerAgent
      .patch(`/items/${item.id}`)
      .send({ attributes: { estimatedValue: 130000 } });

    expect(updateAfterDelete.status).toBe(422);
    expect(updateAfterDelete.body.error.category).toBe("invalid_state");

    const restored = await ownerAgent.patch(`/items/${item.id}/restore`);

    expect(restored.status).toBe(200);
    expect(restored.body.was_deleted).toBe(true);
    expect(restored.body.restored_at).toEqual(expect.any(String));
    expect(restored.body.attributes._deleted_at).toBeUndefined();

    const defaultListAfterRestore = await ownerAgent.get("/items");
    expect(defaultListAfterRestore.status).toBe(200);
    expect(defaultListAfterRestore.body.total_count).toBe(1);

    const deletedListAfterRestore = await ownerAgent
      .get("/items")
      .query({ include_deleted: "true", filter: "deleted" });

    expect(deletedListAfterRestore.status).toBe(200);
    expect(deletedListAfterRestore.body.total_count).toBe(0);

    const updateAfterRestore = await ownerAgent
      .patch(`/items/${item.id}`)
      .send({ attributes: { estimatedValue: 130000 } });

    expect(updateAfterRestore.status).toBe(200);
    expect(updateAfterRestore.body.attributes.estimatedValue).toBe(130000);
  });

  it("restores parent with commitments that were cascade-deleted together", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);

    const parent = await createItem(owner.id, { address: "Sandbox Family SUV" });
    const commitment = await createFinancialItem({
      userId: owner.id,
      linkedAssetItemId: parent.id,
      type: "Commitment",
      title: "Sandbox auto insurance",
      defaultAmount: 350,
      dueDate: "2026-03-03"
    });

    const deleted = await ownerAgent
      .delete(`/items/${parent.id}`)
      .send({ cascade_delete_ids: [commitment.id] });

    expect(deleted.status).toBe(200);
    expect(deleted.body.cascade_deleted_ids).toEqual([commitment.id]);

    const deletedList = await ownerAgent
      .get("/items")
      .query({ include_deleted: "true", filter: "deleted" });

    expect(deletedList.status).toBe(200);
    expect(deletedList.body.items.map((item) => item.id)).toEqual(expect.arrayContaining([parent.id, commitment.id]));

    const restored = await ownerAgent.patch(`/items/${parent.id}/restore`);

    expect(restored.status).toBe(200);
    expect(restored.body.cascade_restored_ids).toEqual([commitment.id]);

    const commitmentItem = await models.Item.findByPk(commitment.id);
    expect(commitmentItem.attributes._deleted_at).toBeUndefined();
    expect(commitmentItem.attributes._deleted_with_parent_id).toBeUndefined();

    const commitments = await ownerAgent
      .get("/items")
      .query({ filter: "commitments", sort: "recently_updated" });

    expect(commitments.status).toBe(200);
    expect(commitments.body.items.map((item) => item.id)).toContain(commitment.id);

    const parentNetStatus = await ownerAgent.get(`/items/${parent.id}/net-status`);
    expect(parentNetStatus.status).toBe(200);
    expect(parentNetStatus.body.child_commitments.map((item) => item.id)).toContain(commitment.id);
  });

  it("derives item ownership from authenticated scope and ignores payload user_id", async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const ownerAgent = await signInAs(owner);

    const created = await ownerAgent.post("/items").send({
      user_id: outsider.id,
      item_type: "RealEstate",
      attributes: {
        address: "Scope Owned Home",
        estimatedValue: 456000
      }
    });

    expect(created.status).toBe(201);
    expect(created.body.user_id).toBe(owner.id);
    expect(created.body.user_id).not.toBe(outsider.id);

    const persisted = await models.Item.findByPk(created.body.id);
    expect(persisted.user_id).toBe(owner.id);
  });

  it("returns item activity timeline with deterministic shape and supports limit validation", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    const item = await createItem(owner.id, { address: "Activity House" });

    await ownerAgent
      .patch(`/items/${item.id}`)
      .send({ attributes: { estimatedValue: 320000 } });

    const event = await createEvent(item.id, "2026-08-01T00:00:00.000Z");
    await ownerAgent.patch(`/events/${event.id}/complete`);

    await ownerAgent.delete(`/items/${item.id}`);

    const activity = await ownerAgent
      .get(`/items/${item.id}/activity`)
      .query({ limit: "2" });

    expect(activity.status).toBe(200);
    expect(activity.body.item_id).toBe(item.id);
    expect(activity.body.activity).toHaveLength(2);
    activity.body.activity.forEach((entry) => {
      expect(Object.keys(entry).sort()).toEqual([
        "action",
        "actor_user_id",
        "created_at",
        "entity",
        "entity_id",
        "entity_type",
        "event_amount",
        "event_completed_at",
        "event_due_date",
        "event_status",
        "event_type",
        "id",
        "lens_attribution_state",
        "lens_user_id",
        "timestamp",
        "updated_at",
        "user_id"
      ]);
    });
    expect(activity.body.activity.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(["item.deleted", "event.completed"])
    );

    const invalidLimit = await ownerAgent
      .get(`/items/${item.id}/activity`)
      .query({ limit: "0" });

    expect(invalidLimit.status).toBe(422);
    expect(invalidLimit.body.error).toMatchObject({
      code: "item_query_failed",
      category: "invalid_request"
    });
    expect(invalidLimit.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "limit",
          code: "invalid_limit"
        })
      ])
    );
  });
});
