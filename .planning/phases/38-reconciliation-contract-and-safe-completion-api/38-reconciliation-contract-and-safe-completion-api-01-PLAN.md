---
phase: 38-reconciliation-contract-and-safe-completion-api
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - src/db/migrations/20260313090000-add-event-reconciliation-actuals.js
  - src/db/models/event.model.js
  - src/domain/events/complete-event.js
  - test/domain/events/complete-event.test.js
autonomous: true
requirements:
  - EVENT-05
  - SAFE-04
must_haves:
  truths:
    - User can complete an upcoming event without overwriting projected `amount` and `due_date`.
    - User can trust every completed event to persist nullable reconciliation fields for actual paid amount/date.
    - User can trust completion to keep existing RBAC guards, projected-event materialization, audit attribution, and `completed_at` behavior unchanged.
  artifacts:
    - path: src/db/migrations/20260313090000-add-event-reconciliation-actuals.js
      provides: Adds nullable `actual_amount` and `actual_date` columns to `Events`
      contains: addColumn("Events", "actual_amount")
    - path: src/db/models/event.model.js
      provides: Sequelize model contract for `actual_amount` and `actual_date`
      contains: actual_amount
    - path: src/domain/events/complete-event.js
      provides: Completion service reconciliation persistence with non-destructive projected-field behavior
      contains: actual_amount
    - path: test/domain/events/complete-event.test.js
      provides: Domain regressions for reconciliation persistence, defaults, and safety invariants
      contains: actual_date
  key_links:
    - from: src/domain/events/complete-event.js
      to: src/db/models/event.model.js
      via: completion write path persists `actual_amount` and `actual_date` on the same event row as `completed_at`
      pattern: event\.(actual_amount|actual_date|completed_at)
    - from: src/domain/events/complete-event.js
      to: src/domain/items/item-event-sync.js
      via: projected event IDs still materialize to persisted rows before completion
      pattern: materializeItemEventForDate
    - from: src/domain/events/complete-event.js
      to: src/api/auth/scope-context.js
      via: owner-access guard continues to enforce scope-safe completion paths
      pattern: canAccessOwner
---

<objective>
Establish the backend reconciliation persistence contract so completion can store actual paid amount/date while preserving existing projection, safety, and audit semantics.

Purpose: EVENT-05 and SAFE-04 require additive reconciliation fields without breaking established completion guarantees.
Output: Migration + model updates, reconciliation-aware domain completion behavior, and domain-level regression coverage.
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
@src/db/models/event.model.js
@src/domain/events/complete-event.js
@test/domain/events/complete-event.test.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add failing domain regressions for reconciliation fields and non-destructive completion</name>
  <files>test/domain/events/complete-event.test.js</files>
  <action>Add targeted tests proving completion writes `actual_amount` and `actual_date` while leaving projected `amount` and `due_date` unchanged on the event row. Include omitted-input behavior asserting defaults resolve to projected amount and business paid date derived from completion time. Add safety regression assertions confirming projected ID materialization, RBAC scope denial behavior, audit attribution tuple persistence, and `completed_at` system timestamp behavior remain intact. Start by writing assertions that fail against current implementation.</action>
  <verify>
    <automated>npm test -- test/domain/events/complete-event.test.js --runInBand</automated>
    <manual>Optional: confirm new assertions explicitly check both projected and actual values, not only response status.</manual>
    <sampling_rate>run after test updates and again after Task 3 implementation</sampling_rate>
  </verify>
  <done>Domain suite fails before implementation and codifies EVENT-05 + SAFE-04 reconciliation invariants.</done>
</task>

<task type="auto">
  <name>Task 2: Add nullable reconciliation columns to Events migration and model contract</name>
  <files>src/db/migrations/20260313090000-add-event-reconciliation-actuals.js, src/db/models/event.model.js</files>
  <action>Create an additive migration that introduces nullable `actual_amount` (DECIMAL(12,2)) and nullable `actual_date` (DATEONLY or DATE aligned with existing business-date conventions) on `Events`, with safe idempotent `describeTable` guards matching repository migration style. Update `event.model.js` to expose both fields with validation consistent with non-negative amount and valid date semantics, while keeping `amount`, `due_date`, and completion validation unchanged.</action>
  <verify>
    <automated>npm test -- test/domain/events/complete-event.test.js --runInBand</automated>
    <manual>Optional: inspect migration up/down paths to ensure rollback removes only new reconciliation columns.</manual>
    <sampling_rate>run after migration/model edits and before Task 3 finishes</sampling_rate>
  </verify>
  <done>Schema + model support nullable reconciliation actuals without changing projected field constraints.</done>
</task>

<task type="auto">
  <name>Task 3: Implement reconciliation-aware completion persistence with backend defaults</name>
  <files>src/domain/events/complete-event.js</files>
  <action>Extend `completeEvent` to accept optional reconciliation inputs (`actual_amount`, `actual_date`) and persist them on first completion. When omitted, default server-side to projected event amount and business paid date based on completion timestamp (today), while preserving projected `amount` and `due_date` values exactly as stored. Keep idempotent re-complete behavior (no overwrite of original completion/actual values), keep existing projected event materialization flow, preserve owner scoping and ownership-denial normalization, keep audit attribution and `event.completed` write semantics, and continue setting `completed_at` as the system timestamp.</action>
  <verify>
    <automated>npm test -- test/domain/events/complete-event.test.js --runInBand</automated>
    <manual>Optional: spot-check one completion path in debugger/log output to confirm persisted event row has both projected and actual fields populated as intended.</manual>
    <sampling_rate>run immediately after implementation</sampling_rate>
  </verify>
  <done>Completion service persists reconciliation actuals with backend defaults and retains all SAFE-04 safety guarantees.</done>
</task>

</tasks>

<verification>
Run `npm test -- test/domain/events/complete-event.test.js --runInBand`.

Verification must prove projected fields remain immutable at completion time while actual fields and completion safety semantics are preserved.
</verification>

<success_criteria>
Upcoming event completion stores additive reconciliation actuals, keeps projected values untouched, and preserves existing RBAC/materialization/audit/`completed_at` behavior.
</success_criteria>

<output>
After completion, create `.planning/phases/38-reconciliation-contract-and-safe-completion-api/38-reconciliation-contract-and-safe-completion-api-01-SUMMARY.md`
</output>
