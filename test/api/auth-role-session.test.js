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
const { requireAuth } = require("../../src/api/auth/require-auth");

process.env.SESSION_SECRET = "test-session-secret";
process.env.FRONTEND_ORIGIN = "http://localhost:5173";

describe("auth role-aware session behavior", () => {
  const app = createApp();
  const originalAdminEmail = process.env.HACT_ADMIN_EMAIL;
  const originalLegacyAdminEmail = process.env.ADMIN_EMAIL;
  let userCounter = 0;

  async function createUser(overrides = {}) {
    userCounter += 1;
    const password = overrides.password || "StrongPass123!";
    const passwordHash = await bcrypt.hash(password, 12);

    const created = await models.User.create({
      username: overrides.username || `role-user-${userCounter}`,
      email: overrides.email || `role-user-${userCounter}@example.com`,
      password_hash: passwordHash,
      role: overrides.role
    });

    return {
      id: created.id,
      email: created.email,
      password
    };
  }

  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    delete process.env.HACT_ADMIN_EMAIL;
    delete process.env.ADMIN_EMAIL;
    await sequelize.query("PRAGMA foreign_keys = OFF");
    await sequelize.query('DELETE FROM "Sessions"');
    await models.User.destroy({ where: {}, force: true });
    await sequelize.query("PRAGMA foreign_keys = ON");
  });

  afterAll(async () => {
    if (typeof originalAdminEmail === "string") {
      process.env.HACT_ADMIN_EMAIL = originalAdminEmail;
    } else {
      delete process.env.HACT_ADMIN_EMAIL;
    }

    if (typeof originalLegacyAdminEmail === "string") {
      process.env.ADMIN_EMAIL = originalLegacyAdminEmail;
    } else {
      delete process.env.ADMIN_EMAIL;
    }

    await sequelize.close();
  });

  it("defaults role to user and ignores client role input on register", async () => {
    const agent = request.agent(app);

    const registerResponse = await agent.post("/auth/register").send({
      email: "member@example.com",
      password: "StrongPass123!",
      role: "admin"
    });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.user.role).toBe("user");

    const persisted = await models.User.findOne({ where: { email_normalized: "member@example.com" } });
    expect(persisted.role).toBe("user");

    const sessionResponse = await agent.get("/auth/session");
    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.body.user.role).toBe("user");
  });

  it("assigns admin role to configured admin email and user role to others", async () => {
    process.env.HACT_ADMIN_EMAIL = "admin@example.com";

    const adminAgent = request.agent(app);
    const userAgent = request.agent(app);

    const adminRegister = await adminAgent.post("/auth/register").send({
      email: "admin@example.com",
      password: "StrongPass123!"
    });
    const userRegister = await userAgent.post("/auth/register").send({
      email: "member@example.com",
      password: "StrongPass123!"
    });

    expect(adminRegister.status).toBe(201);
    expect(userRegister.status).toBe(201);
    expect(adminRegister.body.user.role).toBe("admin");
    expect(userRegister.body.user.role).toBe("user");

    const [adminUser, standardUser] = await Promise.all([
      models.User.findOne({ where: { email_normalized: "admin@example.com" } }),
      models.User.findOne({ where: { email_normalized: "member@example.com" } })
    ]);

    expect(adminUser.role).toBe("admin");
    expect(standardUser.role).toBe("user");
  });

  it("ignores legacy ADMIN_EMAIL when HACT_ADMIN_EMAIL is unset", async () => {
    process.env.ADMIN_EMAIL = "legacy-admin@example.com";

    const agent = request.agent(app);
    const registerResponse = await agent.post("/auth/register").send({
      email: "legacy-admin@example.com",
      password: "StrongPass123!"
    });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.user.role).toBe("user");

    const persisted = await models.User.findOne({ where: { email_normalized: "legacy-admin@example.com" } });
    expect(persisted.role).toBe("user");
  });

  it("hydrates login and session role from trusted persisted state", async () => {
    const created = await createUser({ email: "fixture-admin@example.com", role: "admin" });
    const agent = request.agent(app);

    const loginResponse = await agent.post("/auth/login").send({
      email: created.email,
      password: created.password,
      role: "user"
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.user.role).toBe("admin");

    const sessionResponse = await agent.get("/auth/session");
    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.body.user.role).toBe("admin");
  });

  it("hydrates req.actor and req.scope with role-aware defaults", async () => {
    const standardUser = await createUser({ email: "scope-user@example.com", role: "user" });
    const adminUser = await createUser({ email: "scope-admin@example.com", role: "admin" });

    const userReq = {
      session: {
        userId: standardUser.id
      }
    };
    const adminReq = {
      session: {
        userId: adminUser.id
      }
    };
    const userRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const adminRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const userNext = jest.fn();
    const adminNext = jest.fn();

    await requireAuth(userReq, userRes, userNext);
    await requireAuth(adminReq, adminRes, adminNext);

    expect(userNext).toHaveBeenCalledTimes(1);
    expect(adminNext).toHaveBeenCalledTimes(1);
    expect(userRes.status).not.toHaveBeenCalled();
    expect(adminRes.status).not.toHaveBeenCalled();

    expect(userReq.actor).toEqual({
      userId: standardUser.id,
      role: "user"
    });
    expect(userReq.scope).toEqual({
      actorUserId: standardUser.id,
      actorRole: "user",
      mode: "owner",
      lensUserId: standardUser.id
    });

    expect(adminReq.actor).toEqual({
      userId: adminUser.id,
      role: "admin"
    });
    expect(adminReq.scope).toEqual({
      actorUserId: adminUser.id,
      actorRole: "admin",
      mode: "all",
      lensUserId: null
    });
  });
});
