"use strict";

const { models } = require("../../db");

function sanitizeLocalPart(localPart) {
  const normalized = typeof localPart === "string" ? localPart.toLowerCase() : "";
  const alphanumeric = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  if (alphanumeric.length >= 3) {
    return alphanumeric.slice(0, 64);
  }

  if (alphanumeric.length > 0) {
    return `${alphanumeric}usr`.slice(0, 64);
  }

  return "user";
}

function baseFromEmail(email) {
  if (typeof email !== "string") {
    return "user";
  }

  const [localPart] = email.trim().split("@");
  return sanitizeLocalPart(localPart);
}

async function usernameFromEmail(email) {
  const base = baseFromEmail(email);
  let attempt = 0;

  while (attempt < 1000) {
    const suffix = attempt === 0 ? "" : String(attempt + 1);
    const maxBaseLength = 64 - suffix.length;
    const candidate = `${base.slice(0, maxBaseLength)}${suffix}`;
    const existing = await models.User.findOne({
      where: {
        username_normalized: candidate
      },
      attributes: ["id"]
    });

    if (!existing) {
      return candidate;
    }

    attempt += 1;
  }

  throw new Error("Unable to generate a unique username.");
}

module.exports = {
  usernameFromEmail
};
