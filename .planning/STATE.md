# Project State
## Project Reference
See: `.planning/PROJECT.md` (updated 2026-03-02)
Milestone archive: `.planning/milestones/v2.0-ROADMAP.md`
Requirements archive: `.planning/milestones/v2.0-REQUIREMENTS.md`

**Core value:** Users can see each asset together with its linked obligations and timeline status so they can make clear, timely household financial decisions.
**Current focus:** Milestone v3.0 Data Portability definition and requirements planning
## Current Position

Phase: Not started (defining requirements)
Plan: -
Status: Defining requirements
Last activity: 2026-03-02 - Milestone v3.0 Data Portability started

Progress: [██████████] 100%

## Performance Metrics
**Velocity:**
- Total plans completed: 34
- Average duration: 4 min (v2.0)
- Total execution time: 53 min (v2.0)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 8. Auth Sessions & Protected Access | 2 | 6 min | 3 min |
| 9. RBAC Scope & Admin Safety Mode | 8 | 23 min | 3 min |
| 10. Financial Contract-Occurrence Foundation | 4 | 21 min | 5 min |
| 11. Timeline Projection & Asset Ledger Views | 4 (+extension) | 17 min | 4 min |
| 12. Deletion Lifecycle & Retention Controls | integrated | n/a | n/a |

