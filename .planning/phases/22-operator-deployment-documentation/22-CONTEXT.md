# Phase 22: Operator Deployment Documentation - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Publish a single operator-facing production deployment procedure for NAS + Portainer that clearly lists required environment values and enables successful deployment without missing-configuration blockers.

</domain>

<decisions>
## Implementation Decisions

### Runbook flow
- Primary path is pinned-tag deployment, not floating `latest`.
- GitHub Actions image publish/verification appears before Portainer deploy steps.
- Document two separate procedures: first-time deployment and update/redeploy.
- Include explicit rollback procedure to previous known-good image tag.

### Environment variable presentation
- Present env values in tiered groups: required core, optional tuning, and derived values.
- Main documentation uses placeholders (no real secrets in shared docs).
- Document `DATABASE_URL` encoding rules explicitly, including `!` -> `%21` with a concrete example.
- Provide one canonical copy-paste env block for Portainer panel input.

### Troubleshooting strategy
- Troubleshooting is organized by symptom, then cause checks, then exact fixes.
- First-class incidents to cover: session drop after login, `/items` route-not-found, Portainer deploy `500`, and image-tag drift mismatch.
- Include exact diagnostic commands with expected outputs/signatures.
- Keep runbook on permanent fixes only; do not include temporary runtime hotfix procedures.

### Verification checklist
- Use gate-based required checks before declaring deployment successful.
- Mandatory checks include: health/auth/session persistence, protected-route expectations, item-create functional check, and persistence restart check.
- Present verification as request/response table with expected status and failure interpretation.
- Include explicit stop conditions and rollback trigger criteria.

### Claude's Discretion
- Exact document formatting style and section heading hierarchy.
- Exact wording tone while preserving explicit operational clarity.
- Exact ordering of troubleshooting entries within each symptom cluster.

</decisions>

<specifics>
## Specific Ideas

- Keep guidance deterministic and recovery-focused for real Portainer operations.
- Use explicit expected outcomes (status/body signatures), not generic success language.
- Include practical rollback readiness as part of standard runbook flow.

</specifics>

<deferred>
## Deferred Ideas

- Create a private operator-only cheat-sheet variant with real environment values and secrets handling notes; keep this separate from shared/public documentation.

</deferred>

---

*Phase: 22-operator-deployment-documentation*
*Context gathered: 2026-03-06*
