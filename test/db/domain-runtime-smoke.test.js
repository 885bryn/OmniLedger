"use strict";

describe("domain runtime smoke", () => {
  beforeAll(() => {
    process.env.DB_DIALECT = "sqlite";
    process.env.DB_STORAGE = ":memory:";
  });

  afterAll(() => {
    delete process.env.DB_DIALECT;
    delete process.env.DB_STORAGE;
  });

  it("boots model registry with required models and associations", () => {
    jest.isolateModules(() => {
      const { models } = require("../../src/db");

      expect(models.User).toBeDefined();
      expect(models.Item).toBeDefined();
      expect(models.Event).toBeDefined();
      expect(models.AuditLog).toBeDefined();

      expect(models.Item.associations.parentItem).toBeDefined();
      expect(models.Item.associations.childCommitments).toBeDefined();
      expect(models.Event.associations.item).toBeDefined();
      expect(models.AuditLog.associations.user).toBeDefined();
    });
  });

  it("supports connect and disconnect lifecycle", async () => {
    await jest.isolateModulesAsync(async () => {
      const { sequelize } = require("../../src/db");

      await sequelize.authenticate();
      await sequelize.close();

      expect(sequelize.getDialect()).toBe("sqlite");
    });
  });
});
