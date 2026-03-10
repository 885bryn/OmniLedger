# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-03-10)
Milestone archives: `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v2.0-ROADMAP.md`, `.planning/milestones/v3.0-ROADMAP.md`, `.planning/milestones/v4.0-ROADMAP.md`, `.planning/milestones/v4.1-ROADMAP.md`

**Core value:** Users can see each asset together with its linked obligations and timeline status so they can make clear, timely household financial decisions.
**Current focus:** Phase 32 plan 01 is complete; phase 32 plan 02 and the post-phase browser/API verification gate remain next.

## Current Position

Phase: 32 - Manual Override Boundary Contract
Plan: 01/02
Status: In Progress
Last activity: 2026-03-10 - Completed 32-01 backend boundary hardening and manual override API contract

Progress: [######----] 55%

## Performance Metrics

**Velocity:**
- Total plans completed: 71
- Average duration: 4 min
- Total execution time: 5.7 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 14-18 (v3.0) | 11 | 46 min | 4 min |
| 19-23 (v4.0) | 10 | 27 min | 3 min |
| 24-26 (v4.1) | 10 | 41 min | 4 min |

**Recent Trend:**
- Last 5 plans: 31-01 (12 min), 30-01 (4 min), 29-10 (6 min), 29-09 (12 min), 29-08 (4 min)
- Trend: v4.3 now includes inline paid-flow history movement on the Events ledger while preserving explicit manual browser verification gates between phases.
| Phase 27 P02 | 3 min | 2 tasks | 4 files |
| Phase 27 P03 | 3 min | 2 tasks | 2 files |
| Phase 28 P01 | 1 min | 2 tasks | 2 files |
| Phase 28 P02 | 3 min | 2 tasks | 1 files |
| Phase 29 P01 | 1 min | 2 tasks | 3 files |
| Phase 29 P02 | 4 min | 2 tasks | 1 files |
| Phase 29 P03 | 5 min | 2 tasks | 2 files |
| Phase 29 P02 | 1 min | 2 tasks | 1 files |
| Phase 29 P03 | 2 min | 2 tasks | 2 files |
| Phase 29 P04 | 7 min | 2 tasks | 3 files |
| Phase 29 P05 | 2 min | 2 tasks | 5 files |
| Phase 29 P06 | 5 min | 2 tasks | 3 files |
| Phase 29 P07 | 8 min | 2 tasks | 3 files |
| Phase 29 P08 | 4 min | 2 tasks | 3 files |
| Phase 29 P09 | 12 min | 2 tasks | 5 files |
| Phase 29 P10 | 6 min | 2 tasks | 5 files |
| Phase 29 P11 | 2 min | 2 tasks | 2 files |
| Phase 30 P01 | 4 min | 2 tasks | 4 files |
| Phase 31-paid-flow-into-history P01 | 12 min | 2 tasks | 5 files |
| Phase 32-manual-override-boundary-contract P01 | 5 min | 2 tasks | 7 files |

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
- [Phase 29]: Use displayCadence separate from selectedCadence so card values remain coherent while transitions are pending.
- [Phase 29]: Guard cadence transitions with monotonic version checks so last selection wins and stale updates cannot overwrite newer intent.
- [Phase 29]: Assert cadence toggle buttons by accessible selected-cadence labels to match ARIA contract.
- [Phase 29]: Exercise cadence transition failure with invalid monthly fallback totals while keeping recurring monthly projection valid.
- [Phase 29]: Normalize recurring net display to remain equal to cadence income minus obligations when cadence net metadata is missing or inconsistent.
- [Phase 29]: Cancel pending cadence transition timers on rapid toggles so stale async work cannot overwrite latest selection.
- [Phase 29]: Model rapid cadence interactions as multi-click sequences and assert only the final cadence state remains visible.
- [Phase 29]: Guard item list/create workflow payloads from cadence-toggle-only fields so cadence scope stays item-detail local.
- [Phase 29]: Replace run-rate cadence totals with inclusive active-period due-date inclusion before aggregation.
- [Phase 29]: Keep summary.active_period explicit while exposing recurring cadence active periods for deterministic interpretation.
- [Phase 29]: Render cadence card copy as due-this-period language using localized period nouns instead of annualized-style wording.
- [Phase 29]: Protect non-summary workflows by asserting cadence-only and summary metadata fields never appear in list/create/delete contracts.
- [Phase 29]: Use Event table due dates as cadence period inclusion source of truth for summary rollups.
- [Phase 29]: Keep one-time inclusion monthly-scoped by requiring an in-month event while recurring totals remain event-driven across cadences.
- [Phase 29]: Filter linked financial rows by active cadence period metadata plus in-period event occurrence rather than due-date anchors.
- [Phase 29]: Keep cadence wording bound to selected cadence while preserving display-cadence projection safety for transitions.
- [Phase 29]: Count recurring cadence totals from matching event occurrences inside each active period instead of boolean membership.
- [Phase 29]: Keep one-time inclusion monthly-only while recurrence-aware cadence net remains income minus obligations.
- [Phase 29]: Use the full linked commitments list for the commitments tab while keeping the summary count cadence-filtered.
- [Phase 29]: Derive visible cadence labels and period copy from displayCadence active-period metadata so wording matches rendered totals during and after transitions.
- [Phase 29]: Use explicit originDate metadata (with due-date fallback) as shared recurring origin boundary for rollups and projections.
- [Phase 29]: Keep one-time inclusion monthly-only while tightening recurring pre-origin filtering.
- [Phase 29]: Parse backend YYYY-MM-DD active-period dates as calendar days and compare by day keys so item-detail labels and filtering are timezone-stable.
- [Phase 29]: Add UI regressions for exact cadence boundaries and boundary-day events so labels, hints, and totals stay synchronized and non-zero when API data is valid.
- [Phase 30]: Start v4.3 with a read-only Upcoming/History ledger foundation before introducing any state-changing flows.
- [Phase 31]: Mark-paid behavior must move rows from Upcoming to History immediately and stay legible via shared spring motion.
- [Phase 32]: Manual historical injection support must be enforced first at the backend/manual-override boundary layer before exposing the item-detail UI.
- [Phase 33]: Every v4.3 phase pauses for manual browser testing and explicit approval before the next phase begins.
- [Phase 30]: Compare due dates as calendar-day keys so overdue and rolling-week buckets stay timezone-stable.
- [Phase 30]: Keep History intentionally empty in Phase 30 even when completed rows are fetched so Phase 31 owns populated history.
- [Phase 31-paid-flow-into-history]: Keep successful rows in local History immediately, then show calm catch-up copy until the server refresh includes the completed row.
- [Phase 31-paid-flow-into-history]: Group completed history from completed_at month-year keys so paid chronology stays trustworthy and newest-first.
- [Phase 32-manual-override-boundary-contract]: Use the latest valid date across origin metadata, due-date seed data, and item creation day as the shared safe boundary for projection and suppression.
- [Phase 32-manual-override-boundary-contract]: Persist manual overrides as completed non-recurring events that bypass only the origin boundary while keeping ownership, date, amount, and duplicate validation intact.

### Pending Todos

- Next milestone kickoff: include progress-style rollup visual showing completed/total amounts for selected cadence period.
- Next milestone kickoff: include financial-item event-history tab with past/future events and completion state per event.
- After Phase 32, verify pre-origin manual overrides are allowed while projected pre-origin system events remain blocked before Phase 33.
- After Phase 33, run final manual browser verification before milestone closeout.

### Blockers/Concerns

- Phase 32 still requires plan 02 plus browser/API verification on `/events` before Phase 33 starts.
- v4.3 execution must preserve RBAC, audit attribution, deployment contracts, and existing item/event workflows while adding grouped ledger and manual-history flows.

## Session Continuity

Last session: 2026-03-10
Stopped at: Completed 32-manual-override-boundary-contract-01-PLAN.md
Resume file: `.planning/phases/32-manual-override-boundary-contract/32-manual-override-boundary-contract-02-PLAN.md`
