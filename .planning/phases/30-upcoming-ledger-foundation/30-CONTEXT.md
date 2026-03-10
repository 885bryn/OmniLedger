# Phase 30: Upcoming Ledger Foundation - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a read-only global Events ledger foundation for upcoming events. This phase covers `Upcoming` and `History` tabs, chronological grouping for upcoming rows, sticky headers, overdue emphasis, and foundational empty/loading/error states. Mark-paid behavior, populated history, and manual historical injection are separate later phases.

</domain>

<decisions>
## Implementation Decisions

### Group Boundaries
- `Overdue` means any event due before the current calendar day, not before the current timestamp.
- `This Week` uses a rolling 7-day window, and the UI should make that rolling definition clear to the user.
- `Later This Month` includes events beyond the rolling 7-day window that still fall within the current calendar month.
- Within each group, cards should be ordered soonest due first.

### Event Card Content
- Upcoming ledger rows should be compact and scan-first rather than spacious.
- Each card should lead with the event name plus the related item/asset context.
- Due date and amount should always be visible as the core secondary details.
- Overdue styling should use a red urgent accent, but not a full destructive-card treatment.

### Tab Behavior
- The Events page should open on the `Upcoming` tab by default in this phase.
- The tab bar should remain visible while scrolling long ledgers.
- `History` should exist now but show a purposeful empty state until Phase 31 populates it.
- Tab labels should not show counts yet in this phase.

### Empty and Loading States
- If there are no upcoming events, the empty state should feel like a calm all-clear rather than an instructional prompt.
- Empty groups should be hidden instead of rendering placeholder section shells.
- Initial loading should use skeleton groups/cards so the ledger structure is visible immediately.
- Load failures should use a plain recovery-oriented message rather than dramatic warning language.

### Claude's Discretion
- Exact wording for the rolling-7-day explanation, as long as users can tell it is not a fixed calendar week.
- Visual styling details for skeleton placeholders, spacing, and typography within the chosen compact ledger direction.
- Exact retry affordance for load failures, provided the tone stays calm and recovery-oriented.

</decisions>

<specifics>
## Specific Ideas

- The ledger should communicate that `This Week` is rolling, not a Monday-Sunday calendar bucket.
- The phase should feel optimized for quick scanning of many rows, not large showcase cards.
- `History` should feel intentionally present from day one, even though it stays empty until the next phase.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 30-upcoming-ledger-foundation*
*Context gathered: 2026-03-10*