**Recent Trend:**
- Last 5 plans: 13-02 (2 min), 13-01 (3 min), 11-04 (7 min), 11-03 (6 min), 11-02 (2 min)
- Trend: admin scope continuity hardening now covers backend mutation authorization plus frontend drill-through cache partitioning.
| Phase 11 P01 | 2 min | 2 tasks | 3 files |
| Phase 11 P02 | 2 min | 2 tasks | 6 files |
| Phase 11 P03 | 6 min | 2 tasks | 6 files |
| Phase 11 P04 | 7 min | 2 tasks | 5 files |
| Phase 13-admin-scope-integration-hardening P01 | 3 min | 2 tasks | 9 files |
| Phase 13 P02 | 2 min | 2 tasks | 4 files |
| Phase 13 P03 | 4 min | 2 tasks | 5 files |

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
- [Phase 09]: Kept user_id in AuditLog while adding actor_user_id and lens_user_id to preserve historical compatibility.
- [Phase 09]: Audit write paths now persist actor+lens attribution from enforced scope context, defaulting owner-mode lens to actor user.
- [Phase 09]: Hydrate admin scope from /auth/session and keep lens mutation writes explicit through /auth/admin-scope.
- [Phase 09]: Clear actor-sensitive query cache roots on lens change and immediately invalidate active roots to force scoped refetch.
- [Phase 09]: Expose lens_attribution_state in item activity responses so legacy rows render deterministic fallback semantics.
- [Phase 09]: Render activity attribution uniformly as Actor: X | Lens: Y across timeline rows, including restore-category rows.
- [Phase 09]: Show admin safety context only while mode=all to avoid warning fatigue outside elevated scope.
- [Phase 09]: Require a blocking confirmation dialog before any all-data to owner-lens transition is applied.
- [Phase 09]: Centralized Actor/Lens label resolution in a shared admin-scope chip utility to keep mutation attribution copy consistent.
- [Phase 09]: Rendered attribution in both inline action zones and confirmation dialogs so context is visible before commit on every targeted mutation surface.
- [Phase 09]: Emit policy-denied toast signals in api-client so blocked writes keep one centralized toast channel while inline errors stay local.
- [Phase 09]: Block admin owner-lens writes when the selected lens user is invalid and require reselection before mutation commit.
- [Phase 09]: Use shared localized safety copy for policy-denied and invalid-lens write blocking messages across inline and toast channels.
- [Phase 09-rbac-scope-admin-safety-mode]: Render invalid-lens blocking copy inline even when completion mutation is never started.
- [Phase 09-rbac-scope-admin-safety-mode]: Assert safety messages in regressions through i18n keys so copy remains locale-safe.
- [Phase 09]: Use AdminScopeContext mode/lens as banner source-of-truth while retaining actor identity from AuthContext session.
- [Phase 09]: Model stale auth-session lag in tests and assert immediate Lens: All users output from active admin scope state.
- [Phase 10]: Persist FinancialItem parent contract fields (title/type/frequency/default_amount/status) explicitly on Items rather than JSON-only inference.
- [Phase 10]: Require `confirm_unlinked_asset=true` when `linked_asset_item_id` is omitted to allow intentional unlinked financial saves.
- [Phase 10]: Restrict automatic first-occurrence materialization to `FinancialItem` records with `frequency=one_time` and keep parent+event writes in one transaction.
- [Phase 10]: Used deterministic projected event ids (projected-{itemId}-{YYYY-MM-DD}) so projected rows can be acted on before persistence.
- [Phase 10]: Bound recurring read projection to three upcoming occurrences per active FinancialItem to avoid long-horizon generation.
- [Phase 10]: Materialized projected completion targets by item/date with dedupe lookup to prevent duplicate exception rows on retries.
- [Phase 10]: Preserved legacy /items/create/wizard redirects with query params intact so subtype and parent prefill context survives on /items/create.
- [Phase 10]: Financial item create now requires explicit warning confirmation for unlinked saves instead of blocking or silently allowing.
- [Phase 10]: List and detail surfaces standardize parent label as Financial item while rendering Commitment or Income subtype badges.
- [Phase 10]: Events page now queries status=all and splits Current/Upcoming from History in one surface.
- [Phase 10]: Inline row controls use status-first Complete/Undo transitions with confirmation as the default-safe edit model.
- [Phase 10]: Recurrence messaging uses localized frequency text with next-date/closed fallbacks across events and item detail.
- [Phase 10]: List filters now classify FinancialItem rows by subtype so commitments/income views include canonical contracts.
- [Phase 10]: Net-status child lookup now includes both parent_item_id and linked_asset_item_id with existing owner/soft-delete guards.
- [Phase 10]: Event lifecycle merge now prefers persisted rows over projections for the same item/date key to preserve completed visibility.
- [Phase 11]: Projection generation now uses explicit today..today+3y date bounds instead of occurrence count limits.
- [Phase 11]: Event timeline DTOs now include source_state and is_projected so projected state is explicit.
- [Phase 11]: Same-date event tie-breaks now rank persisted rows ahead of projected rows for deterministic ordering.
- [Phase 11]: Projected edit requests now materialize through item-event-sync before mutation to preserve dedupe semantics.
- [Phase 11]: PATCH /events/:id ownership denials return not_found envelopes to match completion-route policy behavior.
- [Phase 11]: Events persist an is_exception marker when projected materialization is used so edited occurrences remain identifiable after reload.
- [Phase 11]: Timeline rows now render explicit projected/persisted badges with section legends while preserving grouped chronology.
- [Phase 11]: Projected occurrence edits use a dedicated Save exception CTA and explain persisted exception creation before commit.
- [Phase 11]: Edited occurrence success feedback is state-driven via refetch and is_exception indicators instead of extra success toasts.
- [Phase 11]: Asset detail ledger now reads owner-scoped /events rows filtered by linked financial item IDs for deterministic sectioning.
- [Phase 11]: Current & Upcoming classification keeps pending or future-facing rows actionable while settled past rows move to Historical Ledger.
- [Phase 11]: Historical Ledger defaults collapsed on mobile with explicit toggle controls and remains expanded on desktop.
- [Phase 11/12 alignment]: Deletion lifecycle and retention scope was delivered during Phase 11 extension work; roadmap/state now track Phase 12 as integrated and complete for traceability.
- [Phase 13-admin-scope-integration-hardening]: Added canAccessOwner(scope, ownerUserId) as the shared mutation/detail authorization contract for owner/all/lens semantics.
- [Phase 13-admin-scope-integration-hardening]: Changed /items/:id/net-status to consume req.scope directly so admin drill-through follows active scope mode.
- [Phase 13-admin-scope-integration-hardening]: Preserved existing 404 not_found ownership-denial envelopes while replacing actor-only owner resolution.
- [Phase 13]: Extended item detail query keys with optional LensScope segments so non-lens callers remain compatible while lens-aware callers are isolated.
- [Phase 13]: Bound detail lookup URL params and query keys to scope_mode/lens_user_id so lens transitions deterministically refetch same-route item detail context.
- [Phase 13]: Locked scoped cache partition behavior in frontend regressions with QueryClient-level assertions.
- [Phase 13]: Expanded admin scope regressions directly in items/events API contract suites to catch drift at endpoint boundaries.
- [Phase 13]: Out-of-lens projected-id mutation tests assert both 404/not_found envelopes and zero materialization side effects.

### Blockers/Concerns

- Unrelated frontend build check currently fails at `frontend/src/pages/events/events-page.tsx:255` (TS6133 unused `todayStart`), logged in `.planning/phases/13-admin-scope-integration-hardening/deferred-items.md`.

## Session Continuity
Last session: 2026-03-02 01:30
Stopped at: Started v3.0 new-milestone workflow (questioning/research/requirements/roadmap)
Resume file: None
