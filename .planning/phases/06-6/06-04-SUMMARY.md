---
phase: 06-6
plan: 04
subsystem: ui
tags: [react-router, tanstack-query, i18next, react-i18next, api-client]

requires:
  - phase: 06-6
    provides: frontend runtime baseline with stable entrypoint seams for providers and routing
provides:
  - Persistent app shell with left-sidebar navigation and route skeletons for dashboard/items/events/detail/edit/wizard paths
  - Shared app provider wiring using QueryClient + RouterProvider
  - Runtime bilingual switching (English and Chinese) with fallbackLng set to English
  - Shared API adapter with issue-envelope parsing and x-user-id header injection from active actor state
  - Header user switcher backed by GET /users with persisted active actor hydration/fallback behavior
affects: [phase-06-dashboard-events-journeys, phase-06-items-journeys, frontend-runtime-contract]

tech-stack:
  added: [react-router-dom, @tanstack/react-query, i18next, react-i18next]
  patterns: [persistent app shell layout, centralized api transport adapter, persisted active-actor context, deterministic query key namespaces]

key-files:
  created:
    - frontend/src/app/providers.tsx
    - frontend/src/app/router.tsx
    - frontend/src/app/shell/app-shell.tsx
    - frontend/src/app/shell/language-switcher.tsx
    - frontend/src/app/shell/user-switcher.tsx
    - frontend/src/lib/api-client.ts
    - frontend/src/lib/i18n.ts
    - frontend/src/lib/query-keys.ts
  modified:
    - frontend/src/App.tsx
    - frontend/package.json
    - frontend/package-lock.json

key-decisions:
  - "Use one app-shell route root with nested dashboard/items/events/detail/edit/wizard placeholders so later plans can drop in page implementations without changing topology."
  - "Use a module-level active actor source in api-client and hydrate it from a /users-backed user switcher to guarantee x-user-id propagation on every request."
  - "Initialize i18next once at provider boot with fallbackLng: en and keep user-entered values untouched by limiting translation to interface labels."

patterns-established:
  - "All frontend network calls should flow through src/lib/api-client.ts to preserve shared error-envelope parsing and actor headers."
  - "Cross-page server state should use queryKeys namespace factories in src/lib/query-keys.ts."

requirements-completed: []

duration: 2 min
completed: 2026-02-24
---

# Phase 6 Plan 04: Shell and Runtime Wiring Summary

**Persistent sidebar routing, shared providers, bilingual runtime switching, and `/users`-driven actor context plumbing are now established as reusable frontend foundations for all upcoming page journeys.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-24T20:40:47-08:00
- **Completed:** 2026-02-24T20:42:45-08:00
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Implemented a responsive left-sidebar shell plus route topology for dashboard, items, events, item detail, item edit, and wizard flows.
- Wired TanStack Query and React Router through shared app providers, and established deterministic query key conventions.
- Added runtime language switching (`English | 中文`) with English fallback behavior and integrated translated shell/navigation labels.
- Added centralized API transport with issue-envelope parsing and `x-user-id` header injection sourced from a persisted `/users`-backed actor switcher.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement app shell, routing, and shared providers for dashboard/items/events navigation** - `7df8af1` (feat)
2. **Task 2: Implement bilingual runtime switching, shared API adapter, and persisted `/users`-backed user switcher** - `136a40f` (feat)

## Files Created/Modified
- `frontend/src/app/providers.tsx` - QueryClient + RouterProvider app boot composition.
- `frontend/src/app/router.tsx` - Browser router topology with shell-rooted route skeletons.
- `frontend/src/app/shell/app-shell.tsx` - Persistent sidebar/header layout with switcher integration.
- `frontend/src/app/shell/language-switcher.tsx` - Immediate runtime language toggle component.
- `frontend/src/app/shell/user-switcher.tsx` - `/users` fetch, actor persistence, and hydration fallback behavior.
- `frontend/src/lib/api-client.ts` - Shared fetch adapter with issue-envelope mapping and actor header injection.
- `frontend/src/lib/i18n.ts` - i18next initialization and bilingual resources with fallbackLng.
- `frontend/src/lib/query-keys.ts` - Shared query key namespaces and factories.
- `frontend/src/App.tsx` - Switched app entry from static placeholder to provider-driven runtime.
- `frontend/package.json` - Added routing/query/i18n runtime dependencies.
- `frontend/package-lock.json` - Locked dependency graph updates for installed packages.

## Decisions Made
- Kept route topology explicit (including detail/edit/wizard paths) before page implementation so next plans can focus on journey logic rather than structural rewiring.
- Chose API adapter-owned actor header injection so pages do not duplicate `x-user-id` transport logic.
- Used `/users` as the single actor source with localStorage persistence and safe fallback to first available user when saved actor is no longer present.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Frontend shell/runtime foundations are in place for dashboard/events journey implementation in `06-05-PLAN.md`.
- API transport, actor context, and language switching contracts are centralized and ready for reuse in items/events pages.

---
*Phase: 06-6*
*Completed: 2026-02-24*

## Self-Check: PASSED
- FOUND: `.planning/phases/06-6/06-04-SUMMARY.md`
- FOUND: `7df8af1`
- FOUND: `136a40f`
