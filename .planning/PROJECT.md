# Household Asset & Commitment Tracker (HACT)

## What This Is

HACT is a full-stack household ledger product with secure multi-user access, role-aware admin scope controls, financial contract/occurrence modeling, deterministic timeline projection, and asset-centric ledger views.

## Core Value

Users can see each asset together with its linked obligations and timeline status so they can make clear, timely household financial decisions.

## Current State

- **Latest shipped milestone:** v2.0 Auth, Timeline & Data Lifecycle (2026-03-02)
- **Archive references:** `.planning/milestones/v2.0-ROADMAP.md`, `.planning/milestones/v2.0-REQUIREMENTS.md`, `.planning/milestones/v2.0-MILESTONE-AUDIT.md`
- **Completion stance:** shipped with accepted tech debt (non-blocking)

## Current Milestone: v3.0 Data Portability

**Goal:** Implement a secure, RBAC-aware data portability module that exports clean multi-sheet Excel backups of ledger data.

**Target features:**
- Server-side `.xlsx` generation and download streaming for ledger backup export.
- Multi-sheet workbook output for Assets, Financial Contracts, and Event History with readable flattened columns.
- Scope-correct export behavior for standard users and admin all-data/lens modes.
- Frontend export action with loading/progress UX and resilient error handling.
- Usability defaults in exported workbook (frozen headers, auto-filters, date formatting aligned to locale/timezone where available).

## Active Priorities

- [ ] Define and finalize v3.0 requirements for data portability export scope.
- [ ] Create phased roadmap for implementation and verification.
- [ ] Decide which carried v2.0 debt items are in-scope for v3.0 versus deferred.

## Constraints

- **Stack continuity:** Node.js + Express + Sequelize + React architecture remains baseline unless explicitly replatformed.
- **Data integrity:** UUID keys, owner-scoped RBAC behavior, and audit visibility guarantees remain mandatory.
- **Execution model:** Phase planning/execution continues through GSD workflows and milestone archives.

<details>
<summary>Archived Prior Project Detail (pre-v2.0 completion snapshot)</summary>

- Legacy PROJECT.md requirement buckets, context notes, and historical decision table were superseded at v2.0 completion.
- See milestone archives and phase summaries for full historical implementation detail.

</details>

---
*Last updated: 2026-03-02 after v3.0 milestone kickoff*
