---
phase: 16-event-history-and-downloadable-workbook
plan: 02
subsystem: exports
tags: [xlsx, exceljs, export-route, attachment-download, scope-regression]

requires:
  - phase: 16-event-history-and-downloadable-workbook
    provides: Event History workbook-model sheet contract and deterministic scope-safe workbook datasets
provides:
  - ExcelJS serializer that writes workbook model sheets to downloadable XLSX bytes
  - GET /exports/backup.xlsx binary attachment transport using server-scoped datasets only
  - API and serializer regressions for sheet order, attachment headers, and owner/all/lens scope membership
affects: [16-03, export-client-download-flow, workbook-safety-defaults]

tech-stack:
  added: [exceljs]
  patterns: [model-to-xlsx-serializer, attachment-response-contract, binary-workbook-regression-parsing]

key-files:
  created:
    - src/domain/exports/workbook-xlsx.js
    - test/domain/exports/workbook-xlsx.test.js
  modified:
    - package.json
    - package-lock.json
    - src/api/routes/exports.routes.js
    - test/api/exports-backup-scope.test.js

key-decisions:
  - "Export route now serializes workbook model output directly to XLSX and returns attachment bytes instead of JSON workbook envelopes."
  - "API scope regressions parse returned XLSX files with ExcelJS and verify row membership per scope mode rather than asserting transport-layer JSON payloads."

patterns-established:
  - "Workbook sheet order is hard-locked as Assets, Financial Contracts, Event History during XLSX serialization."
  - "Each generated sheet receives frozen headers and auto-filter ranges derived from populated workbook-model contracts."

requirements-completed: [EXPT-01, EXPT-02]

duration: 4 min
completed: 2026-03-03
---

# Phase 16 Plan 02: XLSX Serializer and Download Transport Summary

**Exports now stream a real XLSX backup attachment generated from scoped workbook-model sheets, with deterministic sheet ordering and binary regression coverage for owner/all/lens access modes.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-03T20:40:21Z
- **Completed:** 2026-03-03T20:44:05Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Added `serializeWorkbookToXlsx` with ExcelJS to transform workbook model contracts into non-empty `.xlsx` buffers.
- Converted `GET /exports/backup.xlsx` to return binary attachment responses (`Content-Disposition` + XLSX content type) while keeping `exportScopeQuery({ scope: req.scope })` as the source path.
- Reworked serializer/API tests to parse workbook bytes and lock expected sheet order, header/filter defaults, and scope-safe row membership.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add XLSX serializer module using ExcelJS with locked sheet defaults** - `f68112b` (feat)
2. **Task 2: Convert export route to attachment download while preserving scoped source data path** - `3262f7e` (feat)
3. **Task 3: Update API regressions for binary transport and scope-safe workbook content** - `9e49d87` (test)

**Plan metadata:** pending

## Files Created/Modified
- `src/domain/exports/workbook-xlsx.js` - Serializes workbook model sheets to XLSX buffer with locked order and sheet defaults.
- `test/domain/exports/workbook-xlsx.test.js` - Verifies serializer output, sheet order, header mapping, frozen headers, and auto-filter ranges.
- `src/api/routes/exports.routes.js` - Switches export endpoint from JSON to attachment transport using XLSX bytes.
- `test/api/exports-backup-scope.test.js` - Validates attachment headers and workbook row membership across owner/all/lens scope modes.
- `package.json` - Adds `exceljs` runtime dependency.
- `package-lock.json` - Locks ExcelJS dependency tree for reproducible installs.

## Decisions Made
- Used a dedicated domain serializer module (`workbook-xlsx`) so route logic remains scope/auth focused while workbook byte construction stays testable in isolation.
- Locked transport verification to workbook-content assertions (not JSON envelope assertions) to guard against future regressions in binary export behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added explicit binary parser in API tests for XLSX payloads**
- **Found during:** Task 3 (Update API regressions for binary transport and scope-safe workbook content)
- **Issue:** Supertest default parsing produced non-buffer response bodies for XLSX payloads, causing workbook load failures.
- **Fix:** Added `.buffer(true).parse(binaryParser)` to export route requests and centralized XLSX response parsing helper.
- **Files modified:** `test/api/exports-backup-scope.test.js`
- **Verification:** `npm test -- test/api/exports-backup-scope.test.js --runInBand`
- **Committed in:** `9e49d87` (part of task commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix was required to validate the intended binary transport contract; no scope creep introduced.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend now serves real downloadable workbook attachments and preserves scope trust boundaries through regression tests.
- Phase 16-03 can focus on frontend blob-download UX and in-app export feedback without backend contract ambiguity.

---
*Phase: 16-event-history-and-downloadable-workbook*
*Completed: 2026-03-03*

## Self-Check: PASSED

- Verified summary file exists on disk.
- Verified task commits `f68112b`, `3262f7e`, and `9e49d87` exist in git history.
