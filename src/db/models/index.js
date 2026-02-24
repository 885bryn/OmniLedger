"use strict";

const { User } = require("./user.model");
const { Item } = require("./item.model");
const { Event } = require("./event.model");
const { AuditLog } = require("./audit-log.model");

function registerModels(sequelize) {
  const models = {
    User: User.initModel(sequelize),
    Item: Item.initModel(sequelize),
    Event: Event.initModel(sequelize),
    AuditLog: AuditLog.initModel(sequelize)
  };

  Object.values(models).forEach((model) => {
    if (typeof model.associate === "function") {
      model.associate(models);
    }
  });

  return models;
}

module.exports = {
  registerModels
};
