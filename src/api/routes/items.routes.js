"use strict";

const express = require("express");
const { createItem } = require("../../domain/items/create-item");

function createItemsRouter() {
  const router = express.Router();

  router.post("/items", async (req, res, next) => {
    try {
      const created = await createItem(req.body);
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = {
  createItemsRouter
};
