---
phase: 37-exceptions-trends-and-dashboard-polish
plan: "02"
type: execute
wave: 2
depends_on:
  - 37-exceptions-trends-and-dashboard-polish-01
files_modified:
  - frontend/src/pages/dashboard/dashboard-page.tsx
  - frontend/src/features/dashboard/dashboard-recent-activity.tsx
  - frontend/src/features/dashboard/dashboard-activity-trend-strip.tsx
  - frontend/src/__tests__/dashboard-information-architecture.test.tsx
autonomous: false
requirements:
  - DASH-08
  - DASH-09
must_haves:
  truths:
    - User sees Recent Activity as a compact, low-profile audit log that remains readable but visually secondary to Needs Attention.
    - User sees supporting trend/timeline context that helps interpret active-period upcoming and completed activity.
    - User continues to see exact date-boundary microcopy precision on Current position cards (for example `Based on events due in Mar 1 - Mar 31`).
    - User can use the same priority hierarchy comfortably on desktop and mobile after polish updates.
  artifacts:
    - path: frontend/src/features/dashboard/dashboard-recent-activity.tsx
      provides: Compact audit-log rendering with reduced visual weight and preserved readability
      min_lines: 120
    - path: frontend/src/features/dashboard/dashboard-activity-trend-strip.tsx
      provides: Lightweight trend/timeline support panel based on existing dashboard event datasets
      min_lines: 70
    - path: frontend/src/pages/dashboard/dashboard-page.tsx
      provides: Wiring for activity trend context and compact recent-activity placement in final hierarchy
      min_lines: 430
    - path: frontend/src/__tests__/dashboard-information-architecture.test.tsx
      provides: Regression coverage for compact activity profile, trend context presence, and locked summary microcopy precision
      min_lines: 730
  key_links:
    - from: frontend/src/pages/dashboard/dashboard-page.tsx
      to: frontend/src/features/dashboard/dashboard-activity-trend-strip.tsx
      via: pending and completed event aggregates are transformed into active-period trend/timeline context
      pattern: activity|trend|period
    - from: frontend/src/pages/dashboard/dashboard-page.tsx
      to: frontend/src/features/dashboard/dashboard-recent-activity.tsx
      via: completed-event feed is rendered as compact audit-log rows with item detail navigation continuity
      pattern: recent-activity
    - from: frontend/src/pages/dashboard/dashboard-page.tsx
      to: frontend/src/features/dashboard/dashboard-summary-card.tsx
      via: summary-card support microcopy remains exact and date-boundary precise
      pattern: Based on events due in|upcoming rows due in|row overdue in
---

<objective>
Finalize dashboard polish by compressing Recent Activity into a low-profile audit-log style and adding supporting trend context, while preserving exact summary microcopy precision and responsive utility hierarchy.

Purpose: DASH-08 and DASH-09 require interpretive timeline support and responsive clarity without feature sprawl. This plan keeps phase scope as refinement-only and locks the user's microcopy precision requirement.
Output: Compact recent-activity presentation, supporting trend/timeline strip, microcopy-lock regressions, and final browser verification checkpoint.
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
@.planning/phases/37-exceptions-trends-and-dashboard-polish/37-exceptions-trends-and-dashboard-polish-01-PLAN.md
@frontend/src/pages/dashboard/dashboard-page.tsx
@frontend/src/features/dashboard/dashboard-recent-activity.tsx
@frontend/src/features/dashboard/dashboard-summary-card.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add polish regressions for compact activity, trend context, and locked summary microcopy</name>
  <files>frontend/src/__tests__/dashboard-information-architecture.test.tsx</files>
  <action>Expand dashboard architecture regressions to lock three polish behaviors: (1) Recent Activity renders as a compact low-profile audit-log list that is visibly less dominant than Needs Attention, (2) supporting trend/timeline context is present and derived from existing dashboard period data, and (3) Current position summary-card support text remains exact and date-boundary precise with no simplification (including phrases like `Based on events due in Mar 1 - Mar 31` and row-count boundary wording). Keep tests deterministic by freezing `Date.now` and reusing existing mock payload shape; do not add new API contracts.</action>
  <verify>
    <automated>npm --prefix frontend run test -- dashboard-information-architecture</automated>
    <manual>Optional: review assertions to ensure they protect literal summary-card precision copy, not relaxed partial-match wording.</manual>
    <sampling_rate>run after test updates and again after Task 2 implementation</sampling_rate>
  </verify>
  <done>Regression suite fails on any drift in compact activity density, missing trend/timeline context, or summary-card microcopy simplification.</done>
