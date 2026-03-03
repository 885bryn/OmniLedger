# Phase 18: Export Feedback UX and Audit Visibility - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver trustworthy in-app export feedback states (loading, success, failure) and user-visible audit attribution for export actions (actor and lens context). This phase clarifies how export status communication and audit traceability should appear within existing product surfaces.

</domain>

<decisions>
## Implementation Decisions

### Failure recovery UX
- Failure messaging should prioritize a clear retry path.
- Error state should include a one-click retry action in the same UI context.
- Auth/session-related failures should include actionable re-auth guidance.
- Repeated failures should escalate guidance (for example: check connection, refresh session, then retry).

### Loading feedback behavior
- In-progress export feedback should appear inline near the export action.
- Export action should be disabled with a loading label while request is in progress.
- Long-running exports should keep a persistent "still working" hint.
- Loading state should clear when response completion is known (success or failure).

### Success confirmation style
- Success feedback should explicitly confirm export completion and download start.
- Use medium prominence confirmation (inline plus toast-level acknowledgement).
- In admin contexts, success messaging should include contextual attribution (actor/lens context).
- Success feedback should auto-dismiss after a brief readable interval.

### Audit history visibility
- Each export audit entry should include actor, lens context, and timestamp.
- Lens attribution should be shown as readable label plus stable ID.
- Audit visibility should use the existing audit history surface (no new export-only surface).
- Failed export attempts should be recorded with outcome status (not successes-only).

### Claude's Discretion
- Exact copy text for loading/success/failure states, as long as it remains actionable and trust-oriented.
- Exact duration values for brief auto-dismiss behavior.
- Exact visual emphasis patterns for inline vs toast confirmation while maintaining medium prominence.

</decisions>

<specifics>
## Specific Ideas

- Strong preference for explicit trust signals: users should know both that export completed and that download started.
- Failure handling should never leave users guessing; retry path should remain immediately visible.
- Audit attribution must be human-readable and machine-stable at the same time.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 18-export-feedback-ux-and-audit-visibility*
*Context gathered: 2026-03-03*
