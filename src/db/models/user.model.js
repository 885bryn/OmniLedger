"use strict";

const { DataTypes, Model } = require("sequelize");

class User extends Model {
  static initModel(sequelize) {
    User.init(
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
        username: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            notEmpty: true,
            len: [3, 64]
          }
        },
        username_normalized: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
          validate: {
            notEmpty: true
          }
        },
        email: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            notEmpty: true,
            isEmail: true
          }
        },
        email_normalized: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
          validate: {
            notEmpty: true,
            isEmail: true
          }
        },
        password_hash: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            notEmpty: true,
            len: [8, 255]
          }
        },
        role: {
          type: DataTypes.ENUM("user", "admin"),
          allowNull: false,
          defaultValue: "user",
          validate: {
            isIn: [["user", "admin"]]
          }
        }
      },
      {
        sequelize,
        modelName: "User",
        tableName: "Users",
        underscored: true,
        timestamps: true,
        hooks: {
          beforeValidate(user) {
            if (typeof user.username === "string") {
              user.username = user.username.trim();
              user.username_normalized = user.username.toLowerCase();
            }

            if (typeof user.email === "string") {
              user.email = user.email.trim();
              user.email_normalized = user.email.toLowerCase();
            }
          }
        }
      }
    );

    return User;
  }
}

module.exports = {
  User
};
