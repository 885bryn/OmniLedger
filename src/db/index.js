"use strict";

const { Sequelize } = require("sequelize");
const { getDatabaseConfig } = require("../config/database");
const { registerModels } = require("./models");

const databaseConfig = getDatabaseConfig();

const sequelize = databaseConfig.url
  ? new Sequelize(databaseConfig.url, databaseConfig.options)
  : new Sequelize(databaseConfig.options);

const models = registerModels(sequelize);

module.exports = {
  sequelize,
  models
};
