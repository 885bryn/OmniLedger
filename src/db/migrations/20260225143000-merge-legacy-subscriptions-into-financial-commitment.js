"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query("UPDATE \"Items\" SET item_type = 'FinancialCommitment' WHERE item_type = 'Subscription';");
  },

  async down() {
    // No safe automatic rollback. Intentionally noop.
  }
};
