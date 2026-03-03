"use strict";

const express = require("express");
const { requireAuth } = require("../auth/require-auth");
const { exportScopeQuery } = require("../../domain/exports/export-scope-query");
const { buildWorkbookModel } = require("../../domain/exports/workbook-model");
const { serializeWorkbookToXlsx } = require("../../domain/exports/workbook-xlsx");

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

      const workbook = buildWorkbookModel(scopedDataset.datasets);
      const xlsxBuffer = await serializeWorkbookToXlsx(workbook);

      const dateStamp = new Date().toISOString().slice(0, 10);
      const fileName = `hact-backup-${dateStamp}.xlsx`;

      res.status(200);
      res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.attachment(fileName);
      res.send(xlsxBuffer);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = {
  createExportsRouter
};
