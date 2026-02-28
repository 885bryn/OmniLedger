# Phase 11: Timeline Projection & Asset Ledger Views - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a unified, deterministic timeline up to the defined horizon with clear projected-versus-persisted distinction, projected-edit exception instantiation visibility, and split asset financial ledgers into Current & Upcoming versus Historical sections.

</domain>

<decisions>
## Implementation Decisions

### Timeline ordering
- Default sort is soonest-first so upcoming actionable entries stay at the top.
- For same-date ties, persisted rows appear before projected rows.
- Completed rows remain interleaved by chronology on the same date (no forced push to top or bottom).
- Timeline is grouped with date headers, not a flat continuous list.

### Projected vs persisted cues
- Projected rows always show an explicit `Projected` badge.
- Use subtle visual contrast between projected and persisted rows (clear but not heavy).
- Include a short inline legend near section headers to explain state labels.
- Show state markers anywhere applicable, including timeline and asset ledger surfaces.

### Projected edit behavior
- Confirmation copy must explicitly state that saving creates a persisted exception for that date.
- Use explicit primary action wording (for example, `Save exception`) rather than generic copy.
- After save, update the same row in place to reflect persisted state.
- Show an `Edited occurrence`-style indicator for rows materialized via projection edits.
- If amount and date are edited together, confirmation includes a field-level change summary (old -> new).
- On validation/server failure, show inline error plus toast.
- No success toast is required when in-place row state clearly updates.
- No direct revert-to-projected control is required in this phase.

### Asset ledger split
- Split records by status/date rules: pending and future-facing rows in Current & Upcoming; settled historical rows in Historical.
- Each section includes a compact summary header with count and total amount.
- Historical section is collapsed by default on mobile.
- Empty states use plain informative copy (no decorative or promotional tone).

### Claude's Discretion
- Exact badge/icon visual treatment and spacing as long as state distinction remains subtle and clear.
- Final microcopy wording for legends and empty states, preserving explicitness and plain tone.

</decisions>

<specifics>
## Specific Ideas

- The desired future-series edit behavior should feel similar to Google Calendar's "this event vs this and following" model, but series-wide edits are out of scope for this phase.

</specifics>

<deferred>
## Deferred Ideas

- Add recurrence-series edit scope controls (for example, "change this occurrence" vs "change this and all future occurrences") as a separate future phase.

</deferred>

---

*Phase: 11-timeline-projection-asset-ledger-views*
*Context gathered: 2026-02-27*
