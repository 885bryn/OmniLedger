# Phase 37: Exceptions, Trends, and Dashboard Polish - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Polish the redesigned dashboard so it is less redundant, has clearer visual hierarchy, and preserves strict data precision in user-facing context copy. This phase refines existing dashboard surfaces and signal clarity without introducing new backend capabilities.

</domain>

<decisions>
## Implementation Decisions

### Redundancy removal
- Remove or fully hide the financial snapshot list surface from dashboard presentation.
- `dashboard-financial-snapshot.tsx` should no longer render as a competing list in the dashboard layout.
- Reason: event-level obligations are already represented in `Needs Attention`; duplicate list context should be eliminated.

### Layout hierarchy and portfolio elevation
- Place `Portfolio snapshot` in the right-hand column at roughly 40% width, adjacent to `Needs Attention` in the main dashboard body.
- Keep `Needs Attention` as the dominant left-column operational queue.
- Use right-column composition to prioritize portfolio + exception awareness over duplicate event lists.

### Exception signals on asset cards
- Add a prominent exception treatment on asset cards when that asset has overdue events.
- Exception treatment must be visually obvious (for example: red border and/or `Needs Attention` badge), not subtle.
- Exception signal should be computed from existing event state; no new backend contract.

### Recent activity density
- Keep `Recent Activity`, but convert it to a compact, low-profile audit-log presentation.
- Reduce spacing and typography emphasis so it does not compete with primary triage surfaces.
- Maintain readability while clearly deprioritizing it in visual hierarchy.

### Microcopy precision (locked)
- Do not simplify `Current position` microcopy.
- Preserve highly specific context phrasing and strict date-boundary language (examples: `Based on events due in Mar 1 - Mar 31`, `9 upcoming rows due in ...`).
- Precision and explicit boundary definition are mandatory for this phase.

### Claude's Discretion
- Exact responsive breakpoint behavior to preserve the 60/40 hierarchy intent across desktop/tablet/mobile.
- Exact visual style token choices for exception indicators as long as prominence is clear.
- Exact compacting values for recent activity (padding/font/row density) while preserving legibility.

</decisions>

<specifics>
## Specific Ideas

- Treat Phase 37 as dashboard de-duplication and hierarchy correction rather than feature expansion.
- Keep the dashboard operationally precise: less duplicate UI, stronger signal placement, exact metric context wording.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 37-exceptions-trends-and-dashboard-polish*
*Context gathered: 2026-03-12*
