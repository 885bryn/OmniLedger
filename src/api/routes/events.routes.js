"use strict";

const express = require("express");
const { requireAuth } = require("../auth/require-auth");
const { completeEvent, undoEventCompletion } = require("../../domain/events/complete-event");
const {
  createManualOverrideEvent,
  ManualOverrideEventError,
  MANUAL_OVERRIDE_ERROR_CATEGORIES
} = require("../../domain/events/create-manual-override-event");
const { listEvents } = require("../../domain/events/list-events");
const { updateEvent } = require("../../domain/events/update-event");
const { EventUpdateError, EVENT_UPDATE_ERROR_CATEGORIES } = require("../../domain/events/event-update-errors");

function mapEventUpdateError(error) {
  if (!(error instanceof EventUpdateError)) {
    return null;
  }

  const category = error.category || EVENT_UPDATE_ERROR_CATEGORIES.INVALID_REQUEST;
  const status = category === EVENT_UPDATE_ERROR_CATEGORIES.NOT_FOUND ? 404 : 422;
  const issues = Array.isArray(error.issues)
    ? error.issues.map((issue) => ({
      field: issue.field || "unknown",
      code: issue.code || "validation_error",
      category,
      message: issue.message || "Invalid value."
    }))
    : [];

  return {
    status,
    body: {
      error: {
        code: "event_update_failed",
        category,
        message: error.message || "Event update request failed.",
        issues
      }
    }
  };
}

function mapManualOverrideError(error) {
  if (!(error instanceof ManualOverrideEventError)) {
    return null;
  }

  const category = error.category || MANUAL_OVERRIDE_ERROR_CATEGORIES.INVALID_REQUEST;
  const status = category === MANUAL_OVERRIDE_ERROR_CATEGORIES.NOT_FOUND
    ? 404
    : category === MANUAL_OVERRIDE_ERROR_CATEGORIES.DUPLICATE
      ? 409
      : 422;
  const issues = Array.isArray(error.issues)
    ? error.issues.map((issue) => ({
      field: issue.field || "unknown",
      code: issue.code || "validation_error",
      category,
      message: issue.message || "Invalid value."
    }))
    : [];

  return {
    status,
    body: {
      error: {
        code: "event_manual_override_failed",
        category,
        message: error.message || "Manual override event request failed.",
        issues
      }
    }
  };
}

function createEventsRouter() {
  const router = express.Router();

  router.use(requireAuth);

  router.get("/events", async (req, res, next) => {
    try {
      const listed = await listEvents({
        scope: req.scope,
        status: req.query.status,
        dueFrom: req.query.due_from,
        dueTo: req.query.due_to
      });

      res.status(200).json(listed);
    } catch (error) {
      next(error);
    }
  });

  router.post("/events/manual-override", async (req, res, next) => {
    try {
      const created = await createManualOverrideEvent({
        payload: req.body,
        scope: req.scope
      });

      res.status(201).json(created);
    } catch (error) {
      const mapped = mapManualOverrideError(error);
      if (mapped) {
        res.status(mapped.status).json(mapped.body);
        return;
      }

      next(error);
    }
  });

  router.patch("/events/:id/complete", async (req, res, next) => {
    try {
      const completed = await completeEvent({
        eventId: req.params.id,
        scope: req.scope
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
        scope: req.scope
      });

      res.status(200).json(undone);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/events/:id", async (req, res, next) => {
    try {
      const updated = await updateEvent({
        eventId: req.params.id,
        payload: req.body,
        scope: req.scope
      });

      res.status(200).json(updated);
    } catch (error) {
      const mapped = mapEventUpdateError(error);
      if (mapped) {
        res.status(mapped.status).json(mapped.body);
        return;
      }

      next(error);
    }
  });

  return router;
}

module.exports = {
  createEventsRouter
};
