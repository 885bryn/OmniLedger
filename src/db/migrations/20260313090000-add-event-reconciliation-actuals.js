"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable("Events");

    if (!columns.actual_amount) {
      await queryInterface.addColumn("Events", "actual_amount", {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true
      });
    }

    if (!columns.actual_date) {
      await queryInterface.addColumn("Events", "actual_date", {
        type: Sequelize.DATEONLY,
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable("Events");

    if (columns.actual_date) {
      await queryInterface.removeColumn("Events", "actual_date");
    }

    if (columns.actual_amount) {
      await queryInterface.removeColumn("Events", "actual_amount");
    }
  }
};
