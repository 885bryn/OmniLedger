"use strict";

module.exports = {
  async up(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === "postgres") {
      await queryInterface.sequelize.query("ALTER TYPE \"enum_Items_item_type\" ADD VALUE IF NOT EXISTS 'FinancialIncome';");
    }

    // Legacy cleanup: move any historical Subscription rows into FinancialCommitment.
    await queryInterface.sequelize.query("UPDATE \"Items\" SET item_type = 'FinancialCommitment' WHERE item_type = 'Subscription';");
  },

  async down() {
    // Postgres enum value removal is destructive; intentionally noop.
  }
};
