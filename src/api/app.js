"use strict";

const express = require("express");
const {
  mapItemCreateError,
  mapItemNetStatusError,
  mapEventCompletionError
} = require("./errors/http-error-mapper");

let createItemsRouter = () => express.Router();
let createEventsRouter = () => express.Router();

try {
  ({ createItemsRouter } = require("./routes/items.routes"));
} catch (error) {
  const isMissingItemsRouter = error && error.code === "MODULE_NOT_FOUND" && /items\.routes/.test(error.message);

  if (!isMissingItemsRouter) {
    throw error;
  }
}

try {
  ({ createEventsRouter } = require("./routes/events.routes"));
} catch (error) {
  const isMissingEventsRouter = error && error.code === "MODULE_NOT_FOUND" && /events\.routes/.test(error.message);

  if (!isMissingEventsRouter) {
    throw error;
  }
}

function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json());
  app.use("/", createItemsRouter());
  app.use("/", createEventsRouter());

  app.use((error, req, res, next) => {
    const mapped = mapItemCreateError(error) || mapItemNetStatusError(error) || mapEventCompletionError(error);

    if (!mapped) {
      next(error);
      return;
    }

    res.status(mapped.status).json(mapped.body);
  });

  app.use((req, res) => {
    res.status(404).json({
      error: {
        code: "not_found",
        message: "Route not found."
      }
    });
  });

  return app;
}

module.exports = {
  createApp
};
