"use strict";

const request = require("supertest");

const mockAuthenticate = jest.fn();

jest.mock("../../src/db", () => ({
  sequelize: {
    authenticate: mockAuthenticate
  }
}));

const { createApp } = require("../../src/api/app");

describe("GET /health", () => {
  const app = createApp();

  beforeEach(() => {
    mockAuthenticate.mockReset();
  });

  it("returns ready response when database connectivity succeeds", async () => {
    mockAuthenticate.mockResolvedValueOnce();

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      ready: true
    });
  });

  it("returns unhealthy response when database connectivity fails", async () => {
    mockAuthenticate.mockRejectedValueOnce(new Error("db unavailable"));

    const response = await request(app).get("/health");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: "unhealthy",
      ready: false,
      error: {
        code: "database_unavailable",
        message: "Database connectivity check failed."
      }
    });
  });
});
