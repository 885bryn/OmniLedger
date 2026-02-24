"use strict";

const EVENT_STATUSES = ["Pending", "Completed"];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Events", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true
      },
      item_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Items",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      event_type: {
        type: Sequelize.STRING,
        allowNull: false
      },
      due_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM(...EVENT_STATUSES),
        allowNull: false,
        defaultValue: "Pending"
      },
      is_recurring: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true
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

    await queryInterface.createTable("AuditLog", {
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
      action: {
        type: Sequelize.STRING,
        allowNull: false
      },
      entity: {
        type: Sequelize.STRING,
        allowNull: false
      },
      timestamp: {
        type: Sequelize.DATE,
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

    await queryInterface.addIndex("Events", ["item_id", "due_date"], {
      name: "events_item_due_date_idx"
    });

    await queryInterface.addIndex("Events", ["status"], {
      name: "events_status_idx"
    });

    await queryInterface.addIndex("AuditLog", ["user_id", "timestamp"], {
      name: "audit_log_user_timestamp_idx"
    });

    await queryInterface.addIndex("AuditLog", ["entity", "timestamp"], {
      name: "audit_log_entity_timestamp_idx"
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("AuditLog");
    await queryInterface.dropTable("Events");

    if (queryInterface.sequelize.getDialect() === "postgres") {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Events_status";');
    }
  }
};
