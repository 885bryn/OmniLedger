# Roadmap: Household Asset & Commitment Tracker (HACT)

## Milestones

- ✅ **v1.0 MVP** - Phases 1-7 shipped 2026-02-25 (`.planning/milestones/v1.0-ROADMAP.md`)
- ✅ **v2.0 Auth, Timeline & Data Lifecycle** - Phases 8-13 shipped 2026-03-02 (`.planning/milestones/v2.0-ROADMAP.md`, `.planning/milestones/v2.0-MILESTONE-AUDIT.md`)
- ✅ **v3.0 Data Portability** - Phases 14-18 shipped 2026-03-04 (`.planning/milestones/v3.0-ROADMAP.md`, `.planning/milestones/v3.0-MILESTONE-AUDIT.md`)
- ✅ **v4.0 Interactive Production Deployment for Ugreen NAS** - Phases 19-23 shipped 2026-03-07 (`.planning/milestones/v4.0-ROADMAP.md`, `.planning/milestones/v4.0-REQUIREMENTS.md`, `.planning/milestones/v4.0-MILESTONE-AUDIT.md`)
- ✅ **v4.1 Frontend UI/UX Overhaul: High-Contrast Dual Theme (Light Mode Default) & Fluid MacOS-Style Motion** - Phases 24-26 shipped 2026-03-07 (`.planning/milestones/v4.1-ROADMAP.md`, `.planning/milestones/v4.1-REQUIREMENTS.md`, `.planning/milestones/v4.1-MILESTONE-AUDIT.md`)
- ✅ **v4.2 Cashflow Frequency Normalization & Cadence Toggle** - Phases 27-29 shipped 2026-03-10
- ✅ **v4.3 Smart Grouped Ledger & Historical Event Injection** - Phases 30-34 shipped 2026-03-10 (`.planning/milestones/v4.3-ROADMAP.md`, `.planning/milestones/v4.3-REQUIREMENTS.md`, `.planning/milestones/v4.3-MILESTONE-AUDIT.md`)
- 🚧 **v4.4 Dashboard Utility Redesign with shadcn/ui** - Phases 35-37 (planned)

## Phases

<details>
<summary>Shipped milestone history</summary>

- v1.0 MVP - Phases 1-7
- v2.0 Auth, Timeline & Data Lifecycle - Phases 8-13
- v3.0 Data Portability - Phases 14-18
- v4.0 Interactive Production Deployment for Ugreen NAS - Phases 19-23
- v4.1 Frontend UI/UX Overhaul: High-Contrast Dual Theme (Light Mode Default) & Fluid MacOS-Style Motion - Phases 24-26
- v4.2 Cashflow Frequency Normalization & Cadence Toggle - Phases 27-29

</details>

### ✅ v4.3 Smart Grouped Ledger & Historical Event Injection (Shipped)

**Milestone Goal:** Turn the events experience into a usable ledger by grouping upcoming obligations, supporting pay/log-history actions, and letting users inject past completed events without breaking origin-boundary safety.

**Execution Gate:** Pause after each phase for manual browser testing and explicit user approval before starting the next phase.

- [x] **Phase 30: Upcoming Ledger Foundation** - Deliver the read-only grouped Upcoming ledger with clear tabs, sticky chronology, and urgent overdue presentation. (completed 2026-03-10)
- [x] **Phase 31: Paid Flow Into History** - Let users mark projected events as paid and immediately see them reappear in history with legible motion. (completed 2026-03-10)
- [x] **Phase 32: Manual Override Boundary Contract** - Add the backend/manual-override rules that allow explicit pre-origin historical overrides while keeping system-generated guardrails intact. (completed 2026-03-10)
- [x] **Phase 33: Historical Injection UI** - Let users log completed historical events from item detail using the manual-override flow without breaking existing platform guarantees. (completed 2026-03-10)
- [x] **Phase 34: Item Detail Events Tab Clarity** - Rename the Financial Item detail `Commitments` tab to `Events` so the tab label matches the event history and event actions it contains. (completed 2026-03-10)

### 🚧 v4.4 Dashboard Utility Redesign with shadcn/ui

**Milestone Goal:** Turn the dashboard into an information-dense household finance control center using `shadcn/ui` primitives, with clear period summaries, action-oriented event triage, and direct pathways into item/event workflows.

**Execution Gate:** Pause after each phase for browser verification and explicit approval before starting the next phase.

- [ ] **Phase 35: Dashboard Information Architecture** - Rebuild the dashboard shell around utility-first sections for summary, attention, and activity instead of a generic overview surface.
- [ ] **Phase 36: Action Queue and Financial Snapshot** - Add a high-utility dashboard action queue plus a reusable financial-items snapshot section with dense scan-friendly rows.
- [ ] **Phase 37: Exceptions, Trends, and Dashboard Polish** - Add exception/notice surfaces, period-aware supporting insights, and responsive polish that ties the redesigned dashboard together.

