# Phase 1: Domain Model Foundation - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Define and persist the core ledger domain records (`Users`, `Items`, `Events`, `AuditLog`) with UUID-backed relationships and parent-child linkage so downstream API phases can rely on consistent stored semantics.

</domain>

<decisions>
## Implementation Decisions

### Data Rules and Validation Posture
- Use a balanced required-field posture: require core fields, keep non-critical fields optional.
- Treat user identity fields (`username`, `email`) as case-insensitive unique values.
- For `attributes` JSON, enforce minimum required keys by item type and allow additional keys.
- Reject clearly invalid domain values at model level (for example invalid dates, disallowed negative amounts).

### Item Type Semantics
- Allowed item types are fixed to roadmap types only: `RealEstate`, `Vehicle`, `FinancialCommitment`, `Subscription`.
- `FinancialCommitment` records require a parent link at creation time.
- `Subscription` is standalone by default (not required to link to a parent asset).
- If full type-specific detail is missing but minimum required keys are present, item creation is still allowed.

### Parent-Child Linkage Behavior
- A parent item may have many linked commitments.
- Parent target type for commitment links is currently allowed as any existing item type.
- Writes with missing/nonexistent parent ids are rejected (no dangling links).
- Parent deletion is blocked while linked commitments exist.

### Event and Audit Language
- Canonical event statuses in this phase: `Pending`, `Completed`.
- Completing an event requires an explicit completion timestamp.
- Minimum required `AuditLog` fields: user, action, entity, and timestamp.
- Audit action naming uses a consistent verb-style convention (for example `item.created`, `event.completed`).

### Claude's Discretion
- Exact per-type minimum attribute key list (within these locked semantics).
- Exact error message wording/shape for validation failures.
- Exact naming variant for action verbs as long as style stays consistent.

</decisions>

<specifics>
## Specific Ideas

No specific references requested; decisions focus on deterministic data semantics and strict integrity on relationships.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 01-domain-model-foundation*
*Context gathered: 2026-02-23*
