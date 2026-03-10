---
phase: 34-item-detail-events-tab-clarity
plan: "01"
type: execute
wave: 1
depends_on:
  - 33-historical-injection-ui-02
files_modified:
  - frontend/src/pages/items/item-detail-page.tsx
  - frontend/src/locales/en/common.json
  - frontend/src/locales/zh/common.json
  - frontend/src/__tests__/item-detail-ledger.test.tsx
autonomous: false
requirements:
  - UX-01
must_haves:
  truths:
    - User sees the Financial Item detail tab label rendered as `Events` instead of `Commitments`.
    - Opening the renamed tab still reveals the same item-specific event timeline content, including current/upcoming and historical sections.
    - Historical-entry actions and related event behavior inside the renamed tab remain unchanged.
    - Focused frontend regressions assert the new tab label so stale `Commitments` wording does not silently return in this surface.
  artifacts:
    - path: frontend/src/pages/items/item-detail-page.tsx
      provides: Financial Item detail tab label wiring that surfaces `Events` without changing tab behavior
      min_lines: 1100
    - path: frontend/src/locales/en/common.json
      provides: English item-detail tab label copy updated from `Commitments` to `Events`
      contains: 'Events'
    - path: frontend/src/locales/zh/common.json
      provides: Chinese item-detail tab label copy updated for the same clarity rename
      contains: '事件'
    - path: frontend/src/__tests__/item-detail-ledger.test.tsx
      provides: Frontend regressions that interact with the renamed tab by its new accessible label
      min_lines: 1300
  key_links:
    - from: frontend/src/locales/en/common.json
      to: frontend/src/pages/items/item-detail-page.tsx
      via: item-detail tab button label resolves through `items.detail.tabs.commitments`
      pattern: items.detail.tabs.commitments
    - from: frontend/src/locales/zh/common.json
      to: frontend/src/pages/items/item-detail-page.tsx
      via: localized item-detail tab button label resolves through the same translation key
      pattern: items.detail.tabs.commitments
    - from: frontend/src/__tests__/item-detail-ledger.test.tsx
      to: frontend/src/pages/items/item-detail-page.tsx
      via: tests select the renamed tab by accessible button text and verify the existing timeline behavior still works
      pattern: Commitments|Events
---

<objective>
Rename the Financial Item detail tab label from `Commitments` to `Events` so the UI more accurately reflects the event timeline and actions contained in that tab.

Purpose: UX-01 is completed only when users can identify the tab's purpose immediately from its label, while the existing item-detail timeline, historical injection flow, and related interactions continue to work exactly as before.
Output: One focused UI implementation plan with a blocking browser check for wording clarity and unchanged behavior.
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
@.planning/phases/34-item-detail-events-tab-clarity/34-CONTEXT.md
@.planning/phases/33-historical-injection-ui/33-historical-injection-ui-02-SUMMARY.md
@frontend/src/pages/items/item-detail-page.tsx
@frontend/src/locales/en/common.json
@frontend/src/locales/zh/common.json
@frontend/src/__tests__/item-detail-ledger.test.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rename the Financial Item detail tab label to Events</name>
  <files>frontend/src/pages/items/item-detail-page.tsx, frontend/src/locales/en/common.json, frontend/src/locales/zh/common.json, frontend/src/__tests__/item-detail-ledger.test.tsx</files>
  <action>Update the item-detail tab copy so the Financial Item detail tab currently labeled `Commitments` displays as `Events`. Keep the existing translation key structure if that is the smallest-safe path, but make the rendered label user-facing `Events` in English and the corresponding localized wording in Chinese. Do not reorder tabs, remove any event content, or rename unrelated domain copy outside this tab-control clarity issue. Update focused frontend regressions so they select the tab by its new accessible label and continue proving the same timeline behavior under the renamed surface.</action>
  <verify>
    <automated>npm --prefix frontend run test -- item-detail-ledger</automated>
    <manual>Open a Financial Item detail page and confirm the tab row reads `Overview`, `Events`, and `Activity`, with the renamed tab still opening the same event timeline content.</manual>
    <sampling_rate>run after task completion and again before the browser checkpoint if any follow-up wording tweaks are needed</sampling_rate>
  </verify>
  <done>The Financial Item detail tab now renders as `Events`, related tests assert the new label, and the tab still opens the existing event timeline surface without behavioral drift.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Run the browser clarity gate for the renamed Events tab</name>
  <action>Pause after the rename lands and have the user verify the item-detail tab wording in a real browser. This checkpoint exists because the phase is specifically about user clarity, so the final judgment is whether the renamed tab reads naturally and still matches the content behind it.</action>
  <what-built>Financial Item detail now labels the event timeline tab as `Events` instead of `Commitments`, with no intended behavior changes inside that tab.</what-built>
  <how-to-verify>
    1. Open a Financial Item detail page and confirm the top-level tab row reads `Overview`, `Events`, and `Activity`.
    2. Click `Events` and confirm the same item-specific event timeline appears, including the current/upcoming and historical ledger sections.
    3. Confirm the historical-entry action still appears where expected and the rename does not make the tab feel misleading or incomplete.
    4. Verify there is no stale `Commitments` wording left on that tab control for this surface.
  </how-to-verify>
  <verify>Human browser verification is required using the exact steps in `<how-to-verify>` after `npm --prefix frontend run test -- item-detail-ledger` passes.</verify>
  <done>The user has either approved the renamed `Events` tab for clarity or reported concrete wording/UX issues that need a gap plan.</done>
  <resume-signal>Type `approved` to finish the phase, or describe any wording issues that should be corrected.</resume-signal>
</task>

</tasks>

<verification>
Run `npm --prefix frontend run test -- item-detail-ledger`.

Then complete the blocking browser verification for the renamed Financial Item detail `Events` tab before closing the phase.
</verification>

<success_criteria>
Users see the Financial Item detail tab labeled `Events`, can open it to access the same event timeline and historical-entry behavior as before, and no stale `Commitments` wording remains in the targeted tab control or its focused frontend regressions.
</success_criteria>

<output>
After completion, create `.planning/phases/34-item-detail-events-tab-clarity/34-item-detail-events-tab-clarity-01-SUMMARY.md`
</output>
