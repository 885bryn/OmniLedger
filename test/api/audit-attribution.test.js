"use strict";

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

describe("audit attribution persistence", () => {
  let userCount = 0;

  async function createUser() {
    userCount += 1;

    return models.User.create({
      username: `audit-user-${userCount}`,
      email: `audit-user-${userCount}@example.com`,
      password_hash: await bcrypt.hash("StrongPass123!", 12)
    });
  }

  beforeAll(async () => {
    await sequelize.query("PRAGMA foreign_keys = ON");
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await sequelize.query("PRAGMA foreign_keys = OFF");
    await models.AuditLog.destroy({ where: {}, force: true });
    await models.Item.destroy({ where: {}, force: true });
    await models.User.destroy({ where: {}, force: true });
    await sequelize.query("PRAGMA foreign_keys = ON");
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("keeps legacy audit writes readable by backfilling actor and lens", async () => {
    const user = await createUser();

    const created = await models.AuditLog.create({
      user_id: user.id,
      action: "item.created",
      entity: "item:abc",
      timestamp: new Date("2026-02-26T00:00:00.000Z")
    });

    expect(created.user_id).toBe(user.id);
    expect(created.actor_user_id).toBe(user.id);
    expect(created.lens_user_id).toBe(user.id);
  });

  it("persists explicit actor and lens tuple when provided", async () => {
    const actor = await createUser();
    const lens = await createUser();

    const created = await models.AuditLog.create({
      user_id: actor.id,
      actor_user_id: actor.id,
      lens_user_id: lens.id,
      action: "event.completed",
      entity: "event:abc",
      timestamp: new Date("2026-02-26T01:00:00.000Z")
    });

    expect(created.user_id).toBe(actor.id);
    expect(created.actor_user_id).toBe(actor.id);
    expect(created.lens_user_id).toBe(lens.id);
  });
});
