"use strict";

const express = require("express");
const { createSessionMiddleware } = require("./auth/session-options");
const { sequelize } = require("../db");
const {
  mapItemCreateError,
  mapItemNetStatusError,
  mapEventCompletionError,
  mapItemQueryError,
  mapEventQueryError
} = require("./errors/http-error-mapper");

let createItemsRouter = () => express.Router();
let createEventsRouter = () => express.Router();
let createUsersRouter = () => express.Router();
let createAuthRouter = () => express.Router();

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

try {
  ({ createUsersRouter } = require("./routes/users.routes"));
} catch (error) {
  const isMissingUsersRouter = error && error.code === "MODULE_NOT_FOUND" && /users\.routes/.test(error.message);

  if (!isMissingUsersRouter) {
    throw error;
  }
}

try {
  ({ createAuthRouter } = require("./routes/auth.routes"));
} catch (error) {
  const isMissingAuthRouter = error && error.code === "MODULE_NOT_FOUND" && /auth\.routes/.test(error.message);

  if (!isMissingAuthRouter) {
    throw error;
  }
}

function resolveAllowedOrigin() {
  if (typeof process.env.FRONTEND_ORIGIN === "string" && process.env.FRONTEND_ORIGIN.trim().length > 0) {
    return process.env.FRONTEND_ORIGIN.trim();
  }

  return "http://localhost:5173";
}

function createApp() {
  const app = express();
  const allowedOrigin = resolveAllowedOrigin();
  const allowedHeaders = "Content-Type, Accept";

  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", allowedHeaders);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    next();
  });
  app.use(createSessionMiddleware());
  app.use(express.json());
  app.use("/auth", createAuthRouter());
  app.use("/", createItemsRouter());
  app.use("/", createEventsRouter());
  app.use("/", createUsersRouter());

  app.get("/health", async (req, res) => {
    try {
      await sequelize.authenticate();
      res.status(200).json({
        status: "ok",
        ready: true
      });
    } catch (error) {
      res.status(503).json({
        status: "unhealthy",
        ready: false,
        error: {
          code: "database_unavailable",
          message: "Database connectivity check failed."
        }
      });
    }
  });

  app.use((error, req, res, next) => {
    const mapped =
      mapItemCreateError(error) ||
      mapItemNetStatusError(error) ||
      mapItemQueryError(error) ||
      mapEventCompletionError(error) ||
      mapEventQueryError(error);

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
