# Phase 16: Event History and Downloadable Workbook - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a downloadable workbook experience that includes all required sheets (`Assets`, `Financial Contracts`, `Event History`) and makes event lifecycle history readable with stable cross-sheet relationships. This phase clarifies export/download behavior and workbook readability within the existing export surface.

</domain>

<decisions>
## Implementation Decisions

### Event row clarity
- Event rows should lead with lifecycle-stage readability (not raw system-type emphasis).
- Row density should be balanced: enough lifecycle and money context to understand status quickly without overloading each row.
- Missing lifecycle values should use explicit markers (not blank cells).
- Event History default ordering should be newest-first.

### Cross-sheet linking
- Event rows should include both stable IDs and readable reference values in separate fields.
- When a linked record cannot be resolved, keep the ID context and show an explicit `UNLINKED` marker.
- Include both contract and asset references whenever available.
- Cross-sheet reference values should match `Assets` and `Financial Contracts` sheet values exactly.

### Download experience
- Export action should show immediate inline loading state in-app.
- On success, show explicit success feedback in-app in addition to browser download behavior.
- On failure, present actionable retry guidance.
- While export is in progress, prevent duplicate export clicks.

### Workbook structure defaults
- Sheet order should be `Assets` -> `Financial Contracts` -> `Event History`.
- Sheet naming should use human-readable titles.
- All sheets should open with frozen headers and filtering enabled.
- Date/time presentation should be consistent and user-friendly across workbook sheets.

### Claude's Discretion
- Exact UX microcopy for loading/success/failure messages.
- Exact column-level field selection as long as balanced density and lifecycle readability are preserved.
- Exact visual style/details of in-app export feedback components.

</decisions>

<specifics>
## Specific Ideas

- Emphasis on fast human scanning in Event History (lifecycle-stage first and newest-first ordering).
- Strong preference for explicit unresolved relationship signaling via `UNLINKED`.
- Workbook should feel consistent on first open across all sheets (same readability defaults).

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 16-event-history-and-downloadable-workbook*
*Context gathered: 2026-03-03*
