---
phase: 35-dashboard-information-architecture
plan: "02"
type: execute
wave: 2
depends_on:
  - 35-dashboard-information-architecture-01
files_modified:
  - frontend/src/pages/dashboard/dashboard-page.tsx
  - frontend/src/features/dashboard/dashboard-summary-card.tsx
  - frontend/src/features/dashboard/dashboard-needs-attention.tsx
  - frontend/src/features/dashboard/dashboard-recent-activity.tsx
  - frontend/src/locales/en/common.json
  - frontend/src/locales/zh/common.json
  - frontend/src/__tests__/dashboard-information-architecture.test.tsx
autonomous: false
requirements:
  - DASH-02
  - DASH-03
must_haves:
  truths:
    - User sees four summary cards for net cashflow, upcoming due, overdue, and completed activity with short period-aware supporting text.
    - User can treat `Needs Attention` as the primary triage surface because overdue rows appear before due-soon rows and retain dense scan-friendly metadata.
    - User can treat `Recent Activity` as a calmer companion feed that highlights recent completions and manual overrides without turning into a second urgent queue.
    - User can drill from cards and rows into existing `/events` and item-detail workflows without the dashboard inventing new actions.
  artifacts:
    - path: frontend/src/pages/dashboard/dashboard-page.tsx
      provides: Dashboard data wiring and section composition for summary cards, attention triage, and recent activity
      min_lines: 320
    - path: frontend/src/features/dashboard/dashboard-summary-card.tsx
      provides: Reusable informational summary-card primitive with value, support line, and optional link treatment
      min_lines: 60
    - path: frontend/src/features/dashboard/dashboard-needs-attention.tsx
      provides: Dense overdue-first and due-soon dashboard queue rendering
      min_lines: 70
    - path: frontend/src/features/dashboard/dashboard-recent-activity.tsx
      provides: Supportive recent-completion feed with calm manual-override distinction
      min_lines: 70
    - path: frontend/src/__tests__/dashboard-information-architecture.test.tsx
      provides: Focused frontend coverage for period-aware metrics, attention ordering, and recent-activity behavior
      min_lines: 140
  key_links:
    - from: frontend/src/pages/dashboard/dashboard-page.tsx
      to: frontend/src/features/dashboard/dashboard-summary-card.tsx
      via: summary metrics are rendered through one shared informational card contract with downstream navigation targets
      pattern: dashboard-summary-card|net cashflow|upcoming due|overdue|completed activity
    - from: frontend/src/pages/dashboard/dashboard-page.tsx
      to: frontend/src/features/dashboard/dashboard-needs-attention.tsx
      via: pending event data is sorted overdue-first and passed into the dedicated attention surface
      pattern: overdue|due-soon|Needs Attention
    - from: frontend/src/pages/dashboard/dashboard-page.tsx
      to: frontend/src/features/dashboard/dashboard-recent-activity.tsx
      via: completed and exceptional rows are shaped into a calm supporting feed rather than another urgent queue
      pattern: completed_at|is_manual_override|Recent Activity
    - from: frontend/src/locales/en/common.json
      to: frontend/src/locales/zh/common.json
      via: all new dashboard summary and section copy stays bilingual and aligned
      pattern: dashboard
---

<objective>
Fill the new dashboard shell with period-aware summary cards and first-pass `Needs Attention` plus `Recent Activity` surfaces so users can read position and next actions without leaving the page.

Purpose: DASH-02 and DASH-03 are completed only when the redesigned dashboard shows the four locked top metrics, prioritizes overdue then due-soon triage, and surfaces recent completions/manual overrides as supportive feedback while preserving existing contracts and routes.
Output: Summary-card and section components, localized copy, dashboard data wiring, focused frontend regressions, and a blocking browser approval gate.
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
@frontend/src/pages/dashboard/dashboard-page.tsx
@frontend/src/pages/events/events-page.tsx
@frontend/src/pages/items/item-detail-page.tsx
@frontend/src/features/dashboard/data-card.tsx
@frontend/src/locales/en/common.json
@frontend/src/locales/zh/common.json
@frontend/src/__tests__/dashboard-events-flow.test.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Wire period-aware summary metrics into reusable dashboard cards</name>
  <files>frontend/src/pages/dashboard/dashboard-page.tsx, frontend/src/features/dashboard/dashboard-summary-card.tsx, frontend/src/locales/en/common.json, frontend/src/locales/zh/common.json, frontend/src/__tests__/dashboard-information-architecture.test.tsx</files>
  <action>Create a reusable dashboard summary-card component and replace the generic metric row with the four locked cards: net cashflow, upcoming due, overdue, and completed activity. Keep that same priority order in the DOM and in the small-screen layout so mobile stacks the cards vertically instead of squeezing them into a tight grid. Derive the period context from existing contracts instead of inventing new backend shapes: continue using dashboard event reads for pending/completed counts, and aggregate net cashflow from existing asset `net-status` summaries (using the established `/items/:id/net-status` contract and its `summary.active_period`/`cadence_totals` metadata where available) so the support line can stay period-aware. Each card must include one short supporting line, remain informational rather than CTA-heavy, and only link to existing downstream routes such as `/events` or the relevant item flow when that link is already supported by the current app.</action>
  <verify>
    <automated>npm --prefix frontend run test -- dashboard-information-architecture</automated>
    <manual>Open `/dashboard` and confirm the top row now shows four cards with readable support text instead of the old generic metric blocks, and that mobile stacks them vertically in the same priority order.</manual>
    <sampling_rate>run after the summary-card work lands and again after Task 2 updates the same page</sampling_rate>
  </verify>
  <done>The dashboard renders four period-aware informational summary cards with bilingual copy, the cards use existing data contracts, mobile preserves their priority-order stack, and focused tests protect the metric labels and support-line behavior.</done>
