---
phase: 36-action-queue-and-financial-snapshot
plan: "01"
type: execute
wave: 1
depends_on:
  - 35-dashboard-information-architecture-02
files_modified:
  - frontend/src/pages/dashboard/dashboard-page.tsx
  - frontend/src/features/dashboard/dashboard-action-queue.tsx
  - frontend/src/__tests__/dashboard-action-queue.test.tsx
  - frontend/src/locales/en/common.json
  - frontend/src/locales/zh/common.json
autonomous: true
requirements:
  - DASH-04
  - DASH-06
must_haves:
  truths:
    - User sees an action queue split into `Overdue` and `Upcoming` sections with row counts.
    - User sees overdue rows first, sorted oldest overdue first, with explicit age-band labels (`1-7d`, `8-30d`, `30+d`).
    - User sees upcoming rows limited to obligations due within the next 14 days, sorted nearest due date first.
    - User can jump directly from queue rows to existing `/events` and item-detail workflows without new backend contracts.
  artifacts:
    - path: frontend/src/features/dashboard/dashboard-action-queue.tsx
      provides: Sectioned dashboard queue rendering with locked priority ordering and age-bucket treatment
      min_lines: 140
    - path: frontend/src/pages/dashboard/dashboard-page.tsx
      provides: Queue data shaping and wiring from existing dashboard event/item queries into the queue component
      min_lines: 360
    - path: frontend/src/__tests__/dashboard-action-queue.test.tsx
      provides: Focused regression coverage for queue sectioning, ordering, age buckets, and 14-day window behavior
      min_lines: 150
  key_links:
    - from: frontend/src/pages/dashboard/dashboard-page.tsx
      to: frontend/src/features/dashboard/dashboard-action-queue.tsx
      via: pending event rows are split and sorted into overdue/upcoming queue sections with count metadata
      pattern: Overdue|Upcoming|14
    - from: frontend/src/features/dashboard/dashboard-action-queue.tsx
      to: /events
      via: queue-level continuation link routes users into the existing full events workflow
      pattern: /events
    - from: frontend/src/features/dashboard/dashboard-action-queue.tsx
      to: /items/:itemId
      via: linked-item navigation keeps direct handoff from queue triage to item detail
      pattern: /items/
---

<objective>
Deliver a dashboard action queue that supports urgency-first event triage directly from the dashboard using the exact ordering and section model locked in phase context.

Purpose: DASH-04 and DASH-06 require an operational queue, not just a generic list. The queue must preserve overdue-first decision speed, limit upcoming noise to a 14-day horizon, and hand users into existing workflows without introducing new contracts.
Output: A dedicated queue component, dashboard data wiring, bilingual queue copy, and focused regressions that lock sectioning, ordering, and navigation behavior.
</objective>

<execution_context>
@C:/Users/bryan/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/bryan/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/36-action-queue-and-financial-snapshot/36-CONTEXT.md
@.planning/phases/35-dashboard-information-architecture/35-dashboard-information-architecture-02-SUMMARY.md
@frontend/src/pages/dashboard/dashboard-page.tsx
@frontend/src/features/dashboard/dashboard-needs-attention.tsx
@frontend/src/features/events/complete-event-row-action.tsx
@frontend/src/locales/en/common.json
@frontend/src/locales/zh/common.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add queue-focused frontend regressions before queue refactor</name>
  <files>frontend/src/__tests__/dashboard-action-queue.test.tsx</files>
  <action>Create a focused dashboard action-queue regression suite that uses mocked pending-event data and asserts every locked context decision: separate `Overdue` and `Upcoming` sections with counts, overdue sorted oldest overdue first, upcoming sorted nearest due date first, upcoming limited to due dates inside the next 14 days, and overdue age-bucket labels rendered as `1-7d`, `8-30d`, or `30+d`. Include assertions that queue rows preserve direct links to `/events` and `/items/:itemId` so navigation contracts are guarded before implementation refactor work begins.</action>
  <verify>
    <automated>npm --prefix frontend run test -- dashboard-action-queue</automated>
    <manual>Optional: inspect test names and confirm they encode ordering, section split, and 14-day inclusion behavior rather than generic rendering checks.</manual>
    <sampling_rate>run after test creation and again after Task 2 implementation</sampling_rate>
  </verify>
  <done>A dedicated queue regression file exists and fails when overdue/upcoming splitting, sorting, age-bucket labels, 14-day upcoming filtering, or direct workflow links drift from the locked decisions.</done>
</task>

<task type="auto">
  <name>Task 2: Implement the urgency-first dashboard action queue</name>
  <files>frontend/src/pages/dashboard/dashboard-page.tsx, frontend/src/features/dashboard/dashboard-action-queue.tsx, frontend/src/locales/en/common.json, frontend/src/locales/zh/common.json</files>
  <action>Create `frontend/src/features/dashboard/dashboard-action-queue.tsx` and wire it into the dashboard body so the old generic attention list becomes a true action queue. Implement the locked section model exactly: `Overdue` first and `Upcoming` second, each with section header and count; overdue rows sorted by oldest overdue first; upcoming rows sorted by nearest due date first and restricted to obligations due in the next 14 days only; overdue rows display explicit age buckets (`1-7d`, `8-30d`, `30+d`) for scanability under high volume. Keep action affordances safe and within current capability by reusing existing row-safe actions and/or existing deep links; do not add new backend endpoints, payload fields, or state-mutating workflows that do not already exist. Preserve existing RBAC/lens query patterns and return-to navigation state when linking to item detail or `/events`.</action>
  <verify>
    <automated>npm --prefix frontend run test -- dashboard-action-queue dashboard-information-architecture</automated>
    <manual>Open `/dashboard` and confirm the queue is sectioned as `Overdue` then `Upcoming`, overdue rows show the expected age bands, upcoming excludes >14-day rows, and row actions/links hand off to existing workflows without confusion.</manual>
    <sampling_rate>run after implementation and before planning handoff to Plan 02</sampling_rate>
  </verify>
  <done>The dashboard now renders a locked urgency-first action queue with explicit overdue/upcoming sectioning, deterministic sorting, 14-day upcoming scope, age-bucket severity labels, and intact navigation into `/events` and item detail flows.</done>
</task>

</tasks>

<verification>
Run `npm --prefix frontend run test -- dashboard-action-queue dashboard-information-architecture`.

Confirm the dashboard queue enforces overdue-first triage with explicit section counts, deterministic ordering, 14-day upcoming scoping, and direct links to existing workflows.
</verification>

<success_criteria>
Users can triage dashboard obligations in an urgency-first queue that is visibly split into `Overdue` and `Upcoming`, where overdue is oldest-first with age-band severity, upcoming is nearest-first within a 14-day horizon, and queue rows provide clear handoff paths into `/events` and item detail.
</success_criteria>

<output>
After completion, create `.planning/phases/36-action-queue-and-financial-snapshot/36-action-queue-and-financial-snapshot-01-SUMMARY.md`
</output>