## Phase Details

### Phase 30: Upcoming Ledger Foundation
**Goal**: Users can review upcoming obligations in a read-only grouped ledger before any state-changing event workflows are introduced.
**Depends on**: Phase 29
**Requirements**: LEDGER-01, LEDGER-02, LEDGER-03
**Success Criteria** (what must be TRUE):
  1. User can open the global Events page and switch between `Upcoming` and `History` ledger tabs.
  2. User sees pending and overdue upcoming events grouped into Overdue, This Week, Later This Month, and Future sections.
  3. User sees sticky chronological section headers remain visible while scrolling long upcoming ledgers.
  4. User can immediately distinguish overdue events from other upcoming rows through urgent visual treatment.
**Plans**: 1 plan
Plans:
- [ ] `30-upcoming-ledger-foundation-01-PLAN.md` - Rebuild the global Events page into the read-only grouped ledger foundation with compact upcoming buckets, sticky chronology, calm state handling, and focused frontend regressions.
**Manual Test Gate**: Stop after this phase for browser verification of ledger grouping, sticky headers, and tab behavior before Phase 31 starts.

### Phase 31: Paid Flow Into History
**Goal**: Users can resolve projected obligations from the Upcoming ledger and trust that completion is reflected immediately in the ledger history.
**Depends on**: Phase 30
**Requirements**: FLOW-02, FLOW-03, FLOW-04, LEDGER-04
**Success Criteria** (what must be TRUE):
  1. User can mark an upcoming event as paid directly from the Upcoming ledger.
  2. User sees the paid row leave Upcoming and appear in the `History` tab without manually refreshing the page.
  3. User sees completed history grouped by month/year in reverse chronological order.
  4. User sees ledger reflow remain legible during pay completion because the row transition is animated.
**Plans**: 1 plan
Plans:
- [ ] `31-paid-flow-into-history-01-PLAN.md` - Add inline mark-paid behavior, immediate move-to-history ledger state, grouped completed-month history rendering, and focused frontend regressions for pending, failure, and catch-up behavior.
**Manual Test Gate**: Stop after this phase for browser verification of mark-paid behavior, animation feel, and history arrival before Phase 32 starts.

### Phase 32: Manual Override Boundary Contract
**Goal**: Users can trust the boundary rules behind historical injection before the manual-entry UI is exposed.
**Depends on**: Phase 31
**Requirements**: SAFE-02, EVENT-02, EVENT-03
**Success Criteria** (what must be TRUE):
  1. User-created historical override events can be saved as completed materialized events flagged as manual overrides.
  2. User-created manual override events can exist before the item's normal origin boundary without being rejected.
  3. User cannot create or surface system-generated projected events before the item's origin boundary.
  4. User experiences the same origin-boundary protection on normal projected events after manual-override support is added.
**Plans**: 2 plans
Plans:
- [ ] `32-manual-override-boundary-contract-01-PLAN.md` - Harden event projection/origin boundaries, suppress absurd historical system rows, and add the explicit API-only manual override creation contract with regression coverage.
- [ ] `32-manual-override-boundary-contract-02-PLAN.md` - Surface admin-only suppression feedback and strong manual-override history labeling on the Events ledger with frontend regressions.
**Manual Test Gate**: Stop after this phase for browser/API verification that pre-origin system projections stay blocked while manual overrides remain allowed before Phase 33 starts.

### Phase 33: Historical Injection UI
**Goal**: Users can log completed historical events from item detail through an explicit manual-override workflow that preserves existing safety and compatibility guarantees.
**Depends on**: Phase 32
**Requirements**: EVENT-01, SAFE-03
**Success Criteria** (what must be TRUE):
  1. User can open an item-detail dialog to log a completed historical event with date, amount, and note fields.
  2. User can submit a past completed event from item detail and then find it in history as a completed manual entry.
  3. User can use the historical injection flow without breaking existing RBAC scoping, audit attribution, or deployment-facing behavior.
**Plans**: 2 plans
Plans:
- [x] `33-historical-injection-ui-01-PLAN.md` - Extend the manual-override backend contract with optional note persistence and read-path compatibility coverage for item-detail historical injection.
- [x] `33-historical-injection-ui-02-PLAN.md` - Add the item-detail historical injection dialog, post-save history reveal, and blocking browser verification gate.
**Manual Test Gate**: Stop after this phase for final browser verification and explicit approval before milestone closeout.

### Phase 34: Item Detail Events Tab Clarity
**Goal**: Users can recognize that the Financial Item detail tab contains event history and event actions because the tab label says `Events` instead of `Commitments`.
**Depends on**: Phase 33
**Requirements**: UX-01
**Success Criteria** (what must be TRUE):
  1. User sees the Financial Item detail tab label rendered as `Events` anywhere the prior `Commitments` label appeared for that view.
  2. User can still access the same event timeline, historical injection action, and related event content from that tab with no behavior regressions.
  3. User does not see stale `Commitments` wording in Financial Item detail copy, tests, or accessibility labels where it would make the tab's purpose unclear.
