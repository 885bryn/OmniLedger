"use strict";

const express = require("express");
const { requireAuth } = require("../auth/require-auth");
const { exportScopeQuery } = require("../../domain/exports/export-scope-query");
const { buildWorkbookModel } = require("../../domain/exports/workbook-model");
const { serializeWorkbookToXlsx } = require("../../domain/exports/workbook-xlsx");
const { resolveExportDatePolicy } = require("../../domain/exports/workbook-safety");
const { models } = require("../../db");

function ignoreClientScopeHints(query, body) {
  const queryPayload = query && typeof query === "object" ? query : {};
  const bodyPayload = body && typeof body === "object" && !Array.isArray(body) ? body : {};

  const {
    user_id: _ignoredQueryUserId,
    owner_id: _ignoredQueryOwnerId,
    scope_mode: _ignoredQueryScopeMode,
    lens_user_id: _ignoredQueryLensUserId
  } = queryPayload;

  const {
    user_id: _ignoredBodyUserId,
    owner_id: _ignoredBodyOwnerId,
    scope_mode: _ignoredBodyScopeMode,
    lens_user_id: _ignoredBodyLensUserId
  } = bodyPayload;

  void _ignoredQueryUserId;
  void _ignoredQueryOwnerId;
  void _ignoredQueryScopeMode;
  void _ignoredQueryLensUserId;
  void _ignoredBodyUserId;
  void _ignoredBodyOwnerId;
  void _ignoredBodyScopeMode;
  void _ignoredBodyLensUserId;
}

function createExportsRouter() {
  const router = express.Router();

  router.use(requireAuth);

  router.get("/exports/backup.xlsx", async (req, res, next) => {
    try {
      ignoreClientScopeHints(req.query, req.body);

      const scopedDataset = await exportScopeQuery({
        scope: req.scope
      });

      const exportDatePreferences = resolveExportDatePreferences(req);

      const workbook = buildWorkbookModel({
        datasets: scopedDataset.datasets,
        export_preferences: exportDatePreferences
      });
      const xlsxBuffer = await serializeWorkbookToXlsx(workbook);
      await createExportAuditLog({
        scope: req.scope,
        action: "export.backup.succeeded",
        timestamp: new Date()
      });

      const dateStamp = new Date().toISOString().slice(0, 10);
      const fileName = `hact-backup-${dateStamp}.xlsx`;

      res.status(200);
      res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.attachment(fileName);
      res.send(xlsxBuffer);
    } catch (error) {
      await createExportAuditLog({
        scope: req.scope,
        action: "export.backup.failed",
        timestamp: new Date()
      });
      next(error);
    }
  });

  return router;
}

function normalizeScopeId(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function resolveExportAuditAttribution(scope) {
  const resolvedScope = scope && typeof scope === "object" ? scope : {};
  const actorUserId = normalizeScopeId(resolvedScope.actorUserId);
  const mode = resolvedScope.mode === "all" ? "all" : "owner";
  const lensUserId = mode === "all" ? null : normalizeScopeId(resolvedScope.lensUserId) || actorUserId;
  const userId = lensUserId || actorUserId;

  return {
    userId,
    actorUserId,
    lensUserId
  };
}

async function createExportAuditLog(input) {
  const payload = input && typeof input === "object" ? input : {};
  const attribution = resolveExportAuditAttribution(payload.scope);

  if (!attribution.userId || !attribution.actorUserId) {
    return;
  }

  await models.AuditLog.create({
    user_id: attribution.userId,
    actor_user_id: attribution.actorUserId,
    lens_user_id: attribution.lensUserId,
    action: payload.action,
    entity: "export:backup.xlsx",
    timestamp: payload.timestamp || new Date()
  });
}

function firstNonEmptyString(values) {
  if (!Array.isArray(values)) {
    return null;
  }

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function getHeader(req, headerName) {
  if (!req || typeof req.get !== "function") {
    return null;
  }

  const rawHeader = req.get(headerName);
  return typeof rawHeader === "string" && rawHeader.trim().length > 0
    ? rawHeader.trim()
    : null;
}

function resolveLocaleFromHeaders(req) {
  const acceptLanguage = getHeader(req, "accept-language");
  if (!acceptLanguage) {
    return null;
  }

  const [firstToken] = acceptLanguage.split(",");
  if (!firstToken) {
    return null;
  }

  const [localeToken] = firstToken.split(";");
  return typeof localeToken === "string" && localeToken.trim().length > 0
    ? localeToken.trim()
    : null;
}

function resolveExportDatePreferences(req) {
  const requestSources = [
    req && req.scope,
    req && req.actor,
    req && req.session
  ].filter(Boolean);

  const preferenceSources = requestSources.flatMap((source) => {
    if (!source || typeof source !== "object") {
      return [];
    }

    return [
      source.export_preferences,
      source.exportPreferences,
      source.preferences,
      source.userPreferences,
      source.datePreferences
    ].filter((candidate) => candidate && typeof candidate === "object");
  });

  const locale = firstNonEmptyString([
    ...preferenceSources.map((candidate) => candidate.locale),
    resolveLocaleFromHeaders(req)
  ]);

  const timeZone = firstNonEmptyString([
    ...preferenceSources.flatMap((candidate) => [candidate.timeZone, candidate.timezone, candidate.tz]),
    getHeader(req, "x-timezone"),
    getHeader(req, "x-time-zone")
  ]);

  return resolveExportDatePolicy({ locale, timeZone });
}

module.exports = {
  createExportsRouter
};
