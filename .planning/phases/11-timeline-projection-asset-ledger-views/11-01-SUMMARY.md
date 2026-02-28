---
phase: 11-timeline-projection-asset-ledger-views
plan: 01
subsystem: api
tags: [timeline, projection, ordering, events]

requires:
  - phase: 10-financial-contract-occurrence-foundation
    provides: recurring projection-on-read primitives and projected event ID materialization patterns
provides:
  - Unified persisted+projected timeline rows across a bounded 3-year forward horizon.
  - Explicit source metadata on event DTOs for persisted versus projected state rendering.
  - Deterministic same-date ordering that ranks persisted rows before projected rows.
affects: [phase-11-plan-02, events-api, timeline-ui]

tech-stack:
  added: []
  patterns: [date-window projection bounds, explicit source-state DTO contract, persisted-first tie-break sorting]

key-files:
  created: [.planning/phases/11-timeline-projection-asset-ledger-views/11-01-SUMMARY.md]
  modified: [src/domain/items/item-event-sync.js, src/domain/events/list-events.js, test/api/events-list.test.js]

key-decisions:
  - "Projection generation now uses explicit date bounds (today..today+3y) instead of count limits."
  - "Timeline DTOs expose source_state and is_projected so clients do not infer projected state from ID shape."
  - "Same-date ties apply persisted-before-projected ranking before updated_at/id tie-breaks."

patterns-established:
  - "Projection bounds are owned by list-events and passed into projectItemEvents as windowStart/windowEnd."
  - "Persisted rows are preserved as-is; only overlapping projected placeholders are removed by item/day key."

requirements-completed: [TIME-01, TIME-02]

duration: 2 min
completed: 2026-02-28
---

# Phase 11 Plan 01: Deterministic 3-Year Timeline Contract Summary

**Unified timeline output now combines persisted occurrences with projection-on-read rows through a 3-year forward window, with explicit source metadata and deterministic persisted-before-projected tie ordering.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-28T00:56:44Z
- **Completed:** 2026-02-28T00:58:54Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Replaced count-capped recurring projection with date-window generation (`today` through `today + 3 years`).
- Extended `/events` row payloads with `source_state` and `is_projected` for explicit persisted/projected semantics.
- Enforced deterministic same-date ranking where persisted rows sort before projected rows.
- Added regression coverage for 3-year horizon boundaries and persisted-first mixed-source tie ordering.

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace count-based projection with today..today+3y date-window generation** - `f80c6a0` (feat)
2. **Task 2: Add explicit source metadata and deterministic persisted-first tie sorting** - `37c1739` (feat)

## Files Created/Modified
- `src/domain/items/item-event-sync.js` - Reworked recurring projection from count limit to bounded date-window iteration.
- `src/domain/events/list-events.js` - Passed explicit projection bounds, emitted source metadata, and added persisted-first same-date comparator logic.
- `test/api/events-list.test.js` - Added 3-year horizon and source-ordering regressions; validated explicit source-state payload fields.

## Decisions Made
- Source-state must be explicit in API contracts (`source_state`, `is_projected`) to avoid client ID-pattern inference.
- Projection horizon responsibility sits at the list-events composition boundary so domain projection stays reusable and bounded by caller intent.
- Same-day sorting preserves chronology while enforcing persisted-before-projected precedence for deterministic rendering.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserved multiple persisted rows on same item/date during merge**
- **Found during:** Task 1 (verification run)
- **Issue:** Persisted event merge collapsed distinct persisted rows sharing item/date into one row.
- **Fix:** Updated merge logic to keep all persisted rows and drop only overlapping projected placeholders.
- **Files modified:** src/domain/events/list-events.js
- **Verification:** `npm test -- test/api/events-list.test.js --runInBand`
- **Committed in:** `f80c6a0`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Auto-fix was required for deterministic timeline correctness and aligned existing ordering expectations.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Timeline API contract now satisfies TIME-01/TIME-02 and is ready for projected-occurrence edit materialization work in 11-02.
- No blockers identified for continuing Phase 11.

## Self-Check: PASSED

- Commit `f80c6a0` exists and is discoverable as `feat(11-01): switch recurring projection to 3-year date horizon`.
- Commit `37c1739` exists and is discoverable as `feat(11-01): add explicit event source metadata and tie-break ordering`.
- Verification rerun passed: `npm test -- test/api/events-list.test.js --runInBand`.

---
*Phase: 11-timeline-projection-asset-ledger-views*
*Completed: 2026-02-28*
