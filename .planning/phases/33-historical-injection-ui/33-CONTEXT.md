# Phase 33: Historical Injection UI - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Add an explicit manual-override workflow to item detail so users can log a completed historical event with date, amount, and note fields, then see it in history as a completed manual entry. This phase stays within the existing manual-override contract and must preserve RBAC scoping, audit attribution, and current deployment-facing behavior.

</domain>

<decisions>
## Implementation Decisions

### Launch point
- Expose the historical injection action from both item-detail tabs.
- Use a secondary button, not a primary CTA or low-visibility text link.
- Launch the flow in a modal dialog.

### Form behavior
- Default the date field to the item's last due date when available.
- Default the amount field to the item's default amount.
- Keep note as an optional freeform field.
- Include short helper copy that explains this creates a completed manual historical entry.

### Safety messaging
- Show an inline warning banner inside the dialog to reinforce that this is an exceptional manual-override flow.
- Keep validation and policy failures in the dialog with inline feedback so users can correct issues without losing context.
- When an admin is acting in a scoped view, show both actor and target attribution in the dialog.
- Do not require an additional acknowledgement checkbox or second confirmation step beyond the dialog submit action.

### After submit
- On success, close the dialog and refresh the relevant item-detail and event data in place.
- Direct the user back to the item-detail History tab as the primary place to confirm the result.
- Show the new row in normal chronological history, using the existing manual-override exceptional treatment rather than pinning or separating it.
- Provide a success toast in addition to the visible refreshed history row.

### Claude's Discretion
- Exact button label and placement within each tab.
- Precise helper-copy and warning-banner wording.
- Exact inline error presentation details, as long as failures stay visible within the dialog.
- Whether the post-save history focus is handled by switching tabs automatically or another equally clear in-context reveal.

</decisions>

<specifics>
## Specific Ideas

- The flow should feel explicit and exceptional without overpowering normal item-detail actions.
- The item-detail History tab is the clearest confirmation surface after save, even though the action itself should be reachable from both tabs.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 33-historical-injection-ui*
*Context gathered: 2026-03-10*
