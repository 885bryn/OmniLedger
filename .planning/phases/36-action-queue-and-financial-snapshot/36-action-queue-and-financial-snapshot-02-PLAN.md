---
phase: 36-action-queue-and-financial-snapshot
plan: "02"
type: execute
wave: 2
depends_on:
  - 36-action-queue-and-financial-snapshot-01
files_modified:
  - frontend/src/pages/dashboard/dashboard-page.tsx
  - frontend/src/features/dashboard/dashboard-financial-snapshot.tsx
  - frontend/src/features/dashboard/dashboard-summary-card.tsx
  - frontend/src/__tests__/dashboard-financial-snapshot.test.tsx
  - frontend/src/locales/en/common.json
  - frontend/src/locales/zh/common.json
autonomous: false
requirements:
  - DASH-05
  - DASH-06
must_haves:
  truths:
    - User can scan a dense but readable financial snapshot table/list with one row per financial item and high-value metadata.
    - User can distinguish core row facts quickly (item name/type, status signal, next due context, and amount context) without opening item detail first.
    - User can move from summary cards and snapshot rows into `/events` and item-detail workflows while preserving navigation context.
    - User can use the snapshot comfortably on desktop and mobile without losing row readability.
  artifacts:
    - path: frontend/src/features/dashboard/dashboard-financial-snapshot.tsx
      provides: Reusable financial snapshot section with dense row layout, metadata chips, and responsive fallback structure
      min_lines: 170
    - path: frontend/src/pages/dashboard/dashboard-page.tsx
      provides: Dashboard wiring that feeds summary and snapshot navigation paths from existing query data
      min_lines: 400
    - path: frontend/src/__tests__/dashboard-financial-snapshot.test.tsx
      provides: Focused regressions for snapshot row readability, metadata rendering, and navigation affordances
      min_lines: 140
    - path: frontend/src/features/dashboard/dashboard-summary-card.tsx
      provides: Summary-card link behavior aligned with snapshot and events handoff expectations
      min_lines: 60
  key_links:
    - from: frontend/src/pages/dashboard/dashboard-page.tsx
      to: frontend/src/features/dashboard/dashboard-financial-snapshot.tsx
      via: dashboard item/query data is shaped into dense snapshot row props rather than ad hoc page markup
      pattern: financial snapshot|item
    - from: frontend/src/features/dashboard/dashboard-financial-snapshot.tsx
      to: /items/:itemId
      via: each row provides direct item-detail drill-through with return-to state
      pattern: /items/
    - from: frontend/src/features/dashboard/dashboard-summary-card.tsx
      to: /events
      via: summary cards preserve direct operational handoff into events workflow
      pattern: /events
---

<objective>
Add a reusable financial snapshot section that gives users a dense operational scan of item-level status while preserving direct, context-safe navigation from dashboard summary and row surfaces.

Purpose: DASH-05 and DASH-06 are satisfied only if the dashboard surfaces compact item-level status metadata and keeps movement into `/events` and item detail obvious and low-friction.
Output: A reusable snapshot component, dashboard integration updates, bilingual row/metadata copy, focused snapshot regressions, and a blocking browser verification gate for usability confidence.
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
@.planning/phases/36-action-queue-and-financial-snapshot/36-action-queue-and-financial-snapshot-01-SUMMARY.md
@frontend/src/pages/dashboard/dashboard-page.tsx
@frontend/src/features/dashboard/dashboard-summary-card.tsx
@frontend/src/features/dashboard/data-card.tsx
@frontend/src/locales/en/common.json
@frontend/src/locales/zh/common.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add focused financial snapshot regression coverage</name>
  <files>frontend/src/__tests__/dashboard-financial-snapshot.test.tsx</files>
  <action>Create a dedicated financial-snapshot test suite that renders dashboard snapshot data with mixed financial item states and asserts scan-first row readability: dense row layout, stable row ordering, key metadata presence (item identity, subtype/status signal, amount context, and due context), and responsive-safe fallback behavior for narrow widths. Include explicit assertions that snapshot rows navigate to `/items/:itemId` and that summary-card/queue continuation links still route to `/events` where expected, so DASH-06 navigation guarantees are locked alongside DASH-05 density goals.</action>
  <verify>
    <automated>npm --prefix frontend run test -- dashboard-financial-snapshot</automated>
    <manual>Optional: confirm test fixtures include both commitment and income-style rows plus mixed due-state metadata.</manual>
    <sampling_rate>run after test creation and again after Task 2 implementation</sampling_rate>
  </verify>
  <done>A dedicated snapshot regression file exists and fails when row density/readability, metadata signals, responsive behavior, or navigation handoffs regress.</done>
