---
phase: 17-workbook-safety-and-usability-defaults
plan: 01
subsystem: exports
tags: [xlsx, workbook-safety, formula-hardening, date-policy]

requires:
  - phase: 16-event-history-and-downloadable-workbook
    provides: Workbook model + XLSX serializer baseline for Assets, Financial Contracts, and Event History sheets
provides:
  - Centralized text-cell sanitizer for spreadsheet formula-trigger prefixes
  - Deterministic export date policy resolver with fallback locale/timezone behavior
  - Workbook-model projection path that routes emitted rows through one safety/date boundary
affects: [17-02, workbook-xlsx, export-route]

tech-stack:
  added: []
  patterns: [centralized-export-safety-boundary, policy-driven-date-normalization, cross-sheet-regression-hardening]

key-files:
  created:
    - src/domain/exports/workbook-safety.js
    - test/domain/exports/workbook-safety.test.js
  modified:
    - src/domain/exports/workbook-model.js
    - src/domain/exports/workbook-formatters.js
    - test/domain/exports/workbook-model.test.js

key-decisions:
  - "Applied workbook string sanitization at projection-time in projectColumns so every emitted sheet cell follows one formula-hardening policy."
  - "Resolved export date preferences once per workbook build and applied a deterministic fallback policy when preferences are missing or invalid."

patterns-established:
  - "All workbook text cells pass through sanitizeWorkbookTextCell before row emission."
  - "Date cells use toExportDateCell with a shared policy object, and invalid dates always emit INVALID_DATE marker."

requirements-completed: [XLSX-02, SECU-01]

duration: 5 min
completed: 2026-03-03
---

# Phase 17 Plan 01: Workbook Safety and Date Policy Summary

**Workbook exports now enforce global formula-trigger sanitization and deterministic date policy resolution through a centralized safety boundary used by all projected sheets.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-03T22:20:01Z
- **Completed:** 2026-03-03T22:25:21Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Added `workbook-safety` utility functions for text-cell sanitization, date-policy resolution, and export-date normalization behavior.
- Refactored workbook model projection to sanitize emitted string cells globally and apply one resolved date policy across Assets, Financial Contracts, and Event History rows.
- Expanded regression coverage for cross-sheet formula-trigger handling, invalid-date marker behavior, timezone fallback determinism, and Date typing preservation.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create centralized workbook safety/date policy utilities** - `55d0653` (feat)
2. **Task 2: Route workbook model projections through safety and date policy boundary** - `85d76f7` (feat)
3. **Task 3: Expand workbook-model regressions for cross-sheet safety and date determinism** - `6e88c59` (test)

**Plan metadata:** pending

## Files Created/Modified
- `src/domain/exports/workbook-safety.js` - Central safety boundary for formula-trigger text sanitization and deterministic date policy resolution.
- `src/domain/exports/workbook-model.js` - Workbook row projection now applies one date policy and global text sanitization before row emission.
- `src/domain/exports/workbook-formatters.js` - Formatter compatibility updates aligned with date-cell normalization behavior.
- `test/domain/exports/workbook-safety.test.js` - Unit coverage for sanitizer behavior, fallback policy resolution, invalid-date markers, and typed Date preservation.
- `test/domain/exports/workbook-model.test.js` - Regression coverage for cross-sheet sanitization and timezone fallback/preference determinism.

## Decisions Made
- Kept sanitizer enforcement at `projectColumns` to guarantee all emitted string values are hardened without per-sheet call-site drift.
- Kept deterministic fallback policy constants in `workbook-safety` and allowed optional preference overrides from workbook-model input.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Resolved date-cell type mismatch uncovered during combined regression run**
- **Found during:** Task 3 (combined workbook-safety + workbook-model verification)
- **Issue:** `workbook-safety` tests expected `Date` objects for string date inputs after policy normalization, but model behavior intentionally returns normalized date strings for string inputs while preserving `Date` typing for `Date` inputs.
- **Fix:** Updated `workbook-safety` regression expectations to assert deterministic normalized strings for string inputs and explicit Date-type preservation only for Date inputs.
- **Files modified:** `test/domain/exports/workbook-safety.test.js`
- **Verification:** `npm test -- test/domain/exports/workbook-safety.test.js test/domain/exports/workbook-model.test.js --runInBand`
- **Committed in:** `6e88c59` (part of task commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Auto-fix aligned tests with the intended safety/date contract and kept scope focused on SECU-01 + XLSX-02 behavior.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Workbook-model safety and deterministic date policy boundaries are now centralized and regression-locked.
- Phase 17-02 can focus on wiring request preference context plus serializer/API defaults (freeze/filter/date presentation) without reworking projection safety logic.

---
*Phase: 17-workbook-safety-and-usability-defaults*
*Completed: 2026-03-03*

## Self-Check: PASSED

- Verified summary file exists on disk.
- Verified task commits `55d0653`, `85d76f7`, and `6e88c59` exist in git history.
