"use strict";

const { readRequiredProductionEnv, ProductionEnvValidationError } = require("../../src/config/production-env");

describe("readRequiredProductionEnv", () => {
  it("returns normalized values when all required variables are valid", () => {
    const result = readRequiredProductionEnv({
      NAS_STATIC_IP: " 192.168.1.40 ",
      HACT_ADMIN_EMAIL: " Admin@Example.com ",
      DB_PASSWORD: "my-strong-secret"
    });

    expect(result).toEqual({
      nasStaticIp: "192.168.1.40",
      adminEmail: "admin@example.com",
      dbPassword: "my-strong-secret"
    });
  });

  it("aggregates missing and invalid issues in deterministic order", () => {
    expect(() => {
      readRequiredProductionEnv({
        NAS_STATIC_IP: "999.1.1.1",
        HACT_ADMIN_EMAIL: "not-an-email",
        DB_PASSWORD: ""
      });
    }).toThrow(ProductionEnvValidationError);

    try {
      readRequiredProductionEnv({
        NAS_STATIC_IP: "999.1.1.1",
        HACT_ADMIN_EMAIL: "not-an-email",
        DB_PASSWORD: ""
      });
      throw new Error("expected readRequiredProductionEnv to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ProductionEnvValidationError);
      expect(error.issues.map((issue) => issue.key)).toEqual([
        "DB_PASSWORD",
        "NAS_STATIC_IP",
        "HACT_ADMIN_EMAIL"
      ]);
      expect(error.message).toContain("DB_PASSWORD: missing required value.");
      expect(error.message).toContain("NAS_STATIC_IP: invalid IPv4 address format.");
      expect(error.message).toContain("HACT_ADMIN_EMAIL: invalid email format.");
      expect(error.message).toContain("Portainer stack env DB_PASSWORD");
      expect(error.message).toContain("Portainer stack env NAS_STATIC_IP");
      expect(error.message).toContain("Portainer stack env HACT_ADMIN_EMAIL");
    }
  });

  it("rejects placeholder-like DB_PASSWORD values without leaking the value", () => {
    const placeholderSecret = "replace_with_real_secret";

    expect(() => {
      readRequiredProductionEnv({
        NAS_STATIC_IP: "192.168.0.10",
        HACT_ADMIN_EMAIL: "admin@example.com",
        DB_PASSWORD: placeholderSecret
      });
    }).toThrow(ProductionEnvValidationError);

    try {
      readRequiredProductionEnv({
        NAS_STATIC_IP: "192.168.0.10",
        HACT_ADMIN_EMAIL: "admin@example.com",
        DB_PASSWORD: placeholderSecret
      });
      throw new Error("expected readRequiredProductionEnv to throw");
    } catch (error) {
      expect(error.message).toContain("DB_PASSWORD: placeholder-like secret is not allowed.");
      expect(error.message).not.toContain(placeholderSecret);
    }
  });
});
