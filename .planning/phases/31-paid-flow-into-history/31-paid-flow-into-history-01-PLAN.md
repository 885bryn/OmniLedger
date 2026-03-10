---
phase: 31-paid-flow-into-history
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/pages/events/events-page.tsx
  - frontend/src/features/events/mark-paid-ledger-action.tsx
  - frontend/src/locales/en/common.json
  - frontend/src/locales/zh/common.json
  - frontend/src/__tests__/events-ledger-page.test.tsx
autonomous: true
requirements:
  - FLOW-02
  - FLOW-03
  - FLOW-04
  - LEDGER-04
must_haves:
  truths:
    - User can mark an upcoming row as paid directly inside the Upcoming ledger without opening a blocking confirmation flow.
    - User sees the paid row stay visible but non-repeatable while saving, then leave Upcoming and show up in History without a manual refresh.
    - User sees completed history grouped into reverse-chronological month/year sections such as `March 2026`.
    - User can still read event name, paid date, amount, and linked item context after the row moves into History.
    - User sees shared spring motion keep the ledger reflow legible, with only a subtle highlight on newly arrived history rows.
    - User sees inline retry/error recovery on the same row if saving fails, and calm catch-up messaging if success lands before history refresh catches up.
  artifacts:
    - path: frontend/src/pages/events/events-page.tsx
      provides: Upcoming inline pay flow, optimistic ledger transition state, and grouped completed-history rendering
      min_lines: 350
    - path: frontend/src/features/events/mark-paid-ledger-action.tsx
      provides: Inline mark-paid mutation surface with pending, success, failure, and retry states tuned for the ledger
      min_lines: 80
    - path: frontend/src/locales/en/common.json
      provides: English copy for inline mark-paid, paid acknowledgement, history grouping context, retry, and catch-up states
      contains: '"events"'
    - path: frontend/src/locales/zh/common.json
      provides: Chinese copy for inline mark-paid, paid acknowledgement, history grouping context, retry, and catch-up states
      contains: '"events"'
    - path: frontend/src/__tests__/events-ledger-page.test.tsx
      provides: Focused regressions for inline mark-paid, optimistic history arrival, animation hooks, and recovery states
      min_lines: 220
  key_links:
    - from: frontend/src/features/events/mark-paid-ledger-action.tsx
      to: /events/:id/complete
      via: inline react-query mutation using the existing completion route without a confirmation dialog
      pattern: /events/.*/complete
    - from: frontend/src/pages/events/events-page.tsx
      to: frontend/src/features/events/mark-paid-ledger-action.tsx
      via: upcoming rows pass ledger-local pending, success, retry, and acknowledgement state into the inline action
      pattern: MarkPaidLedgerAction
    - from: frontend/src/pages/events/events-page.tsx
      to: frontend/src/components/ui/motion-panel-list.tsx
      via: shared MotionPanelList spring layout and subtle highlight for newly arrived history rows
      pattern: highlightedKeys|MotionPanelList
---

<objective>
Deliver the Phase 31 paid-flow ledger so users can resolve projected obligations inline and immediately trust the completed ledger history.

Purpose: Extend the Phase 30 read-only Events ledger into a fast completion workflow that keeps mark-paid inline, uses today's completion date, preserves legibility through shared spring motion, and makes History feel like a trustworthy archive instead of a placeholder.
Output: One autonomous frontend plan that adds inline mark-paid behavior, populated History month/year sections, calm pending/failure/catch-up states, locale copy, and focused regression coverage before the required browser handoff.
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
@.planning/phases/31-paid-flow-into-history/31-CONTEXT.md
@.planning/phases/30-upcoming-ledger-foundation/30-upcoming-ledger-foundation-01-SUMMARY.md
@.planning/phases/26-motion-interaction-patterns/26-motion-interaction-patterns-01-SUMMARY.md
@.planning/phases/04-event-completion-and-audit-traceability/04-01-SUMMARY.md
@frontend/src/pages/events/events-page.tsx
@frontend/src/features/events/complete-event-row-action.tsx
@frontend/src/components/ui/motion-panel-list.tsx
@frontend/src/lib/motion.ts
@frontend/src/__tests__/events-ledger-page.test.tsx
@src/api/routes/events.routes.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add inline mark-paid ledger flow with immediate move-to-history behavior</name>
  <files>frontend/src/pages/events/events-page.tsx, frontend/src/features/events/mark-paid-ledger-action.tsx, frontend/src/locales/en/common.json, frontend/src/locales/zh/common.json</files>
  <action>Create a ledger-specific inline mark-paid action instead of reusing the existing confirm-dialog completion control. Keep the Events page on the existing `/events?status=all` and item lookup queries plus admin-scope wiring, but add row-local mutation state for Upcoming cards: `Mark Paid` lives inline on each upcoming card, uses the existing `PATCH /events/:id/complete` route, assumes today's calendar day as the completion date for the immediate ledger acknowledgement, disables itself while the save is in flight, and ignores duplicate taps by leaving the same row visible but non-interactive until the request settles. On success, briefly swap the row into a calm paid acknowledgement state, then animate it out of Upcoming and into ledger-local completed state before the background refresh finishes. If the mutation fails, keep the row in place and show inline failure plus retry on that same row; do not rely on toast-only recovery or a modal. If the save succeeds but the follow-up history refresh lags or fails, prioritize success messaging first and show a calm catch-up message instead of rolling the row back. Preserve existing owner/admin scope guarantees, do not add undo, do not add manual-history entry points, and do not introduce backend override semantics beyond the current completion route.</action>
  <verify>
    <automated>npm --prefix frontend run typecheck</automated>
    <manual>During the required post-phase browser gate, open `/events`, mark an upcoming row paid, confirm the button is inline with no blocking dialog, the row stays visible-but-disabled while saving, then briefly acknowledges payment and exits Upcoming even before a manual refresh.</manual>
    <sampling_rate>run after task completion and again after Task 2 regression updates land</sampling_rate>
  </verify>
  <done>The Upcoming ledger exposes an inline mark-paid action that uses today's date for immediate acknowledgement, prevents duplicate submissions while pending, exits rows with shared spring motion after success, keeps failures recoverable inline, and keeps success visible even if the history refetch is temporarily behind.</done>