</task>

<task type="auto">
  <name>Task 2: Implement compact audit-log activity and supporting trend strip</name>
  <files>frontend/src/pages/dashboard/dashboard-page.tsx, frontend/src/features/dashboard/dashboard-recent-activity.tsx, frontend/src/features/dashboard/dashboard-activity-trend-strip.tsx</files>
  <action>Refactor `dashboard-recent-activity.tsx` to a compact audit-log style with tighter spacing, lower visual emphasis, and preserved readability so it clearly becomes a secondary surface beneath operational triage. Add `dashboard-activity-trend-strip.tsx` and wire it into dashboard body using existing pending/completed event datasets to present active-period trend/timeline context (for example period-bound counts, completion-vs-upcoming context, and timeline signal hints) without introducing backend changes. Preserve current summary-card computation and support-copy strings exactly; do not simplify or paraphrase date-boundary language in Current position cards. Keep item-detail and `/events` navigation continuity unchanged.</action>
  <verify>
    <automated>npm --prefix frontend run test -- dashboard-information-architecture dashboard-action-queue</automated>
    <manual>Open `/dashboard` and verify Recent Activity reads as a compact audit log, trend strip helps interpret period activity, and summary-card support text remains exact date-boundary wording.</manual>
    <sampling_rate>run after implementation and before checkpoint</sampling_rate>
  </verify>
  <done>Dashboard shows a lower-profile but legible audit-log activity panel plus supporting trend/timeline context, while Current position precision microcopy stays unchanged.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Final browser verification for dashboard polish and precision copy</name>
  <action>Pause after final polish implementation for explicit browser sign-off on hierarchy clarity, trend context usefulness, and strict microcopy precision before phase closeout.</action>
  <what-built>Dashboard now has de-duplicated queue/portfolio structure, clear exception notices, compact audit-log activity presentation, and active-period trend context with locked summary precision wording.</what-built>
  <how-to-verify>
    1. Open `/dashboard` on desktop and verify Needs Attention remains dominant while Portfolio snapshot and notices sit in the right rail; confirm no financial snapshot list surface appears.
    2. Confirm at least one overdue-linked asset card shows a visually obvious exception treatment (for example red border and/or `Needs Attention` badge).
    3. Verify Recent Activity appears as a compact low-profile audit log and does not compete visually with Needs Attention.
    4. Verify the trend/timeline strip explains active-period upcoming/completed context using real dashboard data.
    5. Verify Current position support microcopy still includes exact date-boundary precision language (for example `Based on events due in Mar 1 - Mar 31` and explicit row-count boundary phrases).
    6. Repeat key checks at mobile width and confirm hierarchy intent remains intact.
  </how-to-verify>
  <verify>
    <automated>npm --prefix frontend run test -- dashboard-information-architecture dashboard-action-queue</automated>
    <manual>Complete the six browser checks above and approve only if hierarchy, trend context, and precision copy all hold without regression.</manual>
    <sampling_rate>run immediately before checkpoint sign-off</sampling_rate>
  </verify>
  <done>User confirms dashboard polish improves clarity and context while preserving exact precision microcopy and responsive utility hierarchy.</done>
  <resume-signal>Type `approved` to close Phase 37, or list specific polish regressions to address in a gap-closure plan.</resume-signal>
</task>

</tasks>

<verification>
Run `npm --prefix frontend run test -- dashboard-information-architecture dashboard-action-queue`.

Then complete the blocking browser checkpoint to confirm compact audit-log hierarchy, trend interpretability, and exact Current position microcopy precision.
</verification>

<success_criteria>
Users get compact but readable audit feedback, period-aware trend context for interpreting activity, and unchanged precision summary wording while the utility-first hierarchy remains strong across desktop and mobile.
</success_criteria>

<output>
After completion, create `.planning/phases/37-exceptions-trends-and-dashboard-polish/37-exceptions-trends-and-dashboard-polish-02-SUMMARY.md`
</output>
