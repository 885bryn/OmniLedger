# Phase 4: Event Completion and Audit Traceability - Research

**Researched:** 2026-02-25
**Domain:** Express PATCH endpoint + Sequelize transactional event state transition + audit write semantics
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
### Completion response contract
- Success returns the updated event object directly (not message-only, not wrapper envelope).
- Success payload includes canonical event fields (`id`, `item_id`, `type`, `due_date`, `amount`, `status`, `recurring`, timestamps) and explicitly includes `completed_at`.
- Success responses are data-only with no human-readable confirmation message.

### Prompt-next-date behavior
- `prompt_next_date` is provided on successful completion for both non-recurring and recurring events.
- For non-recurring events, prompt behavior is deterministic: `prompt_next_date` indicates user should provide the next date.
- For recurring events, prompt behavior indicates recurrence-date confirmation (confirm/update recurrence date) rather than forcing brand-new entry flow.
- Error responses do not include `prompt_next_date`.
- If recurrence metadata is missing, treat as non-recurring for prompt behavior.

### Completion error semantics
- Unknown `event_id` returns `404`.
- Foreign-owned events return `403`.
- Already-completed events are idempotent success (return success payload without applying a second transition).
- Invalid transition/state failures use the established issue-envelope style: `error.code`, `error.category`, `error.message`, `error.issues`.

### Audit event wording
- Audit action name for completion is `event.completed`.
- Minimum required audit details: actor user id, action, target event id, and timestamp.
- Keep audit payload minimal for this phase (no extra source/context note fields).
- Idempotent re-complete requests do not create a new audit entry.

### Claude's Discretion
- Exact success payload key ordering and naming for completion-specific metadata beyond locked fields.
- Exact issue `category` labels for transition-related validation errors, as long as they are stable and actionable.
- Whether idempotent success returns HTTP `200` or `204`, as long as returned semantics stay clearly idempotent and consistent.

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EVNT-02 | User can complete an event through `PATCH /events/:id/complete` and the event status becomes `Completed`. | Transactional completion service, explicit state-transition guard, and endpoint contract are defined below. |
| EVNT-03 | User receives `prompt_next_date: true` in completion response when the completed event is non-recurring. | Deterministic prompt rules and response serializer mapping are defined below. |
| AUDT-01 | User actions are recorded in `AuditLog` with user id, action, and timestamp when event completion is performed. | Atomic audit-write pattern (`event.completed`) with idempotent suppression is defined below. |
</phase_requirements>

## Summary

Phase 4 is a transactional write workflow, not just a route addition. The system must (1) resolve event existence, (2) enforce actor ownership through the event's parent item owner, (3) apply at-most-once completion transition, and (4) persist an audit row only on first completion. The current codebase already has the right foundations: event status invariants in `src/domain/events/status-and-completion-rules.js`, canonical error-envelope mapping in `src/api/errors/http-error-mapper.js`, and proven thin-route service delegation patterns from earlier phases.

The highest-risk implementation detail is response contract mapping. The `Event` model stores `event_type` and `is_recurring`, but locked API output requires `type` and `recurring` plus `prompt_next_date`. Plan for an explicit serializer so API shape stays deterministic and decoupled from Sequelize field names. Also plan around DECIMAL behavior (`amount`) across sqlite/PostgreSQL so tests assert stable semantics.

A second planning hotspot is audit target representation. `AuditLog` currently has `user_id`, `action`, `entity`, and `timestamp`. Locked decisions require target event id without adding extra payload fields. The minimal path is to encode the target event id in `entity` deterministically (for example `event:<uuid>`), keeping schema unchanged in this phase.

**Primary recommendation:** Implement one transaction-safe domain service `completeEvent({ eventId, actorUserId, now })` that returns canonical success payload and idempotency metadata; map domain errors centrally into issue-envelope HTTP responses; and cover first-complete vs re-complete behavior with both domain and API integration tests.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `express` | `^5.2.1` | `PATCH /events/:id/complete` route and middleware flow | Already used in `src/api/app.js` and Phase 2/3 endpoints. |
| `sequelize` | `^6.37.5` | Event read/update + audit insert in one DB transaction | Existing ORM, model registration, and migration model are already in place. |
| `jest` + `supertest` | `^29.7.0` + `^7.2.2` | Domain and endpoint contract verification | Existing project harness with sqlite-backed integration tests. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sqlite3` | `^5.1.7` | Fast local/in-test DB for route integration | Use for deterministic endpoint tests in this phase. |
| `pg` + `pg-hstore` | installed | Production/runtime PostgreSQL support | Keep behavior aligned with deployment target dialect. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Service-level transaction + explicit ownership check | Inline route logic with ad-hoc model calls | Faster to write, but weakens idempotency/audit atomicity and error consistency. |
| Reusing `entity` for target event id encoding | New migration adding `target_event_id` to `AuditLog` | Clearer schema, but adds migration scope that is not required to satisfy locked minimal audit payload. |
| Returning ORM event instance directly | Explicit serializer with canonical keys | Direct return risks contract drift (`event_type`, `is_recurring`, dialect date/decimal quirks). |

**Installation:**
```bash
npm install
```

## Architecture Patterns

### Recommended Project Structure
```text
src/
|- api/
|  |- app.js                                  # mount events router + central error mapping
|  |- routes/events.routes.js                 # NEW PATCH /events/:id/complete route
|  `- errors/http-error-mapper.js             # extend with event completion mapping
|- domain/
|  |- events/
|  |  |- status-and-completion-rules.js       # existing invariant utilities
|  |  |- complete-event.js                    # NEW transactional completion service
|  |  `- event-completion-errors.js           # NEW domain error taxonomy
test/
|- domain/events/complete-event.test.js       # NEW transition + idempotency + audit tests
`- api/events-complete.test.js                # NEW endpoint contract/error tests
```

