"use strict";

const { DataTypes, Model } = require("sequelize");
const {
  assertVerbStyleAuditAction,
  assertValidDueDate
} = require("../../domain/events/status-and-completion-rules");

class AuditLog extends Model {
  static initModel(sequelize) {
    AuditLog.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          allowNull: false,
          primaryKey: true,
          validate: {
            isUUID: 4
          }
        },
        user_id: {
          type: DataTypes.UUID,
          allowNull: false,
          validate: {
            isUUID: 4
          }
        },
        action: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            notEmpty: true,
            verbStyle(value) {
              assertVerbStyleAuditAction(value);
            }
          }
        },
        entity: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            notEmpty: true
          }
        },
        timestamp: {
          type: DataTypes.DATE,
          allowNull: false,
          validate: {
            validTimestamp(value) {
              assertValidDueDate(value);
            }
          }
        }
      },
      {
        sequelize,
        modelName: "AuditLog",
        tableName: "AuditLog",
        underscored: true,
        timestamps: true
      }
    );

    return AuditLog;
  }

  static associate(models) {
    AuditLog.belongsTo(models.User, {
      as: "user",
      foreignKey: "user_id"
    });
  }
}

module.exports = {
  AuditLog
};
