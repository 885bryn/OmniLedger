---
phase: 35-dashboard-information-architecture
plan: 02
subsystem: ui
tags: [react, dashboard, auth-session, vitest, i18n, mobile]

# Dependency graph
requires:
  - phase: 35-dashboard-information-architecture
    plan: 01
    provides: dashboard shell hierarchy and responsive section scaffolding
provides:
  - monthly event-based dashboard summary cards with stable due-period semantics
  - first-pass Needs Attention and Recent Activity surfaces tuned for mobile reachability
  - host-aware API fallback to prevent localhost/127.0.0.1 sign-in bounce loops
affects: [phase-36-dashboard-actions, phase-37-dashboard-polish, dashboard-metric-trust]

# Tech tracking
tech-stack:
  added: []
  patterns: [month-bounded summary math by due_date, mobile attention preview cap, host-aware local API fallback]

key-files:
  created: [.planning/phases/35-dashboard-information-architecture/35-dashboard-information-architecture-02-SUMMARY.md]
  modified: [frontend/src/pages/dashboard/dashboard-page.tsx, frontend/src/lib/api-client.ts, frontend/src/__tests__/dashboard-information-architecture.test.tsx, frontend/src/__tests__/user-switcher-export-action.test.tsx, frontend/src/locales/en/common.json, frontend/src/locales/zh/common.json]

key-decisions:
  - "Locked dashboard summary metrics to current-month event rows by due date so net, upcoming, overdue, and completed cards share one trustable period contract."
  - "Capped dashboard Needs Attention preview at six rows so Recent Activity remains reachable on mobile while full triage remains available through /events."
  - "Made API fallback host-aware to keep auth cookies first-party when local dev uses 127.0.0.1 instead of localhost."

patterns-established:
  - "Dashboard monthly metrics should use due-date month boundaries even for completed rows; completion timestamp alone must not move values across months."
  - "When dense queues dominate mobile height, dashboard sections should provide a bounded preview plus explicit deep-link continuation."

deferred-followups:
  - "Future milestone note: add an automatic midnight month-rollover refresh so open dashboard tabs recalculate monthly cards exactly when the calendar month changes."

requirements-completed: [DASH-02, DASH-03]

# Metrics
duration: 130 min
completed: 2026-03-11
---

# Phase 35 Plan 02: Dashboard Information Architecture Summary

**Phase 35 now closes with trustworthy month-bounded summary math, a mobile-reachable dashboard body hierarchy, and a resolved local sign-in bounce regression that blocked browser verification.**

## Performance

- **Duration:** 130 min
- **Started:** 2026-03-11T22:25:00Z
- **Completed:** 2026-03-12T00:35:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Updated dashboard summary-card math to month-standard cadence based on event data and due-date month boundaries, covering net cashflow, upcoming due, overdue, and completed activity.
- Fixed the local browser sign-in bounce by resolving API base-url fallback from the current browser host when explicit env overrides are absent.
- Ensured Recent Activity stays visible on mobile by capping Needs Attention preview rows and linking overflow to the existing `/events` workflow.
- Updated English/Chinese copy so summary-card support text matches the new month-based semantics.
- Added and expanded frontend regressions to lock the host-aware API fallback, month-bounded dashboard math, completion-state stability, and mobile reachability behavior.

## Task Commits

No new git commit was requested during this closeout; changes remain in the working tree.

## Files Created/Modified
- `frontend/src/pages/dashboard/dashboard-page.tsx` - Implements month-bounded event math and mobile attention preview cap.
- `frontend/src/lib/api-client.ts` - Uses runtime browser host/protocol for local API fallback when env overrides are missing.
- `frontend/src/__tests__/dashboard-information-architecture.test.tsx` - Adds month-bounded metric and transition stability regressions.
- `frontend/src/__tests__/user-switcher-export-action.test.tsx` - Adds host-aware API base-url fallback coverage.
- `frontend/src/locales/en/common.json` - Aligns dashboard summary support text and preview hint copy.
- `frontend/src/locales/zh/common.json` - Aligns Chinese dashboard summary support text and preview hint copy.
- `.planning/phases/35-dashboard-information-architecture/35-dashboard-information-architecture-02-SUMMARY.md` - Records plan-02 completion and deferred rollover note.

## Decisions Made
- Treated monthly due-date boundaries as the single source of truth for all top-card metrics so one completion timing edge case cannot skew period math.
- Preserved existing `/events` and item-detail pathways instead of introducing new action types in this phase.
- Logged automatic midnight rollover refresh as deferred scope to keep Phase 35 focused on information architecture and metric trust.

## Deviations from Plan

- Added a small auth fallback fix (`localhost` vs `127.0.0.1`) because it blocked browser verification for the dashboard phase; this stayed within existing auth contracts.

## Issues Encountered

- Local browser verification initially failed with a brief post-login dashboard flash followed by sign-in redirect due to host mismatch for cookie-scoped requests.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 35 is complete and DASH-01, DASH-02, DASH-03 are satisfied.
- Phase 36 can now focus on queue depth and financial snapshot utility without revisiting dashboard top-card math contracts.
- Future milestone backlog includes automatic midnight month-rollover refresh for long-lived open dashboard tabs.

## Self-Check: PASSED

- Verified `.planning/phases/35-dashboard-information-architecture/35-dashboard-information-architecture-02-SUMMARY.md` exists on disk.
- Verified dashboard, auth-route, and API fallback regressions pass after the final month-boundary fixes.
