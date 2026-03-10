---
phase: 32-manual-override-boundary-contract
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - src/domain/items/item-event-sync.js
  - src/domain/events/list-events.js
  - src/api/routes/events.routes.js
  - src/db/models/event.model.js
  - src/db/migrations/20260310000000-add-event-manual-override-flag.js
  - src/domain/events/create-manual-override-event.js
  - test/api/events-list.test.js
  - test/api/events-manual-override-create.test.js
autonomous: true
requirements:
  - SAFE-02
  - EVENT-02
  - EVENT-03
must_haves:
  truths:
    - User never sees system-generated projected events before the latest safe origin boundary, even when old bad data or absurd historical projections exist.
    - User can create an explicit completed historical override before origin through an API-only override path, and the saved event is marked as a manual override.
    - Manual overrides bypass only the origin boundary; malformed dates, future dates, bad amounts, and owner-scope violations still fail.
    - Admins can learn that bogus projected rows were suppressed, while normal users simply receive a clean `/events` payload with no noisy warning surface.
    - Weak or conflicting origin metadata never causes unsafe projection; the system skips projection instead of guessing.
  artifacts:
    - path: src/domain/items/item-event-sync.js
      provides: Effective latest-safe origin boundary resolver plus projection suppression when metadata is too weak or dates fall before boundary
      min_lines: 220
    - path: src/domain/events/list-events.js
      provides: Response-path filtering for bogus system-generated rows plus admin-only suppression metadata on `/events`
      min_lines: 280
    - path: src/domain/events/create-manual-override-event.js
      provides: Explicit manual-override creation service that persists completed events with origin-bypass-only semantics
      min_lines: 120
    - path: src/db/models/event.model.js
      provides: Event persistence contract with `is_manual_override` boolean support
      contains: is_manual_override
    - path: src/db/migrations/20260310000000-add-event-manual-override-flag.js
      provides: Database schema addition for the manual override flag
      contains: is_manual_override
    - path: test/api/events-list.test.js
      provides: Regressions for absurd historical suppression, weak-metadata no-projection behavior, and admin-vs-user suppression responses
      min_lines: 560
    - path: test/api/events-manual-override-create.test.js
      provides: API regressions for explicit pre-origin manual override creation, warnings, and scope validation
      min_lines: 220
  key_links:
    - from: src/domain/events/list-events.js
      to: src/domain/items/item-event-sync.js
      via: shared effective-origin-boundary projection/filter contract used before projected rows reach `/events`
      pattern: projectItemEvents|resolveOriginBoundary
    - from: src/api/routes/events.routes.js
      to: src/domain/events/create-manual-override-event.js
      via: explicit authenticated POST manual-override route for API-only historical injection before Phase 33 UI work
      pattern: manual-override
    - from: src/domain/events/create-manual-override-event.js
      to: src/db/models/event.model.js
      via: persisted completed Event row with `is_manual_override = true`
      pattern: is_manual_override
---

<objective>
Deliver the backend boundary contract that fixes the absurd historical projection leak and introduces an explicit manual-override creation path before any item-detail UI is exposed.

Purpose: Restore trust and performance on `/events` by dropping bogus projected history like `1068`-`1192`, enforcing the latest safe origin boundary without a hardcoded year floor, and adding an API-only override path that allows intentional pre-origin completed history while keeping all normal system projections guarded.
Output: One autonomous backend plan that hardens projection/filtering, adds manual-override persistence plus route support, and locks the contract with focused API regressions before the required browser/API handoff.
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
@.planning/phases/29-cadence-toggle-synced-cashflow-view/29-cadence-toggle-synced-cashflow-view-10-SUMMARY.md
@.planning/phases/31-paid-flow-into-history/31-paid-flow-into-history-01-SUMMARY.md
@src/domain/items/item-event-sync.js
@src/domain/events/list-events.js
@src/domain/events/complete-event.js
@src/api/routes/events.routes.js
@src/api/auth/scope-context.js
@src/db/models/event.model.js
@test/api/events-list.test.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Harden projection boundaries and suppress absurd historical system rows</name>
  <files>src/domain/items/item-event-sync.js, src/domain/events/list-events.js, src/api/routes/events.routes.js, test/api/events-list.test.js</files>
  <action>Replace the current recurring-origin lower-bound handling with one shared effective boundary contract that uses the strictest/latest safe date available from valid origin metadata, valid due-date seed data, and the item's own creation-day anchor instead of any hardcoded year floor. If those inputs are too weak or invalid to produce a trustworthy projection anchor, return no projected rows for that item rather than guessing. On the `/events` read path, immediately filter out already-materialized bogus system-generated rows that predate the effective boundary or otherwise represent absurd historical leakage from the projection bug; do not clamp, backfill, or surface them as normal ledger rows. Count suppressed system-generated junk rows and return that count only in an admin-visible response field (for example `meta.suppressed_invalid_projected_count`) while keeping the normal-user payload clean. Preserve existing owner/admin scope behavior and completed-history grouping semantics, and make sure the first-class `1068`-`1192` regression is covered so `/events` stays fast once those rows are excluded.</action>
  <verify>
    <automated>npm test -- test/api/events-list.test.js</automated>
    <manual>API handoff after execution: as a normal user call authenticated `GET /events?status=all` against seeded bad data and confirm no absurd historical rows or suppression notice fields appear; repeat as an admin and confirm the rows are still absent but the response includes the inline-notice count metadata for suppressed junk projections.</manual>
    <sampling_rate>run after task completion and again after Task 2 lands because both tasks touch `/events` contracts</sampling_rate>
  </verify>
  <done>Recurring projection and `/events` filtering now share one latest-safe origin boundary, bogus historical system rows are dropped immediately instead of rendered, weak metadata produces no unsafe projection, and admin-only suppression metadata exists without polluting the standard user response.</done>
