"use strict";

const session = require("express-session");
const ConnectSessionSequelize = require("connect-session-sequelize");
const { sequelize } = require("../../db");

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

let sharedStore = null;

function isSequelizeCompatible(value) {
  return Boolean(value) && typeof value.define === "function";
}

function resolveSessionSecret() {
  if (typeof process.env.SESSION_SECRET === "string" && process.env.SESSION_SECRET.trim().length > 0) {
    return process.env.SESSION_SECRET;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be configured in production.");
  }

  return "development-session-secret";
}

function resolveCookieMaxAgeMs() {
  const configured = Number(process.env.SESSION_MAX_AGE_MS);

  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }

  return ONE_WEEK_MS;
}

function parseBooleanEnv(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }

  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }

  return null;
}

function resolveCookieSecure() {
  const override = parseBooleanEnv(process.env.SESSION_COOKIE_SECURE);

  if (override !== null) {
    return override;
  }

  return process.env.NODE_ENV === "production";
}

function getSessionStore() {
  if (!isSequelizeCompatible(sequelize)) {
    return null;
  }

  if (sharedStore) {
    return sharedStore;
  }

  const SequelizeStore = ConnectSessionSequelize(session.Store);
  sharedStore = new SequelizeStore({
    db: sequelize,
    tableName: "Sessions",
    checkExpirationInterval: 15 * 60 * 1000,
    expiration: resolveCookieMaxAgeMs()
  });

  sharedStore.sync();

  return sharedStore;
}

function createSessionOptions() {
  const maxAge = resolveCookieMaxAgeMs();
  const store = getSessionStore();

  return {
    name: "hact.sid",
    secret: resolveSessionSecret(),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    proxy: process.env.NODE_ENV === "production",
    store: store || undefined,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: resolveCookieSecure(),
      maxAge
    }
  };
}

function createSessionMiddleware() {
  return session(createSessionOptions());
}

module.exports = {
  createSessionOptions,
  createSessionMiddleware
};
