# Project State
## Project Reference
See: `.planning/PROJECT.md` (updated 2026-03-10)
Milestone archives: `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v2.0-ROADMAP.md`, `.planning/milestones/v3.0-ROADMAP.md`, `.planning/milestones/v4.0-ROADMAP.md`, `.planning/milestones/v4.1-ROADMAP.md`

**Core value:** Users can see each asset together with its linked obligations and timeline status so they can make clear, timely household financial decisions.
**Current focus:** v4.4 dashboard redesign is complete and ready for milestone closeout.
## Current Position
Phase: 37 - Exceptions, Trends, and Dashboard Polish
Plan: 02/02
Status: Complete
Last activity: 2026-03-13 - Completed Plan 02 compact activity polish, trend strip, and precision microcopy lock
Progress: [##########] 100%
## Performance Metrics
**Velocity:**
- Total plans completed: 76
- Average duration: 4 min
- Total execution time: 6.4 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 14-18 (v3.0) | 11 | 46 min | 4 min |
| 19-23 (v4.0) | 10 | 27 min | 3 min |
| 24-26 (v4.1) | 10 | 41 min | 4 min |

**Recent Trend:**
| Phase 27 P02 | 3 min | 2 tasks | 4 files |
| Phase 27 P03 | 3 min | 2 tasks | 2 files |
| Phase 28 P01 | 1 min | 2 tasks | 2 files |
| Phase 28 P02 | 3 min | 2 tasks | 1 files |
| Phase 29 P01 | 1 min | 2 tasks | 3 files |
| Phase 29 P02 | 4 min | 2 tasks | 1 files |
| Phase 29 P03 | 5 min | 2 tasks | 2 files |
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
| Phase 32 P02 | 3 min | 2 tasks | 4 files |
| Phase 33-historical-injection-ui P01 | 3 min | 2 tasks | 6 files |
| Phase 33 P02 | 1 session | 3 tasks | 6 files |
| Phase 34 P01 | 14 min | 2 tasks | 4 files |
| Phase 35-dashboard-information-architecture P01 | 3 min | 2 tasks | 5 files |
| Phase 36-action-queue-and-financial-snapshot P01 | 5 min | 2 tasks | 6 files |
| Phase 36 P02 | 1 min | 3 tasks | 6 files |
| Phase 37-exceptions-trends-and-dashboard-polish P01 | 8 min | 2 tasks | 6 files |
| Phase 37 P02 | 16 min | 3 tasks | 7 files |

## Accumulated Context

### Decisions

- v4.2 phase numbering starts at 27 and continues current roadmap sequence.
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
- [Phase 34]: Use `Events` as the Financial Item detail tab label wherever the tab currently surfaces item-specific event timeline content and historical-entry actions.
- [Phase 30]: Compare due dates as calendar-day keys so overdue and rolling-week buckets stay timezone-stable.
- [Phase 30]: Keep History intentionally empty in Phase 30 even when completed rows are fetched so Phase 31 owns populated history.
- [Phase 31-paid-flow-into-history]: Keep successful rows in local History immediately, then show calm catch-up copy until the server refresh includes the completed row.
- [Phase 31-paid-flow-into-history]: Group completed history from completed_at month-year keys so paid chronology stays trustworthy and newest-first.
- [Phase 32-manual-override-boundary-contract]: Use the latest valid date across origin metadata, due-date seed data, and item creation day as the shared safe boundary for projection and suppression.
- [Phase 32-manual-override-boundary-contract]: Persist manual overrides as completed non-recurring events that bypass only the origin boundary while keeping ownership, date, amount, and duplicate validation intact.
- [Phase 32]: Render suppression feedback inline in the ledger header for admins only so normal users keep a clean /events experience.
- [Phase 32]: Keep manual override rows inside normal History month groups and distinguish them with warning copy and styling instead of moving them to a separate section.
- [Phase 33-historical-injection-ui]: Keep note writes exclusive to POST /events/manual-override so projected-event creation and ordinary completion/edit routes stay untouched.
- [Phase 33-historical-injection-ui]: Expose note data only on manual override rows in /events responses so normal event payloads keep their prior shape.
- [Phase 34]: Kept the existing items.detail.tabs.commitments translation key and changed only the localized values so the user-facing rename stayed low risk.
- [Phase 34]: Used browser approval as the release gate for this phase because wording clarity is a UX judgment, not just a test result.
- [Phase 35+]: The next milestone should optimize the dashboard for utility and information density first, using shadcn primitives as the structural system rather than chart-heavy or marketing-style layouts.
- [Phase 35-dashboard-information-architecture]: Used existing dashboard event and item queries for the new Recent Activity companion so Phase 35 could improve information architecture without expanding data contracts.
- [Phase 35-dashboard-information-architecture]: Kept Needs Attention ahead of Recent Activity in DOM and responsive order so mobile collapse preserves the same priority hierarchy.
- [Phase 35-dashboard-information-architecture]: Month-standard dashboard summary math should stay bound to event due-date boundaries; completion timing must not shift a row across monthly cards.
- [Phase 35-dashboard-information-architecture]: Future dashboard milestones should add an automatic midnight month-rollover refresh so long-lived open tabs recalculate cards exactly when the calendar month changes.
- [Phase 36-action-queue-and-financial-snapshot]: Implemented queue ordering from calendar-day offsets so overdue and upcoming sections stay deterministic across timezone boundaries.
- [Phase 36-action-queue-and-financial-snapshot]: Kept queue handoff inside existing workflows by linking rows to /events and /items/:itemId with preserved return state instead of adding new write actions.
- [Phase 36]: Kept the financial snapshot as a reusable feature component wired from existing dashboard/item queries.
- [Phase 36]: Preserved workflow continuity by routing summary/action links to /events and snapshot rows to /items/:itemId with return context.
- [Phase 36]: Prioritized narrow-width readability by restructuring snapshot rows and adding a mobile jump path to the snapshot section.
- [Phase 37]: Removed the dashboard financial snapshot list so Needs Attention remains the only due-work list on the page.
- [Phase 37]: Moved portfolio cards and exception notices into the right rail while keeping Recent Activity below the dashboard body.
- [Phase 37]: Derived overdue asset alerts from existing linked asset ids on financial items instead of adding new backend fields.
- [Phase 37]: Kept Recent Activity intentionally compact and low-contrast so Needs Attention remains the primary task surface.
- [Phase 37]: Derived dashboard trend context from existing pending and completed event datasets instead of expanding backend contracts.
- [Phase 37]: Locked Current position support copy to exact date-boundary wording with literal UI regressions because the phrasing carries financial meaning.

### Pending Todos
- Future milestone note: add dashboard month-rollover auto-refresh at local midnight for open tabs.

### Blockers/Concerns

- The dashboard redesign must preserve existing RBAC, item/event contracts, admin scope behavior, and established event-history/manual-override workflows.

## Session Continuity
Last session: 2026-03-13
Stopped at: Completed 37-exceptions-trends-and-dashboard-polish-02-PLAN.md.
Resume file: `None`
