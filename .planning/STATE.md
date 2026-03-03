# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-03-02)
Milestone archives: `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v2.0-ROADMAP.md`

**Core value:** Users can see each asset together with its linked obligations and timeline status so they can make clear, timely household financial decisions.
**Current focus:** Milestone v3.0 Data Portability execution (Phase 16 next)

## Current Position

Phase: 16 of 18 (Event History and Downloadable Workbook)
Plan: 0 of TBD
Status: Ready to Start
Last activity: 2026-03-03 - Completed 15-02 workbook route wiring and scope-preserving API regressions

Progress: [██░░░░░░░░] 18%

## Performance Metrics

**Velocity:**
- Total plans completed: 36
- Average duration: 4 min (v2.0)
- Total execution time: 53 min (v2.0)

**By Phase (recent baseline):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 8. Auth Sessions & Protected Access | 2 | 6 min | 3 min |
| 9. RBAC Scope & Admin Safety Mode | 8 | 23 min | 3 min |
| 10. Financial Contract-Occurrence Foundation | 4 | 21 min | 5 min |
| 11. Timeline Projection & Asset Ledger Views | 4 (+extension) | 17 min | 4 min |
| 13. Admin Scope Integration Hardening | 3 | 9 min | 3 min |

**Recent Trend:**
- Last 5 plans: 15-02 (3 min), 15-01 (4 min), 14-02 (3 min), 14-01 (3 min), 13-03 (4 min)
- Trend: Phase 15 is complete; export API now exposes workbook contracts with scope parity locked by regression tests
| Phase 14 P02 | 3 min | 2 tasks | 5 files |
| Phase 15 P01 | 4 min | 3 tasks | 4 files |
| Phase 15 P02 | 3 min | 2 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in `.planning/PROJECT.md`.
Recent decisions affecting current work:

- v3.0 phase numbering continues from prior milestone and starts at Phase 14.
- v3.0 roadmap is requirement-derived and scoped only to EXPT/SCOP/RELA/XLSX/SECU/UXEX requirements.
- Every v3.0 requirement maps to exactly one phase (14-18) with user-observable success criteria.
- Milestone record now tracks v3.0 as in progress with execution pending.
- [Phase 14]: Locked export entry endpoint to GET /exports/backup.xlsx for phase-14 scope contract stability.
- [Phase 14]: Returned a minimal JSON dataset contract in phase 14 to prove SCOP behavior before workbook shaping phases.
- [Phase 14]: Placed Export Backup in UserSwitcher to keep actor and lens context visible at click time.
- [Phase 14]: Kept frontend export requests fixed to GET /exports/backup.xlsx without owner override identifiers.
- [Phase 15]: Use frozen workbook column definitions with explicit order metadata to guarantee deterministic sheet schemas.
- [Phase 15]: Resolve parent and linked asset references using canonical fields first, then compatibility attributes, with UNLINKED markers for missing targets.
- [Phase 15]: Enforce explicit marker and formatting policy: N/A for missing values, fixed two-decimal amounts, and ISO-like dates.
- [Phase 15]: Expose workbook model additively as workbook/sheets while preserving existing datasets keys for backward compatibility.
- [Phase 15]: Build workbook payload strictly from exportScopeQuery({ scope: req.scope }) datasets to keep Phase 14 trust boundaries unchanged.
- [Phase 15]: Lock workbook scope behavior in owner/all/lens modes via export API regression assertions.

### Pending Todos

None yet.

### Blockers/Concerns

- Existing unrelated frontend deferred item remains from v2.0: `frontend/src/pages/events/events-page.tsx:255` (TS6133 unused `todayStart`).

## Session Continuity

Last session: 2026-03-03 12:17
Stopped at: Phase 16 context gathered
Resume file: .planning/phases/16-event-history-and-downloadable-workbook/16-CONTEXT.md
