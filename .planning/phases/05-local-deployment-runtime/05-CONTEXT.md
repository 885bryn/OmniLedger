# Phase 5: Local Deployment Runtime - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver local runtime deployment for the API + PostgreSQL stack via Docker Compose so users can start services together and access them on the local network.

Scope includes compose service contract, startup workflow, environment configuration, and readiness/troubleshooting behavior for local execution.

</domain>

<decisions>
## Implementation Decisions

### Compose service contract
- API default host port is `8080`.
- PostgreSQL default host port is `5433`.
- Compose uses fixed/predictable service names (for example, `api`, `db`).
- API is LAN-reachable by default (not localhost-only).

### Startup workflow UX
- Primary startup command is `docker compose up -d`.
- First boot auto-runs migrations.
- Canonical stop command is `docker compose down`.
- Documentation provides a single quickstart path.

### Env/config behavior
- Commit a `.env.example` with required variables and safe placeholders.
- Local developers copy `.env.example` to `.env`.
- Compose-provided environment values are the runtime source of truth.
- Docs explicitly list sensitive placeholders (DB password, JWT secret, etc.) even for local use.

### Readiness and failure signals
- Include healthchecks for both API and DB services.
- API should wait/retry until DB is ready (not fail-fast).
- Health verification guidance uses `docker compose ps` plus API health endpoint checks.
- Quickstart includes top 3 troubleshooting fixes: port conflicts, missing/invalid env values, delayed DB readiness.

### Claude's Discretion
- Exact healthcheck intervals/timeouts/retry counts.
- Exact env variable naming for compose-specific convenience vars when equivalent options exist.
- Exact wording/format of quickstart and troubleshooting sections.

</decisions>

<specifics>
## Specific Ideas

- Keep local startup friction low: one command up, one command down.
- Prefer explicit, deterministic defaults so onboarding is repeatable across machines.
- Optimize for local-network validation, not just localhost-only development.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-local-deployment-runtime*
*Context gathered: 2026-02-25*
