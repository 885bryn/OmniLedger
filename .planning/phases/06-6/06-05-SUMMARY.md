---
phase: 06-6
plan: 05
subsystem: ui
tags: [react-query, react-router, vitest, i18next, events]

requires:
  - phase: 06-6
    provides: frontend app shell, routing, provider wiring, and actor-aware API adapter from plan 04
provides:
  - Dashboard-first landing with summary cards and due-first grouped event visibility
  - Events page grouped nearest-due timeline with inline completion controls
  - Completion mutation flow with confirm-then-refresh semantics and prompt_next_date follow-up branching
  - Shared deterministic date-ordering utility and bilingual event journey copy
  - Journey test coverage for completion refresh and follow-up modal branching behavior
affects: [phase-06-events-journey, phase-06-items-journey, frontend-i18n-contract]

tech-stack:
  added: [@testing-library/react, @testing-library/user-event]
  patterns: [shared due-date comparator utility, payload-driven modal branching, confirm-then-refresh mutation invalidation]

key-files:
  created:
    - frontend/src/pages/dashboard/dashboard-page.tsx
    - frontend/src/pages/events/events-page.tsx
    - frontend/src/lib/date-ordering.ts
    - frontend/src/features/events/complete-event-row-action.tsx
    - frontend/src/features/events/follow-up-modal.tsx
    - frontend/src/locales/en/common.json
    - frontend/src/locales/zh/common.json
    - frontend/src/__tests__/dashboard-events-flow.test.tsx
  modified:
    - frontend/src/app/router.tsx
    - frontend/src/lib/i18n.ts
    - frontend/scripts/run-vitest.mjs
    - frontend/package.json
    - frontend/package-lock.json
    - frontend/tsconfig.app.json

key-decisions:
  - "Keep one date-ordering utility for dashboard and events pages so due-first grouping remains deterministic across views."
  - "Invalidate both events and dashboard query namespaces after completion so row/group state refreshes without optimistic assumptions."
  - "Trigger follow-up modal only when completion payload includes prompt_next_date true, with schedule-first focus and explicit Not now escape."

patterns-established:
  - "Inline completion controls should live beside each event row and branch from API payload flags instead of client-side heuristics."
  - "Frontend bilingual strings are sourced from locale JSON files and loaded through i18n resources with English fallback."

requirements-completed: []

duration: 7 min
completed: 2026-02-25
---

# Phase 6 Plan 05: Dashboard and Events Journeys Summary

**Dashboard-first grouped due-event workflows now support inline completion with deterministic refresh behavior and payload-driven next-date prompting in both English and Chinese UI copy.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-25T04:46:05Z
- **Completed:** 2026-02-25T04:53:24Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Implemented routed dashboard and events pages with grouped nearest-due rendering, responsive layout, skeleton loading, and action-oriented empty states.
- Added a shared deterministic due-order comparator utility consumed by both views.
- Implemented inline one-click completion with confirm-then-refresh invalidation and row-level feedback.
- Added follow-up modal branching that appears only when completion payload contains `prompt_next_date: true`, including a clear `Not now` path.
- Added bilingual locale resources and journey tests that validate refresh and modal branch behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build Dashboard and Events grouped views with deterministic due ordering** - `60458a6` (feat)
2. **Task 2: Add inline event completion flow with payload-driven follow-up modal behavior** - `b7d1d45` (feat)

## Files Created/Modified
- `frontend/src/pages/dashboard/dashboard-page.tsx` - Dashboard summary cards, grouped due sections, and inline completion entry points.
- `frontend/src/pages/events/events-page.tsx` - Grouped events timeline with row-level completion action.
- `frontend/src/features/events/complete-event-row-action.tsx` - Completion mutation, query invalidation, and feedback handling.
- `frontend/src/features/events/follow-up-modal.tsx` - Prompt-next-date modal with schedule-first focus and `Not now` branch.
- `frontend/src/lib/date-ordering.ts` - Shared nearest-due and group ordering comparators.
- `frontend/src/locales/en/common.json` - English UI copy for dashboard/events flows.
- `frontend/src/locales/zh/common.json` - Chinese UI copy for dashboard/events flows.
- `frontend/src/__tests__/dashboard-events-flow.test.tsx` - Journey tests for completion refresh and follow-up modal branching.
- `frontend/src/lib/i18n.ts` - Locale JSON resource wiring.
- `frontend/src/app/router.tsx` - Dashboard/events routes switched from placeholders to live pages.
- `frontend/scripts/run-vitest.mjs` - Vitest wrapper stripping unsupported `--runInBand` arg from plan command.
- `frontend/package.json` - Test runner script and test dependency declarations.
- `frontend/package-lock.json` - Locked dependency graph after test tooling install.
- `frontend/tsconfig.app.json` - JSON module import support for locale files.

## Decisions Made
- Shared one comparator utility between dashboard and events to prevent order drift between pages.
- Kept completion as confirm-then-refresh without optimistic updates to align with locked mutation behavior.
- Used locale JSON files as the source for new event-flow copy to keep bilingual behavior consistent and maintainable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added Vitest wrapper for `--runInBand` compatibility**
- **Found during:** Task 1 verification command
- **Issue:** Plan-mandated command passed `--runInBand`, which Vitest rejects as an unknown option.
- **Fix:** Added `frontend/scripts/run-vitest.mjs` and routed `npm test` through it to strip `--runInBand` while preserving test filtering.
- **Files modified:** `frontend/package.json`, `frontend/scripts/run-vitest.mjs`
- **Verification:** `npm --prefix frontend run test -- dashboard-events-flow --runInBand` exits successfully.
- **Committed in:** `60458a6` and `b7d1d45`

**2. [Rule 3 - Blocking] Enabled locale JSON module loading for bilingual files**
- **Found during:** Task 2 implementation
- **Issue:** New locale files required JSON imports through TypeScript.
- **Fix:** Enabled `resolveJsonModule` and wired `i18n` resources to `frontend/src/locales/*/common.json`.
- **Files modified:** `frontend/tsconfig.app.json`, `frontend/src/lib/i18n.ts`
- **Verification:** `npm --prefix frontend run typecheck` passes and event/dashboard copy resolves in tests.
- **Committed in:** `b7d1d45`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were required to execute the exact verification command and deliver bilingual locale-file-based copy without changing intended feature scope.

## Authentication Gates

None.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Dashboard/events journeys are implemented with deterministic ordering, completion refresh, and bilingual follow-up prompting.
- Shared event-row completion component and locale structure are ready for reuse in item-centric plan work.
- Ready for `06-06-PLAN.md`.

---
*Phase: 06-6*
*Completed: 2026-02-25*

## Self-Check: PASSED
- FOUND: `.planning/phases/06-6/06-05-SUMMARY.md`
- FOUND: `60458a6`
- FOUND: `b7d1d45`
