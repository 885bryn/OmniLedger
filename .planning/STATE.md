# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-02-25)

**Core value:** Users can see each asset together with its linked obligations and timeline status so they can make clear, timely household financial decisions.
**Current focus:** Phase 8 - Auth Sessions & Protected Access (v2.0)

## Current Position

Phase: 8 of 12 (Auth Sessions & Protected Access)
Plan: 6 of 6 in current phase
Status: Complete
Last activity: 2026-02-25 - Completed 08-04 frontend session identity migration and regression coverage

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 21
- Average duration: 3 min (v2.0)
- Total execution time: 6 min (v2.0)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 8. Auth Sessions & Protected Access | 2 | 6 min | 3 min |
| 9. RBAC Scope & Admin Safety Mode | 0 | 0 min | 0 min |
| 10. Financial Contract-Occurrence Foundation | 0 | 0 min | 0 min |
| 11. Timeline Projection & Asset Ledger Views | 0 | 0 min | 0 min |
| 12. Deletion Lifecycle & Retention Controls | 0 | 0 min | 0 min |

**Recent Trend:**
- Last 5 plans: 08-01 (4 min), 08-03 (2 min)
- Trend: Authorization boundary migration landed with faster second-plan execution.
| Phase 08 P03 | 2 min | 2 tasks | 6 files |
| Phase 08 P02 | 2 min | 2 tasks | 10 files |
| Phase 08 P06 | 5 min | 2 tasks | 6 files |
| Phase 08 P05 | 4 min | 2 tasks | 8 files |
| Phase 08 P04 | 5 min | 3 tasks | 10 files |

## Accumulated Context

### Decisions

Decisions are logged in `.planning/PROJECT.md` Key Decisions table.
Recent decisions affecting current work:

- v2.0 phase numbering continues from v1.0 and starts at Phase 8.
- v2.0 roadmap uses dependency-first order: auth -> RBAC -> contracts/occurrences -> timeline -> lifecycle.
- Every v2.0 requirement is mapped to exactly one phase with observable success criteria.
- [Phase 08]: Adopted express-session with connect-session-sequelize for durable, server-managed auth state in Phase 8.
- [Phase 08]: Kept invalid-credential responses generic and uniform to avoid account existence leakage.
- [Phase 08]: Derived internal usernames from email local-part so signup remains email+password-only.
- [Phase 08]: Added requireAuth middleware as the single API boundary that enforces session identity and hydrates req.actor.
- [Phase 08]: Removed x-user-id as an authorization source by passing req.actor.userId into protected route domain calls.
- [Phase 08]: Store returnTo in sessionStorage only after app-relative sanitization and consume it once after successful auth.
- [Phase 08]: Wrap the protected app shell route tree with RequireAuth, while exposing /login and /register as public routes.
- [Phase 08]: Use a generic failed-login alert plus inline field errors and cooldown submit lock to satisfy security-safe UX requirements.
- [Phase 08]: Standardized migrated API suites on /auth/login + supertest.agent so session cookies are the sole identity transport in integration tests.
- [Phase 08]: Hashed fixture user passwords with bcrypt in migrated suites so login-based session setup mirrors production credential verification.
- [Phase 08]: Frontend now emits a single hact:session-expired event for protected API 401 responses.
- [Phase 08]: Session-expired notice state is persisted in sessionStorage so login always shows expiry feedback during forced re-auth.
- [Phase 08]: Removed frontend x-user-id injection and standardized session-cookie identity transport.
- [Phase 08]: Replaced shell actor switcher with authenticated identity plus explicit logout control.
- [Phase 08]: Updated frontend regressions to enforce credentialed requests and logout-driven cache reset.

### Pending Todos

- [2026-02-25] Run Phase 5 second-device LAN health test (`.planning/todos/pending/2026-02-25-run-phase-5-second-device-lan-health-test.md`)
- [2026-02-25] Add recurrence checkbox for cashflow items (`.planning/todos/pending/2026-02-25-add-recurrence-checkbox-for-cashflow-items.md`)

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-25 23:19
Stopped at: Completed 08-04-PLAN.md
Resume file: None
