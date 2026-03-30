---
phase: 40-actual-based-history-and-metrics
plan: 01
subsystem: api
tags: [metrics, i18n, history, reconciliation]

requires:
  - phase: 39-reconciliation-modal-and-completion-ux
    provides: actual_amount and actual_date reconciliation fields on completed events
provides:
  - resolveCompletedAt now prefers business actual_date over system timestamps
  - date-only parsing keeps YYYY-MM-DD stable in UTC formatting
  - phase 40 History/variance translation keys in both English and Chinese locales
affects: [phase-40-plan-02, history-ledger, item-tracking]

tech-stack:
  added: []
  patterns: [DATEONLY parsing via split + Date.UTC, i18n key parity across locales]

key-files:
  created:
    - test/domain/items/financial-metrics.test.js
  modified:
    - src/domain/items/financial-metrics.js
    - frontend/src/locales/en/common.json
    - frontend/src/locales/zh/common.json

key-decisions:
  - "Export resolveCompletedAt and derive/apply helpers to support focused unit coverage for tracking date behavior."
  - "Parse actual_date with Date.UTC from YYYY-MM-DD parts to avoid timezone day drift in derived metrics."

patterns-established:
  - "Completion-derived date metrics must source actual_date first, then legacy completion fallback chain."
  - "When adding phase labels, keep en/zh locale structures in lockstep to prevent runtime key drift."

requirements-completed: [VIEW-07]

duration: 3 min
completed: 2026-03-30
---

# Phase 40 Plan 01: Actual-Date Metrics and Locale Baseline Summary

**Completion-derived tracking now uses business actual_date chronology, and both locale packs include the new History/variance copy needed for Phase 40 UI rendering.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-30T00:29:19.685Z
- **Completed:** 2026-03-30T00:32:38.874Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added TDD coverage for resolveCompletedAt precedence, null fallback behavior, and date-only stability.
- Updated `resolveCompletedAt` to prefer `actual_date` and safely parse DATEONLY values before legacy timestamps.
- Added all phase 40 `events.historyCard` and `events.varianceBadge` keys in both `en` and `zh` locale files while keeping legacy keys.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Add failing tests for actual-date precedence** - `9e51515` (test)
2. **Task 1 (GREEN): Implement actual_date-first resolver + exports** - `3c905f4` (feat)
3. **Task 2: Add phase 40 locale keys in en/zh** - `2a60564` (feat)

## Files Created/Modified
- `test/domain/items/financial-metrics.test.js` - New domain tests for actual_date precedence and derived metric dates.
- `src/domain/items/financial-metrics.js` - Resolver now prioritizes actual_date; exports expanded for direct testing.
- `frontend/src/locales/en/common.json` - Added History actual/projection labels and variance badge labels.
- `frontend/src/locales/zh/common.json` - Added matching Chinese History actual/projection labels and variance badge labels.

## Decisions Made
- Exported `resolveCompletedAt` (and related metric helpers) to enable direct unit assertions without heavy integration setup.
- Used `Date.UTC(year, month-1, day)` for DATEONLY parsing so ISO day output remains stable across local timezones.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `rtk npx jest ...` was interpreted as a missing npm script in this shell wrapper; switched to `rtk test "npx jest ..."` and continued with the same Jest target.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for `40-02-PLAN.md`; UI layer can now consume the new i18n keys and rely on actual_date-backed completion metrics.
- No blockers found in this plan.

---
*Phase: 40-actual-based-history-and-metrics*
*Completed: 2026-03-30*

## Self-Check: PASSED
