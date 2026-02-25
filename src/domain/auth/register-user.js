"use strict";

const bcrypt = require("bcryptjs");
const { models } = require("../../db");
const { usernameFromEmail } = require("./username-from-email");

const BCRYPT_ROUNDS = 12;

class RegisterUserError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RegisterUserError";
    this.code = code;
  }
}

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
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

async function registerUser(input) {
  const email = normalizeEmail(input && input.email);
  const password = input && input.password;

  if (!validateEmail(email)) {
    throw new RegisterUserError("invalid_email", "email must be a valid email address.");
  }

  if (!validatePassword(password)) {
    throw new RegisterUserError("invalid_password", "password must be between 8 and 128 characters.");
  }

  const existing = await models.User.findOne({
    where: {
      email_normalized: email
    },
    attributes: ["id"]
  });

  if (existing) {
    throw new RegisterUserError("email_in_use", "An account with this email already exists.");
  }

  const username = await usernameFromEmail(email);
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const created = await models.User.create({
    username,
    email,
    password_hash: passwordHash
  });

  return toPublicUser(created);
}

module.exports = {
  RegisterUserError,
  registerUser
};
