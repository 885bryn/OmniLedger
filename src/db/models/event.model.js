"use strict";

const { DataTypes, Model } = require("sequelize");
const {
  EVENT_STATUSES,
  assertValidDueDate,
  assertNonNegativeAmount,
  assertCompletionTimestamp
} = require("../../domain/events/status-and-completion-rules");

class Event extends Model {
  static initModel(sequelize) {
    Event.init(
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
        item_id: {
          type: DataTypes.UUID,
          allowNull: false,
          validate: {
            isUUID: 4
          }
        },
        event_type: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            notEmpty: true
          }
        },
        due_date: {
          type: DataTypes.DATE,
          allowNull: false,
          validate: {
            validDueDate(value) {
              assertValidDueDate(value);
            }
          }
        },
        amount: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          validate: {
            nonNegativeAmount(value) {
              assertNonNegativeAmount(value);
            }
          }
        },
        status: {
          type: DataTypes.ENUM(...EVENT_STATUSES),
          allowNull: false,
          defaultValue: "Pending",
          validate: {
            isIn: [EVENT_STATUSES]
          }
        },
        is_recurring: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        is_exception: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        is_manual_override: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        completed_at: {
          type: DataTypes.DATE,
          allowNull: true
        }
      },
      {
        sequelize,
        modelName: "Event",
        tableName: "Events",
        underscored: true,
        timestamps: true,
        validate: {
          completionTimestampRequired() {
            assertCompletionTimestamp(this.status, this.completed_at);
          }
        }
      }
    );

    return Event;
  }

  static associate(models) {
    Event.belongsTo(models.Item, {
      as: "item",
      foreignKey: "item_id"
    });
  }
}

module.exports = {
  Event,
  EVENT_STATUSES
};
