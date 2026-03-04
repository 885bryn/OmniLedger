"use strict";

describe("startup production env preflight", () => {
  const originalExitCode = process.exitCode;
  const originalEnv = { ...process.env };

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.exitCode = originalExitCode;
    process.env = { ...originalEnv };
  });

  it("fails before DB wait or child process launch when production env is invalid", async () => {
    const spawnMock = jest.fn();
    const sequelizeConstructor = jest.fn();

    jest.doMock("node:child_process", () => ({
      spawn: spawnMock
    }));
    jest.doMock("sequelize", () => ({
      Sequelize: sequelizeConstructor
    }));

    const startup = require("../../src/scripts/startup");

    await expect(
      startup.run({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://user:sensitive-value@db:5432/hact",
        NAS_STATIC_IP: "",
        HACT_ADMIN_EMAIL: "invalid-email",
        DB_PASSWORD: "replace_me"
      })
    ).rejects.toMatchObject({ name: "ProductionEnvValidationError" });

    expect(sequelizeConstructor).not.toHaveBeenCalled();
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("reports aggregated variable diagnostics with Portainer hints and no secret leakage", async () => {
    const spawnMock = jest.fn();
    const sequelizeConstructor = jest.fn();
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    jest.doMock("node:child_process", () => ({
      spawn: spawnMock
    }));
    jest.doMock("sequelize", () => ({
      Sequelize: sequelizeConstructor
    }));

    const startup = require("../../src/scripts/startup");

    let capturedError;

    try {
      await startup.run({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://user:super-secret-value@db:5432/hact",
        NAS_STATIC_IP: "500.1.1.1",
        HACT_ADMIN_EMAIL: "admin-at-example",
        DB_PASSWORD: "replace_with_real_secret"
      });
    } catch (error) {
      capturedError = error;
    }

    expect(capturedError).toBeDefined();
    startup.handleStartupError(capturedError);

    const stderrOutput = errorSpy.mock.calls.flat().join("\n");

    expect(stderrOutput).toContain("Production environment validation failed:");
    expect(stderrOutput).toContain("NAS_STATIC_IP: invalid IPv4 address format.");
    expect(stderrOutput).toContain("HACT_ADMIN_EMAIL: invalid email format.");
    expect(stderrOutput).toContain("DB_PASSWORD: placeholder-like secret is not allowed.");
    expect(stderrOutput).toContain("Portainer stack env NAS_STATIC_IP");
    expect(stderrOutput).toContain("Portainer stack env HACT_ADMIN_EMAIL");
    expect(stderrOutput).toContain("Portainer stack env DB_PASSWORD");
    expect(stderrOutput).not.toContain("replace_with_real_secret");
    expect(stderrOutput).not.toContain("super-secret-value");
    expect(process.exitCode).toBe(1);

    expect(sequelizeConstructor).not.toHaveBeenCalled();
    expect(spawnMock).not.toHaveBeenCalled();
  });
});
