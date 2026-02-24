"use strict";

const { DataTypes, Model } = require("sequelize");
const { minimumAttributeKeys } = require("../../domain/items/minimum-attribute-keys");

const ITEM_TYPES = Object.freeze(["RealEstate", "Vehicle", "FinancialCommitment", "Subscription"]);

function isIsoDateLike(value) {
  return Number.isNaN(new Date(value).getTime()) === false;
}

class Item extends Model {
  static initModel(sequelize) {
    Item.init(
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
        item_type: {
          type: DataTypes.ENUM(...ITEM_TYPES),
          allowNull: false,
          validate: {
            isIn: [ITEM_TYPES]
          }
        },
        attributes: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: {},
          validate: {
            minimumKeysByType(value) {
              if (value === null || typeof value !== "object" || Array.isArray(value)) {
                throw new Error("attributes must be a JSON object");
              }

              const requiredKeys = minimumAttributeKeys[this.item_type] || [];
              const missing = requiredKeys.filter((key) => value[key] === undefined || value[key] === null || value[key] === "");

              if (missing.length > 0) {
                throw new Error(`attributes missing minimum keys: ${missing.join(", ")}`);
              }

              if (typeof value.amount === "number" && value.amount < 0) {
                throw new Error("attributes.amount cannot be negative");
              }

              if (typeof value.estimatedValue === "number" && value.estimatedValue < 0) {
                throw new Error("attributes.estimatedValue cannot be negative");
              }

              if (value.dueDate !== undefined && value.dueDate !== null && isIsoDateLike(value.dueDate) === false) {
                throw new Error("attributes.dueDate must be a valid date");
              }
            }
          }
        },
        parent_item_id: {
          type: DataTypes.UUID,
          allowNull: true,
          validate: {
            isParentWhenCommitment(value) {
              if (this.item_type === "FinancialCommitment" && !value) {
                throw new Error("FinancialCommitment requires parent_item_id");
              }

              if (value && typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) === false) {
                throw new Error("parent_item_id must be a valid UUID");
              }
            }
          }
        }
      },
      {
        sequelize,
        modelName: "Item",
        tableName: "Items",
        underscored: true,
        timestamps: true
      }
    );

    return Item;
  }

  static associate(models) {
    Item.belongsTo(models.User, {
      as: "owner",
      foreignKey: "user_id"
    });

    Item.belongsTo(Item, {
      as: "parentItem",
      foreignKey: "parent_item_id",
      onDelete: "RESTRICT",
      onUpdate: "CASCADE"
    });

    Item.hasMany(Item, {
      as: "childCommitments",
      foreignKey: "parent_item_id",
      onDelete: "RESTRICT",
      onUpdate: "CASCADE"
    });
  }
}

module.exports = {
  Item,
  ITEM_TYPES
};
