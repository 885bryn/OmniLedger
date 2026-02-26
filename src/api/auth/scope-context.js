"use strict";

const ROLE_USER = "user";
const ROLE_ADMIN = "admin";

function normalizeActorRole(role) {
  return role === ROLE_ADMIN ? ROLE_ADMIN : ROLE_USER;
}

function buildScopeContext(input) {
  const actorUserId = input && input.actorUserId;
  const actorRole = normalizeActorRole(input && input.actorRole);
  const isAdmin = actorRole === ROLE_ADMIN;

  return {
    actorUserId,
    actorRole,
    mode: isAdmin ? "all" : "owner",
    lensUserId: isAdmin ? null : actorUserId
  };
}

module.exports = {
  buildScopeContext
};
