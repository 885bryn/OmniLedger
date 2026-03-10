"use strict";

const FINANCIAL_SUBTYPES = ["Commitment", "Income"];
const FINANCIAL_FREQUENCIES = ["one_time", "weekly", "monthly", "yearly"];
const FINANCIAL_STATUSES = ["Active", "Closed"];

async function addPostgresEnumValue(queryInterface, enumName, value) {
  await queryInterface.sequelize.query(`ALTER TYPE "${enumName}" ADD VALUE IF NOT EXISTS '${value}';`);
}

async function hasIndex(queryInterface, tableName, indexName) {
  const indexes = await queryInterface.showIndex(tableName);
  return indexes.some((index) => index && index.name === indexName);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    const columns = await queryInterface.describeTable("Items");

    if (dialect === "postgres") {
      await addPostgresEnumValue(queryInterface, "enum_Items_item_type", "FinancialItem");
    }

    if (!columns.title) {
      await queryInterface.addColumn("Items", "title", {
        type: Sequelize.STRING,
        allowNull: true
      });
    }

    if (!columns.type) {
      await queryInterface.addColumn("Items", "type", {
        type: Sequelize.ENUM(...FINANCIAL_SUBTYPES),
        allowNull: true
      });
    }

    if (!columns.frequency) {
      await queryInterface.addColumn("Items", "frequency", {
        type: Sequelize.ENUM(...FINANCIAL_FREQUENCIES),
        allowNull: true
      });
    }

    if (!columns.default_amount) {
      await queryInterface.addColumn("Items", "default_amount", {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true
      });
    }

    if (!columns.status) {
      await queryInterface.addColumn("Items", "status", {
        type: Sequelize.ENUM(...FINANCIAL_STATUSES),
        allowNull: true
      });
    }

    if (!columns.linked_asset_item_id) {
      await queryInterface.addColumn("Items", "linked_asset_item_id", {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "Items",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      });
    }

    if (!(await hasIndex(queryInterface, "Items", "items_linked_asset_item_id_idx"))) {
      await queryInterface.addIndex("Items", ["linked_asset_item_id"], {
        name: "items_linked_asset_item_id_idx"
      });
    }
  },

  async down(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();

    await queryInterface.removeIndex("Items", "items_linked_asset_item_id_idx").catch(() => {});
    await queryInterface.removeColumn("Items", "linked_asset_item_id");
    await queryInterface.removeColumn("Items", "status");
    await queryInterface.removeColumn("Items", "default_amount");
    await queryInterface.removeColumn("Items", "frequency");
    await queryInterface.removeColumn("Items", "type");
    await queryInterface.removeColumn("Items", "title");

    if (dialect === "postgres") {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Items_type";');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Items_frequency";');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Items_status";');
    }
  }
};