</task>

<task type="auto">
  <name>Task 2: Add explicit manual-override event creation with warning-capable validation</name>
  <files>src/db/models/event.model.js, src/db/migrations/20260310000000-add-event-manual-override-flag.js, src/domain/events/create-manual-override-event.js, src/api/routes/events.routes.js, test/api/events-manual-override-create.test.js, test/api/events-list.test.js</files>
  <action>Add an explicit authenticated API-only override path before Phase 33 UI work, using `POST /events/manual-override` rather than overloading normal projection or completion routes. Persist created rows as completed materialized events with `is_manual_override = true`, `status = Completed`, `is_recurring = false`, and `completed_at` aligned to the submitted calendar day so History remains deterministic. Allow both standard users and admins to create pre-origin overrides for accessible owner-scoped financial items, but keep the bypass narrow: the override may cross the origin boundary only, not ownership, malformed-date, future-date, duplicate-row, or invalid-amount rules. Return plain corrective warnings (not failures) for extreme-but-valid historical dates via a response warnings array so Phase 33 can surface them without blocking save. Reuse the existing audit attribution pattern from completion/update flows, add the schema/model support for `is_manual_override`, and extend `/events` normalization so manual override rows carry that flag into ledger consumers. Do not build the item-detail dialog, note field persistence, bulk import, or any broader editing workflow in this phase.</action>
  <verify>
    <automated>npm test -- test/api/events-manual-override-create.test.js test/api/events-list.test.js</automated>
    <manual>API handoff after execution: create one pre-origin override through authenticated `POST /events/manual-override` and confirm the response plus a follow-up `GET /events?status=all` show a completed persisted row with `is_manual_override = true`; repeat with an extreme-but-valid old date and confirm save still succeeds while returning a warning payload instead of a rejection.</manual>
    <sampling_rate>run after this task before writing the phase summary</sampling_rate>
  </verify>
  <done>The backend exposes an explicit manual-override creation route for pre-origin historical entries, stores those events as completed manual overrides, keeps origin bypass limited to that route only, returns warnings for extreme valid dates, and leaves normal system-generated pre-origin projections blocked.</done>
</task>

</tasks>

<verification>
Run `npm test -- test/api/events-list.test.js` and `npm test -- test/api/events-manual-override-create.test.js test/api/events-list.test.js`.

Manual browser/API handoff after execution: use authenticated API calls to confirm a pre-origin manual override can be created only through `POST /events/manual-override`, confirm `GET /events?status=all` never returns projected junk rows like `1068`-`1192`, confirm weak metadata yields no guessed projections, confirm normal users receive a clean ledger payload with no suppression notice field, and confirm admins receive suppression metadata that Phase 32 plan 02 can render inline.
</verification>

<success_criteria>
The backend now blocks or suppresses every unsafe system-generated pre-origin projection using a latest-safe origin boundary, drops absurd historical junk rows from `/events`, exposes an explicit API-only manual-override creation route that persists completed events with `is_manual_override = true`, limits override bypass to origin only, and provides automated regressions plus a concrete API handoff for the required post-phase verification gate.
</success_criteria>

<output>
After completion, create `.planning/phases/32-manual-override-boundary-contract/32-manual-override-boundary-contract-01-SUMMARY.md`
</output>