</task>

<task type="auto">
  <name>Task 2: Implement reusable dashboard financial snapshot section</name>
  <files>frontend/src/pages/dashboard/dashboard-page.tsx, frontend/src/features/dashboard/dashboard-financial-snapshot.tsx, frontend/src/features/dashboard/dashboard-summary-card.tsx, frontend/src/locales/en/common.json, frontend/src/locales/zh/common.json</files>
  <action>Create `frontend/src/features/dashboard/dashboard-financial-snapshot.tsx` as a reusable section component and wire it into the dashboard so users can scan financial item state in dense, readable rows. Use existing dashboard/item data sources only; do not add backend endpoints or payload contract changes. Ensure each row exposes the highest-value operational metadata (item name + subtype, status/due context, amount context, and a direct item-detail drill-through with `returnTo` state). Keep density high but readable across breakpoints by preserving typography hierarchy and row spacing tuned for mobile touch targets. Align summary-card and section links so dashboard summary/action surfaces continue handing off to `/events` and item detail consistently, with no dead-end navigation paths.</action>
  <verify>
    <automated>npm --prefix frontend run test -- dashboard-financial-snapshot dashboard-action-queue dashboard-information-architecture</automated>
    <manual>Open `/dashboard` on desktop and mobile widths and confirm snapshot rows remain compact yet readable, row metadata is complete, and links from summary/snapshot surfaces land in `/events` or item detail without losing context.</manual>
    <sampling_rate>run after implementation and before the blocking browser checkpoint</sampling_rate>
  </verify>
  <done>The dashboard includes a reusable financial snapshot section with dense readable rows, localized metadata copy, and verified navigation continuity from summary/action/snapshot surfaces into existing workflows.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Validate dashboard task-completion utility in browser</name>
  <action>Pause after queue and financial snapshot implementation so the user can verify that the dashboard now supports real triage and item scanning workflows without ambiguity. This checkpoint closes the phase execution gate in ROADMAP.</action>
  <what-built>Dashboard now includes urgency-first queue behavior from Plan 01 plus a dense reusable financial snapshot section with direct workflow navigation.</what-built>
  <how-to-verify>
    1. Open `/dashboard` and verify queue sections render as `Overdue` then `Upcoming`, with overdue age buckets and 14-day upcoming horizon behavior.
    2. Confirm queue rows provide clear handoff to `/events` and item detail actions without adding unfamiliar workflows.
    3. Confirm the financial snapshot section shows dense but readable item rows with key metadata visible at a glance.
    4. Click snapshot row links and verify item detail opens with return navigation context preserved.
    5. Confirm summary and action links still route to `/events` for full triage continuation.
    6. Repeat checks at mobile width and confirm hierarchy/readability remain usable.
  </how-to-verify>
  <verify>
    <automated>npm --prefix frontend run test -- dashboard-financial-snapshot dashboard-action-queue dashboard-information-architecture</automated>
    <manual>Run the 6 browser checks above and confirm the dashboard supports quick triage and snapshot scanning better than the prior surface.</manual>
    <sampling_rate>run immediately before checkpoint sign-off</sampling_rate>
  </verify>
  <done>User approves that dashboard queue + snapshot support urgent action and dense scanning with clear navigation into `/events` and item detail workflows.</done>
  <resume-signal>Type `approved` to close Phase 36, or list concrete queue/snapshot usability gaps for follow-up planning.</resume-signal>
</task>

</tasks>

<verification>
Run `npm --prefix frontend run test -- dashboard-financial-snapshot dashboard-action-queue dashboard-information-architecture`.

Then complete the blocking browser checkpoint to confirm queue triage and financial snapshot scanning both feel operationally useful on desktop and mobile.
</verification>

<success_criteria>
Users can complete dashboard-first triage by reviewing overdue/upcoming queue items and then scanning a dense financial snapshot with clear metadata, while navigating from summary/queue/snapshot surfaces into `/events` and item detail workflows without losing context.
</success_criteria>

<output>
After completion, create `.planning/phases/36-action-queue-and-financial-snapshot/36-action-queue-and-financial-snapshot-02-SUMMARY.md`
</output>
