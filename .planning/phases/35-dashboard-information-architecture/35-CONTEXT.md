# Phase 35: Dashboard Information Architecture - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign the dashboard into a clearer utility-first control center using `shadcn/ui`, with strong section hierarchy, period-aware summary cards, and dedicated `Needs Attention` plus `Recent Activity` surfaces. This phase clarifies dashboard information architecture only; new capabilities like search, filtering, or new workflows belong in later phases.

</domain>

<decisions>
## Implementation Decisions

### Section hierarchy
- The dashboard should read as three clear bands at a glance.
- The first surface under the header should be a critical summary row.
- `Needs Attention` should get the most screen space in the main body.
- `Recent Activity` should live as a right-side companion to the main action area on desktop.

### Summary card framing
- The top summary row should anchor on four metrics: net cashflow, upcoming due, overdue, and completed activity.
- Summary cards should feel informational first, not analytical or heavily action-styled.
- Cards should still be usefully clickable when they can open relevant downstream views.
- Each card should include one short supporting line of context.

### Needs Attention vs Recent Activity
- `Needs Attention` should prioritize overdue items first, then due-soon obligations.
- `Needs Attention` rows should be dense but readable, optimized for scanning.
- `Recent Activity` should act as a supportive feed, not a second urgent queue.
- Manual overrides or exceptional entries in activity should be calm but distinct rather than alarming.

### Mobile dashboard flow
- On mobile, `Needs Attention` should stay directly below the summary row.
- Summary cards should stack in priority order on smaller screens rather than compress into a tight grid.
- The desktop right-side `Recent Activity` companion should move below `Needs Attention` on mobile.
- Lower supporting sections should become a single-column utility stack.
- Mobile section headings should stay strong and clear.
- Mobile attention rows should keep key metadata such as due date, amount, and linked item context.
- Mobile should optimize for quick scanning first.
- Empty states should stay compact and calm on mobile.

### Claude's Discretion
- Exact `shadcn/ui` component composition for each section.
- Final copy wording for supporting text inside summary cards and empty states.
- Exact spacing, typography scale, and visual token choices within the approved hierarchy.

</decisions>

<specifics>
## Specific Ideas

- The dashboard should feel more like a household finance operations center than a generic overview page.
- The top of the dashboard should answer overall position first, then immediately transition into what needs action now.
- The main action queue should feel compact and useful, while recent activity should feel calmer and more observational.
- Mobile should preserve the same hierarchy as desktop instead of inventing a different interaction model.

</specifics>

<deferred>
## Deferred Ideas

- Dashboard search/filter controls beyond the scoped summary and section architecture.
- New workflows or expanded action capabilities beyond the existing event and item-detail flows.
- Broader analytics, charts, or deeper trend tooling that would warrant later phases.

</deferred>

---

*Phase: 35-dashboard-information-architecture*
*Context gathered: 2026-03-10*
