# Phase 9: RBAC Scope & Admin Safety Mode - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver role-aware ownership enforcement for standard users and safe global visibility controls for admin users. This phase covers authorization scope behavior, admin lens UX, and attribution clarity for writes/history within dashboard, items, and events workflows.

</domain>

<decisions>
## Implementation Decisions

### Admin mode entry and safety signaling
- One specific user account is designated as admin and receives global visibility immediately on login.
- Admin scope state is always visible with a persistent top warning banner.
- Exiting admin mode requires explicit confirmation.
- Mutation context in admin mode must show both acting user and selected lens user.

### User lens behavior
- Default admin lens is `All users` on login.
- Lens filtering must apply across Dashboard, Items, and Events surfaces.
- Admin can switch between `All users` and a specific-user lens.
- Lens switch performs a hard reset + refetch to avoid cross-user state leakage.
- Mutation actions in admin mode must show a target-user chip.

### Ownership denial behavior
- Standard user direct access to another user's resource should return 404-style not-found behavior.
- Blocked writes should show both inline and toast policy errors.
- Ownership error copy should be plain/direct (user can only access own records).
- If selected admin lens target becomes invalid, block writes until a valid lens is reselected.

### Audit attribution visibility
- Attribution is required for Create, Complete/Undo, Delete/Restore, and Update actions.
- Activity/history rows should display `Actor + Lens` tuple.
- Admin safety attribution should appear in three places: top banner, mutation buttons, and confirmation dialogs.
- Attribution should remain visible indefinitely in retained in-app history.

### Claude's Discretion
- Exact visual styling of banner/chip/dialog components while preserving required content.
- Exact wording details for direct ownership denial copy, as long as meaning remains plain and explicit.
- Exact placement hierarchy of attribution metadata in dense activity rows.

</decisions>

<specifics>
## Specific Ideas

- Admin context should read as a clear tuple model: "Actor: admin@... | Lens: user@...".
- Safety UX should prioritize preventing accidental cross-user writes over minimizing clicks.

</specifics>

<deferred>
## Deferred Ideas

- None - discussion stayed within Phase 9 scope.

</deferred>

---

*Phase: 09-rbac-scope-admin-safety-mode*
*Context gathered: 2026-02-25*
