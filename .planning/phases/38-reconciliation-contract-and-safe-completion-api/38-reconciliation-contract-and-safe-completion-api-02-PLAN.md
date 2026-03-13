---
phase: 38-reconciliation-contract-and-safe-completion-api
plan: "02"
type: execute
wave: 2
depends_on:
  - 38-reconciliation-contract-and-safe-completion-api-01
files_modified:
  - src/api/routes/events.routes.js
  - test/api/events-complete.test.js
autonomous: false
requirements:
  - FLOW-07
  - SAFE-04
must_haves:
  truths:
    - User can submit completion with explicit actual paid amount/date and the backend persists those values.
    - User can omit reconciliation inputs and backend defaults still complete the event using projected amount and today's paid date.
    - User can trust completion API behavior to preserve existing RBAC denial, projected-event materialization, and completion audit semantics.
  artifacts:
    - path: src/api/routes/events.routes.js
      provides: PATCH completion route accepts reconciliation payload and delegates to domain service
      exports: [createEventsRouter]
    - path: test/api/events-complete.test.js
      provides: API regressions for explicit/omitted reconciliation inputs and SAFE-04 invariants
      min_lines: 700
  key_links:
    - from: src/api/routes/events.routes.js
      to: src/domain/events/complete-event.js
      via: PATCH `/events/:id/complete` forwards reconciliation payload into domain completion contract
      pattern: completeEvent\(\{[\s\S]*payload
    - from: test/api/events-complete.test.js
      to: src/api/routes/events.routes.js
      via: integration tests assert response/persistence behavior for explicit actuals and backend defaults
      pattern: /events/.*/complete
    - from: src/api/routes/events.routes.js
      to: src/api/errors/http-error-mapper.js
      via: completion failures continue through centralized `event_completion_failed` envelope handling
      pattern: next\(error\)
---

<objective>
Expose the reconciliation completion contract through the existing completion API surface and lock it with integration regressions plus final browser gate.

Purpose: FLOW-07 requires backend-defaulted reconciliation inputs at submission time, while SAFE-04 requires no regression in completion safety behavior.
Output: Updated completion route payload plumbing, API-level reconciliation regression suite, and manual browser checkpoint before Phase 39.
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
@.planning/phases/38-reconciliation-contract-and-safe-completion-api/38-reconciliation-contract-and-safe-completion-api-01-PLAN.md
@src/api/routes/events.routes.js
@test/api/events-complete.test.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add failing API integration tests for reconciliation completion payload and defaults</name>
  <files>test/api/events-complete.test.js</files>
  <action>Expand completion integration tests to cover two core FLOW-07 branches: (1) explicit `actual_amount` and `actual_date` submission persists and returns those actual values, and (2) omitted reconciliation inputs still persist backend defaults derived from projected amount and current business date. Add regression assertions proving existing SAFE-04 contracts remain unchanged (owner scoping not_found behavior, projected-id materialization behavior, audit row semantics, and `completed_at` system timestamp continuity). Write assertions first so new tests fail until Task 2 is implemented.</action>
  <verify>
    <automated>npm test -- test/api/events-complete.test.js --runInBand</automated>
    <manual>Optional: confirm test payload shape aligns with planned Phase 39 reconciliation dialog contract (`actual_amount`, `actual_date`).</manual>
    <sampling_rate>run after test edits and again after Task 2 implementation</sampling_rate>
  </verify>
  <done>API suite encodes reconciliation contract and fails before route wiring updates.</done>
</task>

<task type="auto">
  <name>Task 2: Wire PATCH completion route to pass reconciliation payload into completion domain service</name>
  <files>src/api/routes/events.routes.js</files>
  <action>Update `PATCH /events/:id/complete` route to accept reconciliation fields from request body and forward them to `completeEvent` in the agreed contract shape. Keep route thin (no duplicated business logic), preserve existing authentication and scope handling, keep centralized error-envelope behavior untouched (`event_completion_failed` via middleware), and avoid introducing route-local RBAC or audit logic. Ensure compatibility for existing clients that send no body so backend defaults apply.</action>
  <verify>
    <automated>npm test -- test/api/events-complete.test.js --runInBand</automated>
    <manual>Optional: call `PATCH /events/:id/complete` once with and once without reconciliation payload and verify both return 200 with expected actual fields.</manual>
    <sampling_rate>run immediately after implementation</sampling_rate>
  </verify>
  <done>Completion API supports explicit and omitted reconciliation payloads while preserving all pre-existing completion safety semantics.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Browser gate for safe completion continuity before Phase 39</name>
  <action>Pause after API reconciliation contract lands so the user can manually verify that existing Upcoming completion still works end-to-end and no visible regression blocks the upcoming reconciliation modal phase.</action>
  <what-built>Completion backend now accepts reconciliation actuals with server defaults and keeps projected values, RBAC safety, projected materialization, audit attribution, and `completed_at` behavior intact.</what-built>
  <how-to-verify>
    1. Open the app and navigate to `/events`.
    2. Complete one Upcoming row using the existing inline action (no dialog yet in Phase 38).
    3. Confirm the row leaves Upcoming and appears in History as before (no UI breakage/regression).
    4. Optionally inspect network response for the completion call and verify `actual_amount`, `actual_date`, and `completed_at` are present.
    5. Optionally repeat as another user/admin lens path and confirm ownership boundaries still block foreign rows.
  </how-to-verify>
  <verify>
    <automated>npm test -- test/api/events-complete.test.js --runInBand</automated>
    <manual>Run the five browser checks above and approve only if completion behavior remains stable for current UI flows.</manual>
    <sampling_rate>run immediately before manual sign-off</sampling_rate>
  </verify>
  <done>User confirms completion flow remains stable in browser and backend reconciliation contract is ready for Phase 39 modal work.</done>
  <resume-signal>Type `approved` to close Phase 38 or report observed regressions for a targeted gap-closure plan.</resume-signal>
</task>

</tasks>

<verification>
Run `npm test -- test/api/events-complete.test.js --runInBand`.

Then complete the blocking browser checkpoint before moving to Phase 39.
</verification>

<success_criteria>
Completion API accepts reconciliation payloads, defaults missing values server-side, and preserves all existing completion safety contracts without UI regressions.
</success_criteria>

<output>
After completion, create `.planning/phases/38-reconciliation-contract-and-safe-completion-api/38-reconciliation-contract-and-safe-completion-api-02-SUMMARY.md`
</output>
