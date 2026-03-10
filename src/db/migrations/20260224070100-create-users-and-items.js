"use strict";

const ITEM_TYPES = ["RealEstate", "Vehicle", "FinancialCommitment"];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Users", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true
      },
      username: {
        type: Sequelize.STRING,
        allowNull: false
      },
      username_normalized: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false
      },
      email_normalized: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      password_hash: {
        type: Sequelize.STRING,
        allowNull: false
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
      }
    });

    await queryInterface.createTable("Items", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      item_type: {
        type: Sequelize.ENUM(...ITEM_TYPES),
        allowNull: false
      },
      attributes: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {}
      },
      parent_item_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "Items",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
      }
    });

    await queryInterface.addIndex("Items", ["parent_item_id"], {
      name: "items_parent_item_id_idx"
    });

    if (queryInterface.sequelize.getDialect() === "postgres") {
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable("Items");
    await queryInterface.dropTable("Users");

    if (queryInterface.sequelize.getDialect() === "postgres") {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Items_item_type";');
    }
  }
};
