"use strict";

function requireAuth(req, res, next) {
  const sessionUserId = req.session && req.session.userId;

  if (typeof sessionUserId !== "string" || sessionUserId.trim() === "") {
    res.status(401).json({
      error: {
        code: "authentication_required",
        message: "Authentication required."
      }
    });
    return;
  }

  req.actor = {
    userId: sessionUserId
  };

  next();
}

module.exports = {
  requireAuth
};
