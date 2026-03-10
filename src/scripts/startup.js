"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");
const { Sequelize } = require("sequelize");
const {
  readRequiredProductionEnv,
  ProductionEnvValidationError
} = require("../config/production-env");

function resolveMigrationTarget(env = process.env) {
  const sequelizeCliEntry = require.resolve("sequelize-cli/lib/sequelize");

  if (env.DATABASE_URL) {
    return {
      waitForDatabase: true,
      command: process.execPath,
      args: [sequelizeCliEntry, "db:migrate", "--url", env.DATABASE_URL]
    };
  }

  if (env.NODE_ENV === "production" || (env.DB_DIALECT && env.DB_DIALECT !== "sqlite")) {
    throw new Error("DATABASE_URL is required for non-sqlite startup migrations.");
  }

  return {
    waitForDatabase: false,
    command: process.execPath,
    args: [sequelizeCliEntry, "db:migrate"]
  };
}

function isLocalSqliteRuntime(env = process.env) {
  if (env.DATABASE_URL || env.NODE_ENV === "production") {
    return false;
  }

  return !env.DB_DIALECT || env.DB_DIALECT === "sqlite";
}

function getSqliteStoragePath(env = process.env) {
  return env.DB_STORAGE || path.resolve(process.cwd(), ".tmp/hact-dev.sqlite");
}

function openSqliteDatabase(storagePath) {
  const sqlite3 = require("sqlite3");
  return new sqlite3.Database(storagePath);
}

function sqliteAll(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}

function sqliteRun(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.run(sql, params, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function closeSqliteDatabase(database) {
  return new Promise((resolve, reject) => {
    database.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function reconcileLocalSqliteMigrationMeta(env = process.env) {
  if (!isLocalSqliteRuntime(env)) {
    return [];
  }

  const storagePath = getSqliteStoragePath(env);
  if (!fs.existsSync(storagePath)) {
    return [];
  }

  const database = openSqliteDatabase(storagePath);

  try {
    const metaTable = await sqliteAll(
      database,
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'SequelizeMeta'"
    );

    if (metaTable.length === 0) {
      return [];
    }

    const [userColumns, auditColumns, itemColumns, eventColumns, indexes, appliedRows] = await Promise.all([
      sqliteAll(database, 'PRAGMA table_info("Users")'),
      sqliteAll(database, 'PRAGMA table_info("AuditLog")'),
      sqliteAll(database, 'PRAGMA table_info("Items")'),
      sqliteAll(database, 'PRAGMA table_info("Events")'),
      sqliteAll(
        database,
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name IN ('AuditLog', 'Items')"
      ),
      sqliteAll(database, 'SELECT name FROM "SequelizeMeta"')
    ]);

    const columnNames = (rows) => new Set(rows.map((row) => row.name));
    const indexNames = new Set(indexes.map((row) => row.name));
    const applied = new Set(appliedRows.map((row) => row.name));
    const users = columnNames(userColumns);
    const auditLog = columnNames(auditColumns);
    const items = columnNames(itemColumns);
    const events = columnNames(eventColumns);
    const reconciled = [];

    const candidates = [
      {
        name: "20260226090000-add-user-role-and-admin-scope-session-support.js",
        satisfied: users.has("role")
      },
      {
        name: "20260226093000-expand-audit-log-actor-lens-attribution.js",
        satisfied:
          auditLog.has("actor_user_id") &&
          auditLog.has("lens_user_id") &&
          indexNames.has("audit_log_actor_timestamp_idx") &&
          indexNames.has("audit_log_lens_timestamp_idx")
      },
      {
        name: "20260226100000-financial-item-contract-foundation.js",
        satisfied:
          items.has("title") &&
          items.has("type") &&
          items.has("frequency") &&
          items.has("default_amount") &&
          items.has("status") &&
          items.has("linked_asset_item_id") &&
          indexNames.has("items_linked_asset_item_id_idx")
      },
      {
        name: "20260227120000-add-event-exception-flags.js",
        satisfied: events.has("is_exception")
      },
      {
        name: "20260310000000-add-event-manual-override-flag.js",
        satisfied: events.has("is_manual_override")
      },
      {
        name: "20260310010000-add-event-note.js",
        satisfied: events.has("note")
      }
    ];

    for (const candidate of candidates) {
      if (!candidate.satisfied || applied.has(candidate.name)) {
        continue;
      }

      await sqliteRun(database, 'INSERT INTO "SequelizeMeta" (name) VALUES (?)', [candidate.name]);
      reconciled.push(candidate.name);
    }

    return reconciled;
  } finally {
    await closeSqliteDatabase(database);
  }
}

function readPositiveInt(value, fallback) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: process.env
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function waitForDatabase(databaseUrl, retries, retryMs) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const probe = new Sequelize(databaseUrl, {
      dialect: "postgres",
      logging: false
    });

    try {
      await probe.authenticate();
      await probe.close();
      console.log(`Database is ready after ${attempt} attempt(s).`);
      return;
    } catch (error) {
      await probe.close().catch(() => {});

      if (attempt >= retries) {
        throw new Error(`Database readiness check failed after ${retries} attempts: ${error.message}`);
      }

      console.log(`Database not ready (attempt ${attempt}/${retries}): ${error.message}`);
      await delay(retryMs);
    }
  }
}

function validateProductionEnvironment(env = process.env) {
  if (env.NODE_ENV !== "production") {
    return null;
  }

  return readRequiredProductionEnv(env);
}

async function run(env = process.env) {
  validateProductionEnvironment(env);

  const migrationTarget = resolveMigrationTarget(env);

  const retries = readPositiveInt(env.STARTUP_DB_MAX_RETRIES, 30);
  const retryMs = readPositiveInt(env.STARTUP_DB_RETRY_MS, 2000);

  if (migrationTarget.waitForDatabase) {
    console.log("Waiting for database readiness...");
    await waitForDatabase(env.DATABASE_URL, retries, retryMs);
  }

  const reconciled = await reconcileLocalSqliteMigrationMeta(env);
  if (reconciled.length > 0) {
    console.log(`Reconciled local sqlite migration history: ${reconciled.join(", ")}`);
  }

  console.log("Running migrations...");
  await runCommand(migrationTarget.command, migrationTarget.args);

  console.log("Starting API server...");
  await runCommand(process.execPath, ["src/api/server.js"]);
}

function handleStartupError(error) {
  if (error instanceof ProductionEnvValidationError) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  console.error("Startup failed:", error.message);
  process.exitCode = 1;
}

if (require.main === module) {
  run().catch(handleStartupError);
}

module.exports = {
  run,
  runCommand,
  resolveMigrationTarget,
  reconcileLocalSqliteMigrationMeta,
  waitForDatabase,
  handleStartupError,
  readPositiveInt,
  validateProductionEnvironment
};
