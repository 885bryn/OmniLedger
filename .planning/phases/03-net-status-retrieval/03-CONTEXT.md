# Phase 3: Net-Status Retrieval - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver `GET /items/:id/net-status` so a user can retrieve one asset item plus its linked child commitments in a single API response.

Scope is limited to net-status retrieval behavior and response contract for this endpoint.

</domain>

<decisions>
## Implementation Decisions

### Response shape
- Return a single root item object (not a generic envelope wrapper).
- Include child commitments as one-level nested entries (direct children only).
- Each child commitment uses canonical core fields: `id`, `item_type`, `attributes`, `parent_item_id`, `created_at`, `updated_at`.
- Do not include related event previews in this phase.

### Missing-data behavior
- Unknown item id returns `404`.
- Item owned by another user returns `403`.
- Requests where the target item is a commitment type (not an asset) return `422` with an actionable wrong-type category.
- Use the same issue-envelope style established in item-create errors for all net-status failure responses.

### Sorting and ordering
- Default child commitment ordering is soonest due date first (ascending), with null due dates last.
- Tie-break commitments with equal due dates by `created_at` ascending for deterministic output.
- No client-selected sort options in this phase; server uses one fixed default ordering.

### Computed summary fields
- Include a top-level `summary` object in the response.
- Provide monthly obligation total as the initial aggregate value.
- When child rows lack fields needed for aggregation, skip those rows and include an excluded-row count in summary metadata.

### Claude's Discretion
- Exact summary field names and key casing, as long as they are consistent and documented in tests.
- Precise due-date derivation rules per commitment type, provided output obeys the locked ordering and exclusion rules above.

</decisions>

<specifics>
## Specific Ideas

- Keep response deterministic and API-friendly: stable ordering, canonical item fields, and clear summary semantics.
- Keep the endpoint focused on item + child commitment visibility without expanding into event previews.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 03-net-status-retrieval*
*Context gathered: 2026-02-24*
