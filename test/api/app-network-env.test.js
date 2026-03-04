"use strict";

const request = require("supertest");

const mockAuthenticate = jest.fn();

jest.mock("../../src/db", () => ({
  sequelize: {
    authenticate: mockAuthenticate
  }
}));

const ORIGINAL_ENV = process.env;

function withEnv(overrides) {
  process.env = {
    ...ORIGINAL_ENV,
    ...overrides
  };
}

describe("network target CORS resolution", () => {
  beforeEach(() => {
    mockAuthenticate.mockReset();
    jest.resetModules();
    withEnv({
      NODE_ENV: "test",
      NAS_STATIC_IP: "",
      FRONTEND_ORIGIN: "",
      FRONTEND_PORT: ""
    });
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("derives production allowed origin from NAS_STATIC_IP when explicit origin is not set", async () => {
    withEnv({
      NODE_ENV: "production",
      NAS_STATIC_IP: "192.168.1.99",
      SESSION_SECRET: "test-session-secret"
    });

    const { createApp } = require("../../src/api/app");
    const app = createApp();

    const allowed = await request(app)
      .options("/health")
      .set("Origin", "http://192.168.1.99:8085")
      .set("Access-Control-Request-Method", "GET");

    expect(allowed.status).toBe(204);
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://192.168.1.99:8085");

    const denied = await request(app)
      .options("/health")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "GET");

    expect(denied.status).toBe(403);
    expect(denied.body).toEqual({
      error: {
        code: "origin_not_allowed",
        message: "Request origin is not allowed for this API."
      }
    });
  });

  it("honors FRONTEND_ORIGIN override list in production", async () => {
    withEnv({
      NODE_ENV: "production",
      NAS_STATIC_IP: "192.168.1.20",
      FRONTEND_ORIGIN: "https://hact.example.com, https://admin.hact.example.com",
      SESSION_SECRET: "test-session-secret"
    });

    const { createApp } = require("../../src/api/app");
    const app = createApp();

    const allowed = await request(app)
      .options("/health")
      .set("Origin", "https://admin.hact.example.com")
      .set("Access-Control-Request-Method", "GET");

    expect(allowed.status).toBe(204);
    expect(allowed.headers["access-control-allow-origin"]).toBe("https://admin.hact.example.com");

    const deniedNasDerivedOrigin = await request(app)
      .options("/health")
      .set("Origin", "http://192.168.1.20:8085")
      .set("Access-Control-Request-Method", "GET");

    expect(deniedNasDerivedOrigin.status).toBe(403);
  });

  it("keeps developer local defaults when not in production", async () => {
    withEnv({
      NODE_ENV: "development",
      NAS_STATIC_IP: "192.168.1.77"
    });

    const { createApp } = require("../../src/api/app");
    const app = createApp();

    const localOrigin = await request(app)
      .options("/health")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "GET");

    expect(localOrigin.status).toBe(204);
    expect(localOrigin.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });
});
