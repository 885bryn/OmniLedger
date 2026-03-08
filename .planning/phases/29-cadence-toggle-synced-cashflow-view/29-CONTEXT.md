# Phase 29: Cadence Toggle & Synced Cashflow View - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a cadence switch (weekly/monthly/yearly) to the asset summary so obligations, income, and net cashflow update together with cadence-aligned labels and units, while preserving existing item/event workflows and safety behavior.

</domain>

<decisions>
## Implementation Decisions

### Cadence control UX
- Use a segmented three-option control (Weekly, Monthly, Yearly), not dropdown or cycle button.
- Default cadence is monthly when opening an asset summary.
- Cadence selection scope is per-asset session state (resets to monthly when re-entering asset detail).
- Place one shared cadence control directly above the obligations/income/net cards.

### Synchronized card updates
- Obligations, income, and net cashflow must update atomically (never mixed-cadence values on screen).
- Use a section-level loading state for the summary cards during cadence changes.
- If cadence update fails, keep prior synced values and show concise user feedback.
- On rapid cadence changes, last selection wins.

### Labels and unit wording
- Card titles must include explicit cadence wording (for example, Weekly Obligations, Monthly Income, Yearly Net Cashflow).
- Primary unit clarity comes from full cadence words in labels, not symbol-only shorthand.
- Net card includes concise helper text stating formula at active cadence.
- Cadence terms should be locale-specific in i18n (en/zh), not forced English terms.

### Net cashflow presentation
- In-scope net card value represents recurring cadence-normalized net.
- Present one-time impact as a separate note (not blended into recurring net value).
- Positive/negative values use semantic color plus explicit +/- sign.
- Exact zero is shown as 0.00 with neutral styling.
- Place one-time-impact note directly under the net card.

### Claude's Discretion
- Exact segmented-control visual styling and microcopy tone, as long as cadence state clarity is preserved.
- Exact animation timing for synchronized card transitions/loading states.
- Exact phrasing for localized helper text, as long as cadence and net formula meaning stay explicit.

</decisions>

<specifics>
## Specific Ideas

- User expects the cadence switch to feel obvious and tightly coupled to the three cashflow cards.
- User wants card synchronization to avoid trust-breaking partial updates.
- User prefers recurring net as the main signal with one-time impact clearly visible as context.

</specifics>

<deferred>
## Deferred Ideas

- Blend one-time values directly into cadence net cashflow card totals (deferred policy change; aligns with future CASH-05 style preference work).

</deferred>

---

*Phase: 29-cadence-toggle-synced-cashflow-view*
*Context gathered: 2026-03-08*
