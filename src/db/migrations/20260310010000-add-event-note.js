"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Events", "note", {
      type: Sequelize.STRING(280),
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Events", "note");
  }
};
