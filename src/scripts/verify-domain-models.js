"use strict";

const { sequelize, models } = require("../db");

const REQUIRED_MODELS = ["User", "Item", "Event", "AuditLog"];

function assertRequiredModels() {
  const missingModels = REQUIRED_MODELS.filter((name) => !models[name]);

  if (missingModels.length > 0) {
    throw new Error(`Missing required models: ${missingModels.join(", ")}`);
  }
}

function assertRequiredAssociations() {
  const requiredAssociations = [
    ["Item", "parentItem"],
    ["Item", "childCommitments"],
    ["Event", "item"],
    ["AuditLog", "user"]
  ];

  const missingAssociations = requiredAssociations.filter(([modelName, associationName]) => {
    return !models[modelName].associations[associationName];
  });

  if (missingAssociations.length > 0) {
    const names = missingAssociations.map(([modelName, associationName]) => `${modelName}.${associationName}`);
    throw new Error(`Missing required associations: ${names.join(", ")}`);
  }
}

async function run() {
  try {
    assertRequiredModels();
    assertRequiredAssociations();

    await sequelize.authenticate();

    for (const modelName of REQUIRED_MODELS) {
      await models[modelName].findOne({ attributes: ["id"] });
    }

    console.log("Domain model verification passed.");
    process.exitCode = 0;
  } catch (error) {
    console.error("Domain model verification failed:", error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

run();
