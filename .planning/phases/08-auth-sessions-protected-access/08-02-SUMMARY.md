---
phase: 08-auth-sessions-protected-access
plan: 02
subsystem: auth
tags: [react-router, session-auth, protected-routes, login-ux, vitest]
requires:
  - phase: 08-auth-sessions-protected-access
    provides: Backend session and auth endpoints from 08-01
provides:
  - Frontend auth context hydrated from /auth/session with safe return intent handling
  - Protected route guard that redirects unauthenticated users to login with deep-link preservation
  - Login/register pages with generic failed-login UX and cooldown submit lock
  - Regression tests for route guard redirect, deep-link restoration, and cooldown behavior
affects: [phase-08, auth-ux, frontend-routing]
tech-stack:
  added: []
  patterns: [sessionStorage returnTo sanitization, guard-wrapped protected route tree, cookie-credentialed frontend API transport]
key-files:
  created:
    - frontend/src/auth/auth-context.tsx
    - frontend/src/auth/require-auth.tsx
    - frontend/src/pages/auth/login-page.tsx
    - frontend/src/pages/auth/register-page.tsx
    - frontend/src/__tests__/auth-routes-guard.test.tsx
  modified:
    - frontend/src/app/router.tsx
    - frontend/src/app/providers.tsx
    - frontend/src/lib/api-client.ts
    - frontend/src/locales/en/common.json
    - frontend/src/locales/zh/common.json
key-decisions:
  - "Store returnTo in sessionStorage only after app-relative sanitization and consume it once after successful auth."
  - "Wrap the protected app shell route tree with RequireAuth, while exposing /login and /register as public routes."
  - "Use a generic failed-login alert plus inline field errors and cooldown submit lock to satisfy security-safe UX requirements."
patterns-established:
  - "Route protection pattern: RequireAuth wraps protected router branches and always redirects to /login?returnTo=..."
  - "Auth UX pattern: preserve email, clear password, and disable submit during backend cooldown windows"
requirements-completed: [AUTH-01, AUTH-02]
duration: 2 min
completed: 2026-02-25
---

# Phase 8 Plan 02: Frontend auth UX and protected routing Summary

**Frontend route gating now enforces authenticated sessions and restores exact deep-link intent after login, with locked failed-login UX semantics and cooldown protection.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-25T22:57:29Z
- **Completed:** 2026-02-25T22:59:15Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Added `AuthProvider` session lifecycle (`/auth/session`, login/register/logout helpers) with app-relative `returnTo` sanitization and one-time consumption.
- Introduced `RequireAuth` and router updates so dashboard/items/events paths require auth and redirect unauthenticated users to `/login` with deep-link preservation.
- Implemented login/register pages with phase-required failure UX behavior: generic top alert, inline feedback, preserved email, cleared password, and temporary cooldown submit lock.
- Added `auth-routes-guard` regression coverage for protected-route redirect behavior, exact deep-link restoration (including query/hash), and cooldown re-enable behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add frontend auth session context and protected route guard with deep-link return restoration** - `e0a4ca4` (feat)
2. **Task 2: Implement login/register pages with locked error UX and cooldown behavior** - `20b1139` (feat)

## Files Created/Modified
- `frontend/src/auth/auth-context.tsx` - Auth session context with safe `returnTo` storage/consumption and auth action helpers.
- `frontend/src/auth/require-auth.tsx` - Protected-route guard that redirects unauthenticated users to login with preserved intent.
- `frontend/src/app/router.tsx` - Public `/login` and `/register` routes plus guard-wrapped protected app shell tree.
- `frontend/src/app/providers.tsx` - Auth provider wiring around router.
- `frontend/src/pages/auth/login-page.tsx` - Sign-in form with generic error UX, password clearing, cooldown lock, and post-login intent restore.
- `frontend/src/pages/auth/register-page.tsx` - Email/password registration flow aligned to phase auth path restoration.
- `frontend/src/locales/en/common.json` - English auth copy for login/register and cooldown messaging.
- `frontend/src/locales/zh/common.json` - Chinese auth copy for login/register and cooldown messaging.
- `frontend/src/__tests__/auth-routes-guard.test.tsx` - Guard/login UX regression tests for redirect and cooldown behavior.
- `frontend/src/lib/api-client.ts` - Credentialed fetch defaults and cooldown metadata mapping for auth error UX.

## Decisions Made
- Sanitized `returnTo` accepts only app-relative paths and rejects external/absolute URLs to prevent redirect abuse.
- Auth state hydration runs from `/auth/session` on app startup to keep route guards session-aware across reloads.
- Cooldown UX is driven by backend `retry_after_seconds`, with submit disabled until retry time expires.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Enabled credentialed API transport for cookie-backed sessions**
- **Found during:** Task 1 (auth context hydration and guard implementation)
- **Issue:** Frontend fetches did not include browser credentials by default, which would prevent cookie session transport across frontend/API origins.
- **Fix:** Set `credentials: 'include'` default in `apiRequest` and surfaced cooldown metadata for auth errors.
- **Files modified:** `frontend/src/lib/api-client.ts`
- **Verification:** `npm --prefix frontend run test -- auth-routes-guard --runInBand`; `npm --prefix frontend run typecheck`
- **Committed in:** `e0a4ca4`

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential correctness fix for session-cookie auth transport; no scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Frontend now enforces protected-route entry and supports deterministic return-intent restoration for login/register flows.
- Ready for `08-03` scope to complete server-side auth boundary migration and remove remaining actor-shim paths.

---
*Phase: 08-auth-sessions-protected-access*
*Completed: 2026-02-25*

## Self-Check: PASSED

- FOUND: `.planning/phases/08-auth-sessions-protected-access/08-02-SUMMARY.md`
- FOUND: `e0a4ca4`
- FOUND: `20b1139`
