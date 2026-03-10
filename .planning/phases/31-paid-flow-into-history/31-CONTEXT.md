# Phase 31: Paid Flow Into History - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn the read-only Events ledger into a state-changing flow where users can mark upcoming events as paid and then see those completed events appear in `History`. This phase covers the pay interaction, motion-backed departure from `Upcoming`, grouped completed-history presentation, and failure/pending handling for that workflow. Manual historical injection and broader event editing remain separate later phases.

</domain>

<decisions>
## Implementation Decisions

### Mark Paid Interaction
- `Mark Paid` should be an inline button on each upcoming card for fast completion.
- The action should complete immediately with undo-style feedback rather than opening a blocking confirm dialog.
- Marking paid from `Upcoming` should use today's date as the completion date by default.
- After success, the card should briefly show a paid acknowledgment state before animating out of `Upcoming`.

### History Presentation
- `History` should group completed rows by month/year sections such as `March 2026`.
- Each history row should lead with the event and paid date.
- Amount and related item context should always remain visible as the core secondary details.
- Newly arrived rows should get only a subtle highlight, not a strong celebratory treatment.

### Failure and Pending States
- While `Mark Paid` is saving, keep the row visible but disable the action.
- Extra taps during the in-flight save should be ignored rather than queued or warned aggressively.
- If marking paid fails, show inline error + retry on the same row instead of relying on toast-only or modal recovery.
- If the payment succeeds but `History` refresh is delayed or fails, prioritize success messaging first and explain that history is catching up.

### Claude's Discretion
- Exact wording and placement of the brief paid acknowledgment, as long as the row still exits quickly.
- Exact visual treatment for the subtle newly-arrived History highlight.
- Exact microcopy for the inline retry and history-catching-up message, as long as it stays calm and clear.

</decisions>

<specifics>
## Specific Ideas

- The phase should feel like a fast ledger workflow, not a heavy approval flow.
- History should read like a trustworthy completed ledger archive rather than a flashy activity feed.
- Success should feel immediate even if the History view catches up a beat later.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 31-paid-flow-into-history*
*Context gathered: 2026-03-10*
