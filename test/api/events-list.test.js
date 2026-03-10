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

describe("GET /events", () => {
  const app = createApp();
  let userCount = 0;
  const originalAdminEmail = process.env.HACT_ADMIN_EMAIL;

  async function createUser(overrides = {}) {
    userCount += 1;
    const password = overrides.password || "StrongPass123!";
    const passwordHash = await bcrypt.hash(password, 12);

    const created = await models.User.create({
      username: overrides.username || `events-user-${userCount}`,
      email: overrides.email || `events-user-${userCount}@example.com`,
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

  async function createItem(userId) {
    return models.Item.create({
      user_id: userId,
      item_type: "RealEstate",
      attributes: {
        address: "21 Due Street",
        estimatedValue: 220000
      }
    });
  }

  async function createFinancialItem({
    userId,
    title = "Recurring payment",
    frequency = "monthly",
    status = "Active",
    dueDate = "2026-01-15",
    defaultAmount = 250
  }) {
    return models.Item.create({
      user_id: userId,
      item_type: "FinancialItem",
      title,
      type: "Commitment",
      frequency,
      default_amount: defaultAmount,
      status,
      attributes: {
        dueDate
      }
    });
  }

  async function createEvent({ itemId, dueDate, status = "Pending", amount = "100.00", recurring = false }) {
    return models.Event.create({
      item_id: itemId,
      event_type: "MortgagePayment",
      due_date: dueDate,
      amount,
      status,
      is_recurring: recurring,
      completed_at: status === "Completed" ? dueDate : null
    });
  }

  async function setEventUpdatedAt(eventId, isoDate) {
    await models.Event.update(
      { updated_at: isoDate },
      {
        where: { id: eventId },
        silent: true
      }
    );
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

  it("returns grouped nearest-due sections with deterministic event ordering", async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const ownerAgent = await signInAs(owner);
    const item = await createItem(owner.id);
    const outsiderItem = await createItem(outsider.id);

    const firstDate = await createEvent({
      itemId: item.id,
      dueDate: "2026-07-01T00:00:00.000Z",
      amount: "1200.00",
      recurring: true
    });
    const tieOlder = await createEvent({
      itemId: item.id,
      dueDate: "2026-07-15T00:00:00.000Z",
      amount: "200.00"
    });
    const tieNewer = await createEvent({
      itemId: item.id,
      dueDate: "2026-07-15T00:00:00.000Z",
      amount: "400.00"
    });
    await createEvent({
      itemId: outsiderItem.id,
      dueDate: "2026-07-10T00:00:00.000Z",
      amount: "999.99"
    });

    await setEventUpdatedAt(tieOlder.id, "2026-01-01T00:00:00.000Z");
    await setEventUpdatedAt(tieNewer.id, "2026-01-05T00:00:00.000Z");

    const response = await ownerAgent.get("/events");

    expect(response.status).toBe(200);
    expect(response.body.total_count).toBe(3);
    expect(response.body.groups).toHaveLength(2);
    expect(response.body.groups.map((group) => group.due_date)).toEqual(["2026-07-01", "2026-07-15"]);
    expect(response.body.groups[0].events[0].id).toBe(firstDate.id);
    expect(response.body.groups[1].events.map((event) => event.id).sort()).toEqual([tieNewer.id, tieOlder.id].sort());
    expect(response.body.groups[0]).toMatchObject({
      due_date: "2026-07-01"
    });
    expect(Object.keys(response.body.groups[0].events[0]).sort()).toEqual([
      "amount",
      "completed_at",
      "created_at",
      "due_date",
      "id",
      "is_projected",
      "item_id",
      "recurring",
      "source_state",
      "status",
      "type",
      "updated_at"
    ]);
  });

  it("returns explicit source metadata and sorts persisted rows before projected rows on same due date", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    const persistedItem = await createItem(owner.id);

    const sameDate = new Date();
    sameDate.setUTCDate(sameDate.getUTCDate() + 8);
    const dueDateKey = sameDate.toISOString().slice(0, 10);
    const dueDateIso = `${dueDateKey}T00:00:00.000Z`;

    const persisted = await createEvent({
      itemId: persistedItem.id,
      dueDate: dueDateIso,
      status: "Pending",
      amount: "111.00"
    });

    const projectedItem = await createFinancialItem({
      userId: owner.id,
      title: "Projected monthly bill",
      frequency: "monthly",
      status: "Active",
      dueDate: dueDateKey,
      defaultAmount: 222
    });

    const response = await ownerAgent.get("/events").query({ status: "all" });

    expect(response.status).toBe(200);
    const sameDateGroup = response.body.groups.find((group) => group.due_date === dueDateKey);
    expect(sameDateGroup).toBeTruthy();
    expect(sameDateGroup.events).toHaveLength(2);

    expect(sameDateGroup.events[0]).toMatchObject({
      id: persisted.id,
      source_state: "persisted",
      is_projected: false
    });

    expect(sameDateGroup.events[1]).toMatchObject({
      item_id: projectedItem.id,
      source_state: "projected",
      is_projected: true
    });
    expect(sameDateGroup.events[1].id).toMatch(new RegExp(`^projected-${projectedItem.id}-${dueDateKey}$`));
  });

  it("supports status and due range filters for page-level event views", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    const item = await createItem(owner.id);

    await createEvent({
      itemId: item.id,
      dueDate: "2026-06-01T00:00:00.000Z",
      status: "Pending"
    });
    await createEvent({
      itemId: item.id,
      dueDate: "2026-07-10T00:00:00.000Z",
      status: "Completed"
    });

    const pending = await ownerAgent
      .get("/events")
      .query({ status: "pending" });
    expect(pending.status).toBe(200);
    expect(pending.body.total_count).toBe(1);

    const completed = await ownerAgent
      .get("/events")
      .query({ status: "completed" });
    expect(completed.status).toBe(200);
    expect(completed.body.total_count).toBe(1);

    const ranged = await ownerAgent
      .get("/events")
      .query({ due_from: "2026-07-01", due_to: "2026-07-31", status: "all" });
    expect(ranged.status).toBe(200);
    expect(ranged.body.total_count).toBe(1);
    expect(ranged.body.groups[0].due_date).toBe("2026-07-10");
  });

  it("returns issue envelopes for invalid status and due-range inputs", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    await createItem(owner.id);

    const invalidStatus = await ownerAgent
      .get("/events")
      .query({ status: "bad" });

    expect(invalidStatus.status).toBe(422);
    expect(invalidStatus.body.error).toMatchObject({
      code: "event_query_failed",
      category: "invalid_filter"
    });
    expect(invalidStatus.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "status",
          code: "unsupported_status_filter",
          category: "invalid_filter"
        })
      ])
    );

    const invalidRange = await ownerAgent
      .get("/events")
      .query({ due_from: "2026-08-01", due_to: "2026-07-01" });

    expect(invalidRange.status).toBe(422);
    expect(invalidRange.body.error).toMatchObject({
      code: "event_query_failed",
      category: "invalid_range"
    });
    expect(invalidRange.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "due_range",
          code: "invalid_due_range",
          category: "invalid_range"
        })
      ])
    );
  });

  it("backfills pending events for cashflow items missing event rows", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    const parent = await createItem(owner.id);

    const commitment = await models.Item.create({
      user_id: owner.id,
      item_type: "FinancialItem",
      parent_item_id: parent.id,
      linked_asset_item_id: parent.id,
      title: "e300 testing payment",
      type: "Commitment",
      frequency: "one_time",
      default_amount: 300,
      status: "Active",
      attributes: {
        name: "e300 testing payment",
        amount: 300,
        dueDate: "2026-02-26",
        financialSubtype: "Commitment"
      }
    });

    const firstRead = await ownerAgent
      .get("/events")
      .query({ status: "pending" });

    expect(firstRead.status).toBe(200);
    expect(firstRead.body.groups.flatMap((group) => group.events)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          item_id: commitment.id,
          type: "e300 testing payment",
          status: "Pending"
        })
      ])
    );

    const secondRead = await ownerAgent
      .get("/events")
      .query({ status: "pending" });

    const secondMatches = secondRead.body.groups
      .flatMap((group) => group.events)
      .filter((event) => event.item_id === commitment.id && event.type === "e300 testing payment");

    expect(secondRead.status).toBe(200);
    expect(secondMatches).toHaveLength(1);
  });

  it("projects recurring financial item occurrences across a 3-year horizon and suppresses closed contracts", async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const ownerAgent = await signInAs(owner);

    const activeRecurring = await createFinancialItem({
      userId: owner.id,
      title: "Monthly HOA",
      frequency: "monthly",
      status: "Active",
      dueDate: "2026-02-10",
      defaultAmount: 345.12
    });

    await createFinancialItem({
      userId: owner.id,
      title: "Closed insurance",
      frequency: "monthly",
      status: "Closed",
      dueDate: "2026-02-01",
      defaultAmount: 88
    });

    await createFinancialItem({
      userId: outsider.id,
      title: "Outsider recurring",
      frequency: "monthly",
      status: "Active",
      dueDate: "2026-02-03",
      defaultAmount: 99
    });

    const response = await ownerAgent.get("/events").query({ status: "pending" });

    expect(response.status).toBe(200);
    const projected = response.body.groups
      .flatMap((group) => group.events)
      .filter((event) => event.item_id === activeRecurring.id);

    expect(projected.length).toBeGreaterThan(30);
    projected.forEach((event) => {
      expect(event.id).toMatch(new RegExp(`^projected-${activeRecurring.id}-\\d{4}-\\d{2}-\\d{2}$`));
      expect(event.status).toBe("Pending");
      expect(event.recurring).toBe(true);
      expect(event.type).toBe("Monthly HOA");
      expect(event.source_state).toBe("projected");
      expect(event.is_projected).toBe(true);
    });

    const today = new Date();
    const todayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const horizonDate = new Date(Date.UTC(today.getUTCFullYear() + 3, today.getUTCMonth(), today.getUTCDate()));
    const horizonEnd = horizonDate.getTime();

    const projectedTimes = projected.map((event) => new Date(event.due_date).getTime());
    const overdueTimes = projectedTimes.filter((dueTime) => dueTime < todayStart);
    const currentAndFutureTimes = projectedTimes.filter((dueTime) => dueTime >= todayStart);

    expect(overdueTimes.length).toBe(0);
    expect(currentAndFutureTimes.length).toBeGreaterThan(0);
    expect(Math.min(...currentAndFutureTimes)).toBeGreaterThanOrEqual(todayStart);
    expect(Math.max(...projectedTimes)).toBeLessThanOrEqual(horizonEnd);

    const leakedClosedOrForeign = response.body.groups
      .flatMap((group) => group.events)
      .filter((event) => event.type === "Closed insurance" || event.type === "Outsider recurring");
    expect(leakedClosedOrForeign).toHaveLength(0);

    const secondResponse = await ownerAgent.get("/events").query({ status: "pending" });
    const secondProjected = secondResponse.body.groups
      .flatMap((group) => group.events)
      .filter((event) => event.item_id === activeRecurring.id);
    expect(secondProjected).toHaveLength(projected.length);
    expect(secondProjected.map((event) => event.id)).toEqual(projected.map((event) => event.id));
  });

  it("hides persisted and projected events when source financial item is soft-deleted", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);

    const financialItem = await createFinancialItem({
      userId: owner.id,
      title: "Deleted recurring bill",
      frequency: "monthly",
      status: "Active",
      dueDate: "2026-03-10",
      defaultAmount: 220
    });

    await createEvent({
      itemId: financialItem.id,
      dueDate: "2026-03-10T00:00:00.000Z",
      status: "Pending",
      amount: "220.00",
      recurring: true
    });

    const deletedAttributes = {
      ...(financialItem.attributes || {}),
      _deleted_at: "2026-02-26T00:00:00.000Z",
      _deleted_by: owner.id
    };
    await financialItem.update({ attributes: deletedAttributes });

    const response = await ownerAgent.get("/events").query({ status: "all" });

    expect(response.status).toBe(200);
    const matching = response.body.groups
      .flatMap((group) => group.events)
      .filter((event) => event.item_id === financialItem.id || event.type === "Deleted recurring bill");

    expect(matching).toHaveLength(0);
  });

  it("does not project recurring events before the source financial item creation date", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-18T12:00:00.000Z"));

    try {
      const owner = await createUser();
      const ownerAgent = await signInAs(owner);

      const recurringItem = await createFinancialItem({
        userId: owner.id,
        title: "Creation-bounded projection",
        frequency: "weekly",
        status: "Active",
        dueDate: "2026-01-01",
        defaultAmount: 140
      });

      await models.Item.update(
        {
          attributes: {
            ...(recurringItem.attributes || {}),
            originDate: "2026-03-16"
          }
        },
        {
          where: { id: recurringItem.id }
        }
      );

      const response = await ownerAgent.get("/events").query({ status: "pending" });

      expect(response.status).toBe(200);

      const projected = response.body.groups
        .flatMap((group) => group.events)
        .filter((event) => event.item_id === recurringItem.id && event.source_state === "projected");

      expect(projected.length).toBeGreaterThan(0);

      const creationBoundary = new Date("2026-03-16T00:00:00.000Z").getTime();
      projected.forEach((event) => {
        expect(new Date(event.due_date).getTime()).toBeGreaterThanOrEqual(creationBoundary);
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it("suppresses absurd historical recurring rows for normal users without meta noise", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);
    const recurringItem = await createFinancialItem({
      userId: owner.id,
      title: "Boundary regression bill",
      frequency: "monthly",
      status: "Active",
      dueDate: "2026-03-15",
      defaultAmount: 180
    });

    await createEvent({
      itemId: recurringItem.id,
      dueDate: "1068-01-15T00:00:00.000Z",
      recurring: true,
      amount: "180.00"
    });
    await createEvent({
      itemId: recurringItem.id,
      dueDate: "1192-02-15T00:00:00.000Z",
      recurring: true,
      amount: "180.00"
    });

    const response = await ownerAgent.get("/events").query({ status: "all" });

    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty("meta");

    const flattened = response.body.groups.flatMap((group) => group.events);
    expect(flattened.some((event) => String(event.due_date).includes("1068-"))).toBe(false);
    expect(flattened.some((event) => String(event.due_date).includes("1192-"))).toBe(false);
  });

  it("returns admin-only suppression metadata for bogus historical recurring rows", async () => {
    const admin = await createUser({ email: "admin@example.com" });
    const owner = await createUser();
    const adminAgent = await signInAs(admin);
    const recurringItem = await createFinancialItem({
      userId: owner.id,
      title: "Admin suppression bill",
      frequency: "monthly",
      status: "Active",
      dueDate: "2026-03-15",
      defaultAmount: 95
    });

    await createEvent({
      itemId: recurringItem.id,
      dueDate: "1068-01-15T00:00:00.000Z",
      recurring: true,
      amount: "95.00"
    });
    await createEvent({
      itemId: recurringItem.id,
      dueDate: "1192-02-15T00:00:00.000Z",
      recurring: true,
      amount: "95.00"
    });

    const response = await adminAgent.get("/events").query({ status: "all" });

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({
      suppressed_invalid_projected_count: 2
    });

    const flattened = response.body.groups.flatMap((group) => group.events);
    expect(flattened.some((event) => event.item_id === recurringItem.id && String(event.due_date).includes("1068-"))).toBe(false);
    expect(flattened.some((event) => event.item_id === recurringItem.id && String(event.due_date).includes("1192-"))).toBe(false);
  });

  it("skips recurring projection when due-date seed metadata is invalid instead of guessing", async () => {
    const owner = await createUser();
    const ownerAgent = await signInAs(owner);

    const weakRecurring = await models.Item.create(
      {
        user_id: owner.id,
        item_type: "FinancialItem",
        title: "Weak metadata recurring",
        type: "Commitment",
        frequency: "monthly",
        default_amount: 61,
        status: "Active",
        attributes: {
          dueDate: "not-a-date"
        }
      },
      { validate: false }
    );

    const response = await ownerAgent.get("/events").query({ status: "all" });

    expect(response.status).toBe(200);
    const flattened = response.body.groups.flatMap((group) => group.events);
    expect(flattened.filter((event) => event.item_id === weakRecurring.id)).toHaveLength(0);
  });
});
