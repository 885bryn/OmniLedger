---
phase: 27-frequency-rule-contract
plan: "01"
subsystem: api
tags: [cashflow, net-status, one_time, summary-contract]

requires:
  - phase: 26-ui-motion-foundation
    provides: Existing asset summary API surface consumed by item detail UI
provides:
  - Deterministic one-time monthly inclusion contract for net-status totals
  - Active-period and one-time-rule summary metadata for downstream UI messaging
  - Regression coverage for one-time inclusion, exclusion, boundaries, and invalid amount guardrails
affects: [27-02, 28-cadence-normalized-totals, item-detail-summary]

tech-stack:
  added: []
  patterns: [UTC calendar-month active period, one-time due-date inclusion gate, summary metadata contract]

key-files:
  created: []
  modified:
    - src/domain/items/get-item-net-status.js
    - test/api/items-net-status.test.js

key-decisions:
  - "Use one shared one-time inclusion path for both commitment and income rows based on inclusive active-month due-date checks."
  - "Expose summary.active_period and summary.one_time_rule so frontend copy can render period context without recomputing domain logic."
  - "Exclude malformed, null, and zero amounts before subtype allocation to keep net cashflow math symmetric and predictable."

patterns-established:
  - "Net-status summary metadata: active_period + one_time_rule"
  - "One-time filtering applies by due date only, recurring rows keep baseline monthly behavior"

requirements-completed: [CASH-04]

duration: 0 min
completed: 2026-03-07
---

# Phase 27 Plan 01: Frequency Rule Contract Summary

**Net-status now applies an inclusive active-month one-time due-date rule and returns period metadata so totals and summary messaging stay deterministic.**

## Performance

- **Duration:** 0 min
- **Started:** 2026-03-07T15:54:23-08:00
- **Completed:** 2026-03-07T23:54:53.346Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Refactored net-status summary computation to include one-time rows only when due date falls inside the active calendar month (inclusive boundaries).
- Added guardrail handling that excludes malformed, null, and zero amounts before obligation/income allocation.
- Added stable summary metadata (`active_period`, `one_time_rule`) for frontend period-aware copy.
- Expanded API regression tests to lock one-time inclusion/exclusion, boundary inclusion, and amount guardrail behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement monthly active-period one-time filtering in net-status summary** - `576fa29` (feat)
2. **Task 2: Add API regression coverage for one-time period and guardrail semantics** - `58bc084` (test)

## Files Created/Modified

- `src/domain/items/get-item-net-status.js` - Added one-time monthly inclusion filter, active period metadata, and one-time rule descriptor.
- `test/api/items-net-status.test.js` - Added one-time contract regression cases and metadata assertions.

## Decisions Made

- Used UTC calendar month boundaries for active-period metadata and due-date inclusion checks so period boundaries are deterministic.
- Kept recurring items on existing baseline monthly behavior while applying one shared one-time path for both income and obligations.
- Treated zero values as excluded rows alongside malformed/null amounts to enforce the plan guardrail requirement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Manually updated STATE.md after gsd-tools state parser mismatch**
- **Found during:** Post-task metadata/state update
- **Issue:** `state advance-plan`, `state update-progress`, and `state record-session` could not parse the existing STATE.md position/session format.
- **Fix:** Applied manual STATE.md updates for current plan position, progress, last activity, total plans completed, and session stop marker after running successful `state record-metric` and `state add-decision` commands.
- **Files modified:** `.planning/STATE.md`
- **Verification:** STATE now reflects Phase 27 Plan 1/2 progress and latest session stop point.
- **Committed in:** `af695ce` (metadata/docs commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Metadata tracking completed without changing product code scope.

## Issues Encountered

- Pre-existing Jest haste-map warning from duplicate `frontend/package.json` under `.tmp/lockcheck` appeared during tests; net-status suite still passed and no task files required changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 27-01 outputs are complete and consumed metadata is ready for period-aware summary wording in `27-02`.
- No blockers for continuing to plan 27-02.

---
*Phase: 27-frequency-rule-contract*
*Completed: 2026-03-07*

## Self-Check: PASSED

- FOUND: `.planning/phases/27-frequency-rule-contract/27-frequency-rule-contract-01-SUMMARY.md`
- FOUND: `576fa29`
- FOUND: `58bc084`
