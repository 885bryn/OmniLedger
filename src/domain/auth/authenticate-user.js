"use strict";

const bcrypt = require("bcryptjs");
const { models } = require("../../db");

const DUMMY_HASH = "$2b$12$XJfjd7v4ck8fL4w7xQzLwevPSfNpQ8fV6mRjW4i95zm0vMylXf8nq";

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function toPublicUser(userInstance) {
  const raw = userInstance.get({ plain: true });
  return {
    id: raw.id,
    username: raw.username,
    email: raw.email,
    created_at: raw.created_at || raw.createdAt,
    updated_at: raw.updated_at || raw.updatedAt
  };
}

async function authenticateUser(input) {
  const email = normalizeEmail(input && input.email);
  const password = typeof (input && input.password) === "string" ? input.password : "";

  if (!email || !password) {
    await bcrypt.compare(password || "invalid-password", DUMMY_HASH);
    return {
      authenticated: false
    };
  }

  const user = await models.User.findOne({
    where: {
      email_normalized: email
    }
  });

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    return {
      authenticated: false
    };
  }

  const matches = await bcrypt.compare(password, user.password_hash);
  if (!matches) {
    return {
      authenticated: false
    };
  }

  return {
    authenticated: true,
    user: toPublicUser(user)
  };
}

module.exports = {
  authenticateUser
};
