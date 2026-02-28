---
phase: 11-timeline-projection-asset-ledger-views
plan: 02
subsystem: api
tags: [events, projection, exceptions, mutations]

requires:
  - phase: 11-timeline-projection-asset-ledger-views
    provides: explicit source-state timeline contract and projected id materialization primitives
provides:
  - Projected occurrence edits now materialize one persisted exception row and update it transactionally.
  - Event update API enforces owner-scoped not_found behavior and payload validation envelopes.
  - Durable `is_exception` metadata is persisted for projected-edit exception rows.
affects: [phase-11-plan-03, events-api, timeline-ui]

tech-stack:
  added: []
  patterns: [projected-id edit materialization, persisted exception marker column, owner-scoped update mutation policy]

key-files:
  created: [src/db/migrations/20260227120000-add-event-exception-flags.js, src/domain/events/event-update-errors.js, src/domain/events/update-event.js, test/api/events-update.test.js, .planning/phases/11-timeline-projection-asset-ledger-views/11-02-SUMMARY.md]
  modified: [src/db/models/event.model.js, src/api/routes/events.routes.js]

key-decisions:
  - "Projected edit requests via projected-{itemId}-{YYYY-MM-DD} always materialize through existing item-event-sync primitives before updates."
  - "Ownership denials in PATCH /events/:id return 404 not_found envelopes to match completion-route policy semantics."
  - "`is_exception` is persisted on Events and set when projected materialization is used so edited occurrences remain identifiable after reload."

patterns-established:
  - "Event edits share projected-target resolution semantics with completion flow: resolve owner scope, parse projected id, materialize in transaction, mutate persisted row."
  - "Event update validation returns multi-issue envelopes for invalid editable payload fields (`due_date`, `amount`)."

requirements-completed: [FIN-05, TIME-02]

duration: 2 min
completed: 2026-02-28
---

# Phase 11 Plan 02: Projected Occurrence Edit Exception Persistence Summary

**PATCH event edits now materialize projected occurrences into one persisted exception row with durable `is_exception` metadata, then apply owner-scoped date/amount updates with canonical source-state payloads.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-28T01:20:52Z
- **Completed:** 2026-02-28T01:23:45Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added migration + Event model support for durable persisted exception marker metadata (`is_exception`).
- Implemented projected-aware `PATCH /events/:id` update mutation with projected-id materialization, transactional updates, and owner-safe not_found policy behavior.
- Added focused API regressions covering projected materialization, idempotent dedupe, foreign-owner denials, and invalid payload validation issues.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add durable event exception metadata for projected-edit persistence** - `b5447b4` (feat)
2. **Task 2: Implement PATCH /events/:id projected-aware edit mutation and regressions** - `cceb6f8` (feat)

## Files Created/Modified
- `src/db/migrations/20260227120000-add-event-exception-flags.js` - Adds durable persisted `is_exception` boolean column on `Events`.
- `src/db/models/event.model.js` - Extends Event model schema with `is_exception` defaulted false.
- `src/domain/events/event-update-errors.js` - Defines typed update error categories and shared error class.
- `src/domain/events/update-event.js` - Implements projected-aware event edit materialization + transactional mutation path.
- `src/api/routes/events.routes.js` - Adds `PATCH /events/:id` route and update-error HTTP envelope mapping.
- `test/api/events-update.test.js` - Covers projected edit materialization, dedupe behavior, ownership denial policy, and validation issues.

## Decisions Made
- Reused existing projected materialization primitive (`materializeItemEventForDate`) for edit mutations to preserve deterministic dedupe semantics.
- Kept ownership-denial behavior aligned with completion routes by returning `not_found` envelopes instead of `forbidden`.
- Persisted only a minimal durable marker (`is_exception`) in this phase to support edited-occurrence state without introducing series-wide metadata.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FIN-05 projected edit persistence path is in place and regression-covered.
- Timeline/UI surfaces can now consume durable exception state for edited occurrence badges in follow-on phase work.
- No blockers identified for continuing Phase 11.

## Self-Check: PASSED

- FOUND: `.planning/phases/11-timeline-projection-asset-ledger-views/11-02-SUMMARY.md`
- FOUND: `b5447b4`
- FOUND: `cceb6f8`
