# Phase 2: Item Creation Workflow - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Define `POST /items` behavior so users can create valid ledger items with type-aware default attributes, consistent validation feedback, and predictable persisted responses.

</domain>

<decisions>
## Implementation Decisions

### Default Attribute Behavior
- Use type baseline defaults per item type (compact, usable defaults).
- Client-supplied values always override defaults; defaults only fill missing keys.
- Allow extra keys in `attributes` while still enforcing required minimum keys.
- Defaults should be structural/machine-relevant, not user-facing placeholder text.

### Create Response Shape
- Return the full created item payload on successful create.
- Return canonical persisted fields only (no expanded/derived relationship objects).
- Do not include explicit "defaults applied" metadata in the response.
- Response must include canonical persisted id and timestamps.

### Validation and Error Style
- Return field-level validation details.
- Return all validation issues found in a single response (not fail-fast first error only).
- Use distinct error categories/messages for invalid item type vs missing required keys.
- Error language should be plain and actionable.

### Parent Linking on Create
- `FinancialCommitment` requires a valid parent link at create time.
- `Subscription` parent link is optional by default.
- Nonexistent parent ids must return explicit validation errors.
- Create response returns `parent_item_id` only (no expanded parent object).

### Claude's Discretion
- Exact per-type default attribute key/value sets (within the locked behavior above).
- Exact error envelope shape and field naming conventions.
- Exact validation code taxonomy labels while preserving distinct categories.

</decisions>

<specifics>
## Specific Ideas

No product references requested; priority is predictable create semantics and client-friendly correction loops.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 02-item-creation-workflow*
*Context gathered: 2026-02-24*
