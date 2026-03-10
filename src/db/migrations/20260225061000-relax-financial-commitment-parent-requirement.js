"use strict";

module.exports = {
  async up(queryInterface) {
    if (queryInterface.sequelize.getDialect() !== "postgres") {
      return;
    }

    await queryInterface.sequelize.query('ALTER TABLE "Items" DROP CONSTRAINT IF EXISTS "items_financial_commitment_requires_parent";');
  },

  async down(queryInterface, Sequelize) {
    if (queryInterface.sequelize.getDialect() !== "postgres") {
      return;
    }

    await queryInterface.addConstraint("Items", {
      fields: ["item_type", "parent_item_id"],
      type: "check",
      name: "items_financial_commitment_requires_parent",
      where: {
        [Sequelize.Op.or]: [
          { item_type: { [Sequelize.Op.ne]: "FinancialCommitment" } },
          { parent_item_id: { [Sequelize.Op.ne]: null } }
        ]
      }
    });
  }
};
