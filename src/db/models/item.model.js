"use strict";

const { DataTypes, Model } = require("sequelize");
const { minimumAttributeKeys } = require("../../domain/items/minimum-attribute-keys");

const ITEM_TYPES = Object.freeze(["RealEstate", "Vehicle", "FinancialCommitment", "FinancialIncome", "FinancialItem"]);
const FINANCIAL_SUBTYPES = Object.freeze(["Commitment", "Income"]);
const FINANCIAL_FREQUENCIES = Object.freeze(["one_time", "weekly", "monthly", "yearly"]);
const FINANCIAL_STATUSES = Object.freeze(["Active", "Closed"]);

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
              if (value && typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) === false) {
                throw new Error("parent_item_id must be a valid UUID");
              }
            }
          }
        },
        title: {
          type: DataTypes.STRING,
          allowNull: true,
          validate: {
            notEmptyIfPresent(value) {
              if (value !== null && value !== undefined && String(value).trim() === "") {
                throw new Error("title cannot be empty");
              }
            }
          }
        },
        type: {
          type: DataTypes.ENUM(...FINANCIAL_SUBTYPES),
          allowNull: true,
          validate: {
            isIn: [FINANCIAL_SUBTYPES]
          }
        },
        frequency: {
          type: DataTypes.ENUM(...FINANCIAL_FREQUENCIES),
          allowNull: true,
          validate: {
            isIn: [FINANCIAL_FREQUENCIES]
          }
        },
        default_amount: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: true,
          validate: {
            min: 0
          }
        },
        status: {
          type: DataTypes.ENUM(...FINANCIAL_STATUSES),
          allowNull: true,
          validate: {
            isIn: [FINANCIAL_STATUSES]
          }
        },
        linked_asset_item_id: {
          type: DataTypes.UUID,
          allowNull: true,
          validate: {
            isUuidIfPresent(value) {
              if (value && typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) === false) {
                throw new Error("linked_asset_item_id must be a valid UUID");
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
        timestamps: true,
        validate: {
          financialContractRequiredFields() {
            if (this.item_type !== "FinancialItem") {
              return;
            }

            if (!this.title || String(this.title).trim() === "") {
              throw new Error("title is required for FinancialItem");
            }

            if (!this.type) {
              throw new Error("type is required for FinancialItem");
            }

            if (!this.frequency) {
              throw new Error("frequency is required for FinancialItem");
            }

            if (this.default_amount === null || this.default_amount === undefined || Number(this.default_amount) < 0) {
              throw new Error("default_amount is required for FinancialItem");
            }

            if (!this.status) {
              throw new Error("status is required for FinancialItem");
            }
          }
        }
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

    Item.belongsTo(Item, {
      as: "linkedAssetItem",
      foreignKey: "linked_asset_item_id",
      onDelete: "SET NULL",
      onUpdate: "CASCADE"
    });
  }
}

module.exports = {
  Item,
  ITEM_TYPES
};
