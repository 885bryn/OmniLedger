# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-03-07)
Milestone archives: `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v2.0-ROADMAP.md`, `.planning/milestones/v3.0-ROADMAP.md`, `.planning/milestones/v4.0-ROADMAP.md`, `.planning/milestones/v4.1-ROADMAP.md`

**Core value:** Users can see each asset together with its linked obligations and timeline status so they can make clear, timely household financial decisions.
**Current focus:** Milestone v4.2 phase planning and execution starting at Phase 27

## Current Position

Phase: 29 of 29 (Cadence Toggle & Synced Cashflow View)
Plan: 1 of 3
Status: In Progress
Last activity: 2026-03-08 - Completed 29-01 localized segmented cadence toggle and cadence-explicit summary wording

Progress: [#########-] 90%

## Performance Metrics

**Velocity:**
- Total plans completed: 65
- Average duration: 4 min
- Total execution time: 5.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 14-18 (v3.0) | 11 | 46 min | 4 min |
| 19-23 (v4.0) | 10 | 27 min | 3 min |
| 24-26 (v4.1) | 10 | 41 min | 4 min |

**Recent Trend:**
- Last 5 plans: 29-01 (1 min), 28-02 (3 min), 28-01 (1 min), 27-03 (3 min), 27-02 (3 min)
- Trend: Stable execution cadence with phase 29 underway and UI cadence toggle baseline complete.
| Phase 27 P02 | 3 min | 2 tasks | 4 files |
| Phase 27 P03 | 3 min | 2 tasks | 2 files |
| Phase 28 P01 | 1 min | 2 tasks | 2 files |
| Phase 28 P02 | 3 min | 2 tasks | 1 files |
| Phase 29 P01 | 1 min | 2 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in `.planning/PROJECT.md`.
- v4.2 phase numbering starts at 27 and continues current roadmap sequence.
- v4.2 scope is limited to rollup calculation correctness and cadence selector clarity.
- Existing RBAC, audit visibility, and deployment guarantees remain unchanged in this milestone.
- No broad redesign or schema replatforming is allowed in v4.2 scope.
- [Phase 27]: Use one shared one-time inclusion path for both commitment and income rows with inclusive active-month due-date checks.
- [Phase 27]: Expose summary.active_period and summary.one_time_rule metadata so UI copy consumes backend period context without recomputation.
- [Phase 27]: Exclude malformed, null, and zero amounts before subtype allocation so net cashflow remains symmetric and predictable.
- [Phase 27]: Render summary period labels from summary.active_period metadata with localized current-month fallback.
- [Phase 27]: Display one-time inclusion and net formula helper copy in item detail summary cards for contract clarity.
- [Phase 27]: Use explicit active-month helper checks so one-time rows require matching month/year plus inclusive day boundaries.
- [Phase 27]: Freeze regression clock to March in API tests so future-month one-time leakage remains reproducible and protected.
- [Phase 28]: Use yearly baseline cadence normalization with strict 52/12 constants and banker rounding at final totals.
- [Phase 28]: Expose cadence_totals while preserving legacy monthly keys until Phase 29 UI cadence toggle adoption.
- [Phase 28]: Use deterministic recurring fixture values for exact cross-cadence equivalence assertions in net-status API tests.
- [Phase 28]: Model invalid recurring frequency regression with nullable frequency rows because persisted enum rejects arbitrary invalid strings.
- [Phase 29]: Keep cadence state scoped to item detail and reset to monthly on itemId change.
- [Phase 29]: Use one shared cadence totals resolver with monthly fallback for missing metadata.

### Pending Todos

None yet.

### Blockers/Concerns

- Existing unrelated frontend lint item remains: `frontend/src/pages/events/events-page.tsx:255` (`todayStart` unused).
- Phase execution must preserve item/event workflows while changing only summary rollup behavior and cadence controls.

## Session Continuity

Last session: 2026-03-08
Stopped at: Completed 29-01-PLAN.md
Resume file: `None`
