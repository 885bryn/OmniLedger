---
phase: 35-dashboard-information-architecture
plan: "01"
type: execute
wave: 1
depends_on:
  - 34-item-detail-events-tab-clarity-01
files_modified:
  - frontend/src/pages/dashboard/dashboard-page.tsx
  - frontend/src/features/dashboard/data-card.tsx
  - frontend/src/features/dashboard/dashboard-layout.tsx
  - frontend/src/__tests__/dashboard-information-architecture.test.tsx
autonomous: true
requirements:
  - DASH-01
must_haves:
  truths:
    - User lands on a dashboard with a clear utility-first hierarchy instead of one undifferentiated overview stack.
    - The first band under the page header is a dedicated summary row reserved for high-level position signals.
    - On smaller screens, the summary cards stack in priority order instead of compressing into a cramped multi-column grid.
    - `Needs Attention` owns the main body column while `Recent Activity` is positioned as a desktop companion and mobile follow-up section.
    - Lower supporting content remains available without displacing the primary summary and action hierarchy.
  artifacts:
    - path: frontend/src/pages/dashboard/dashboard-page.tsx
      provides: Dashboard page wiring that renders the new section order and responsive band layout
      min_lines: 250
    - path: frontend/src/features/dashboard/dashboard-layout.tsx
      provides: Shared dashboard shell primitives for section framing, headings, and responsive body columns
      min_lines: 60
    - path: frontend/src/features/dashboard/data-card.tsx
      provides: Card-level support for denser informational dashboard sections without breaking existing card consumers
      min_lines: 40
    - path: frontend/src/__tests__/dashboard-information-architecture.test.tsx
      provides: Focused frontend regressions proving the redesigned dashboard hierarchy renders in the intended order
      min_lines: 80
  key_links:
    - from: frontend/src/pages/dashboard/dashboard-page.tsx
      to: frontend/src/features/dashboard/dashboard-layout.tsx
      via: dashboard page composes the shell and section primitives instead of ad hoc page-local wrappers
      pattern: DashboardLayout|Needs Attention|Recent Activity
    - from: frontend/src/features/dashboard/data-card.tsx
      to: frontend/src/pages/dashboard/dashboard-page.tsx
      via: summary and support sections keep using the shared shadcn card surface language while adopting denser information layout hooks
      pattern: CardHeader|CardContent|className
    - from: frontend/src/__tests__/dashboard-information-architecture.test.tsx
      to: frontend/src/pages/dashboard/dashboard-page.tsx
      via: tests assert the summary-first band and section-heading hierarchy users rely on for scanability
      pattern: Needs Attention|Recent Activity|Portfolio snapshot
---

<objective>
Establish the dashboard's utility-first shell so the page reads as a finance control center with a summary-first top band, a dominant attention surface, and a calmer activity companion.

Purpose: DASH-01 is only satisfied when the dashboard structure itself guides the eye toward current position first and urgent work second, without adding new workflows, search/filter controls, or chart-heavy analytics.
Output: A reusable dashboard layout scaffold, dashboard page refactor, and focused frontend coverage for the new section hierarchy.
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
@.planning/phases/35-dashboard-information-architecture/35-CONTEXT.md
@.planning/phases/34-item-detail-events-tab-clarity/34-item-detail-events-tab-clarity-01-SUMMARY.md
@frontend/src/pages/dashboard/dashboard-page.tsx
@frontend/src/features/dashboard/data-card.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add a focused regression harness for the dashboard hierarchy</name>
  <files>frontend/src/__tests__/dashboard-information-architecture.test.tsx</files>
  <action>Create a dedicated dashboard information-architecture regression suite that renders the dashboard with mocked queries and asserts the locked section order from context: summary band first, `Needs Attention` as the dominant main-body heading, `Recent Activity` as the companion section, and lower supporting content following afterward. Include explicit coverage for the locked mobile summary behavior so small-screen rendering proves the summary cards stack in priority order instead of collapsing into a tight grid, rather than relying on desktop-only visual assumptions.</action>
  <verify>
    <automated>npm --prefix frontend run test -- dashboard-information-architecture</automated>
    <manual>Optional: inspect the test names to confirm they describe hierarchy and ordering rather than data math.</manual>
    <sampling_rate>run after creating the test scaffold and again after the implementation task completes</sampling_rate>
  </verify>
  <done>A dedicated frontend regression file exists and fails if the dashboard loses its summary-first, attention-first section hierarchy or if the mobile summary cards stop stacking in the intended priority order.</done>
</task>

<task type="auto">
  <name>Task 2: Refactor the dashboard into the new utility-first shell</name>
  <files>frontend/src/pages/dashboard/dashboard-page.tsx, frontend/src/features/dashboard/data-card.tsx, frontend/src/features/dashboard/dashboard-layout.tsx</files>
  <action>Create a reusable dashboard shell helper and refactor `frontend/src/pages/dashboard/dashboard-page.tsx` to follow the locked information architecture exactly: a top summary band directly under the page header, a main body where `Needs Attention` gets the largest column, a desktop-side `Recent Activity` companion that drops below attention on mobile, and lower supporting content that does not compete with the first two bands. Implement the locked mobile summary behavior explicitly so smaller screens stack the summary cards in priority order rather than compressing them into a tight grid. Keep the implementation on existing `shadcn/ui` and project motion primitives, preserve current RBAC/lens-aware query usage and existing navigation targets, and do not add deferred scope such as search, filtering, new workflows, or chart surfaces. Update `frontend/src/features/dashboard/data-card.tsx` only as needed to support denser informational framing without breaking existing card consumers elsewhere.</action>
  <verify>
    <automated>npm --prefix frontend run test -- dashboard-information-architecture</automated>
    <manual>Open `/dashboard` and confirm the page now reads top-to-bottom as summary, action, activity, then supporting sections on desktop and mobile widths, with the summary cards stacked in priority order on smaller screens instead of collapsing into a cramped grid.</manual>
    <sampling_rate>run after implementation and before handing off to Plan 02</sampling_rate>
  </verify>
  <done>The dashboard page renders the new summary-first shell with clear `Needs Attention` and `Recent Activity` sections in the required desktop/mobile order, the mobile summary cards stack in priority order, and the focused layout regressions pass.</done>
</task>

</tasks>

<verification>
Run `npm --prefix frontend run test -- dashboard-information-architecture`.

Confirm the dashboard shell now presents a summary-first band, mobile summary cards that stack in priority order, a dominant attention area, and a companion activity area before any later content work begins.
</verification>

<success_criteria>
Users see a dashboard organized into deliberate utility-first sections, with the summary row first, summary cards stacked in priority order on smaller screens, `Needs Attention` as the primary work surface, `Recent Activity` as the companion feedback surface, and the same hierarchy preserved when the layout collapses for mobile.
</success_criteria>

<output>
After completion, create `.planning/phases/35-dashboard-information-architecture/35-dashboard-information-architecture-01-SUMMARY.md`
</output>
