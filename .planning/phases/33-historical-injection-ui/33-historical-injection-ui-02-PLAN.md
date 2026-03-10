---
phase: 33-historical-injection-ui
plan: "02"
type: execute
wave: 2
depends_on:
  - 33-historical-injection-ui-01
files_modified:
  - frontend/src/features/events/log-historical-event-action.tsx
  - frontend/src/pages/items/item-detail-page.tsx
  - frontend/src/locales/en/common.json
  - frontend/src/locales/zh/common.json
  - frontend/src/__tests__/item-detail-ledger.test.tsx
autonomous: false
requirements:
  - EVENT-01
  - SAFE-03
must_haves:
  truths:
    - User can open a modal historical-injection dialog from both item-detail tabs.
    - User can review date, amount, and optional note fields prefilled from item defaults, with helper copy and an inline warning that this is a manual completed entry.
    - Validation and policy failures stay inside the dialog so the user can correct the issue without losing context.
    - After a successful save, the dialog closes, the item detail refreshes in place, and the user lands on the item-detail History view where the new manual row is visible in normal chronology.
    - Admin owner-scope sessions see both actor and target attribution in the dialog while non-admin flows remain uncluttered.
  artifacts:
    - path: frontend/src/features/events/log-historical-event-action.tsx
      provides: Modal dialog action for creating manual historical events with defaults, inline messaging, and mutation handling
      min_lines: 180
    - path: frontend/src/pages/items/item-detail-page.tsx
      provides: Historical injection entry points on both detail tabs plus post-save history reveal and query refresh wiring
      min_lines: 1100
    - path: frontend/src/locales/en/common.json
      provides: English copy for historical injection trigger, helper text, warning banner, validation text, and success toast
      contains: 'historical'
    - path: frontend/src/locales/zh/common.json
      provides: Chinese copy for historical injection trigger, helper text, warning banner, validation text, and success toast
      contains: 'historical'
    - path: frontend/src/__tests__/item-detail-ledger.test.tsx
      provides: Frontend regressions for trigger placement, dialog defaults, inline errors, success refresh, and admin attribution messaging
      min_lines: 1350
  key_links:
    - from: frontend/src/features/events/log-historical-event-action.tsx
      to: /events/manual-override
      via: mutation posts date, amount, optional note, and current scope context to the explicit manual-override route
      pattern: manual-override
    - from: frontend/src/pages/items/item-detail-page.tsx
      to: frontend/src/features/events/log-historical-event-action.tsx
      via: both item-detail tab surfaces launch the same secondary-button dialog workflow
      pattern: log-historical-event-action
    - from: frontend/src/features/events/log-historical-event-action.tsx
      to: frontend/src/pages/items/item-detail-page.tsx
      via: successful save invalidates item/event queries and returns the user to the item-detail history tab for confirmation
      pattern: invalidateQueries|history
---

<objective>
Add the item-detail historical injection workflow that Phase 33 promises: an explicit manual-override dialog reachable from both tabs, with safe inline feedback and a clear post-save return to history.

Purpose: EVENT-01 is completed only when users can actually launch the manual-override flow from item detail, fill date/amount/note defaults in context, understand the exceptional nature of the action, and immediately verify the saved row in history without compromising the Phase 32 safety and attribution patterns.
Output: One implementation plan with two automated UI tasks followed by the required human verification gate for the phase.
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
@.planning/phases/33-historical-injection-ui/33-CONTEXT.md
@.planning/phases/32-manual-override-boundary-contract/32-manual-override-boundary-contract-01-SUMMARY.md
@.planning/phases/32-manual-override-boundary-contract/32-manual-override-boundary-contract-02-SUMMARY.md
@frontend/src/pages/items/item-detail-page.tsx
@frontend/src/__tests__/item-detail-ledger.test.tsx
@frontend/src/features/events/edit-event-row-action.tsx
@frontend/src/features/events/complete-event-row-action.tsx
@frontend/src/features/admin-scope/target-user-chip.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add the historical injection dialog trigger and form workflow to item detail</name>
  <files>frontend/src/features/events/log-historical-event-action.tsx, frontend/src/pages/items/item-detail-page.tsx, frontend/src/locales/en/common.json, frontend/src/locales/zh/common.json, frontend/src/__tests__/item-detail-ledger.test.tsx</files>
  <action>Create a dedicated item-detail action component for logging historical events through the existing `POST /events/manual-override` route. Expose the action from both item-detail tabs as a secondary button, launching a modal dialog rather than a page redirect or inline expander. Prefill the date from the item's last due date when available, otherwise fall back to the current item date metadata pattern already used in detail views; prefill the amount from the item's default amount; keep note optional with a textarea. Include short helper copy explaining that this creates a completed manual historical entry, plus an inline warning banner that frames it as an exceptional manual-override flow. When an admin is acting in an owner-scoped lens, show both actor and target attribution inside the dialog using the established attribution chip pattern. Keep all validation and policy failures inline inside the dialog; do not add a second confirmation step, checkbox, or global navigation jump.</action>
  <verify>
    <automated>npm --prefix frontend run test -- item-detail-ledger</automated>
    <manual>Open an item detail page for a financial item, confirm each tab shows a secondary historical-entry action, open the modal, and verify the date, amount, helper copy, warning banner, optional note field, and admin actor/target attribution appear as expected.</manual>
    <sampling_rate>run after task completion and again after Task 2 because both tasks extend the same item-detail workflow</sampling_rate>
  </verify>
  <done>The item-detail page offers the historical injection action from both tabs, the modal dialog contains date/amount/note fields with correct defaults and exceptional-flow messaging, and inline attribution/error surfaces follow existing admin and safety patterns.</done>
