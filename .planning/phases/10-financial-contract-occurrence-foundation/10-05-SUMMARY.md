---
phase: 10-financial-contract-occurrence-foundation
plan: 05
subsystem: api
tags: [financial-item, events, item-list, net-status, regression]

# Dependency graph
requires:
  - phase: 10-financial-contract-occurrence-foundation
    provides: FinancialItem parent contract fields, projected recurring occurrences, and status=all events split UI from plans 10-01 through 10-04
provides:
  - FinancialItem subtype rows are visible in commitments and income list filters with canonical parent-contract fields
  - Asset net-status includes FinancialItem children linked through parent or linked asset relationship
  - Completed projected recurring occurrences remain visible after completion in status=all event lifecycle reads
affects: [items-list, item-detail-net-status, events-lifecycle, phase-11-timeline-ledger]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Treat FinancialItem as canonical parent contract while preserving legacy FinancialCommitment/FinancialIncome compatibility", "Prefer persisted event rows over projections for the same item/date key"]

key-files:
  created: []
  modified:
    - src/domain/items/list-items.js
    - src/domain/items/get-item-net-status.js
    - src/domain/events/list-events.js
    - test/domain/items/list-items.test.js
    - test/domain/items/get-item-net-status.test.js
    - test/api/items-list-and-mutate.test.js
    - test/api/items-net-status.test.js
    - test/api/events-complete.test.js
    - frontend/src/__tests__/dashboard-events-flow.test.tsx

key-decisions:
  - "List filters classify FinancialItem rows by subtype (`type=Commitment|Income`) so legacy and canonical models share one list contract."
  - "Net-status child queries include both `parent_item_id` and `linked_asset_item_id` relationships with owner and soft-delete guards unchanged."
  - "Event lifecycle merge resolves item+due-date conflicts by preferring persisted rows so completed materializations survive status=all refreshes."

patterns-established:
  - "Subtype filter bridge: canonical FinancialItem contracts can participate in legacy commitment/income list views without API branching."
  - "Lifecycle merge rule: projections are optimistic placeholders, persisted rows are source of truth when both exist."

requirements-completed: [FIN-01, FIN-02, FIN-03, FIN-04, FIN-06]

# Metrics
duration: 2 min
completed: 2026-02-26
---

# Phase 10 Plan 05: UAT Visibility Regression Closure Summary

**FinancialItem parent contracts now stay visible across Items filters, asset commitments net-status, and status=all Events lifecycle reads after projected occurrence completion.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-26T22:26:15Z
- **Completed:** 2026-02-26T22:27:52Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Updated list and net-status domain queries to treat FinancialItem as a first-class parent contract while preserving legacy commitment/income behavior.
- Added regression coverage proving linked-asset financial children and default_amount fallback remain visible in item and net-status APIs.
- Patched event list merge behavior and added API/UI regressions so completed projected occurrences remain visible and actionable after refresh.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix FinancialItem visibility contracts in item list and asset commitments queries** - `07939c8` (fix)
2. **Task 2: Lock post-completion lifecycle visibility so recurring occurrences do not disappear** - `c1dfaac` (fix)

**Plan metadata:** `pending`

## Files Created/Modified
- `src/domain/items/list-items.js` - Adds FinancialItem subtype-aware list filtering and canonical parent contract fields in list payloads.
- `src/domain/items/get-item-net-status.js` - Includes linked-asset FinancialItem children and default_amount summary fallback.
- `src/domain/events/list-events.js` - Merges projected and persisted rows by item/date with persisted precedence.
- `test/domain/items/list-items.test.js` - Covers FinancialItem subtype visibility and canonical fields in list filters/sorts.
- `test/domain/items/get-item-net-status.test.js` - Covers linked_asset_item_id child inclusion and FinancialItem amount fallback in summary.
- `test/api/items-list-and-mutate.test.js` - Asserts FinancialItem rows appear in commitments/income list API filters.
- `test/api/items-net-status.test.js` - Verifies canonical root/child payload expansion and linked recurring commitments.
- `test/api/events-complete.test.js` - Adds regression asserting completed projected rows remain in status=all event reads.
- `frontend/src/__tests__/dashboard-events-flow.test.tsx` - Verifies post-refresh completed rows stay actionable with Undo and no Complete action.

## Decisions Made
- Used subtype (`type`) as the compatibility bridge so FinancialItem rows participate in existing commitments/income filter contracts without introducing a new filter mode.
- Kept ownership and soft-delete constraints unchanged while expanding asset child lookup to `parent_item_id OR linked_asset_item_id` to avoid cross-owner leakage.
- Standardized event merge precedence to persisted rows for item/date collisions so projection placeholders never hide completed lifecycle state.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing test failures remained outside this task scope and were logged in `.planning/phases/10-financial-contract-occurrence-foundation/deferred-items.md`:
  - `test/domain/items/get-item-net-status.test.js` still expects a legacy `forbidden` category while runtime contract returns `not_found`.
  - `test/api/items-list-and-mutate.test.js` activity key assertion omits already-shipped attribution fields (`actor_user_id`, `lens_user_id`, `lens_attribution_state`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 10 plan 05 objectives are complete with regression locks for item visibility and post-completion lifecycle persistence.
- Ready for phase transition planning.

---
*Phase: 10-financial-contract-occurrence-foundation*
*Completed: 2026-02-26*

## Self-Check: PASSED
- FOUND: `.planning/phases/10-financial-contract-occurrence-foundation/10-05-SUMMARY.md`
- FOUND: `07939c8`
- FOUND: `c1dfaac`
