---
phase: 33-historical-injection-ui
plan: "01"
subsystem: api
tags: [events, manual-override, notes, sequelize, regressions]
requires:
  - phase: 32-manual-override-boundary-contract
    provides: explicit manual override creation, origin-boundary safety, and scoped `/events` contracts
provides:
  - Optional persisted note support for completed manual override events
  - Manual override note exposure through scoped `/events` reads
  - API regressions for note validation, persistence, and scope-safe read compatibility
affects: [phase-33-plan-02, item-detail-history, events-api]
tech-stack:
  added: []
  patterns:
    - manual override notes are optional, trimmed, length-limited, and stored only on explicit manual override writes
    - `/events` read payloads expose note data for manual override rows without widening normal event payloads
key-files:
  created:
    - src/db/migrations/20260310010000-add-event-note.js
  modified:
    - src/db/models/event.model.js
    - src/domain/events/create-manual-override-event.js
    - src/domain/events/list-events.js
    - test/api/events-manual-override-create.test.js
    - test/api/events-list.test.js
key-decisions:
  - "Keep note support narrow to the explicit manual override route so normal projection and completion flows remain unchanged."
  - "Expose note data only on manual override rows in `/events` responses to preserve normal event payload compatibility."
patterns-established:
  - "Manual override note contract: optional string, trimmed, max 280 chars, nullable persistence, and route-level validation envelope reuse."
  - "Read compatibility: manual override rows can carry `note` in standard grouped `/events` payloads while ordinary rows keep the prior shape."
requirements-completed: [EVENT-01, SAFE-03]
duration: 3 min
completed: 2026-03-10
---

# Phase 33 Plan 01: Historical Injection UI Summary

**Manual override events now persist optional operator notes and return them through scoped `/events` reads without widening the normal event contract.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T20:02:28Z
- **Completed:** 2026-03-10T20:05:51Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added nullable note storage to the Event persistence model and migration path for historical manual overrides.
- Extended manual override creation to trim, validate, persist, and return optional notes while preserving duplicate, scope, date, amount, and audit protections.
- Extended `/events` normalization so saved manual override notes round-trip to item-detail and ledger consumers without changing normal row payloads.
- Locked the behavior with focused API regressions for note persistence, invalid note rejection, owner/admin scoping, and compatibility reads.

## Task Commits

Each task was committed atomically:

1. **Task 1: Persist manual-override notes without weakening the Phase 32 safety contract** - `a765fcb` (feat)
2. **Task 2: Expose note-bearing manual overrides through existing event reads and compatibility regressions** - `2e75abd` (feat)

**Plan metadata:** Pending final docs commit

## Files Created/Modified

- `src/db/migrations/20260310010000-add-event-note.js` - Adds the nullable event note column.
- `src/db/models/event.model.js` - Extends the Event model with bounded optional note storage.
- `src/domain/events/create-manual-override-event.js` - Validates, trims, persists, and returns optional manual override notes.
- `src/domain/events/list-events.js` - Includes note data on manual override rows in grouped `/events` payloads.
- `test/api/events-manual-override-create.test.js` - Covers note persistence, trimming, validation, and scoped admin creation.
- `test/api/events-list.test.js` - Covers note-bearing `/events` reads and compatibility with normal event rows.

## Decisions Made

- Kept note writes exclusive to `POST /events/manual-override` so projected-event creation and ordinary completion/edit routes stay untouched.
- Limited notes to trimmed short-form text and surfaced them only on manual override read rows so the frontend gets the needed context without broad contract drift.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend note persistence and read compatibility are ready for `33-historical-injection-ui-02-PLAN.md` to build the item-detail dialog and post-save history reveal.
- Final Phase 33 manual browser verification should still confirm the item-detail workflow, refreshed history placement, and note visibility end to end.

---
*Phase: 33-historical-injection-ui*
*Completed: 2026-03-10*

## Self-Check: PASSED

- FOUND: `.planning/phases/33-historical-injection-ui/33-historical-injection-ui-01-SUMMARY.md`
- FOUND: `a765fcb`
- FOUND: `2e75abd`
