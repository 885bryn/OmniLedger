---
phase: 26-motion-interaction-patterns
plan: 01
subsystem: ui
tags: [react, framer-motion, shadcn-ui, motion, shell]
requires:
  - phase: 25-dashboard-surface-system
    provides: shadcn-aligned shell surfaces, reusable card patterns, and theme-aware dashboard styling
provides:
  - shared spring, stagger, press, and create-entry motion tokens for the frontend
  - reusable Pressable and MotionPanelList primitives for shadcn surfaces
  - subtle authenticated shell content-shift transitions keyed by route path
affects: [phase-26-plan-02, phase-26-plan-03, phase-26-plan-04]
tech-stack:
  added: [framer-motion]
  patterns: [shared spring motion tokens, reusable press feedback wrapper, animated panel list with highlight state]
key-files:
  created: [frontend/src/lib/motion.ts, frontend/src/components/ui/pressable.tsx, frontend/src/components/ui/motion-panel-list.tsx]
  modified: [frontend/package.json, frontend/src/app/shell/app-shell.tsx]
key-decisions:
  - "Lock the motion baseline in one shared module with spring stiffness 400, damping 30, press scale 0.97, and shared create-entry presets."
  - "Keep route motion inside the authenticated shell as a small opacity and vertical shift keyed by location.pathname instead of adding cinematic page transitions."
patterns-established:
  - "Interactive shadcn controls can inherit tactile feedback by wrapping their existing surface in Pressable instead of inventing per-screen tap values."
  - "Animated dashboard rows and cards should compose through MotionPanelList so layout, enter/exit, stagger, and new-item highlight states stay consistent."
requirements-completed: [MOTION-01, MOTION-03, IMPL-04]
duration: 5 min
completed: 2026-03-07
---

# Phase 26 Plan 01: Motion Interaction Patterns Summary

**Shared Framer Motion tokens, reusable press and panel primitives, and subtle in-shell route shifts for the authenticated shell.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-07T09:42:50Z
- **Completed:** 2026-03-07T09:48:09Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added a single motion source of truth for the spring baseline, tactile press scale, restrained stagger, create-entry lift, and subtle highlight feedback.
- Introduced reusable `Pressable` and `MotionPanelList` primitives that fit existing shadcn card and row surfaces.
- Replaced abrupt authenticated route swaps with a shared, restrained in-shell content shift keyed by `location.pathname`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the shared motion tokens and reusable animated surface primitives** - `be8fe2f` (feat)
2. **Task 2: Wire subtle in-shell content shift onto the authenticated layout** - `cf50875` (feat)

## Files Created/Modified
- `frontend/src/lib/motion.ts` - Defines the shared spring, stagger, create-entry, highlight, and shell transition presets.
- `frontend/src/components/ui/pressable.tsx` - Provides a reusable tactile press wrapper for buttons and link-like controls.
- `frontend/src/components/ui/motion-panel-list.tsx` - Provides a reusable layout-aware animated list and panel wrapper with highlight support.
- `frontend/package.json` - Adds `framer-motion` to the frontend dependency graph.
- `frontend/src/app/shell/app-shell.tsx` - Applies the shared in-shell route motion to authenticated content changes.

## Decisions Made
- Centralized the motion contract in `frontend/src/lib/motion.ts` so later plans reuse one spring language instead of hardcoding per-page values.
- Kept new-item confirmation as a fade-up with slight lift and brief neutral tint flash so additions read clearly without feeling theatrical.
- Limited shell transitions to subtle in-place motion inside the existing authenticated layout to preserve the current navigation topology.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `frontend/src/lib/motion.ts` and `frontend/src/components/ui/motion-panel-list.tsx` are ready for `26-02-PLAN.md` to animate dashboard and events surfaces with the shared baseline.
- `frontend/src/components/ui/pressable.tsx` is ready for later plans to roll tactile feedback across item flows, dialog actions, and shell controls.

## Self-Check: PASSED
