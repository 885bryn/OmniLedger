---
phase: 30-upcoming-ledger-foundation
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/pages/events/events-page.tsx
  - frontend/src/locales/en/common.json
  - frontend/src/locales/zh/common.json
  - frontend/src/__tests__/events-ledger-page.test.tsx
autonomous: true
requirements:
  - LEDGER-01
  - LEDGER-02
  - LEDGER-03
must_haves:
  truths:
    - User can open the Events page on the `Upcoming` tab and switch to `History` without leaving the ledger surface.
    - User sees pending upcoming events grouped into `Overdue`, `This Week`, `Later This Month`, and `Future`, with empty groups hidden.
    - User can tell `This Week` is a rolling 7-day window, not a fixed calendar week.
    - User sees overdue rows called out with urgent red accents while the page remains read-only.
    - User sees the tab bar and upcoming section headers remain visible while scrolling long ledgers.
    - User sees `History` as an intentional empty state in this phase, even though the tab already exists.
  artifacts:
    - path: frontend/src/pages/events/events-page.tsx
      provides: Read-only ledger tabs, rolling upcoming grouping, sticky tab/header behavior, compact ledger cards, calm loading/empty/error states
      min_lines: 250
    - path: frontend/src/locales/en/common.json
      provides: English ledger tab, grouping, empty-state, and recovery copy
      contains: '"events"'
    - path: frontend/src/locales/zh/common.json
      provides: Chinese ledger tab, grouping, empty-state, and recovery copy
      contains: '"events"'
    - path: frontend/src/__tests__/events-ledger-page.test.tsx
      provides: Focused regression coverage for the read-only grouped ledger contract
      min_lines: 120
  key_links:
    - from: frontend/src/pages/events/events-page.tsx
      to: /events
      via: react-query fetch using existing list params
      pattern: apiRequest<EventsResponse>\(`/events\?
    - from: frontend/src/pages/events/events-page.tsx
      to: frontend/src/locales/en/common.json
      via: events translation keys
      pattern: t\('events\.
    - from: frontend/src/pages/events/events-page.tsx
      to: frontend/src/__tests__/events-ledger-page.test.tsx
      via: rendered grouping, sticky hooks, and read-only tab behavior
      pattern: data-event-group|sticky|History
---

<objective>
Deliver the Phase 30 read-only Events ledger foundation so users can scan upcoming obligations in compact chronological groups before any state-changing ledger workflows ship.

Purpose: Replace the current action-heavy Events page with the locked v4.3 foundation contract: visible `Upcoming`/`History` tabs, rolling upcoming grouping, sticky chronology, urgent overdue emphasis, and calm empty/loading/error handling.
Output: One autonomous implementation plan for the read-only ledger page plus focused frontend regressions that hand off cleanly into the required manual browser gate.
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
@.planning/phases/30-upcoming-ledger-foundation/30-CONTEXT.md
@.planning/phases/29-cadence-toggle-synced-cashflow-view/29-cadence-toggle-synced-cashflow-view-01-SUMMARY.md
@.planning/phases/26-motion-interaction-patterns/26-motion-interaction-patterns-01-SUMMARY.md
@frontend/src/pages/events/events-page.tsx
@frontend/src/locales/en/common.json
@frontend/src/locales/zh/common.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rebuild the Events page into the read-only upcoming ledger foundation</name>
  <files>frontend/src/pages/events/events-page.tsx, frontend/src/locales/en/common.json, frontend/src/locales/zh/common.json</files>
  <action>Refactor `EventsPage` into the Phase 30 read-only ledger surface. Keep the existing `/events?status=all` and item lookup queries plus RBAC/lens wiring intact, but stop surfacing state-changing controls on this page: remove or hide `EditEventRowAction`, `CompleteEventRowAction`, undo actions, counts, and any copy that implies history is already populated. Make `Upcoming` the default tab, keep the tab bar visible while the page scrolls, and render upcoming rows as compact scan-first cards that lead with event name plus linked item context and always show due date and amount. Group only non-completed rows into `Overdue`, `This Week`, `Later This Month`, and `Future` using current-calendar-day boundaries; treat `Overdue` as any due date before today's calendar day, `This Week` as a rolling inclusive 7-day window that the UI explicitly explains, `Later This Month` as the remainder of the current month after that window, and `Future` as anything later. Hide empty groups, sort rows within each visible group by soonest due first, and make each upcoming section header sticky so chronology stays visible in long lists. Keep overdue styling urgent with red accents but not destructive-card styling. Render `History` as an intentionally empty placeholder in this phase even if completed rows are present in the fetched response. Replace the current instructional empty state with a calm all-clear empty state, use skeleton groups/cards during initial load so the ledger shape is visible immediately, and keep error treatment plain and recovery-oriented with a lightweight retry path if one is added. Preserve existing shared motion/shadcn patterns; do not add mark-paid behavior, populated history rendering, or manual historical injection.</action>
  <verify>
    <automated>npm --prefix frontend run typecheck</automated>
    <manual>During the post-phase browser gate, open `/events`, confirm the page lands on `Upcoming`, the tab bar stays visible while scrolling, section headers stick over long lists, overdue rows carry the urgent accent, `This Week` is explained as rolling, and `History` shows the purposeful empty state.</manual>
    <sampling_rate>run after task completion and again after Task 2 regressions land</sampling_rate>
  </verify>
  <done>The Events page is read-only, defaults to `Upcoming`, shows only the locked Phase 30 upcoming groups with hidden empty buckets, keeps tabs/headers sticky, communicates the rolling 7-day window, and shows calm loading/empty/error/history-empty states without exposing later-phase behavior.</done>
</task>

<task type="auto">
  <name>Task 2: Lock the ledger contract with focused frontend regressions</name>
  <files>frontend/src/__tests__/events-ledger-page.test.tsx</files>
  <action>Create a focused Vitest file for the Phase 30 ledger foundation instead of extending the broad dashboard flow suite. Cover the locked behaviors that can regress silently: `Upcoming` is the default tab, the page can switch to `History`, completed rows are not rendered into a populated history ledger yet, upcoming rows are bucketed into `Overdue`/`This Week`/`Later This Month`/`Future` using calendar-day logic, the rolling 7-day explanation is visible, empty groups stay hidden, overdue rows expose a durable hook/class/assertable label for urgent styling, and the page does not render edit/complete/undo actions on the read-only ledger. Also cover the calm loading and recovery copy so the manual browser gate only needs to confirm visual feel and sticky scrolling behavior, not basic contract correctness.</action>
  <verify>
    <automated>npm --prefix frontend run test -- events-ledger-page</automated>
    <manual>Browser gate remains required after execution: use the automated coverage for contract safety, then manually verify sticky behavior and overall scan-first feel before Phase 31 begins.</manual>
    <sampling_rate>run after this task before writing the phase summary</sampling_rate>
  </verify>
  <done>A dedicated ledger regression suite passes and proves the read-only tab, grouping, empty-state, and no-actions contract without relying on the later manual gate to catch basic logic failures.</done>
</task>

</tasks>

<verification>
Run `npm --prefix frontend run test -- events-ledger-page` and `npm --prefix frontend run typecheck`.

Manual browser handoff after execution: open `/events` with enough upcoming rows to scroll, verify sticky tabs and sticky upcoming section headers, confirm overdue accenting stays legible, and confirm `History` remains intentionally empty before Phase 31 is allowed to start.
</verification>

<success_criteria>
The Events page ships as a read-only ledger foundation with visible `Upcoming` and `History` tabs, compact upcoming cards grouped into the four locked chronology buckets, sticky tabs and sticky upcoming section headers, urgent overdue treatment, hidden empty groups, rolling-week explanation copy, calm loading/empty/error/history-empty states, and automated frontend regressions that make the required manual browser gate explicit.
</success_criteria>

<output>
After completion, create `.planning/phases/30-upcoming-ledger-foundation/30-upcoming-ledger-foundation-01-SUMMARY.md`
</output>
