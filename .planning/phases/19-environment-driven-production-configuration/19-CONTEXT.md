# Phase 19: Environment-Driven Production Configuration - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase externalizes required production configuration for network, admin identity, and database secret values (`NAS_STATIC_IP`, `HACT_ADMIN_EMAIL`, `DB_PASSWORD`) and defines clear startup validation behavior when values are missing or invalid.

</domain>

<decisions>
## Implementation Decisions

### Validation UX
- Required env var issues must fail startup (no partial boot on bad config).
- Startup validation output must be explicit in container logs so Portainer operators can diagnose quickly.
- Validation must report all missing/invalid required variables in one pass.
- Error output must include variable names and a short fix hint to set them in Portainer stack environment variables.
- Error output must not include sensitive sample secret values.

### Claude's Discretion
- Exact wording/formatting structure of validation messages.
- Whether to distinguish missing vs invalid as separate visual sections while still reporting all issues in one pass.

</decisions>

<specifics>
## Specific Ideas

- Operator troubleshooting should be log-first and immediately actionable in Portainer.
- Validation feedback should help recovery without exposing secret examples.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 19-environment-driven-production-configuration*
*Context gathered: 2026-03-04*
