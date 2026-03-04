# Phase 20: Production Container Build and Gateway Routing - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers production-ready backend/frontend container build behavior and Nginx gateway routing so frontend API calls are correctly routed to backend targets derived from environment configuration, without production CORS breakage.

</domain>

<decisions>
## Implementation Decisions

### Gateway behavior
- Production backend-bound browser traffic uses a single `/api/*` routing prefix.
- Production routing target must be environment-derived and strict; no hidden localhost fallback when env config is missing/invalid.
- If the gateway cannot reach backend target, responses should use a clear JSON 502 error shape (not default Nginx HTML error pages).
- Production CORS posture should be same-origin oriented behind Nginx (no broad permissive origin policy).

### Claude's Discretion
- Exact JSON error payload fields for gateway 502 responses, as long as they are clear and consistent.
- Exact formatting/location of operator-facing routing failure logs.

</decisions>

<specifics>
## Specific Ideas

- Keep routing behavior deterministic so operators can reason from environment values to runtime behavior without hidden fallbacks.
- Gateway failures should be actionable for both frontend UX handling and operator diagnostics.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 20-production-container-build-and-gateway-routing*
*Context gathered: 2026-03-04*
