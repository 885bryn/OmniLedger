---
phase: 33-historical-injection-ui
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - src/db/models/event.model.js
  - src/db/migrations/20260310010000-add-event-note.js
  - src/domain/events/create-manual-override-event.js
  - src/domain/events/list-events.js
  - src/api/routes/events.routes.js
  - test/api/events-manual-override-create.test.js
  - test/api/events-list.test.js
autonomous: true
requirements:
  - EVENT-01
  - SAFE-03
must_haves:
  truths:
    - User-submitted historical injections can include an optional note without weakening the existing manual-override safety contract.
    - Saved historical injections still persist as completed manual overrides with owner-scoped RBAC and audit attribution intact.
    - Existing projected-event behavior and normal completion/edit flows remain unchanged while manual override reads gain the new note field.
    - Item-detail and ledger consumers can read back the saved manual note through the standard events payload after creation.
  artifacts:
    - path: src/db/models/event.model.js
      provides: Event persistence contract extended with optional manual note storage
      contains: note
    - path: src/db/migrations/20260310010000-add-event-note.js
      provides: Database schema support for persisted event notes
      contains: note
    - path: src/domain/events/create-manual-override-event.js
      provides: Manual-override creation validation and persistence for optional note input while preserving scope and duplicate guards
      min_lines: 140
    - path: src/domain/events/list-events.js
      provides: Event list normalization that exposes manual-override note data to frontend consumers
      min_lines: 320
    - path: test/api/events-manual-override-create.test.js
      provides: Regressions for note persistence, validation, and owner/admin scope safety on manual override creation
      min_lines: 260
    - path: test/api/events-list.test.js
      provides: Regressions proving note-bearing manual overrides flow through `/events` without changing projection filtering or admin scoping
      min_lines: 580
  key_links:
    - from: src/api/routes/events.routes.js
      to: src/domain/events/create-manual-override-event.js
      via: authenticated POST `/events/manual-override` payload now accepts and returns optional note data
      pattern: manual-override
    - from: src/domain/events/create-manual-override-event.js
      to: src/db/models/event.model.js
      via: persisted completed manual override writes `note` alongside `is_manual_override = true`
      pattern: note|is_manual_override
    - from: src/domain/events/list-events.js
      to: /events
      via: normalized event rows include manual note data without changing owner/admin response boundaries
      pattern: note
---

<objective>
Extend the manual-override backend contract so Phase 33 can save a completed historical event with a user note from item detail without reopening the boundary and scope risks solved in Phase 32.

Purpose: EVENT-01 needs more than a button; the API contract must persist an optional note, return it through existing `/events` reads, and keep projection filtering, RBAC scoping, audit attribution, and deployment-facing route behavior stable so the UI can ship on top of a trustworthy backend.
Output: One autonomous backend plan that adds note persistence for manual overrides, exposes it through the existing events payload, and locks compatibility with focused API regressions.
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
@src/domain/events/create-manual-override-event.js
@src/domain/events/list-events.js
@src/api/routes/events.routes.js
@src/db/models/event.model.js
@test/api/events-manual-override-create.test.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Persist manual-override notes without weakening the Phase 32 safety contract</name>
  <files>src/db/models/event.model.js, src/db/migrations/20260310010000-add-event-note.js, src/domain/events/create-manual-override-event.js, src/api/routes/events.routes.js, test/api/events-manual-override-create.test.js</files>
  <action>Add optional manual note support to the explicit `POST /events/manual-override` flow used by Phase 33. Extend the Event model and database schema with a nullable note field sized for short freeform operator context, then teach `createManualOverrideEvent` to accept, trim, validate, and persist that field while preserving every existing guard from Phase 32: owner/admin scope enforcement, duplicate protection, amount validation, calendar-day date validation, future-date rejection, completed persistence, `is_manual_override = true`, and audit attribution. Keep note optional, do not require a second confirmation or acknowledgement field, and do not widen the write contract for normal projected-event completion/edit routes.</action>
  <verify>
    <automated>npm test -- test/api/events-manual-override-create.test.js</automated>
    <manual>POST `/events/manual-override` with `date`, `amount`, and `note` as both an owner and an admin owner-lens session; confirm success persists the note while invalid scope, duplicate, malformed date, future date, and bad amount cases still fail exactly as before.</manual>
    <sampling_rate>run after task completion and again after Task 2 because both tasks shape the response contract consumed by the UI</sampling_rate>
  </verify>
  <done>Manual override creation now accepts an optional note, stores it on the completed event row, returns it in the creation response, and leaves every existing Phase 32 boundary, scope, and audit safeguard intact.</done>
</task>

<task type="auto">
  <name>Task 2: Expose note-bearing manual overrides through existing event reads and compatibility regressions</name>
  <files>src/domain/events/list-events.js, test/api/events-list.test.js, test/api/events-manual-override-create.test.js</files>
  <action>Extend `/events` normalization so persisted manual overrides include the saved note in standard event payloads consumed by item detail and ledger views. Keep the current grouping, admin-only suppression metadata, and clean normal-user payload boundaries unchanged. Add regressions proving a saved manual override note survives a follow-up `/events?status=all` read, remains scoped to the correct owner/admin lens, and does not alter projection suppression or any non-manual event contract. Do not add bulk logging, event editing for notes, or any extra routes.</action>
  <verify>
    <automated>npm test -- test/api/events-manual-override-create.test.js test/api/events-list.test.js</automated>
    <manual>Create a manual override with a note, then call `GET /events?status=all` for the same scoped user and confirm the completed manual row includes that note while normal projected and paid rows still match the existing contract.</manual>
    <sampling_rate>run after this task before writing the phase summary</sampling_rate>
  </verify>
  <done>Existing event reads now carry optional note data for manual overrides, API regressions prove the note round-trip works, and projection filtering, RBAC scoping, audit attribution, and route compatibility remain stable.</done>
</task>

</tasks>

<verification>
Run `npm test -- test/api/events-manual-override-create.test.js test/api/events-list.test.js`.

Manual API verification: create a pre-origin manual override with a note through `POST /events/manual-override`, then confirm a scoped `GET /events?status=all` returns the same completed manual row with `is_manual_override = true` and the saved note, while projection suppression and owner/admin response boundaries remain unchanged.
</verification>

<success_criteria>
The backend now supports Phase 33 historical injection with an optional note, keeps the manual-override contract explicit and safe, exposes the saved note through standard event reads, and preserves existing projection logic, RBAC scoping, audit attribution, and deployment-facing route behavior.
</success_criteria>

<output>
After completion, create `.planning/phases/33-historical-injection-ui/33-historical-injection-ui-01-SUMMARY.md`
</output>
