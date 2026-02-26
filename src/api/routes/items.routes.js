"use strict";

const express = require("express");
const { requireAuth } = require("../auth/require-auth");
const { createItem } = require("../../domain/items/create-item");
const { getItemNetStatus } = require("../../domain/items/get-item-net-status");
const { listItems } = require("../../domain/items/list-items");
const { updateItem } = require("../../domain/items/update-item");
const { softDeleteItem } = require("../../domain/items/soft-delete-item");
const { getItemActivity } = require("../../domain/items/get-item-activity");

function parseBoolean(value) {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function createItemsRouter() {
  const router = express.Router();

  router.use(requireAuth);

  router.post("/items", async (req, res, next) => {
    try {
      const payload = req.body && typeof req.body === "object" ? req.body : {};
      const { user_id: _ignoredUserId, ...safePayload } = payload;

      const created = await createItem({
        ...safePayload,
        scope: req.scope
      });
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  router.get("/items", async (req, res, next) => {
    try {
      const listed = await listItems({
        scope: req.scope,
        search: req.query.search,
        filter: req.query.filter,
        sort: req.query.sort,
        includeDeleted: parseBoolean(req.query.include_deleted)
      });

      res.status(200).json(listed);
    } catch (error) {
      next(error);
    }
  });

  router.get("/items/:id/net-status", async (req, res, next) => {
    try {
      const netStatus = await getItemNetStatus({
        itemId: req.params.id,
        actorUserId: req.actor.userId
      });

      res.status(200).json(netStatus);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/items/:id", async (req, res, next) => {
    try {
      const updated = await updateItem({
        itemId: req.params.id,
        scope: req.scope,
        attributes: req.body && req.body.attributes
      });

      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/items/:id", async (req, res, next) => {
    try {
      const deleted = await softDeleteItem({
        itemId: req.params.id,
        scope: req.scope
      });

      res.status(200).json(deleted);
    } catch (error) {
      next(error);
    }
  });

  router.get("/items/:id/activity", async (req, res, next) => {
    try {
      const activity = await getItemActivity({
        itemId: req.params.id,
        actorUserId: req.actor.userId,
        limit: req.query.limit
      });

      res.status(200).json(activity);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = {
  createItemsRouter
};
