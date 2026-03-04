# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-03-04)
Milestone archives: `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v2.0-ROADMAP.md`, `.planning/milestones/v3.0-ROADMAP.md`

**Core value:** Users can see each asset together with its linked obligations and timeline status so they can make clear, timely household financial decisions.
**Current focus:** Phase 21 - Portainer Stack Deployment and Persistence

## Current Position

Phase: 21 of 22 (Portainer Stack Deployment and Persistence)
Plan: 1 of TBD
Status: Ready
Last activity: 2026-03-04 - completed 20-02 frontend production container and strict NAS-driven Nginx gateway routing

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 52
- Average duration: 4 min
- Total execution time: 4.1 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 14-18 (v3.0) | 11 | 46 min | 4 min |

**Recent Trend:**
- Last 5 plans: 20-02 (3 min), 20-01 (1 min), 19-02 (2 min), 19-01 (3 min), 18-02 (7 min)
- Trend: Stable delivery cadence through Phase 20 completion
- Phase 19 P01: 3 min, 3 tasks, 7 files
- Phase 19 P02: 2 min, 3 tasks, 7 files
- Phase 20 P01: 1 min, 3 tasks, 2 files
- Phase 20 P02: 3 min, 3 tasks, 3 files

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

### Pending Todos

None yet.

### Blockers/Concerns

- Existing unrelated deferred frontend lint item remains: `frontend/src/pages/events/events-page.tsx:255` (TS6133 unused `todayStart`).
- Docker verification commands for plan 20-02 were blocked in this environment because Docker daemon pipe `dockerDesktopLinuxEngine` was unavailable.

## Session Continuity

Last session: 2026-03-04 15:53
Stopped at: Phase 21 context gathered
Resume file: .planning/phases/21-portainer-stack-deployment-and-persistence/21-CONTEXT.md
