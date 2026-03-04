"use strict";

const REQUIRED_PRODUCTION_KEYS = Object.freeze([
  "NAS_STATIC_IP",
  "HACT_ADMIN_EMAIL",
  "DB_PASSWORD"
]);

const PORTAINER_HINTS = Object.freeze({
  NAS_STATIC_IP: "Set Portainer stack env NAS_STATIC_IP to your NAS LAN IPv4 address.",
  HACT_ADMIN_EMAIL: "Set Portainer stack env HACT_ADMIN_EMAIL to the operator admin email.",
  DB_PASSWORD: "Set Portainer stack env DB_PASSWORD to a strong secret value."
});

const SECRET_PLACEHOLDER_VALUES = new Set([
  "changeme",
  "change-me",
  "change_me",
  "password",
  "postgres",
  "secret",
  "your_db_password",
  "db_password",
  "example",
  "test"
]);

function normalizeValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isIpv4Address(value) {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(value)) {
    return false;
  }

  const octets = value.split(".");
  return octets.every((octet) => {
    const numeric = Number(octet);
    return Number.isInteger(numeric) && numeric >= 0 && numeric <= 255;
  });
}

function isEmailAddress(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isSecretPlaceholder(value) {
  const lowered = value.toLowerCase();
  if (SECRET_PLACEHOLDER_VALUES.has(lowered)) {
    return true;
  }

  return lowered.includes("placeholder") || lowered.includes("replace") || lowered.includes("your_");
}

function formatIssues(issues) {
  return [
    "Production environment validation failed:",
    ...issues.map((issue, index) => `${index + 1}. ${issue.key}: ${issue.reason} ${issue.hint}`)
  ].join("\n");
}

class ProductionEnvValidationError extends Error {
  constructor(issues) {
    super(formatIssues(issues));
    this.name = "ProductionEnvValidationError";
    this.issues = issues;
  }
}

function buildIssue(key, reason) {
  return {
    key,
    reason,
    hint: PORTAINER_HINTS[key]
  };
}

function readRequiredProductionEnv(env = process.env) {
  const values = {
    NAS_STATIC_IP: normalizeValue(env.NAS_STATIC_IP),
    HACT_ADMIN_EMAIL: normalizeValue(env.HACT_ADMIN_EMAIL),
    DB_PASSWORD: normalizeValue(env.DB_PASSWORD)
  };

  const issues = [];

  for (const key of REQUIRED_PRODUCTION_KEYS) {
    if (!values[key]) {
      issues.push(buildIssue(key, "missing required value."));
    }
  }

  if (values.NAS_STATIC_IP && !isIpv4Address(values.NAS_STATIC_IP)) {
    issues.push(buildIssue("NAS_STATIC_IP", "invalid IPv4 address format."));
  }

  if (values.HACT_ADMIN_EMAIL && !isEmailAddress(values.HACT_ADMIN_EMAIL)) {
    issues.push(buildIssue("HACT_ADMIN_EMAIL", "invalid email format."));
  }

  if (values.DB_PASSWORD && isSecretPlaceholder(values.DB_PASSWORD)) {
    issues.push(buildIssue("DB_PASSWORD", "placeholder-like secret is not allowed."));
  }

  if (issues.length > 0) {
    throw new ProductionEnvValidationError(issues);
  }

  return {
    nasStaticIp: values.NAS_STATIC_IP,
    adminEmail: values.HACT_ADMIN_EMAIL.toLowerCase(),
    dbPassword: values.DB_PASSWORD
  };
}

module.exports = {
  readRequiredProductionEnv,
  ProductionEnvValidationError
};
