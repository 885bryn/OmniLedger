---
phase: 25-dashboard-surface-system
plan: 01
subsystem: ui
tags: [react, tailwindcss, shadcn-ui, dashboard, theming, vitest]
requires:
  - phase: 24-theme-foundation
    provides: strict light-first theme state, manual dark toggle behavior, and CSS variable scaffolding
provides:
  - tuned Phase 25 light and dark surface tokens for shell and dashboard rollout
  - official shadcn select and textarea primitives for later form migration plans
  - reusable dashboard DataCard pattern for metrics, empty states, and grouped due-date sections
affects: [phase-25-plan-02, phase-25-plan-03, phase-26-motion-interaction-patterns]
tech-stack:
  added: []
  patterns: [border-first dashboard surfaces, reusable shadcn DataCard composition, rounded-xl data surfaces with rounded-lg controls]
key-files:
  created: [frontend/src/components/ui/select.tsx, frontend/src/components/ui/textarea.tsx, frontend/src/features/dashboard/data-card.tsx]
  modified: [frontend/src/index.css, frontend/src/app/shell/app-shell.tsx, frontend/src/pages/dashboard/dashboard-page.tsx, frontend/src/__tests__/dashboard-events-flow.test.tsx]
key-decisions:
  - "Use warmer neutral light tokens with restrained light-only shadows while keeping dark mode border-first and near-black."
  - "Introduce a reusable DataCard wrapper around shadcn Card primitives so dashboard metrics, empty states, and grouped sections share one surface pattern."
patterns-established:
  - "Dashboard surfaces should compose from shared `bg-background`, `bg-card`, and `border-border` tokens instead of page-specific gradients."
  - "Reusable data panels should build on `@/components/ui` primitives and keep controls at rounded-lg inside rounded-xl cards."
requirements-completed: [VIS-01, VIS-02, VIS-03, IMPL-03]
duration: 1 min
completed: 2026-03-07
---

# Phase 25 Plan 01: Dashboard Surface System Summary

**High-contrast shell and dashboard surfaces with border-first dark mode, warmer light tokens, and a reusable shadcn DataCard pattern.**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-07T08:36:53Z
- **Completed:** 2026-03-07T08:37:35Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Retuned shared surface, border, ring, sidebar, and shadow tokens for the Phase 25 dashboard language.
- Added official shadcn `Select` and `Textarea` primitives to support later form-surface rollout.
- Created a reusable `DataCard` and applied it across dashboard metrics, assets, empty states, grouped due-date sections, and shell chrome.

## Task Commits

Each task was committed atomically:

1. **Task 1: Establish Phase 25 surface tokens and official primitive foundation** - `74c53a2` (feat)
2. **Task 2: Apply the new shell surface language and reusable dashboard data card** - `b78b50e` (feat)

## Files Created/Modified
- `frontend/src/index.css` - Tunes the shared light/dark token palette, focus ring behavior, and surface shadow variables.
- `frontend/src/components/ui/select.tsx` - Adds the official shadcn select primitive wrapper for later plans.
- `frontend/src/components/ui/textarea.tsx` - Adds the official shadcn textarea primitive wrapper for later plans.
- `frontend/src/features/dashboard/data-card.tsx` - Defines the reusable dashboard surface pattern built from shadcn card primitives.
- `frontend/src/app/shell/app-shell.tsx` - Aligns shell navigation, header, and mobile menu surfaces to the new token system.
- `frontend/src/pages/dashboard/dashboard-page.tsx` - Migrates dashboard metrics, assets, empty state, and due-date groups onto shared surface primitives.
- `frontend/src/__tests__/dashboard-events-flow.test.tsx` - Keeps the dashboard regression aligned with the new metric-card markup.

## Decisions Made
- Used warmer neutral tokens in light mode so borders, cards, and canvas separate cleanly without reintroducing gradients.
- Kept dark mode separation border-first with shadows effectively disabled, matching the phase requirement for deep-black surfaces.
- Centralized dashboard card styling in `DataCard` so later plans can reuse one surface pattern instead of duplicating panel classes.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Dashboard shell tokens and the shared DataCard exemplar are ready for `25-02-PLAN.md` to migrate auth, dialog, and toast surfaces.
- Select and textarea primitives are in place for the broader Phase 25 form rollout.

## Self-Check: PASSED