</task>

<task type="auto">
  <name>Task 2: Build the first-pass Needs Attention and Recent Activity surfaces</name>
  <files>frontend/src/pages/dashboard/dashboard-page.tsx, frontend/src/features/dashboard/dashboard-needs-attention.tsx, frontend/src/features/dashboard/dashboard-recent-activity.tsx, frontend/src/locales/en/common.json, frontend/src/locales/zh/common.json, frontend/src/__tests__/dashboard-information-architecture.test.tsx</files>
  <action>Implement the two main dashboard surfaces inside the shell from Plan 01. `Needs Attention` must sort overdue rows before due-soon obligations, keep each row dense but readable, preserve key metadata on mobile (due date, amount, linked item context), and avoid introducing new action types beyond existing navigation or already-supported event actions. `Recent Activity` must render recent completions as a calmer feed, visually distinguish manual overrides or exceptional entries without alarm styling, and avoid becoming a duplicate urgent queue. Update localized copy and focused tests so they assert overdue-first ordering, calm manual-override treatment, and the presence of direct pathways into existing `/events` and item-detail workflows.</action>
  <verify>
    <automated>npm --prefix frontend run test -- dashboard-information-architecture</automated>
    <manual>Open `/dashboard` and confirm overdue rows lead the attention list, recent completions feel secondary/calm, and mobile keeps the same hierarchy with activity moved below attention.</manual>
    <sampling_rate>run after implementation and before the browser checkpoint</sampling_rate>
  </verify>
  <done>The dashboard's primary body now contains a scan-friendly overdue-first `Needs Attention` surface plus a calm `Recent Activity` companion, both backed by focused tests and localized copy.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Run the browser utility-hierarchy gate for the redesigned dashboard</name>
  <action>Pause after the summary cards and both dashboard surfaces ship so the user can judge whether the redesigned hierarchy actually feels more actionable than the old overview. This checkpoint is required because the phase goal is information architecture clarity, which cannot be fully validated by automated tests alone.</action>
  <what-built>Dashboard summary cards now show the locked four metrics, `Needs Attention` acts as the main action queue, and `Recent Activity` acts as the calmer companion feed inside the new utility-first shell.</what-built>
  <how-to-verify>
    1. Open `/dashboard` on desktop and confirm the first visible band is the four-card summary row.
    2. Resize to a mobile width and confirm the summary cards stack vertically in priority order rather than compressing into a tight grid.
    3. Confirm `Needs Attention` occupies the main body area and surfaces overdue entries before due-soon items.
    4. Confirm `Recent Activity` sits to the right on desktop, feels calmer than `Needs Attention`, and manual overrides appear distinct but not alarming.
    5. Confirm the order becomes summary row, `Needs Attention`, `Recent Activity`, then lower supporting sections without losing key row metadata.
    6. Confirm the dashboard feels more like an operations surface than a generic overview and that no deferred search/filter/chart features appeared.
  </how-to-verify>
  <verify>Human browser verification is required after `npm --prefix frontend run test -- dashboard-information-architecture` passes.</verify>
  <done>The user has approved the dashboard's hierarchy, scannability, and mobile flow or has reported concrete UX gaps for a follow-up plan.</done>
  <resume-signal>Type `approved` to finish Phase 35, or describe the hierarchy/scannability issues that still need correction.</resume-signal>
</task>

</tasks>

<verification>
Run `npm --prefix frontend run test -- dashboard-information-architecture`.

Then complete the blocking browser verification to confirm the new summary cards, `Needs Attention`, and `Recent Activity` surfaces feel clearer and more actionable than the prior dashboard.
</verification>

<success_criteria>
Users see four period-aware summary cards for net cashflow, upcoming due, overdue, and completed activity; can immediately identify `Needs Attention` as the primary triage surface and `Recent Activity` as the calmer companion feed; and can move into existing `/events` or item-detail workflows without the dashboard introducing off-scope features.
</success_criteria>

<output>
After completion, create `.planning/phases/35-dashboard-information-architecture/35-dashboard-information-architecture-02-SUMMARY.md`
</output>
