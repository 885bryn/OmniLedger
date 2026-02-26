"use strict";

const { models } = require("../../db");
const { buildScopeContext } = require("./scope-context");

function resolveSessionUserId(req) {
  const sessionUserId = req.session && req.session.userId;
  return typeof sessionUserId === "string" ? sessionUserId.trim() : "";
}

function destroySession(req) {
  return new Promise((resolve) => {
    if (!req.session || typeof req.session.destroy !== "function") {
      resolve();
      return;
    }

    req.session.destroy(() => {
      resolve();
    });
  });
}

async function resolveActor(userId) {
  const user = await models.User.findByPk(userId, {
    attributes: ["id", "role"]
  });

  if (!user) {
    return null;
  }

  const raw = user.get({ plain: true });
  return {
    userId: raw.id,
    role: raw.role === "admin" ? "admin" : "user"
  };
}

async function requireAuth(req, res, next) {
  try {
    const sessionUserId = resolveSessionUserId(req);

    if (!sessionUserId) {
      res.status(401).json({
        error: {
          code: "authentication_required",
          message: "Authentication required."
        }
      });
      return;
    }

    const actor = await resolveActor(sessionUserId);
    if (!actor) {
      await destroySession(req);
      res.status(401).json({
        error: {
          code: "authentication_required",
          message: "Authentication required."
        }
      });
      return;
    }

    req.actor = {
      userId: actor.userId,
      role: actor.role
    };

    req.scope = buildScopeContext({
      actorUserId: actor.userId,
      actorRole: actor.role
    });

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  requireAuth
};
