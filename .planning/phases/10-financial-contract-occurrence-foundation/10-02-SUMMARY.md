---
phase: 10-financial-contract-occurrence-foundation
plan: 02
subsystem: api
tags: [financial-item, events, recurrence, projection, ownership]
requires:
  - phase: 10-01
    provides: FinancialItem contract schema and one-time parent+occurrence create transaction
provides:
  - Owner-scoped event listing now merges persisted occurrences with bounded recurring projections on read
  - Closed FinancialItem contracts are projection-gated and no longer emit future projected rows
  - Projected occurrence status edits materialize one persisted exception row per contract/date before mutation
affects: [phase-10-plan-03, phase-10-plan-04, timeline-projection, event-status-mutations]
tech-stack:
  added: []
  patterns: [projection-on-read, projected-id-materialization, owner-scoped-parent-join]
key-files:
  created: []
  modified:
    - src/domain/events/list-events.js
    - src/domain/items/item-event-sync.js
    - src/domain/events/complete-event.js
    - test/api/events-list.test.js
    - test/api/events-complete.test.js
key-decisions:
  - "Used deterministic projected occurrence ids (`projected-{itemId}-{YYYY-MM-DD}`) so projected rows can be targeted for status edits."
  - "Bounded projection-on-read to three upcoming occurrences per active recurring FinancialItem to avoid long-horizon generation."
  - "Materialized projected edits by item/date lookup before create so retries dedupe to one persisted exception row."
patterns-established:
  - "Event list ordering now prioritizes upcoming/current groups before history groups while preserving deterministic intra-group sort."
  - "Recurring projection is gated at parent contract status and owner scope, not at child row writes."
requirements-completed: [FIN-02, FIN-04, FIN-06]
duration: 5 min
completed: 2026-02-26
---

# Phase 10 Plan 02: Financial Contract Occurrence Read/Mutation Baseline Summary

**Event lifecycle now supports owner-scoped recurrence projection on read (with closed-contract gating) and projected-occurrence completion that materializes one persisted exception row per contract/date before status mutation.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-26T21:11:05Z
- **Completed:** 2026-02-26T21:16:22Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Implemented a projection-on-read event listing that merges persisted events with bounded recurring projections for active FinancialItem contracts.
- Added projection gating so closed FinancialItem parents never emit new projected future occurrences while history remains available.
- Updated completion flow so projected occurrence ids are materialized into persisted Event rows by contract/date before status transitions.
- Added API regressions for projection behavior, dedupe/retry behavior, and owner-scope denial semantics on projected edits.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add projection-on-read occurrence listing with closed-contract status gate** - `b3edc32` (feat)
2. **Task 2: Materialize projected occurrence exceptions for status-focused edits** - `2b3102f` (feat)

## Files Created/Modified

- `src/domain/events/list-events.js` - Combines persisted and projected occurrences, applies scope/status/date filters, and orders upcoming before history.
- `src/domain/items/item-event-sync.js` - Adds recurring projection helpers plus contract/date materialization helper for projected status edits.
- `src/domain/events/complete-event.js` - Resolves projected ids, materializes the occurrence if needed, then applies completion/undo ownership-safe transitions.
- `test/api/events-list.test.js` - Adds FIN-02/FIN-04/FIN-06 coverage for active recurring projection, closed gating, and owner-scope isolation.
- `test/api/events-complete.test.js` - Adds projected occurrence completion materialization, dedupe retry, and foreign-owner denial coverage.

## Decisions Made

- Chose deterministic projected ids (`projected-{itemId}-{YYYY-MM-DD}`) so projected rows can be acted on without pre-persisting long-horizon records.
- Bounded recurring read projection to three upcoming occurrences to satisfy no long-horizon pre-generation while keeping list behavior deterministic.
- Reused/created occurrence rows by item+date during projected completion so repeated reads/retries never duplicate persisted exceptions.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Financial occurrence read/mutation foundation now supports recurring projection + projected exception materialization needed by later timeline and UI plans.
- Ready for `10-03-PLAN.md` single guided Financial item form and terminology/subtype UX unification.

---

*Phase: 10-financial-contract-occurrence-foundation*
*Completed: 2026-02-26*

## Self-Check: PASSED

- Verified file exists: `.planning/phases/10-financial-contract-occurrence-foundation/10-02-SUMMARY.md`
- Verified commits exist: `b3edc32`, `2b3102f`
