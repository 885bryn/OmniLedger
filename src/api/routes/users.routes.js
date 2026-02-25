"use strict";

const express = require("express");
const { requireAuth } = require("../auth/require-auth");
const { models } = require("../../db");

function toTransportUser(userInstance) {
  const raw = userInstance.get({ plain: true });

  return {
    id: raw.id,
    username: raw.username,
    email: raw.email,
    created_at: raw.created_at || raw.createdAt,
    updated_at: raw.updated_at || raw.updatedAt
  };
}

function createUsersRouter() {
  const router = express.Router();

  router.use(requireAuth);

  router.get("/users", async (req, res, next) => {
    try {
      const rows = await models.User.findAll({
        order: [
          ["username_normalized", "ASC"],
          ["created_at", "ASC"],
          ["id", "ASC"]
        ]
      });

      res.status(200).json({
        users: rows.map(toTransportUser),
        total_count: rows.length
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = {
  createUsersRouter
};
