"use strict";

const express = require("express");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { models } = require("../../db");
const { registerUser, RegisterUserError } = require("../../domain/auth/register-user");
const { authenticateUser } = require("../../domain/auth/authenticate-user");

const ROLE_USER = "user";
const ROLE_ADMIN = "admin";

const INVALID_CREDENTIALS_BODY = Object.freeze({
  error: {
    code: "invalid_credentials",
    message: "Invalid email or password.",
    cooldown: null
  }
});

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getConfiguredAdminEmail() {
  const candidates = [process.env.HACT_ADMIN_EMAIL, process.env.ADMIN_EMAIL];

  for (const value of candidates) {
    const normalized = normalizeEmail(value);
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function resolveExpectedRole(rawUser, configuredAdminEmail) {
  if (!configuredAdminEmail) {
    return rawUser.role || ROLE_USER;
  }

  return rawUser.email_normalized === configuredAdminEmail ? ROLE_ADMIN : ROLE_USER;
}

function getRetryAfterSeconds(rateLimitInfo, fallbackMs) {
  if (rateLimitInfo && rateLimitInfo.resetTime) {
    const resetTime = new Date(rateLimitInfo.resetTime).getTime();
    const seconds = Math.ceil((resetTime - Date.now()) / 1000);
    return Math.max(seconds, 1);
  }

  return Math.max(Math.ceil(fallbackMs / 1000), 1);
}

function createLoginLimiter() {
  const windowMs = 10 * 60 * 1000;

  return rateLimit({
    windowMs,
    limit: 5,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator(req) {
      const email = normalizeEmail(req.body && req.body.email);
      return `${ipKeyGenerator(req.ip)}:${email || "anonymous"}`;
    },
    handler(req, res) {
      const retryAfterSeconds = getRetryAfterSeconds(req.rateLimit, windowMs);
      res.status(429).json({
        error: {
          code: "auth_cooldown",
          message: "Too many failed sign in attempts. Please wait before trying again.",
          cooldown: {
            retry_after_seconds: retryAfterSeconds
          }
        }
      });
    }
  });
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function destroySession(req) {
  return new Promise((resolve, reject) => {
    if (!req.session) {
      resolve();
      return;
    }

    req.session.destroy((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function setAuthenticatedSession(req, userId) {
  await regenerateSession(req);
  req.session.userId = userId;
  req.session.authenticatedAt = new Date().toISOString();
  await saveSession(req);
}

async function resolveSessionUser(req) {
  if (!req.session || typeof req.session.userId !== "string") {
    return null;
  }

  const user = await models.User.findByPk(req.session.userId, {
    attributes: ["id", "username", "email", "email_normalized", "role", "created_at", "updated_at"]
  });

  if (!user) {
    await destroySession(req);
    return null;
  }

  const raw = user.get({ plain: true });
  const configuredAdminEmail = getConfiguredAdminEmail();
  const expectedRole = resolveExpectedRole(raw, configuredAdminEmail);

  if (raw.role !== expectedRole) {
    await user.update({ role: expectedRole }, { fields: ["role"] });
    raw.role = expectedRole;
  }

  return {
    id: raw.id,
    username: raw.username,
    email: raw.email,
    role: raw.role,
    created_at: raw.created_at || raw.createdAt,
    updated_at: raw.updated_at || raw.updatedAt
  };
}

function toAuthenticatedResponse(user) {
  return {
    user,
    session: {
      authenticated: true
    }
  };
}

function createAuthRouter() {
  const router = express.Router();
  const loginLimiter = createLoginLimiter();

  router.post("/register", async (req, res, next) => {
    try {
      const user = await registerUser(req.body || {});
      await setAuthenticatedSession(req, user.id);
      const sessionUser = await resolveSessionUser(req);

      res.status(201).json(toAuthenticatedResponse(sessionUser));
    } catch (error) {
      if (error instanceof RegisterUserError) {
        res.status(422).json({
          error: {
            code: error.code,
            message: error.message
          }
        });
        return;
      }

      next(error);
    }
  });

  router.post("/login", loginLimiter, async (req, res, next) => {
    try {
      const result = await authenticateUser(req.body || {});

      if (!result.authenticated) {
        res.status(401).json(INVALID_CREDENTIALS_BODY);
        return;
      }

      await setAuthenticatedSession(req, result.user.id);
      const sessionUser = await resolveSessionUser(req);

      res.status(200).json(toAuthenticatedResponse(sessionUser));
    } catch (error) {
      next(error);
    }
  });

  router.post("/logout", async (req, res, next) => {
    try {
      await destroySession(req);
      res.clearCookie("hact.sid");
      res.status(200).json({
        session: {
          authenticated: false
        }
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/session", async (req, res, next) => {
    try {
      const user = await resolveSessionUser(req);
      res.status(200).json({
        user,
        session: {
          authenticated: Boolean(user)
        }
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = {
  createAuthRouter
};
