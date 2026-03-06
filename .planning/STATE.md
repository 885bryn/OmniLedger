# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-03-04)
Milestone archives: `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v2.0-ROADMAP.md`, `.planning/milestones/v3.0-ROADMAP.md`

**Core value:** Users can see each asset together with its linked obligations and timeline status so they can make clear, timely household financial decisions.
**Current focus:** Phase 22 - Operator Deployment Documentation

## Current Position

Phase: 22 of 22 (Operator Deployment Documentation)
Plan: 2 of 2
Status: In Progress
Last activity: 2026-03-06 - completed 22-01 production operator runbook with publish-first deploy/update/rollback guidance

Progress: [███████░░░] 75%

## Performance Metrics

**Velocity:**
- Total plans completed: 53
- Average duration: 4 min
- Total execution time: 4.1 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 14-18 (v3.0) | 11 | 46 min | 4 min |

**Recent Trend:**
- Last 5 plans: 21-02 (7 min), 21-01 (2 min), 20-02 (3 min), 20-01 (1 min), 19-02 (2 min)
- Trend: Stable delivery cadence; Phase 21 closure required extra verification diagnostics due Docker runtime limits
- Phase 19 P01: 3 min, 3 tasks, 7 files
- Phase 19 P02: 2 min, 3 tasks, 7 files
- Phase 20 P01: 1 min, 3 tasks, 2 files
- Phase 20 P02: 3 min, 3 tasks, 3 files
| Phase 21 P01 | 2 min | 3 tasks | 2 files |
| Phase 21 P02 | 7 min | 3 tasks | 5 files |
| Phase 22 P01 | 2 min | 3 tasks | 1 files |

## Accumulated Context

### Decisions

Decisions are logged in `.planning/PROJECT.md`.
Recent decisions affecting current work:

- v4.0 phase numbering continues from prior milestone and starts at Phase 19.
- v4.0 roadmap is derived only from ENV/CONT/DEPL/DOCS requirement groups.
- Every v4.0 v1 requirement maps to exactly one phase (19-22) with observable success criteria.
- [Phase 19]: Validation reports all missing or invalid required production env vars in one deterministic, Portainer-focused payload.
- [Phase 19]: Startup now runs production env preflight before DB readiness, migrations, or server spawn to guarantee fail-fast behavior.
- [Phase 19]: Admin identity mapping uses HACT_ADMIN_EMAIL as the sole configured source; legacy ADMIN_EMAIL fallback is ignored.
- [Phase 19]: Production backend CORS allowlist now resolves FRONTEND_ORIGIN first, then NAS_STATIC_IP + FRONTEND_PORT for deterministic env-driven targeting.
- [Phase 19]: Frontend API base URL now resolves from VITE_API_BASE_URL override, then VITE_NAS_STATIC_IP, preserving localhost fallback only for non-configured dev flows.
- [Phase 20]: Backend production image boots through src/scripts/startup.js so env validation and migrations run before server startup.
- [Phase 20]: Production build context excludes planning/frontend/test/local artifacts to keep backend image inputs deterministic.
- [Phase 20]: Container contract includes an explicit /health probe on port 8080 for runtime readiness checks.
- [Phase 20]: Frontend production builds now default VITE_API_BASE_URL to /api while preserving explicit override support.
- [Phase 20]: Frontend gateway startup hard-fails unless NAS_STATIC_IP is present and valid IPv4, preventing localhost fallback in production.
- [Phase 21]: Compose stack identity is fixed to house-erp-prod for in-place Portainer updates.
- [Phase 21]: Critical stack variables use compose required interpolation to fail fast on missing deployment secrets and NAS identity.
- [Phase 21]: Postgres persistence is locked to /volume1/docker/house-erp/db-data via bind mount for restart continuity.
- [Phase 21]: Use GHCR as the only production registry target with one canonical frontend/backend image tag contract across CI and CLI.
- [Phase 21]: Require GHCR_OWNER and IMAGE_TAG in compose interpolation so Portainer deploys fail fast when image coordinates are missing.
- [Phase 21]: Mark verification as diagnosed when Docker runtime is unavailable while preserving DEPL traceability and NAS rerun steps.
- [Ops 2026-03-06]: Local HTTP LAN deploy must set `SESSION_COOKIE_SECURE=false`; otherwise login succeeds but browser drops session cookie and protected routes return `401`.
- [Ops 2026-03-06]: `Route not found` on `/items` can be caused by backend route load failure when `src/domain/items/financial-metrics.js` is missing from image. Resolution: include module (`b68333c`), publish new backend/frontend images, redeploy pinned tag in Portainer.
- [Ops 2026-03-06]: Avoid floating `latest` for recovery deploys; pin frontend and backend to the same explicit GHCR tag for deterministic runtime behavior.
- [Phase 22]: README now defines one canonical publish-first deployment runbook for Ugreen NAS + Portainer using pinned GHCR tags only.
- [Phase 22]: Portainer stack inputs are documented as required core, optional tuning, and derived values with one placeholder-only canonical env block.
- [Phase 22]: Operator procedures now separate first-time deployment, update/redeploy, and rollback to previous known-good IMAGE_TAG values.

### Pending Todos

None yet.

### Blockers/Concerns

- Existing unrelated deferred frontend lint item remains: `frontend/src/pages/events/events-page.tsx:255` (TS6133 unused `todayStart`).
- Deployment tech debt: production LAN currently depends on `SESSION_COOKIE_SECURE=false` for HTTP access; migrate frontend entrypoint to HTTPS/TLS and restore secure cookies to `true`.
- Docker verification commands for plan 20-02 were blocked in this environment because Docker daemon pipe `dockerDesktopLinuxEngine` was unavailable.
- Docker persistence probe for plan 21-01 also requires rerun on NAS/host with Docker daemon available.
- Plan 21-02 pull-first runtime verification remains diagnosed in this executor for the same Docker daemon gap and must be rerun on NAS/host for live DEPL-03 persistence evidence.

## Session Continuity

Last session: 2026-03-06
Stopped at: Completed 22-01-PLAN.md
Resume file: .planning/phases/22-operator-deployment-documentation/22-02-PLAN.md
