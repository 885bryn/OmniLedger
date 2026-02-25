# Feature Research

**Domain:** Household asset + commitment tracking (v2.0 auth/timeline/lifecycle milestone)
**Researched:** 2026-02-25
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist for these capabilities. Missing these = product feels unsafe or unreliable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Authentication sessions with protected API/UI | Multi-user systems are expected to require sign-in and block anonymous access | MEDIUM | Must cover login, logout, session expiry/refresh, and route protection; replace `x-user-id` shim behavior with real identity claims |
| Role-based authorization enforced server-side | Users expect role limits to be real, not just hidden buttons | MEDIUM | Enforce on every read/write path; keep role set small in milestone scope (for example: admin vs standard user) |
| Owner-scoped data isolation with explicit admin bypass | In household/workspace apps, users expect only their data unless elevated admin role is active | HIGH | Use deny-by-default scoping; admin bypass must be intentional, visible in UI, and audit-logged |
| Parent `FinancialItem` + child occurrence model | Recurring financial obligations are expected to have one contract and many dated occurrences | HIGH | Parent holds recurrence and defaults; child occurrence holds due date, amount snapshot, status, completion/undo state |
| Recurrence projection window with controlled instantiation | Users expect upcoming obligations to appear in advance without manually creating each one | HIGH | Production pattern: project into a bounded horizon (milestone target: 3 years), instantiate only needed exceptions/edits |
| Series edit semantics for recurrence | Users expect "this occurrence", "this and following", and "entire series" behaviors | HIGH | Avoid per-instance mutation of every future row; split series when editing "this and following" |
| Unified timeline segmented by temporal state | Users expect one timeline view with clear "current/upcoming" vs "historical" separation | MEDIUM | Must support stable sorting, filtering, pagination/windowing, and quick jump between now and history |
| Soft delete + restore + retention purge | Production users expect recoverability and predictable retention windows | MEDIUM | Move to trash first, allow restore, run automated 30-day hard purge job, and keep audit evidence |
| Delete intercept for linked records | Users expect guardrails before deleting records with dependents | MEDIUM | Block destructive action when linked children exist, show impact preview, provide safe alternatives (archive/soft-delete) |

### Differentiators (Competitive Advantage)

Features that can make this milestone feel "enterprise-ready" rather than merely functional.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Explainable authorization feedback | Reduces support burden by showing why access was denied and which role is required | MEDIUM | Return structured denial reasons and expose actionable UI guidance |
| Visible admin context mode | Prevents accidental cross-owner actions when using admin bypass | LOW | Add persistent "admin all-data mode" indicator + quick exit back to owner-scoped view |
| Projection confidence states | Improves trust by clearly labeling projected vs instantiated vs completed occurrences | MEDIUM | Leverages existing completion/undo and audit trail; reduces timeline confusion |
| Timeline "decision lanes" (Upcoming, Due Soon, Overdue, History) | Makes the 3-year timeline actionable rather than just chronological | MEDIUM | Build on current dashboard/events journeys and existing net-status patterns |
| Restore-safe conflict handling | Makes trash/restore usable when parent/child records changed after deletion | HIGH | On restore, validate foreign keys and ownership scope; present conflict options instead of silent failure |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem attractive but usually create major risk for this milestone.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Client-only RBAC (hide controls, skip backend checks) | Faster UI implementation | Security bypass risk; API remains vulnerable | Enforce authz in API first, then mirror rules in UI for UX only |
| Unlimited custom roles/permissions in this milestone | "Future-proof" flexibility | Explodes scope (policy editor, migration, support model) | Ship a fixed role matrix now; add custom role management later |
| Materializing every projected occurrence immediately | Simpler queries at first | Massive row growth, slow writes, difficult series edits | Keep canonical parent schedule + bounded projection; instantiate only exceptions/actions |
| Hard delete as default path | Feels "clean" and simple | Irrecoverable user mistakes, audit gaps, high support cost | Soft-delete default, explicit hard-delete via retention job |
| Running purge synchronously during user actions | "Immediate cleanup" expectation | Slow/failing UI operations, lock contention, brittle retries | Async scheduled purge worker with idempotent batches |
| Cross-owner admin search by default on every screen | Convenience for admins | Easy privacy mistakes and accidental edits at wrong scope | Keep owner-scoped default; require explicit admin mode toggle |

## Feature Dependencies

```text
Authenticated identity (replace actor shim)
    -> Server-side RBAC checks
        -> Owner-scoped isolation policies
            -> Admin bypass mode + audit logging

FinancialItem parent model
    -> Occurrence model (due/completed/undone)
        -> Recurrence projection service (3-year horizon)
            -> Timeline segmentation (upcoming vs historical)

Soft-delete flags + trash state
    -> Linked-record delete intercept
        -> Restore workflows
            -> 30-day hard purge automation

Existing event completion/undo + audit trail
    -> Occurrence lifecycle correctness
        -> Trustworthy timeline and restore history
```

### Dependency Notes

