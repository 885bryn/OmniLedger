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
let createExportsRouter = () => express.Router();

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

try {
  ({ createExportsRouter } = require("./routes/exports.routes"));
} catch (error) {
  const isMissingExportsRouter = error && error.code === "MODULE_NOT_FOUND" && /exports\.routes/.test(error.message);

  if (!isMissingExportsRouter) {
    throw error;
  }
}

function resolveAllowedOrigins() {
  if (typeof process.env.FRONTEND_ORIGIN === "string" && process.env.FRONTEND_ORIGIN.trim().length > 0) {
    const configured = process.env.FRONTEND_ORIGIN.split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (configured.length > 0) {
      return configured;
    }
  }

  return [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174"
  ];
}

function isDevOriginAllowed(origin) {
  if (typeof origin !== "string" || origin.length === 0) {
    return false;
  }

  try {
    const parsed = new URL(origin);
    const host = parsed.hostname;

    if (host === "localhost" || host === "127.0.0.1") {
      return true;
    }

    if (/^192\.168\./.test(host) || /^10\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) {
      return true;
    }

    return false;
  } catch (error) {
    return false;
  }
}

function createApp() {
  const app = express();
  const allowedOrigins = new Set(resolveAllowedOrigins());
  const fallbackOrigin = [...allowedOrigins][0] || "http://localhost:5173";
  const allowedHeaders = "Content-Type, Accept";

  app.disable("x-powered-by");
  app.use((req, res, next) => {
    const requestOrigin = typeof req.headers.origin === "string" ? req.headers.origin : "";
    const hasRequestOrigin = requestOrigin.length > 0;
    const allowRequestedOrigin = hasRequestOrigin && (allowedOrigins.has(requestOrigin) || isDevOriginAllowed(requestOrigin));

    if (allowRequestedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", requestOrigin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
    } else if (!hasRequestOrigin) {
      res.setHeader("Access-Control-Allow-Origin", fallbackOrigin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
    }

    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", allowedHeaders);

    if (req.method === "OPTIONS") {
      if (hasRequestOrigin && !allowRequestedOrigin) {
        res.status(403).json({
          error: {
            code: "origin_not_allowed",
            message: "Request origin is not allowed for this API."
          }
        });
        return;
      }

      res.status(204).end();
      return;
    }

    next();
  });
  app.use(createSessionMiddleware());
  app.use(express.json());
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

  app.use("/auth", createAuthRouter());
  app.use("/", createItemsRouter());
  app.use("/", createEventsRouter());
  app.use("/", createUsersRouter());
  app.use("/", createExportsRouter());

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