</task>

<task type="auto">
  <name>Task 2: Close on success, refresh data in place, and reveal the saved manual row in item-detail history</name>
  <files>frontend/src/features/events/log-historical-event-action.tsx, frontend/src/pages/items/item-detail-page.tsx, frontend/src/locales/en/common.json, frontend/src/locales/zh/common.json, frontend/src/__tests__/item-detail-ledger.test.tsx</files>
  <action>Finish the mutation lifecycle so a successful submit closes the dialog, invalidates the relevant item, item-ledger, events, and dashboard queries, and returns the user to the item-detail History tab as the primary confirmation surface. Keep the refreshed row in normal chronological history with the existing manual-override exceptional treatment instead of pinning or separating it. Show a success toast in addition to the refreshed history row, and keep API validation/policy failures visible inline without clearing the user's draft values. If the backend returns warnings for an extreme-but-valid date, surface them inside the dialog without treating the save as a hard failure. Expand `item-detail-ledger` regressions to cover successful save, history-tab reveal, refreshed manual row visibility, preserved inline errors, and admin owner-lens attribution behavior. Do not add bulk logging, note editing, global Events page controls, or any schema changes here.</action>
  <verify>
    <automated>npm --prefix frontend run test -- item-detail-ledger && npm --prefix frontend run typecheck</automated>
    <manual>Submit a past completed event from item detail, confirm the dialog closes, a success toast appears, the item-detail History tab becomes visible, and the new manual entry appears in normal chronology with the existing exceptional treatment.</manual>
    <sampling_rate>run after this task before the verification checkpoint and summary</sampling_rate>
  </verify>
  <done>Submitting the dialog now refreshes data in place, returns the user to item-detail history, shows a success toast, preserves inline correction behavior for failures/warnings, and keeps the new manual row visible with the established exceptional styling.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Run the required browser verification gate for historical injection</name>
  <action>Pause after the automated implementation lands and have the user verify the complete item-detail historical injection flow in a real browser before the milestone closes. This checkpoint exists because the phase definition explicitly requires manual browser approval after the workflow is live, especially for modal feel, inline warning clarity, attribution readability, and post-save history confirmation behavior.</action>
  <what-built>Complete item-detail historical injection workflow, including both-tab launch points, modal form defaults, inline warning/error handling, admin attribution, successful save refresh, and history-tab confirmation.</what-built>
  <how-to-verify>
    1. Open a financial item detail page in a normal user session and confirm both item-detail tabs expose the historical injection action as a secondary button.
    2. Open the dialog and verify the date defaults to the last due date when available, the amount defaults to the item amount, note is optional, and helper/warning copy explains that this creates a completed manual historical entry.
    3. Submit an invalid payload (for example a future date) and confirm the dialog stays open with inline corrective feedback and preserved draft values.
    4. Submit a valid past completed event and confirm the dialog closes, a success toast appears, the page refreshes in place, and the item-detail History tab shows the new manual entry in normal chronology with existing manual-override warning treatment.
    5. Repeat in an admin owner-lens session and confirm the dialog shows both actor and target attribution while the save still lands only inside the scoped user's history.
  </how-to-verify>
  <verify>Human browser verification is required using the exact steps in `<how-to-verify>` after `npm --prefix frontend run test -- item-detail-ledger && npm --prefix frontend run typecheck` passes.</verify>
  <done>The user has either approved the historical injection workflow for milestone closeout or reported concrete browser issues that can be converted into a gap-closure plan.</done>
  <resume-signal>Type "approved" to finish the phase, or describe any browser issues that need a follow-up gap plan.</resume-signal>
</task>

</tasks>

<verification>
Run `npm --prefix frontend run test -- item-detail-ledger` and `npm --prefix frontend run typecheck`.

Then complete the blocking browser verification for the item-detail historical injection workflow before closing the phase.
</verification>

<success_criteria>
Users can launch a modal historical injection workflow from both item-detail tabs, submit a completed past event with date/amount/note defaults and inline safety feedback, see admin actor/target attribution when scoped, and confirm the saved manual row in the refreshed item-detail History view without breaking existing safety or compatibility guarantees.
</success_criteria>

<output>
After completion, create `.planning/phases/33-historical-injection-ui/33-historical-injection-ui-02-SUMMARY.md`
</output>
