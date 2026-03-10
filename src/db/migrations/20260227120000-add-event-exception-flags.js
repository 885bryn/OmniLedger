"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable("Events");

    if (!columns.is_exception) {
      await queryInterface.addColumn("Events", "is_exception", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Events", "is_exception");
  }
};