### Pattern 1: Thin PATCH Route, Service-First Completion
**What:** Route extracts `eventId` and actor header, delegates to `completeEvent`, returns data-only payload.
**When to use:** Every `PATCH /events/:id/complete` request.
**Why:** Matches existing architecture (`POST /items`, `GET /items/:id/net-status`) and keeps transport logic separate from state transition logic.

### Pattern 2: Two-Stage Guard for 404 vs 403
**What:** Fetch event by id first (404 if absent), then verify ownership through `Item.user_id` linked by `event.item_id` (403 if foreign-owned).
**When to use:** Before any state mutation.
**Why:** Required to preserve distinct error semantics from locked decisions.

### Pattern 3: Transactional First-Complete Write + Idempotent Re-Complete Read
**What:** In one transaction, if `status !== Completed`, set `status=Completed` + `completed_at=now` and insert one audit row; if already completed, skip writes and return current canonical payload.
**When to use:** Every successful completion request.
**Why:** Guarantees no duplicate audit entries for idempotent re-complete and keeps event/audit state consistent.

### Pattern 4: Explicit Canonical Serializer for API Contract
**What:** Map model fields to response fields (`event_type -> type`, `is_recurring -> recurring`) and append `prompt_next_date` and `completed_at` deterministically.
**When to use:** All success responses.
**Why:** Locked output contract differs from persistence naming and must remain stable across dialects.

### Anti-Patterns to Avoid
- **Collapsing 404 and 403 into one lookup:** breaks locked ownership semantics.
- **Creating audit rows outside the transaction:** allows event/audit divergence under failure.
- **Returning `204` while also requiring data payload fields:** conflicts with locked response-contract requirement to return updated event object.
- **Using model raw keys in response (`event_type`, `is_recurring`):** violates locked API naming.
- **Generating a second `completed_at` on re-complete:** breaks idempotent semantics.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request routing pipeline | Custom HTTP dispatcher | Existing Express Router + middleware | Project is already standardized on Express route modules. |
| Atomic state + audit coordination | Manual partial rollback logic | Managed Sequelize transaction callback | Official pattern auto-rolls back on thrown errors. |
| Error body composition per route | Inline ad-hoc JSON error responses | Extend central `http-error-mapper.js` | Keeps issue-envelope style consistent phase-to-phase. |
| Event payload normalization by accidental model shape | Direct `instance.get()` passthrough | Dedicated completion serializer | Prevents contract drift and naming mismatches. |

**Key insight:** The phase is mostly about state-transition correctness and contract determinism, not schema expansion.

## Common Pitfalls

### Pitfall 1: Idempotent path still writes audit rows
**What goes wrong:** Repeating `PATCH /events/:id/complete` adds duplicate `event.completed` audit entries.
**Why it happens:** Completion path always inserts audit regardless of previous status.
**How to avoid:** Gate audit insert on first transition only (`Pending -> Completed`).
**Warning signs:** Audit row count increments on repeated requests for same event id.

### Pitfall 2: Response contract leaks persistence keys
**What goes wrong:** API returns `event_type`/`is_recurring` instead of `type`/`recurring`.
**Why it happens:** Route returns raw Sequelize object.
**How to avoid:** Centralize `toCompletionResponse(event)` serializer.
**Warning signs:** Contract tests assert key set and fail on unexpected keys.

### Pitfall 3: Ownership check skipped or inverted
**What goes wrong:** Any actor can complete another user's event or gets 404 instead of 403.
**Why it happens:** Event queried without item-owner verification.
**How to avoid:** Resolve parent item and compare `item.user_id` with actor id before mutation.
**Warning signs:** No test branch proving foreign-owned event returns 403.

