---
phase: 27-frequency-rule-contract
plan: "02"
subsystem: ui
tags: [cashflow, i18n, item-detail, summary-contract]

requires:
  - phase: 27-frequency-rule-contract
    provides: Net-status summary metadata contract (`active_period`, `one_time_rule`)
provides:
  - Item detail summary cards render explicit monthly period context
  - One-time inclusion helper text is visible in asset summary UI
  - Frontend regression coverage for metadata-present and metadata-missing summary messaging paths
affects: [28-cadence-normalized-totals, 29-cadence-toggle-and-synced-cashflow-view, item-detail-summary]

tech-stack:
  added: []
  patterns: [period-aware summary labels from backend metadata, localized fallback copy for missing summary metadata]

key-files:
  created: []
  modified:
    - frontend/src/pages/items/item-detail-page.tsx
    - frontend/src/locales/en/common.json
    - frontend/src/locales/zh/common.json
    - frontend/src/__tests__/item-detail-ledger.test.tsx

key-decisions:
  - "Render summary period labels from `summary.active_period` metadata when available, with a stable localized `current month` fallback when missing."
  - "Keep one-time rule messaging visible in the summary area using backend `one_time_rule.description` if provided, else localized helper copy."

patterns-established:
  - "Summary card labels include explicit period context: obligations, income, and net all bind to one active monthly period label."
  - "Net cashflow card includes formula guidance tying value to normalized income minus obligations."

requirements-completed: [CASH-04]

duration: 3 min
completed: 2026-03-08
---

# Phase 27 Plan 02: Frequency Rule Contract Summary

**Item detail summary cards now show period-explicit monthly labels and one-time inclusion guidance sourced from net-status metadata with safe localized fallbacks.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T23:58:26.176Z
- **Completed:** 2026-03-08T00:01:28.920Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Updated item detail asset summary cards to show period-aware labels for obligations, income, and net cashflow.
- Added summary helper copy for active period context and one-time due-date inclusion behavior.
- Added net cashflow formula hint that explicitly states normalized income minus obligations.
- Added focused UI regressions for both metadata-present and metadata-missing rendering paths.

## Task Commits

Each task was committed atomically:

1. **Task 1: Render period-aware summary labels and one-time rule hint in item detail** - `54609a5` (feat)
2. **Task 2: Lock UI behavior with period-context and one-time hint regression tests** - `4d0242c` (test)

## Files Created/Modified

- `frontend/src/pages/items/item-detail-page.tsx` - Wired summary labels/helpers to active-period metadata with fallback behavior.
- `frontend/src/locales/en/common.json` - Added English period-aware summary labels and helper strings.
- `frontend/src/locales/zh/common.json` - Added Chinese period-aware summary labels and helper strings.
- `frontend/src/__tests__/item-detail-ledger.test.tsx` - Added regression tests for metadata-aware and fallback summary copy rendering.

## Decisions Made

- Prioritized metadata-driven period labels over hardcoded monthly wording to keep UI contract aligned with backend summary context.
- Kept helper messaging localized and concise while explicitly clarifying one-time inclusion and net cashflow derivation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Manually updated STATE.md after gsd-tools state parser mismatch**
- **Found during:** Post-task metadata/state update
- **Issue:** `state advance-plan`, `state update-progress`, and `state record-session` could not parse current STATE.md section labels.
- **Fix:** Applied manual STATE.md updates for plan position, progress, last activity, velocity counters, and session stop marker while keeping `state record-metric` and `state add-decision` outputs.
- **Files modified:** `.planning/STATE.md`
- **Verification:** STATE reflects Phase 27 Plan 2/2 completion and session stop at `27-02-PLAN.md`.
- **Committed in:** plan metadata docs commit

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Metadata tracking completed without product-scope changes.

## Issues Encountered

- `requirements mark-complete CASH-04` returned `not_found`, but `.planning/REQUIREMENTS.md` already had `CASH-04` marked complete so no additional change was required.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 27 frequency-rule messaging contract is now visible in UI and locked by tests.
- Ready for Phase 28 cadence-normalized totals work.

---
*Phase: 27-frequency-rule-contract*
*Completed: 2026-03-08*

## Self-Check: PASSED

- FOUND: `.planning/phases/27-frequency-rule-contract/27-frequency-rule-contract-02-SUMMARY.md`
- FOUND: `54609a5`
- FOUND: `4d0242c`
