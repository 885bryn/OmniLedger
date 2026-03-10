"use strict";

const ROLE_USER = "user";
const ROLE_ADMIN = "admin";

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getConfiguredAdminEmail() {
  const candidates = [process.env.HACT_ADMIN_EMAIL, process.env.ADMIN_EMAIL];

  for (const value of candidates) {
    const normalized = normalizeEmail(value);
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable("Users");

    if (!columns.role) {
      await queryInterface.addColumn("Users", "role", {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: ROLE_USER
      });
    }

    await queryInterface.sequelize.query(
      `UPDATE "Users" SET "role" = :roleUser WHERE "role" IS NULL`,
      {
        replacements: { roleUser: ROLE_USER }
      }
    );

    const configuredAdminEmail = getConfiguredAdminEmail();
    if (configuredAdminEmail) {
      await queryInterface.sequelize.query(
        `
        UPDATE "Users"
        SET "role" = CASE
          WHEN "email_normalized" = :adminEmail THEN :roleAdmin
          ELSE :roleUser
        END
      `,
        {
          replacements: {
            adminEmail: configuredAdminEmail,
            roleAdmin: ROLE_ADMIN,
            roleUser: ROLE_USER
          }
        }
      );
    }

    await queryInterface.changeColumn("Users", "role", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: ROLE_USER
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Users", "role");
  }
};
