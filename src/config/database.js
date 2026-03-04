"use strict";

const path = require("path");

function getDialect() {
  if (process.env.DB_DIALECT) {
    return process.env.DB_DIALECT;
  }

  return process.env.DATABASE_URL ? "postgres" : "sqlite";
}

function getPostgresConfig() {
  const databaseUrl = process.env.DATABASE_URL;
  const isProduction = process.env.NODE_ENV === "production";

  if (databaseUrl) {
    return {
      url: databaseUrl,
      options: {
        dialect: "postgres",
        logging: false,
        dialectOptions: {
          ssl: process.env.DB_SSL === "true" ? { require: true, rejectUnauthorized: false } : undefined
        }
      }
    };
  }

  if (isProduction) {
    const requiredKeys = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"];
    const missing = requiredKeys.filter((key) => {
      const value = process.env[key];
      return typeof value !== "string" || value.trim() === "";
    });

    if (missing.length > 0) {
      throw new Error(`Missing required production postgres env vars: ${missing.join(", ")}`);
    }
  }

  return {
    options: {
      dialect: "postgres",
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || "hact_dev",
      username: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "postgres",
      logging: false
    }
  };
}

function getSqliteConfig() {
  return {
    options: {
      dialect: "sqlite",
      storage: process.env.DB_STORAGE || path.resolve(process.cwd(), ".tmp/hact-dev.sqlite"),
      logging: false
    }
  };
}

function getDatabaseConfig() {
  return getDialect() === "postgres" ? getPostgresConfig() : getSqliteConfig();
}

module.exports = {
  getDatabaseConfig
};
