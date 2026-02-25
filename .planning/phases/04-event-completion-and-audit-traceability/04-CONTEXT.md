# Phase 4: Event Completion and Audit Traceability - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver `PATCH /events/:id/complete` with deterministic completion behavior, follow-up prompting, and audit traceability.

Scope includes event completion state handling, completion response contract, `prompt_next_date` signaling rules, and audit record semantics for completion actions.

</domain>

<decisions>
## Implementation Decisions

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

</decisions>

<specifics>
## Specific Ideas

- Recurring completions should still prompt user action, but as recurrence-date confirmation rather than forcing a fully new manual next-date entry flow.
- Maintain consistent API ergonomics with prior phase error envelope style.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 04-event-completion-and-audit-traceability*
*Context gathered: 2026-02-25*
