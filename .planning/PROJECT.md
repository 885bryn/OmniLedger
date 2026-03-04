# Household Asset & Commitment Tracker (HACT)

## What This Is

HACT is a full-stack household ledger product with secure multi-user access, scope-correct export portability, deterministic workbook generation, and actor/lens-attributed audit visibility.

## Core Value

Users can see each asset together with its linked obligations and timeline status so they can make clear, timely household financial decisions.

## Current State

- **Latest shipped milestone:** v3.0 Data Portability (2026-03-04)
- **Archive references:** `.planning/milestones/v3.0-ROADMAP.md`, `.planning/milestones/v3.0-REQUIREMENTS.md`, `.planning/milestones/v3.0-MILESTONE-AUDIT.md`
- **Completion stance:** shipped; no blocker gaps, with one low-risk deferred UX-noise item in activity timeline context

## Next Milestone Goals

- Define next milestone problem statement and value target via `/gsd-new-milestone`
- Create fresh milestone-scoped `REQUIREMENTS.md`
- Build a new phased roadmap continuing numbering from Phase 19
- Decide whether export activity-feed noise mitigation should be in-scope or backlog

## Constraints

- **Stack continuity:** Node.js + Express + Sequelize + React remains baseline unless explicitly replatformed.
- **Data integrity:** UUID keys, owner-scoped RBAC behavior, and audit visibility guarantees remain mandatory.
- **Execution model:** Continue milestone/phase planning through GSD workflows with archive-first documentation hygiene.

<details>
<summary>Archived Prior Milestone Snapshot</summary>

Previous in-progress v3 kickoff context and interim planning notes were superseded at v3.0 completion.
See milestone archives and phase summaries for implementation history.

</details>

---
*Last updated: 2026-03-04 after v3.0 milestone completion*
