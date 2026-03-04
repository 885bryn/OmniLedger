# Phase 21: Portainer Stack Deployment and Persistence - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a deployable production stack for `frontend`, `backend`, and `postgres` in Portainer with environment-variable injection and NAS-backed Postgres persistence at `/volume1/docker/house-erp/db-data`.

</domain>

<decisions>
## Implementation Decisions

### Stack workflow
- Optimize for a single long-lived Portainer stack lifecycle updated in place over time.
- Use a fixed canonical stack name for operator consistency (example style: `house-erp-prod`).
- Treat in-place stack update/redeploy as the standard update path, not remove/recreate.
- First deployment is only considered successful when backend reaches healthy state after DB readiness and migrations.

### Environment variable contract
- Missing required environment variables must fail fast with clear, variable-specific errors.
- Maintain one canonical required-variable checklist used across stack and docs.
- Lock API routing contract to NAS-derived values (including `API_URL=http://${NAS_STATIC_IP}:8085/api`).
- Keep optional environment-variable surface minimal to preserve deterministic behavior.

### Persistence guarantees
- Persistence baseline is mandatory survival of data across normal service/stack restarts.
- Lock Postgres host path requirement to `/volume1/docker/house-erp/db-data`.
- Include explicit verification steps that prove data remains after restart.
- In-place updates must preserve DB volume continuity (no remap/recreate behavior).

### Operational feedback
- Deployment success signal must include frontend reachability and backend health validation (not just running containers).
- Config failures must surface actionable diagnostics that name missing/invalid variables.
- First-boot validation should be a short explicit operator checklist.
- Troubleshooting in this phase should cover top failure modes (env/path/network) with direct corrective actions.

### Claude's Discretion
None explicitly granted during context discussion.

</decisions>

<specifics>
## Specific Ideas

No specific external product references were requested. Use straightforward, operator-first wording and deterministic deployment behavior.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 21-portainer-stack-deployment-and-persistence*
*Context gathered: 2026-03-04*
