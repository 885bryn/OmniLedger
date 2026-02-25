"use strict";

const express = require("express");
const { completeEvent } = require("../../domain/events/complete-event");

function createEventsRouter() {
  const router = express.Router();

  router.patch("/events/:id/complete", async (req, res, next) => {
    try {
      const completed = await completeEvent({
        eventId: req.params.id,
        actorUserId: req.header("x-user-id")
      });

      res.status(200).json(completed);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = {
  createEventsRouter
};
