"use strict";

const LOCAL_FRONTEND_ORIGINS = Object.freeze([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174"
]);

function normalizeOrigin(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\/+$/, "");
}

function parseFrontendOrigins(rawValue) {
  if (typeof rawValue !== "string") {
    return [];
  }

  return rawValue
    .split(",")
    .map((value) => normalizeOrigin(value))
    .filter(Boolean);
}

function resolveNasFrontendOrigin(env) {
  const nasStaticIp = typeof env.NAS_STATIC_IP === "string" ? env.NAS_STATIC_IP.trim() : "";
  if (!nasStaticIp) {
    return null;
  }

  const frontendPort = typeof env.FRONTEND_PORT === "string" && env.FRONTEND_PORT.trim().length > 0
    ? env.FRONTEND_PORT.trim()
    : "8085";

  return `http://${nasStaticIp}:${frontendPort}`;
}

function resolveNetworkTargets(options = {}) {
  const env = options.env || process.env;
  const nodeEnv = typeof env.NODE_ENV === "string" ? env.NODE_ENV.trim() : "";
  const isProduction = nodeEnv === "production";
  const configuredOrigins = parseFrontendOrigins(env.FRONTEND_ORIGIN);

  if (!isProduction) {
    const allowedOrigins = configuredOrigins.length > 0 ? configuredOrigins : [...LOCAL_FRONTEND_ORIGINS];

    return {
      isProduction,
      allowedOrigins,
      fallbackOrigin: allowedOrigins[0] || LOCAL_FRONTEND_ORIGINS[0],
      allowDevNetworkOrigins: true
    };
  }

  const derivedNasOrigin = resolveNasFrontendOrigin(env);
  const allowedOrigins = configuredOrigins.length > 0
    ? configuredOrigins
    : (derivedNasOrigin ? [derivedNasOrigin] : []);

  return {
    isProduction,
    allowedOrigins,
    fallbackOrigin: allowedOrigins[0] || null,
    allowDevNetworkOrigins: false
  };
}

module.exports = {
  resolveNetworkTargets
};
