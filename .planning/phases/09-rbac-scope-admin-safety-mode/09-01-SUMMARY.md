---
phase: 09-rbac-scope-admin-safety-mode
plan: 01
subsystem: auth
tags: [rbac, session, express, sequelize]

requires:
  - phase: 08-auth-sessions-protected-access
    provides: server-managed session identity via req.session.userId and requireAuth boundary
provides:
  - persisted user role (`user|admin`) with deterministic configured-admin designation
  - role-aware auth/session payloads sourced from trusted database state
  - shared request scope context (`req.actor`, `req.scope`) for downstream RBAC branching
affects: [phase-09-rbac, api-auth-boundary, middleware-scope-contract]

tech-stack:
  added: []
  patterns:
    - auth middleware resolves actor role from persisted session user row
    - scope context builder centralizes owner/all mode derivation

key-files:
  created:
    - src/db/migrations/20260226090000-add-user-role-and-admin-scope-session-support.js
    - src/api/auth/scope-context.js
    - test/api/auth-role-session.test.js
  modified:
    - src/db/models/user.model.js
    - src/api/routes/auth.routes.js
    - src/api/auth/require-auth.js

key-decisions:
  - "Support configured admin email via HACT_ADMIN_EMAIL (fallback ADMIN_EMAIL) to deterministically assign admin role."
  - "Hydrate register/login responses from resolveSessionUser so role always comes from persisted DB state."
  - "Expose req.scope alongside req.actor in requireAuth while preserving req.actor.userId compatibility."

patterns-established:
  - "Role-aware auth boundary: requireAuth resolves persisted actor role before route handlers execute."
  - "Scope contract: req.scope contains actorUserId, actorRole, mode, and lensUserId for future RBAC plans."

requirements-completed: [AUTH-04]

duration: 3 min
completed: 2026-02-26
---

# Phase 9 Plan 01: Role Model and Scope Context Summary

**Server-trusted role persistence and middleware scope hydration now provide `user|admin` identity context on every authenticated request.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-26T03:16:03Z
- **Completed:** 2026-02-26T03:19:40Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added `Users.role` persistence with default `user`, backfill behavior, and deterministic configured-admin assignment path.
- Updated auth register/login/session transport to include role resolved from trusted DB session user data.
- Added shared scope-context builder and upgraded `requireAuth` to hydrate backward-compatible `req.actor` plus new `req.scope` contract.
- Added API regression coverage for role default/admin assignment and role-aware middleware actor/scope hydration.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add persistent role schema and deterministic admin designation** - `fb37b83` (feat)
2. **Task 2: Introduce shared role-aware request scope context at auth boundary** - `805977f` (feat)

## Files Created/Modified
- `src/db/migrations/20260226090000-add-user-role-and-admin-scope-session-support.js` - Adds `Users.role`, backfills defaults, and applies configured admin designation.
- `src/db/models/user.model.js` - Adds strict `role` enum field defaulting to `user`.
- `src/api/routes/auth.routes.js` - Returns role in auth/session payloads from trusted session-user resolution.
- `src/api/auth/scope-context.js` - Provides shared scope context builder (`actorUserId`, `actorRole`, `mode`, `lensUserId`).
- `src/api/auth/require-auth.js` - Hydrates `req.actor` and `req.scope` from persisted user role.
- `test/api/auth-role-session.test.js` - Covers role defaults, configured admin assignment, and middleware scope hydration.

## Decisions Made
- Used environment-configured admin designation (`HACT_ADMIN_EMAIL` with `ADMIN_EMAIL` fallback) so runtime and migration can consistently resolve the single admin account.
- Reused `resolveSessionUser` for login/register responses to avoid role drift from stale in-memory auth payloads.
- Established `req.scope` as middleware-owned contract while keeping `req.actor.userId` intact for existing route compatibility.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Ready for `09-02-PLAN.md` owner-scope enforcement, with trusted role context now available on protected requests.
- No blockers identified for continuing Phase 9.

---
*Phase: 09-rbac-scope-admin-safety-mode*
*Completed: 2026-02-26*

## Self-Check: PASSED