- **Auth before RBAC/scoping:** role and ownership rules are meaningless until identity is authoritative (not header-shimmed).
- **RBAC before admin bypass UX:** admin mode is an extension of policy, not a UI shortcut.
- **Parent/occurrence model before timeline refactor:** timeline quality depends on correct temporal entities and recurrence semantics.
- **Projection service before 3-year timeline:** long-horizon views need bounded generation logic to avoid data explosion.
- **Soft-delete before retention purge:** purge job must operate only on records already in trash with retention metadata.
- **Delete intercept before broad delete rollout:** prevents integrity breaks while parent/child financial model is being introduced.
- **Existing completion/undo/audit integration is mandatory:** recurrence and restore changes must preserve established audit trust.

## MVP Definition

### Launch With (this milestone)

Minimum viable delivery for v2.0 target capabilities.

- [ ] Real authentication/session flow replacing actor-context transport shim
- [ ] Backend-enforced RBAC + owner isolation + explicit admin bypass mode
- [ ] `FinancialItem` parent + occurrence child model with recurrence projection (bounded 3-year horizon)
- [ ] Series edit semantics: this occurrence / this and following / entire series
- [ ] Unified timeline with upcoming/current vs historical segmentation
- [ ] Soft delete, trash restore, linked-record delete intercept, and automated 30-day cleanup

### Add After Validation (v2.1)

Useful once baseline behavior is stable in production.

- [ ] Granular role capabilities beyond core admin/standard split
- [ ] Conflict-resolution assistant for complex restore cases (merge/relink suggestions)
- [ ] Bulk timeline operations (bulk complete/reschedule/archive) with guardrails

### Future Consideration (v3+)

Defer until usage patterns and support load justify complexity.

- [ ] Tenant-configurable retention windows and legal-hold policies
- [ ] Fine-grained delegated administration across household sub-groups
- [ ] Predictive timeline intelligence (risk scoring, anomaly detection)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Authentication + session protection | HIGH | MEDIUM | P1 |
| Server-enforced RBAC + owner isolation | HIGH | HIGH | P1 |
| Admin bypass mode with clear UX + audit | HIGH | MEDIUM | P1 |
| Parent/occurrence financial model | HIGH | HIGH | P1 |
| Recurrence projection + series edit semantics | HIGH | HIGH | P1 |
| Unified 3-year timeline segmentation | HIGH | MEDIUM | P1 |
| Soft delete/restore + 30-day purge | HIGH | MEDIUM | P1 |
| Restore conflict assistant | MEDIUM | HIGH | P2 |
| Granular/custom role matrix | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for milestone acceptance
- P2: Should have after initial stabilization
- P3: Defer to avoid high-risk scope expansion

## Competitor Feature Analysis

| Feature | Competitor A | Competitor B | Our Approach |
|---------|--------------|--------------|--------------|
| Recurring series edits | Google Calendar supports instance, series, and split-series style changes | Many finance apps expose upcoming recurring bills and projected cash flow | Use parent+occurrence model with explicit series-edit options and bounded projection horizon |
| Soft delete lifecycle | Google Drive/Gmail use Trash with automatic deletion after 30 days | GitHub supports restore window before permanent deletion | Mirror enterprise lifecycle: trash first, restore window, automated permanent purge |
| Multi-user access controls | Workspace apps and SaaS platforms rely on role assignments + scoped access | Multitenant guidance emphasizes explicit isolation boundaries | Enforce owner scope in backend with intentional admin bypass and auditability |

## Sources

- PostgreSQL row-level security and BYPASSRLS behavior (official docs, current): https://www.postgresql.org/docs/current/ddl-rowsecurity.html (HIGH)
- Auth0 RBAC concepts and additive role model (official docs): https://auth0.com/docs/manage-users/access-control/rbac (MEDIUM)
- Supabase RLS implementation guidance and policy patterns (official docs): https://supabase.com/docs/guides/database/postgres/row-level-security (MEDIUM)
- Google Calendar recurring events and instance/series modification behavior (official API guide, last updated 2025-12-11): https://developers.google.com/calendar/api/guides/recurringevents (HIGH)
- Google Calendar recurring UX, including repeat limits and series update prompts: https://support.google.com/calendar/answer/37115 (MEDIUM)
- Google Drive and Gmail trash/restore/30-day permanent deletion behavior: https://support.google.com/drive/answer/2375102 and https://support.google.com/mail/answer/7401 (MEDIUM)
- GitHub deleted repository restoration window and caveats: https://docs.github.com/en/repositories/creating-and-managing-repositories/restoring-a-deleted-repository (MEDIUM)
- Microsoft multitenant data isolation patterns and anti-patterns (updated 2025-07-17): https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/approaches/storage-data (MEDIUM)
- Quicken Simplifi feature positioning for upcoming bills and projected cash flow (product page): https://www.quicken.com/products/simplifi/ (LOW)

---
*Feature research for: Household asset + commitment tracking (v2.0 new capabilities only)*
*Researched: 2026-02-25*