**Plans**: 1 plan
Plans:
- [x] `34-item-detail-events-tab-clarity-01-PLAN.md` - Rename the Financial Item detail `Commitments` tab to `Events`, update related item-detail copy and accessibility text, and lock the behavior with focused frontend regressions.
**Manual Test Gate**: Stop after this phase for browser verification that the renamed tab remains clear, accessible, and behaviorally unchanged before milestone closeout.

### Phase 35: Dashboard Information Architecture
**Goal**: Users can understand their current financial position and next actions from the dashboard without hunting across separate pages.
**Depends on**: Phase 34
**Requirements**: DASH-01, DASH-02, DASH-03
**Success Criteria** (what must be TRUE):
  1. User sees a redesigned dashboard built from `shadcn/ui` layout primitives with clear top-level sections instead of a loosely organized overview surface.
  2. User sees period-aware summary cards for net cashflow, upcoming due, overdue count, and completed activity that feel informational and immediately scannable.
  3. User can recognize a dedicated `Needs Attention` area and a dedicated `Recent Activity` area as the dashboard's primary action and feedback surfaces.
**Plans**: 2 plans
Plans:
- [x] `35-dashboard-information-architecture-01-PLAN.md` - Establish the shadcn dashboard shell, section hierarchy, and responsive layout scaffolding for the redesigned overview.
- [x] `35-dashboard-information-architecture-02-PLAN.md` - Add period-aware summary cards plus the first-pass `Needs Attention` and `Recent Activity` surfaces with focused frontend coverage.
**Manual Test Gate**: Stop after this phase for browser verification that the new dashboard hierarchy feels clearer and more actionable than the previous overview.

### Phase 36: Action Queue and Financial Snapshot
**Goal**: Users can act on urgent events and scan financial item status directly from the dashboard.
**Depends on**: Phase 35
**Requirements**: DASH-04, DASH-05, DASH-06
**Success Criteria** (what must be TRUE):
  1. User can review overdue and upcoming obligations from a dashboard action queue with direct links or inline-safe actions.
  2. User can scan a dashboard financial snapshot section showing dense but readable financial item rows with the most important metadata.
  3. User can move from dashboard summary/action surfaces into the existing events and item-detail workflows without confusion.
**Plans**: 2 plans
Plans:
- [ ] `36-action-queue-and-financial-snapshot-01-PLAN.md` - Build the dashboard action queue for overdue/upcoming event triage using existing event data and safe action affordances.
- [ ] `36-action-queue-and-financial-snapshot-02-PLAN.md` - Add the reusable financial snapshot section with scan-friendly rows, metadata, and direct navigation into item detail.
**Manual Test Gate**: Stop after this phase for browser verification that the dashboard now supports real task completion and quick item scanning.

### Phase 37: Exceptions, Trends, and Dashboard Polish
**Goal**: Users can trust the dashboard as an operational control center because it highlights exceptions, contextual trends, and responsive utility without clutter.
**Depends on**: Phase 36
**Requirements**: DASH-07, DASH-08, DASH-09
**Success Criteria** (what must be TRUE):
  1. User sees exception and notice surfaces that highlight meaningful issues like overdue spikes or manual-override/admin signals without overwhelming the main dashboard.
  2. User sees supporting timeline/trend context that helps interpret upcoming and recent activity for the selected period.
  3. User can use the redesigned dashboard comfortably on desktop and mobile, with the same utility-first hierarchy preserved across breakpoints.
**Plans**: 2 plans
Plans:
- [ ] `37-exceptions-trends-and-dashboard-polish-01-PLAN.md` - Add exception and notice panels plus admin-aware dashboard context using the existing data contracts.
- [ ] `37-exceptions-trends-and-dashboard-polish-02-PLAN.md` - Add supporting trend/timeline context, responsive polish, and final shadcn dashboard refinements with focused regressions.
**Manual Test Gate**: Stop after this phase for final browser verification and explicit approval before milestone closeout.

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 30. Upcoming Ledger Foundation | 1/1 | Complete    | 2026-03-10 |
| 31. Paid Flow Into History | 1/1 | Complete    | 2026-03-10 |
| 32. Manual Override Boundary Contract | 2/2 | Complete    | 2026-03-10 |
| 33. Historical Injection UI | 2/2 | Complete    | 2026-03-10 |
| 34. Item Detail Events Tab Clarity | 1/1 | Complete   | 2026-03-10 |
| 35. Dashboard Information Architecture | 2/2 | Complete   | 2026-03-11 |
| 36. Action Queue and Financial Snapshot | 1/2 | In Progress|  |
| 37. Exceptions, Trends, and Dashboard Polish | 0/2 | Planned |  |

---
*Last updated: 2026-03-11 after closing Phase 35 dashboard information architecture*
