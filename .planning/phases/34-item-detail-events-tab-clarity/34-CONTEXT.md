# Phase 34: Item Detail Events Tab Clarity - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Rename the Financial Item detail tab currently labeled `Commitments` to `Events` so users can more easily understand that the tab contains event timeline content and event actions. This phase is a UI clarity pass only and must not change the underlying event data, timeline behavior, tab order, or any non-item-detail flows.

</domain>

<decisions>
## Implementation Decisions

### Scope
- Change the Financial Item detail tab label from `Commitments` to `Events`.
- Keep the existing tab order: `Overview`, `Events`, `Activity`.
- Keep the existing content, actions, and timeline behavior inside that tab unchanged.

### Copy boundary
- Update only the item-detail tab label and closely related accessibility/test text that references that tab.
- Do not rename unrelated copy such as linked financial item headings, model names, or other domain-specific `commitment` wording outside this tab-label clarity issue.

### Verification focus
- Confirm the renamed tab still opens the same event timeline surface.
- Confirm historical injection and history/upcoming sub-tabs still work the same after the rename.
- Confirm stale `Commitments` wording does not remain in the item-detail tab control or its targeted frontend regressions.

### Claude's Discretion
- Exact translation wording for `Events` in localized strings.
- Whether any nearby helper/accessibility text in the same tab control needs a minor wording touch to stay coherent.

</decisions>

<specifics>
## Specific Ideas

- This is a clarity rename, not a structural redesign.
- The user should understand at a glance that the tab is about item-specific events, not linked commitments management.

</specifics>

<deferred>
## Deferred Ideas

- Broader terminology cleanup for `commitment` wording elsewhere in Financial Item detail.
- Any reorganization of tab content or event-history information architecture.

</deferred>

---

*Phase: 34-item-detail-events-tab-clarity*
*Context gathered: 2026-03-10*
