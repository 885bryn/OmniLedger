"use strict";

const ROLE_USER = "user";
const ROLE_ADMIN = "admin";
const SCOPE_MODE_OWNER = "owner";
const SCOPE_MODE_ALL = "all";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeScope(scopeInput) {
  return scopeInput && typeof scopeInput === "object" ? scopeInput : {};
}

function normalizeActorRole(role) {
  return role === ROLE_ADMIN ? ROLE_ADMIN : ROLE_USER;
}

function normalizeMode(mode) {
  return mode === SCOPE_MODE_OWNER ? SCOPE_MODE_OWNER : SCOPE_MODE_ALL;
}

function normalizeSessionScope(scope) {
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) {
    return {
      mode: SCOPE_MODE_ALL,
      lensUserId: null
    };
  }

  const mode = normalizeMode(scope.mode);
  const lensUserId = normalizeString(scope.lensUserId || scope.lens_user_id) || null;

  if (mode === SCOPE_MODE_ALL) {
    return {
      mode,
      lensUserId: null
    };
  }

  return {
    mode,
    lensUserId
  };
}

function buildScopeContext(input) {
  const actorUserId = input && input.actorUserId;
  const actorRole = normalizeActorRole(input && input.actorRole);
  const isAdmin = actorRole === ROLE_ADMIN;

  if (!isAdmin) {
    return {
      actorUserId,
      actorRole,
      mode: SCOPE_MODE_OWNER,
      lensUserId: actorUserId
    };
  }

  const sessionScope = normalizeSessionScope(input && input.sessionScope);
  const mode = sessionScope.mode;
  const lensUserId = mode === SCOPE_MODE_OWNER ? sessionScope.lensUserId : null;

  if (mode === SCOPE_MODE_OWNER && !lensUserId) {
    return {
      actorUserId,
      actorRole,
      mode: SCOPE_MODE_ALL,
      lensUserId: null
    };
  }

  return {
    actorUserId,
    actorRole,
    mode,
    lensUserId
  };
}

function resolveOwnerFilter(scopeInput) {
  const scope = normalizeScope(scopeInput);
  const actorRole = normalizeActorRole(scope.actorRole);
  const actorUserId = normalizeString(scope.actorUserId);

  if (actorRole !== ROLE_ADMIN) {
    return actorUserId || null;
  }

  const mode = normalizeMode(scope.mode);
  if (mode === SCOPE_MODE_ALL) {
    return null;
  }

  const lensUserId = normalizeString(scope.lensUserId);
  return lensUserId || null;
}

function canAccessOwner(scopeInput, ownerUserIdInput) {
  const ownerUserId = normalizeString(ownerUserIdInput);
  if (!ownerUserId) {
    return false;
  }

  const scope = normalizeScope(scopeInput);
  const actorRole = normalizeActorRole(scope.actorRole);

  if (actorRole !== ROLE_ADMIN) {
    const actorUserId = normalizeString(scope.actorUserId);
    return actorUserId !== "" && actorUserId === ownerUserId;
  }

  const mode = normalizeMode(scope.mode);
  if (mode === SCOPE_MODE_ALL) {
    return true;
  }

  const lensUserId = normalizeString(scope.lensUserId);
  return lensUserId !== "" && lensUserId === ownerUserId;
}

module.exports = {
  ROLE_ADMIN,
  ROLE_USER,
  SCOPE_MODE_ALL,
  SCOPE_MODE_OWNER,
  buildScopeContext,
  canAccessOwner,
  resolveOwnerFilter
};
