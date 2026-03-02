# Household Asset & Commitment Tracker (HACT)

## What This Is

HACT is a full-stack household ledger product with secure multi-user access, role-aware admin scope controls, financial contract/occurrence modeling, deterministic timeline projection, and asset-centric ledger views.

## Core Value

Users can see each asset together with its linked obligations and timeline status so they can make clear, timely household financial decisions.

## Current State

- **Latest shipped milestone:** v2.0 Auth, Timeline & Data Lifecycle (2026-03-02)
- **Archive references:** `.planning/milestones/v2.0-ROADMAP.md`, `.planning/milestones/v2.0-REQUIREMENTS.md`, `.planning/milestones/v2.0-MILESTONE-AUDIT.md`
- **Completion stance:** shipped with accepted tech debt (non-blocking)

## Next Milestone Goals

- Define v3.0 scope and fresh requirements using `/gsd-new-milestone`.
- Resolve carried debt items from v2.0 where prioritized:
  - Item detail ledger invalidation continuity after event mutations.
  - Human UX sign-off items from v2.0 Phases 10 and 11.
  - Deferred second-device LAN verification.

## Active Priorities

- [ ] Run milestone setup workflow for v3.0 (questioning, research, requirements, roadmap).
- [ ] Decide whether v2.0 debt items are v3.0 must-haves or deferred backlog.

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
*Last updated: 2026-03-02 after v2.0 milestone completion*