</task>

<task type="auto">
  <name>Task 2: Render grouped completed history and lock the paid-flow contract with frontend regressions</name>
  <files>frontend/src/pages/events/events-page.tsx, frontend/src/locales/en/common.json, frontend/src/locales/zh/common.json, frontend/src/__tests__/events-ledger-page.test.tsx</files>
  <action>Replace the intentional Phase 30 History placeholder with real completed-ledger rendering. Build History from completed API rows plus any newly succeeded local completions, group rows by paid month/year (`March 2026`) in reverse chronological order, and sort rows inside each month with most recently paid first. Each history row should lead with the event name and paid date, while amount and linked item context remain plainly visible as secondary details. Use the shared MotionPanelList spring contract for both the Upcoming reflow and the newly arrived History rows, but keep the arrival treatment subtle: a light highlight only, never celebratory animation. Expand the focused ledger regression suite so it proves the locked Phase 31 behaviors: inline `Mark Paid` exists on Upcoming rows, no confirm dialog opens, duplicate taps are ignored while pending, success moves the row into History without a manual refresh, History sections render by month/year in newest-first order, newly arrived rows expose a subtle highlight hook, inline failure+retry stays on the originating row, and the calm history-catching-up message appears when success lands before the refresh does. Keep scope strictly to the global Events ledger; do not add search, manual injection, progress meters, or broader event editing flows.</action>
  <verify>
    <automated>npm --prefix frontend run test -- events-ledger-page</automated>
    <manual>Browser handoff remains required after execution: on `/events`, switch to `History`, confirm completed rows appear under month/year headings with paid date first, amount and item context still readable, newly arrived rows only lightly highlighted, and overall motion stays legible rather than flashy.</manual>
    <sampling_rate>run after this task before writing the phase summary</sampling_rate>
  </verify>
  <done>The History tab is populated and grouped by reverse-chronological month/year sections, the paid-flow UX matches the locked inline/pending/failure/catch-up decisions, and focused frontend regressions fail if the row no longer moves immediately, if history grouping regresses, or if motion/inline recovery hooks disappear.</done>
</task>

</tasks>

<verification>
Run `npm --prefix frontend run typecheck` and `npm --prefix frontend run test -- events-ledger-page`.

Manual browser handoff after execution: open `/events`, mark an upcoming row paid, confirm there is no blocking dialog, confirm the row stays visible but disabled while saving, confirm it briefly acknowledges payment before animating out, then switch to `History` and verify the completed row appears under the correct month/year heading with paid date leading, amount and item context still visible, and only a subtle arrival highlight. If the app shows history catch-up copy after a successful payment, verify the success state remains clear and the row appears once refresh finishes.
</verification>

<success_criteria>
The Events page now supports inline mark-paid actions directly from Upcoming, moves successful rows into History immediately without waiting for a manual refresh, renders completed history by reverse-chronological month/year sections, preserves readable amount and item context, uses shared spring motion to keep reflow legible, and includes automated regressions plus an explicit manual browser handoff for the required post-phase gate.
</success_criteria>

<output>
After completion, create `.planning/phases/31-paid-flow-into-history/31-paid-flow-into-history-01-SUMMARY.md`
</output>
