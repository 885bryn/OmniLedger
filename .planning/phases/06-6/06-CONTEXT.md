# Phase 6: Full Frontend UI Stack - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a full responsive website frontend that connects to the existing HACT API/database workflows end-to-end for dashboard, items, events, and completion flows.

Scope is implementation clarity for this frontend delivery phase. New capabilities outside these workflows are deferred.

</domain>

<decisions>
## Implementation Decisions

### Core user journeys and navigation
- Default landing is a portfolio dashboard.
- Mandatory v1 pages: Dashboard, Items, and Events.
- Primary home action emphasizes completing due events.
- Event completion happens inline in list views.
- Use a simple user switcher for active user context in local/dev workflows.
- Primary navigation uses a left sidebar.
- Item net-status opens on a dedicated item detail page.
- Item creation uses a step-by-step wizard.
- Target responsive web (desktop + mobile), not separate apps.
- For non-recurring completion with `prompt_next_date: true`, show an immediate follow-up modal with a clear option to skip scheduling.
- Dashboard/events prioritize nearest due first.
- v1 supports soft delete with confirmation.
- First-run no-data experience uses a guided empty state with CTA.
- Dashboard includes high-level financial summary cards.
- Item detail uses tabbed sections.
- Successful event completion shows inline success with refreshed row/state.

### Visual direction
- Visual style: modern finance dashboard.
- Data screens use medium density for scanability.
- Color strategy: neutral base with status-driven accents (overdue/completed/risk emphasis).
- Component shape language: soft corners with subtle depth.

### Data interaction model
- Item editing uses dedicated form-based edit pages.
- Commitment creation requires selecting parent asset in wizard flow.
- Net-status presentation: summary cards + linked child commitment list.
- Include a basic audit/activity history section in Phase 6 UI.

### State feedback behavior
- Use skeleton loading on major views.
- Empty states are action-oriented with explicit next steps.
- API errors show inline field/page messaging with top-level summary.
- Mutations use confirm-then-refresh behavior (no optimistic default).

### List controls
- Items default sort: recently updated.
- Filters: quick filter chips for common conditions.
- Search: debounced live search.
- Events view: grouped-only experience (no grouped/flat toggle in v1).

### Language and terminology behavior
- Entire UI supports English and Mandarin Chinese with a global header language switcher.
- Language labels: `English | 中文`.
- Language switch applies immediately without reload.
- Missing translations fall back to English.
- User-entered data values are never translated (addresses, vehicle names, subscription names, descriptions, etc.).

### Safeguards and confirmations
- Soft delete uses a simple confirm modal.
- Event completion is one-click (no always-on confirm).
- Navigating away from dirty forms triggers an unsaved-changes warning.
- Follow-up modal defaults to scheduling focus while allowing a clear "Not now" skip.

### Frontend stack preference
- Frontend stack preference is React with shadcn/ui for component foundation.

### Claude's Discretion
- Exact component-level spacing, typography scales, and animation timing.
- Exact chip/filter control visuals and iconography.
- Exact wording variations as long as meaning and bilingual behavior stay aligned.

</decisions>

<specifics>
## Specific Ideas

- The UI should feel like a complete website experience, not a simple admin shell.
- Cross-page behavior should stay consistent for create/edit/complete workflows.
- Bilingual behavior should be universal for interface text, while preserving original data values.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 06-6*
*Context gathered: 2026-02-25*
