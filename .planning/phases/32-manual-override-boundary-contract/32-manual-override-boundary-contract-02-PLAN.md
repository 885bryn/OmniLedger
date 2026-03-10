---
phase: 32-manual-override-boundary-contract
plan: "02"
type: execute
wave: 2
depends_on:
  - 32-manual-override-boundary-contract-01
files_modified:
  - frontend/src/pages/events/events-page.tsx
  - frontend/src/locales/en/common.json
  - frontend/src/locales/zh/common.json
  - frontend/src/__tests__/events-ledger-page.test.tsx
autonomous: true
requirements:
  - SAFE-02
  - EVENT-02
  - EVENT-03
must_haves:
  truths:
    - User sees a clean ledger with no bogus historical system rows after the backend suppression contract lands.
    - Admin sees a calm inline notice when invalid projected rows were suppressed, while normal users do not see that privileged notice.
    - Manual override history rows look intentionally exceptional through a strong warning label instead of blending into ordinary paid history.
    - Manual override rows remain visible in History even when they predate the item's normal origin boundary.
  artifacts:
    - path: frontend/src/pages/events/events-page.tsx
      provides: Ledger notice rendering for admin-only suppression metadata plus manual-override warning treatment in History rows
      min_lines: 900
    - path: frontend/src/locales/en/common.json
      provides: English copy for admin suppression notice and manual override warning labels
      contains: '"events"'
    - path: frontend/src/locales/zh/common.json
      provides: Chinese copy for admin suppression notice and manual override warning labels
      contains: '"events"'
    - path: frontend/src/__tests__/events-ledger-page.test.tsx
      provides: Frontend regressions for admin-only suppression notices and manual-override history badges
      min_lines: 560
  key_links:
    - from: frontend/src/pages/events/events-page.tsx
      to: /events
      via: events query reads admin-only suppression metadata without changing the clean default user ledger behavior
      pattern: suppressed_invalid_projected_count|meta
    - from: frontend/src/pages/events/events-page.tsx
      to: frontend/src/__tests__/events-ledger-page.test.tsx
      via: history rows render manual-override warning treatment keyed off API event flags
      pattern: is_manual_override|manualOverride
---

<objective>
Surface the new Phase 32 boundary contract on the Events ledger so admins can see privileged suppression feedback and manual overrides are unmistakably exceptional before the item-detail injection UI exists.

Purpose: Keep the ledger clean for everyone after the backend fix while exposing the minimum necessary UI signals for Phase 32: admin-only suppression notice for filtered bogus projections and strong manual-override labeling in History so explicit pre-origin entries never masquerade as ordinary paid system rows.
Output: One autonomous frontend plan that reads the new `/events` metadata, renders calm admin-only suppression feedback, differentiates manual overrides in History, updates locale copy, and locks the contract with focused ledger regressions before the required browser handoff.
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
@.planning/phases/32-manual-override-boundary-contract/32-CONTEXT.md
@.planning/phases/32-manual-override-boundary-contract/32-manual-override-boundary-contract-01-SUMMARY.md
@.planning/phases/31-paid-flow-into-history/31-paid-flow-into-history-01-SUMMARY.md
@frontend/src/pages/events/events-page.tsx
@frontend/src/__tests__/events-ledger-page.test.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Render admin-only suppression notice from the new boundary metadata</name>
  <files>frontend/src/pages/events/events-page.tsx, frontend/src/locales/en/common.json, frontend/src/locales/zh/common.json, frontend/src/__tests__/events-ledger-page.test.tsx</files>
  <action>Extend the existing `/events?status=all` response typing so the Events page can read the admin-only suppression metadata added in Plan 01. Render a calm inline notice near the ledger header when the signed-in viewer is effectively admin-scoped and the suppressed count is greater than zero. Keep the copy plain and corrective, focused on hidden invalid projected history rather than alarming compliance language. Normal users and owner-scoped views without suppressed rows should continue to see a clean ledger with no extra banner, badge, or placeholder noise. Do not add global toasts, modal interruptions, item-detail controls, or cleanup affordances in this phase.</action>
  <verify>
    <automated>npm --prefix frontend run test -- events-ledger-page</automated>
    <manual>Browser handoff after execution: open `/events` as an admin against data that triggers suppressed bogus projections and confirm a calm inline notice appears; repeat as a normal user and confirm the ledger stays clean with no suppression messaging.</manual>
    <sampling_rate>run after task completion and again after Task 2 because both tasks extend the same ledger regression suite</sampling_rate>
  </verify>
  <done>The Events page understands the new suppression metadata, shows a privileged inline notice only to admins when invalid projected rows were hidden, and leaves the normal user ledger unchanged and noise-free.</done>
</task>

<task type="auto">
  <name>Task 2: Mark manual override history rows as intentionally exceptional</name>
  <files>frontend/src/pages/events/events-page.tsx, frontend/src/locales/en/common.json, frontend/src/locales/zh/common.json, frontend/src/__tests__/events-ledger-page.test.tsx</files>
  <action>Update History-row rendering so events carrying `is_manual_override = true` get a strong warning label and supporting copy that clearly distinguishes them from ordinary paid rows. Keep the treatment consistent with the existing shadcn/Tailwind ledger language: readable, dense, and cautionary rather than flashy. Manual override rows must still participate in the existing month/year history grouping and remain visible even when their dates predate the normal item origin boundary. Expand the frontend regression suite so it proves all locked Phase 32 UI rules: manual override rows render in History with the exceptional label, pre-origin manual rows still appear when returned by the API, admin-only suppression notice appears only for admins, and normal users never see the privileged notice. Do not build the item-detail injection dialog, note field UI, search/filter, or edit/reverse workflows yet.</action>
  <verify>
    <automated>npm --prefix frontend run test -- events-ledger-page && npm --prefix frontend run typecheck</automated>
    <manual>Browser handoff after execution: on `/events`, switch to `History`, confirm manual override rows are visibly labeled as exceptional rather than normal paid history, and verify the admin inline suppression notice plus manual override treatment remain calm and legible on both desktop and mobile widths.</manual>
    <sampling_rate>run after this task before writing the phase summary</sampling_rate>
  </verify>
  <done>History rows now expose a strong manual-override warning treatment, pre-origin manual rows remain visible in ledger history, admin suppression feedback is inline and scoped correctly, and focused frontend regressions fail if privileged messaging leaks to normal users or manual overrides lose their exceptional presentation.</done>
</task>

</tasks>

<verification>
Run `npm --prefix frontend run test -- events-ledger-page` and `npm --prefix frontend run typecheck`.

Manual browser/API handoff after execution: call the new backend from Plan 01 to create one pre-origin manual override, then open `/events` and confirm that row appears in `History` with strong manual-override labeling. Also verify that admin sessions render the suppression notice when invalid projected rows were filtered while normal-user sessions continue to show a clean ledger with no privileged warning copy.
</verification>

<success_criteria>
The Events ledger now reflects the Phase 32 boundary contract in the UI: bogus system projections stay absent, admins get an inline suppression notice when the backend hid invalid projected rows, normal users see no noisy warning surface, and manual override history rows are clearly labeled as exceptional while still rendering inside normal month-grouped History.
</success_criteria>

<output>
After completion, create `.planning/phases/32-manual-override-boundary-contract/32-manual-override-boundary-contract-02-SUMMARY.md`
</output>
