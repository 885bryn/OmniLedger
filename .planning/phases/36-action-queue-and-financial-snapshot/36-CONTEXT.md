# Phase 36: Action Queue and Financial Snapshot - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a dashboard action queue for overdue and upcoming obligations, plus a reusable financial snapshot section for fast item-status scanning, with clear navigation into existing event and item-detail workflows. This phase clarifies how those surfaces behave, not adding new capabilities.

</domain>

<decisions>
## Implementation Decisions

### Queue priority model
- Default ordering is urgency-first: overdue items before upcoming items.
- Overdue items are sorted by oldest overdue first.
- Upcoming items are sorted by nearest due date first.
- Queue is visually split into two sections: `Overdue` and `Upcoming`, each with a header and count.
- `Upcoming` includes obligations due in the next 14 days.
- Overdue severity is shown with explicit age buckets (for example: `1-7d`, `8-30d`, `30+d`).

### Claude's Discretion
- Queue action affordance details (exact inline-safe actions vs link-out patterns).
- Financial snapshot row fields/metadata density and secondary data treatment.
- Exact transition/handoff UX details into event and item-detail views.

</decisions>

<specifics>
## Specific Ideas

- Priority should support rapid triage: most overdue first, then near-term upcoming.
- Queue should remain scan-friendly under high overdue volume by using clear overdue age bands.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 36-action-queue-and-financial-snapshot*
*Context gathered: 2026-03-11*
