---
phase: 37-exceptions-trends-and-dashboard-polish
plan: "01"
type: execute
wave: 1
depends_on:
  - 36-action-queue-and-financial-snapshot-02
files_modified:
  - frontend/src/pages/dashboard/dashboard-page.tsx
  - frontend/src/features/dashboard/dashboard-exception-notices.tsx
  - frontend/src/__tests__/dashboard-information-architecture.test.tsx
  - frontend/src/__tests__/dashboard-financial-snapshot.test.tsx
autonomous: true
requirements:
  - DASH-07
  - DASH-09
must_haves:
  truths:
    - User no longer sees the dashboard financial snapshot list competing with the Needs Attention queue.
    - User sees a two-column dashboard body on desktop with Needs Attention dominant on the left and portfolio plus exception notices in a right rail around 40% width.
    - User immediately sees prominent overdue exception treatment on portfolio asset cards when linked rows are overdue.
    - User keeps the same utility-first hierarchy on mobile without duplicated operational lists.
  artifacts:
    - path: frontend/src/pages/dashboard/dashboard-page.tsx
      provides: Dashboard body layout refactor removing financial snapshot render path and wiring 60/40 left-right hierarchy
      min_lines: 420
    - path: frontend/src/features/dashboard/dashboard-exception-notices.tsx
      provides: Calm exception/notice panel for overdue spikes and manual-override/admin signals using existing query data
      min_lines: 80
    - path: frontend/src/__tests__/dashboard-information-architecture.test.tsx
      provides: Regression coverage for deduplicated layout, right-rail portfolio placement, and responsive hierarchy continuity
      min_lines: 700
    - path: frontend/src/__tests__/dashboard-financial-snapshot.test.tsx
      provides: Regression guard that old financial snapshot list surface is not rendered on dashboard
      min_lines: 200
  key_links:
    - from: frontend/src/pages/dashboard/dashboard-page.tsx
      to: frontend/src/features/dashboard/dashboard-exception-notices.tsx
      via: dashboard metrics and event state feed exception notices without new backend contracts
      pattern: manualOverrideCount|overdue
    - from: frontend/src/pages/dashboard/dashboard-page.tsx
      to: /items/:itemId
      via: portfolio asset cards remain direct drill-in links with added overdue exception indicator
      pattern: /items/
    - from: frontend/src/pages/dashboard/dashboard-page.tsx
      to: frontend/src/features/dashboard/dashboard-financial-snapshot.tsx
      via: legacy financial snapshot import and render path are removed from dashboard composition
      pattern: DashboardFinancialSnapshot
---

<objective>
Remove dashboard redundancy and elevate operational hierarchy by eliminating the duplicate financial snapshot list, then placing portfolio and exception awareness in the right rail beside Needs Attention.

Purpose: DASH-07 and DASH-09 require calm but visible exception signaling and responsive utility hierarchy. This plan enforces the locked de-duplication and 60/40 layout decisions while keeping existing event/item data contracts unchanged.
Output: Dashboard layout refactor, exception-notice component, prominent overdue asset-card signals, and regressions that lock de-duplication plus hierarchy behavior.
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
@.planning/phases/37-exceptions-trends-and-dashboard-polish/37-CONTEXT.md
@.planning/phases/36-action-queue-and-financial-snapshot/36-action-queue-and-financial-snapshot-02-SUMMARY.md
@frontend/src/pages/dashboard/dashboard-page.tsx
@frontend/src/features/dashboard/dashboard-financial-snapshot.tsx
@frontend/src/features/dashboard/dashboard-action-queue.tsx
@frontend/src/features/dashboard/dashboard-layout.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add regression guards for dashboard de-duplication and right-rail hierarchy</name>
  <files>frontend/src/__tests__/dashboard-information-architecture.test.tsx, frontend/src/__tests__/dashboard-financial-snapshot.test.tsx</files>
  <action>Update dashboard tests to encode every locked hierarchy decision before refactor work: assert the financial snapshot section is absent from dashboard rendering, assert `Needs Attention` remains the primary left-column queue, assert `Portfolio snapshot` renders in the right rail adjacent to Needs Attention at desktop widths, and assert portfolio cards show a prominent overdue exception treatment when the asset has overdue linked rows. Keep the tests contract-level by using existing mocked `/events` and `/items` data only; do not introduce new API mocks or backend fields. Ensure responsive assertions still verify the same priority order on mobile stack.</action>
  <verify>
    <automated>npm --prefix frontend run test -- dashboard-information-architecture dashboard-financial-snapshot</automated>
    <manual>Optional: confirm test names explicitly reference de-duplication, right-rail hierarchy, and asset overdue exception visibility.</manual>
    <sampling_rate>run after test updates and again after Task 2 implementation</sampling_rate>
  </verify>
  <done>Regression coverage fails if the dashboard reintroduces the snapshot list, breaks 60/40 hierarchy intent, or hides overdue exception prominence on portfolio cards.</done>
</task>

<task type="auto">
  <name>Task 2: Refactor dashboard body to 60/40 queue-plus-portfolio with exception notices</name>
  <files>frontend/src/pages/dashboard/dashboard-page.tsx, frontend/src/features/dashboard/dashboard-exception-notices.tsx</files>
  <action>Refactor dashboard composition to remove or fully hide the `DashboardFinancialSnapshot` list surface from presentation, then implement a desktop body layout where `Needs Attention` occupies the dominant left column and a right rail (~40%) contains `Portfolio snapshot` plus a calm exception/notice panel. Create `dashboard-exception-notices.tsx` and wire it from existing dashboard metrics/event state so it surfaces meaningful notices (manual overrides/admin signals and unusual overdue conditions) without adding backend contracts. In portfolio cards, compute overdue linkage from existing pending events and add a visually obvious exception treatment (for example red border plus `Needs Attention` badge) when overdue exists. Preserve all existing `/events` and `/items/:itemId` navigation handoffs and keep mobile collapse order aligned to priority hierarchy.</action>
  <verify>
    <automated>npm --prefix frontend run test -- dashboard-information-architecture dashboard-financial-snapshot dashboard-action-queue</automated>
    <manual>Open `/dashboard` at desktop and mobile widths and confirm no financial snapshot list is present, right rail hosts portfolio + notices beside queue on desktop, and overdue asset cards are clearly flagged.</manual>
    <sampling_rate>run after implementation before handoff to Plan 02</sampling_rate>
  </verify>
  <done>Dashboard no longer duplicates queue data with a snapshot list, portfolio is elevated into the right rail next to Needs Attention, and overdue asset exceptions are unmistakable while existing workflows stay intact.</done>
</task>

</tasks>

<verification>
Run `npm --prefix frontend run test -- dashboard-information-architecture dashboard-financial-snapshot dashboard-action-queue`.

Confirm the dashboard body has no duplicate financial snapshot list, preserves a queue-dominant 60/40 hierarchy on desktop, and clearly signals overdue exceptions on portfolio cards.
</verification>

<success_criteria>
Users see one primary operational queue without snapshot duplication, can scan portfolio and exception status in an adjacent right rail, and can still use the dashboard hierarchy comfortably across desktop and mobile.
</success_criteria>

<output>
After completion, create `.planning/phases/37-exceptions-trends-and-dashboard-polish/37-exceptions-trends-and-dashboard-polish-01-SUMMARY.md`
</output>
