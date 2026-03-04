"use strict";

const { spawn } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");
const { Sequelize } = require("sequelize");
const {
  readRequiredProductionEnv,
  ProductionEnvValidationError
} = require("../config/production-env");

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

  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for startup migrations.");
  }

  const retries = readPositiveInt(env.STARTUP_DB_MAX_RETRIES, 30);
  const retryMs = readPositiveInt(env.STARTUP_DB_RETRY_MS, 2000);
  const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

  console.log("Waiting for database readiness...");
  await waitForDatabase(databaseUrl, retries, retryMs);

  console.log("Running migrations...");
  await runCommand(npxCommand, ["sequelize-cli", "db:migrate", "--url", databaseUrl]);

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
  waitForDatabase,
  handleStartupError,
  readPositiveInt,
  validateProductionEnvironment
};
