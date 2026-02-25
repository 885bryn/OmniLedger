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

const { sequelize } = require("../../src/db");
const { createApp } = require("../../src/api/app");

process.env.SESSION_SECRET = "test-session-secret";
process.env.FRONTEND_ORIGIN = "http://localhost:5173";

describe("session authorization enforcement", () => {
  const app = createApp();

  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("returns 401 for unauthenticated protected route access", async () => {
    const response = await request(app).get("/items");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: "authentication_required",
        message: "Authentication required."
      }
    });
  });
});
