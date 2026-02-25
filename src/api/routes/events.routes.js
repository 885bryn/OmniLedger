"use strict";

const express = require("express");
const { requireAuth } = require("../auth/require-auth");
const { completeEvent, undoEventCompletion } = require("../../domain/events/complete-event");
const { listEvents } = require("../../domain/events/list-events");

function createEventsRouter() {
  const router = express.Router();

  router.use(requireAuth);

  router.get("/events", async (req, res, next) => {
    try {
      const listed = await listEvents({
        actorUserId: req.actor.userId,
        status: req.query.status,
        dueFrom: req.query.due_from,
        dueTo: req.query.due_to
      });

      res.status(200).json(listed);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/events/:id/complete", async (req, res, next) => {
    try {
      const completed = await completeEvent({
        eventId: req.params.id,
        actorUserId: req.actor.userId
      });

      res.status(200).json(completed);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/events/:id/undo-complete", async (req, res, next) => {
    try {
      const undone = await undoEventCompletion({
        eventId: req.params.id,
        actorUserId: req.actor.userId
      });

      res.status(200).json(undone);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = {
  createEventsRouter
};
