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

const { sequelize } = require("../../src/db");
const { createApp } = require("../../src/api/app");
const { models } = require("../../src/db");

process.env.SESSION_SECRET = "test-session-secret";
process.env.FRONTEND_ORIGIN = "http://localhost:5173";

describe("auth routes", () => {
  const app = createApp();
  let userCounter = 0;

  async function createUser(overrides = {}) {
    userCounter += 1;
    const email = overrides.email || `auth-user-${userCounter}@example.com`;
    const password = overrides.password || "StrongPass123!";

    const passwordHash = await bcrypt.hash(password, 12);
    const created = await models.User.create({
      username: overrides.username || `auth-user-${userCounter}`,
      email,
      password_hash: passwordHash
    });

    return {
      id: created.id,
      email,
      password
    };
  }

  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await sequelize.query("PRAGMA foreign_keys = OFF");
    await sequelize.query('DELETE FROM "Sessions"');
    await models.User.destroy({ where: {}, force: true });
    await sequelize.query("PRAGMA foreign_keys = ON");
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("registers with email and password then creates an authenticated session", async () => {
    const agent = request.agent(app);
    const registerResponse = await agent.post("/auth/register").send({
      email: "phase8-register@example.com",
      password: "StrongPass123!"
    });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.user).toMatchObject({
      email: "phase8-register@example.com"
    });
    expect(registerResponse.body.session).toEqual(
      expect.objectContaining({
        authenticated: true,
        scope: expect.objectContaining({
          actorRole: "user",
          mode: "owner"
        })
      })
    );

    const sessionResponse = await agent.get("/auth/session");

    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.body.session).toEqual(
      expect.objectContaining({
        authenticated: true,
        scope: expect.objectContaining({
          actorRole: "user",
          mode: "owner"
        })
      })
    );
    expect(sessionResponse.body.user.email).toBe("phase8-register@example.com");
  });

  it("logs in successfully and persists session across follow-up requests", async () => {
    const user = await createUser({ email: "persist@example.com", password: "StrongPass123!" });
    const agent = request.agent(app);
    const loginResponse = await agent.post("/auth/login").send({
      email: user.email,
      password: user.password
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.session).toEqual(
      expect.objectContaining({
        authenticated: true,
        scope: expect.objectContaining({
          actorRole: "user",
          mode: "owner"
        })
      })
    );
    expect(loginResponse.body.user.id).toBe(user.id);

    const firstSession = await agent.get("/auth/session");
    expect(firstSession.status).toBe(200);
    expect(firstSession.body.session).toEqual(
      expect.objectContaining({
        authenticated: true,
        scope: expect.objectContaining({
          actorRole: "user",
          mode: "owner"
        })
      })
    );
    expect(firstSession.body.user.id).toBe(user.id);

    const secondSession = await agent.get("/auth/session");
    expect(secondSession.status).toBe(200);
    expect(secondSession.body.session).toEqual(
      expect.objectContaining({
        authenticated: true,
        scope: expect.objectContaining({
          actorRole: "user",
          mode: "owner"
        })
      })
    );
    expect(secondSession.body.user.id).toBe(user.id);
  });

  it("returns the same generic invalid credential envelope for unknown and wrong-password attempts", async () => {
    const user = await createUser({ email: "generic@example.com", password: "StrongPass123!" });

    const unknownResponse = await request(app).post("/auth/login").send({
      email: "missing-user@example.com",
      password: "WrongPass123!"
    });

    const wrongPasswordResponse = await request(app).post("/auth/login").send({
      email: user.email,
      password: "WrongPass123!"
    });

    expect(unknownResponse.status).toBe(401);
    expect(wrongPasswordResponse.status).toBe(401);
    expect(unknownResponse.body).toEqual(wrongPasswordResponse.body);
    expect(unknownResponse.body).toEqual({
      error: {
        code: "invalid_credentials",
        message: "Invalid email or password.",
        cooldown: null
      }
    });
  });

  it("returns cooldown metadata after repeated failed login attempts", async () => {
    const email = "cooldown@example.com";

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = await request(app).post("/auth/login").send({
        email,
        password: "WrongPass123!"
      });

      expect(failed.status).toBe(401);
      expect(failed.body.error.code).toBe("invalid_credentials");
    }

    const cooldownResponse = await request(app).post("/auth/login").send({
      email,
      password: "WrongPass123!"
    });

    expect(cooldownResponse.status).toBe(429);
    expect(cooldownResponse.body.error.code).toBe("auth_cooldown");
    expect(cooldownResponse.body.error.cooldown.retry_after_seconds).toEqual(expect.any(Number));
    expect(cooldownResponse.body.error.cooldown.retry_after_seconds).toBeGreaterThan(0);
  });

  it("returns unauthenticated session state when no cookie is present", async () => {
    const response = await request(app).get("/auth/session");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: null,
      session: {
        authenticated: false,
        scope: null
      }
    });
  });

  it("invalidates only the current session on logout", async () => {
    const user = await createUser({ email: "multi-device@example.com", password: "StrongPass123!" });
    const deviceA = request.agent(app);
    const deviceB = request.agent(app);

    const loginA = await deviceA.post("/auth/login").send({
      email: user.email,
      password: user.password
    });
    const loginB = await deviceB.post("/auth/login").send({
      email: user.email,
      password: user.password
    });

    expect(loginA.status).toBe(200);
    expect(loginB.status).toBe(200);

    const logoutResponse = await deviceA.post("/auth/logout");
    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body.session).toEqual({ authenticated: false });

    const sessionAfterLogout = await deviceA.get("/auth/session");
    expect(sessionAfterLogout.status).toBe(200);
    expect(sessionAfterLogout.body).toEqual({
      user: null,
      session: {
        authenticated: false,
        scope: null
      }
    });

    const otherDeviceSession = await deviceB.get("/auth/session");
    expect(otherDeviceSession.status).toBe(200);
    expect(otherDeviceSession.body.session).toEqual(
      expect.objectContaining({
        authenticated: true,
        scope: expect.objectContaining({
          actorRole: "user",
          mode: "owner"
        })
      })
    );
    expect(otherDeviceSession.body.user.id).toBe(user.id);
  });
});
