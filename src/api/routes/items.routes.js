"use strict";

const express = require("express");
const { createItem } = require("../../domain/items/create-item");
const { getItemNetStatus } = require("../../domain/items/get-item-net-status");

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

  router.get("/items/:id/net-status", async (req, res, next) => {
    try {
      const netStatus = await getItemNetStatus({
        itemId: req.params.id,
        actorUserId: req.header("x-user-id")
      });

      res.status(200).json(netStatus);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = {
  createItemsRouter
};
