---
phase: 40-actual-based-history-and-metrics
plan: 02
subsystem: ui
tags: [react, ledger, reconciliation, history]

requires:
  - phase: 40-actual-based-history-and-metrics
    provides: actual_date/actual_amount ledger contract and completion-derived metrics helpers
provides:
  - History rows sorted/grouped by actual paid date chronology
  - Variance badges and projected reference lines for overpaid/underpaid outcomes
  - Reconciled optimistic history rows preserve projected context until refetch completes
affects: [events-ledger, item-detail-ledger, reconciliation-ux]

tech-stack:
  added: []
  patterns:
    - Keep projected ledger amount immutable while storing actual reconciliation amount separately
    - Show projected references only when variance is present

key-files:
  created: []
  modified:
    - frontend/src/pages/events/events-page.tsx
    - frontend/src/__tests__/events-ledger-page.test.tsx

key-decisions:
  - "Preserve projected amount in optimistic completion state so variance rendering remains available before server refetch."
  - "Add explicit History assertions for overpaid badge and projected date/amount reference copy in ledger tests."

patterns-established:
  - "History variance UI depends on projected and actual values coexisting in row state."
  - "Checkpoint verification feedback converts directly into regression assertions for stability."

requirements-completed: [LEDGER-06, LEDGER-07, LEDGER-08]

duration: 12 min
completed: 2026-03-30
---

# Phase 40 Plan 02: Actual-based History Rendering Summary

**History now renders actual-paid chronology with visible over/under variance context, including projected references that remain visible immediately after reconciliation.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-30T00:32:26.103Z
- **Completed:** 2026-03-30T00:44:26.103Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Delivered Task 1 helper updates for actual-date keying, variance calculation, and history display date fallback chain.
- Delivered Task 2 history row UI updates for actual labels, variance badges, projected reference lines, and actual-based paid-on text.
- Resolved failed Task 3 verification by fixing optimistic reconciliation state so overpaid/underpaid context renders immediately and is protected by regression tests.

## Task Commits

Each task was committed atomically:

1. **Task 1: Update getCompletedDateKey to prefer actual_date and add variance helper** - `d365e66` (feat)
2. **Task 2: Update History row JSX with actual-based labels, variance badges, and projected references** - `dc4556c` (feat)
3. **Task 3: Browser verification fixes after failed checkpoint feedback** - `422a2ff` (fix)

**Plan metadata:** Pending final docs commit

## Files Created/Modified
- `frontend/src/pages/events/events-page.tsx` - Preserved projected amount in optimistic completion transitions so variance + projected references remain visible before refresh.
- `frontend/src/__tests__/events-ledger-page.test.tsx` - Added assertions for overpaid badge, actual labels, and projected date/amount reference lines after reconcile-to-history flow.

## Decisions Made
- Preserve `amount` as projected in local completion state and keep `actual_amount` separate, preventing transient loss of variance UI context.
- Encode user-reported browser checkpoint expectations directly in the history reconciliation test to prevent regressions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed missing variance UI after optimistic reconciliation transition**
- **Found during:** Task 3 (Browser verification gate)
- **Issue:** Local completion state overwrote projected `amount` with reconciled actual, making variance compare equal and hiding overpaid badge and projected references.
- **Fix:** Kept projected amount in `amount` while storing reconciled value in `actual_amount`; added regression assertions for overpaid + projected reference visibility.
- **Files modified:** frontend/src/pages/events/events-page.tsx, frontend/src/__tests__/events-ledger-page.test.tsx
- **Verification:** `rtk npx tsc --noEmit --project frontend/tsconfig.json`; `rtk npm test -- src/__tests__/events-ledger-page.test.tsx`
- **Committed in:** 422a2ff

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Required for LEDGER-08 correctness and for preserving planned projected-reference behavior during post-reconcile transition.

## Issues Encountered
- Browser checkpoint feedback exposed a transition-state bug that did not appear in static JSX review; fixed and covered with targeted tests.

## Authentication Gates
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 40-02 requirements are satisfied and checkpoint feedback is resolved with tests.
- Phase 40 is ready for closeout/state progression.

---
*Phase: 40-actual-based-history-and-metrics*
*Completed: 2026-03-30*

## Self-Check: PASSED

- FOUND: `.planning/phases/40-actual-based-history-and-metrics/40-02-SUMMARY.md`
- FOUND: `d365e66`
- FOUND: `dc4556c`
- FOUND: `422a2ff`
