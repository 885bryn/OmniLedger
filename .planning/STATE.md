# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-02-25)

**Core value:** Users can see each asset together with its linked obligations and timeline status so they can make clear, timely household financial decisions.
**Current focus:** Phase 9 - RBAC Scope & Admin Safety Mode (v2.0)

## Current Position

Phase: 9 of 12 (RBAC Scope & Admin Safety Mode)
Plan: 4 of 12 (next: 09-04)
Status: In progress
Last activity: 2026-02-26 - Completed 09-03 admin scope mode/lens session enforcement and list resolver normalization

Progress: [███░░░░░░░] 25%

## Performance Metrics

**Velocity:**
- Total plans completed: 24
- Average duration: 3 min (v2.0)
- Total execution time: 14 min (v2.0)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 8. Auth Sessions & Protected Access | 2 | 6 min | 3 min |
| 9. RBAC Scope & Admin Safety Mode | 3 | 8 min | 3 min |
| 10. Financial Contract-Occurrence Foundation | 0 | 0 min | 0 min |
| 11. Timeline Projection & Asset Ledger Views | 0 | 0 min | 0 min |
| 12. Deletion Lifecycle & Retention Controls | 0 | 0 min | 0 min |

**Recent Trend:**
- Last 5 plans: 09-11 (2 min), 09-02 (3 min), 09-01 (3 min), 08-03 (2 min), 08-02 (2 min)
- Trend: Owner-scope regressions are now locked across create/list/mutate/event flows; admin mode/lens plans can proceed with stronger safety coverage.
| Phase 08 P03 | 2 min | 2 tasks | 6 files |
| Phase 08 P02 | 2 min | 2 tasks | 10 files |
| Phase 08 P06 | 5 min | 2 tasks | 6 files |
| Phase 08 P05 | 4 min | 2 tasks | 8 files |
| Phase 08 P04 | 5 min | 3 tasks | 10 files |
| Phase 09 P01 | 3 min | 2 tasks | 6 files |
| Phase 09 P02 | 3 min | 1 tasks | 9 files |
| Phase 09 P11 | 2 min | 2 tasks | 3 files |
| Phase 09 P08 | 4 min | 2 tasks | 9 files |
| Phase 09 P03 | 7 min | 2 tasks | 9 files |

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
- [Phase 09]: Configured admin identity uses HACT_ADMIN_EMAIL (fallback ADMIN_EMAIL) and role is persisted server-side as user/admin.
- [Phase 09]: Auth register/login/session responses now resolve role from trusted DB session-user data instead of request payload hints.
- [Phase 09]: requireAuth now hydrates req.actor plus role-aware req.scope contract for downstream RBAC branching while preserving req.actor.userId compatibility.
- [Phase 09]: Route handlers pass req.scope into item/event domain entry points so ownership enforcement is server-derived and consistent.
- [Phase 09]: POST /items ignores client-provided user_id and persists owner from authenticated scope.actorUserId.
- [Phase 09]: create-item validates parent_item_id owner match against resolved scope owner to prevent cross-owner links.
- [Phase 09]: Create/list/event regressions now inject foreign owner hints and assert authenticated scope remains authoritative.
- [Phase 09]: Foreign event complete and undo attempts are regression-locked to 404 not_found denial behavior under AUTH-05.
- [Phase 09]: Mapped ownership-denial categories to shared 404/not_found envelopes at the API mapper boundary to keep contracts consistent and non-leaky.
- [Phase 09]: Standardized foreign direct-access denial copy to plain policy language while preserving not_found semantics across item and event pathways.
- [Phase 09]: Persist admin scope mode+lens in server session and expose scope metadata in auth/session payloads.
- [Phase 09]: Restrict /auth/admin-scope updates to admins and validate owner lens targets against existing users.
- [Phase 09]: Use resolveOwnerFilter(scope) as the single owner-filter contract for item/event list reads.

### Pending Todos

- [2026-02-25] Run Phase 5 second-device LAN health test (`.planning/todos/pending/2026-02-25-run-phase-5-second-device-lan-health-test.md`)
- [2026-02-25] Add recurrence checkbox for cashflow items (`.planning/todos/pending/2026-02-25-add-recurrence-checkbox-for-cashflow-items.md`)

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-26 03:37
Stopped at: Completed 09-03-PLAN.md
Resume file: None