### Pitfall 4: `completed_at` drift on idempotent re-complete
**What goes wrong:** Second completion overwrites original completion timestamp.
**Why it happens:** Code sets `completed_at = now` unconditionally.
**How to avoid:** Preserve existing `completed_at` when already completed.
**Warning signs:** Consecutive calls return different `completed_at` values.

### Pitfall 5: Prompt behavior not deterministic
**What goes wrong:** `prompt_next_date` appears on errors or missing recurrence metadata is handled inconsistently.
**Why it happens:** Prompt flag computed in route with incomplete rules.
**How to avoid:** Derive prompt in service serializer with explicit fallback (`missing recurrence -> non-recurring behavior`).
**Warning signs:** Error payload contains `prompt_next_date` or recurring/non-recurring tests diverge.

## Code Examples

Verified patterns from official sources and current project:

### Managed transaction pattern for atomic completion + audit
```javascript
// Source: https://sequelize.org/docs/v6/other-topics/transactions/
const result = await sequelize.transaction(async (transaction) => {
  const event = await models.Event.findByPk(eventId, { transaction });

  // ...guards and transition logic...

  await event.save({ transaction });
  await models.AuditLog.create(
    {
      user_id: actorUserId,
      action: "event.completed",
      entity: `event:${event.id}`,
      timestamp: now
    },
    { transaction }
  );

  return event;
});
```

### Express route params + async delegation
```javascript
// Source: https://expressjs.com/en/guide/routing.html
router.patch("/events/:id/complete", async (req, res, next) => {
  try {
    const payload = await completeEvent({
      eventId: req.params.id,
      actorUserId: req.header("x-user-id")
    });
    res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
});
```

### Existing centralized error-mapper pattern to extend
```javascript
// Source: src/api/errors/http-error-mapper.js
const mapped = mapItemCreateError(error) || mapItemNetStatusError(error);
if (!mapped) {
  next(error);
  return;
}
res.status(mapped.status).json(mapped.body);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Route-level ad-hoc validation and response shaping | Domain service + centralized HTTP mapping | Phase 2 and Phase 3 | Enables stable issue-envelope contracts and reusable domain logic. |
| Read-only endpoint semantics (no transactional side effects) | Atomic write workflow with state transition + audit side-effect | Phase 4 scope | Requires stronger idempotency and transaction discipline. |
| Canonical field passthrough where model names match API names | Explicit serializer where storage and API names differ | Phase 4 scope | Prevents contract drift (`type`/`recurring` vs DB columns). |

**Deprecated/outdated:**
- Returning message wrappers for successful mutation responses in this phase.
- Creating audit entries for no-op idempotent calls.

## Open Questions

1. **Exact audit `entity` encoding for "target event id" with current schema**
   - What we know: locked decisions require target event id, and current schema has only one `entity` string column.
   - What's unclear: whether to store bare UUID, prefixed UUID (`event:<id>`), or keep `Events` and add migration.
   - Recommendation: keep schema unchanged and encode `entity` as `event:<uuid>` for deterministic parsing and minimal phase scope.

2. **Idempotent status code discretion (`200` vs `204`) versus locked payload contract**
   - What we know: discretion mentions 200/204, but locked response contract requires returning updated event object with fields.
   - What's unclear: whether 204 is still desired despite payload requirement.
   - Recommendation: standardize on `200` for both first-complete and idempotent re-complete to satisfy locked payload semantics.

## Sources

### Primary (HIGH confidence)
- `src/domain/events/status-and-completion-rules.js` - event status/completion invariants and audit action format guard.
- `src/db/models/event.model.js` - persistence field names and completion timestamp validation behavior.
- `src/db/models/audit-log.model.js` - available audit columns and required metadata constraints.
- `src/api/errors/http-error-mapper.js` - canonical issue-envelope mapping architecture.
- `src/api/routes/items.routes.js` - thin-route service delegation pattern to replicate.
- `test/api/items-create.test.js` - API contract and error-envelope assertion style.
- `test/api/items-net-status.test.js` - ownership guard and endpoint-level integration style.
- https://sequelize.org/docs/v6/other-topics/transactions/ - managed transaction and rollback semantics.
- https://sequelize.org/docs/v6/core-concepts/model-instances/ - instance save/update behavior and mutation lifecycle.
- https://expressjs.com/en/guide/routing.html - route param handling and router patterns.

### Secondary (MEDIUM confidence)
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods/PATCH - PATCH method semantics and response code flexibility.
- `.planning/STATE.md` - active project decisions including temporary `x-user-id` actor transport and audit action format.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - directly verified from installed dependencies and existing runtime code.
- Architecture: HIGH - built on current repo patterns already used in Phase 2/3.
- Pitfalls: HIGH - directly tied to locked decisions plus concrete model/contract mismatches.

**Research date:** 2026-02-25
**Valid until:** 2026-03-27
