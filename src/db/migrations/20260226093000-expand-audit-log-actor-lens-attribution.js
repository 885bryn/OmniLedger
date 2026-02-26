"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("AuditLog", "actor_user_id", {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: "Users",
        key: "id"
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE"
    });

    await queryInterface.addColumn("AuditLog", "lens_user_id", {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: "Users",
        key: "id"
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });

    await queryInterface.sequelize.query(`
      UPDATE "AuditLog"
      SET actor_user_id = user_id
      WHERE actor_user_id IS NULL
    `);

    await queryInterface.sequelize.query(`
      UPDATE "AuditLog"
      SET lens_user_id = user_id
      WHERE lens_user_id IS NULL
    `);

    await queryInterface.changeColumn("AuditLog", "actor_user_id", {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: "Users",
        key: "id"
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE"
    });

    await queryInterface.addIndex("AuditLog", ["actor_user_id", "timestamp"], {
      name: "audit_log_actor_timestamp_idx"
    });

    await queryInterface.addIndex("AuditLog", ["lens_user_id", "timestamp"], {
      name: "audit_log_lens_timestamp_idx"
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("AuditLog", "audit_log_lens_timestamp_idx");
    await queryInterface.removeIndex("AuditLog", "audit_log_actor_timestamp_idx");
    await queryInterface.removeColumn("AuditLog", "lens_user_id");
    await queryInterface.removeColumn("AuditLog", "actor_user_id");
  }
};
