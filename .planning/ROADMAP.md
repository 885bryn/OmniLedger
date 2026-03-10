# Roadmap: Household Asset & Commitment Tracker (HACT)

## Milestones

- ✅ **v1.0 MVP** - Phases 1-7 shipped 2026-02-25 (`.planning/milestones/v1.0-ROADMAP.md`)
- ✅ **v2.0 Auth, Timeline & Data Lifecycle** - Phases 8-13 shipped 2026-03-02 (`.planning/milestones/v2.0-ROADMAP.md`, `.planning/milestones/v2.0-MILESTONE-AUDIT.md`)
- ✅ **v3.0 Data Portability** - Phases 14-18 shipped 2026-03-04 (`.planning/milestones/v3.0-ROADMAP.md`, `.planning/milestones/v3.0-MILESTONE-AUDIT.md`)
- ✅ **v4.0 Interactive Production Deployment for Ugreen NAS** - Phases 19-23 shipped 2026-03-07 (`.planning/milestones/v4.0-ROADMAP.md`, `.planning/milestones/v4.0-REQUIREMENTS.md`, `.planning/milestones/v4.0-MILESTONE-AUDIT.md`)
- ✅ **v4.1 Frontend UI/UX Overhaul: High-Contrast Dual Theme (Light Mode Default) & Fluid MacOS-Style Motion** - Phases 24-26 shipped 2026-03-07 (`.planning/milestones/v4.1-ROADMAP.md`, `.planning/milestones/v4.1-REQUIREMENTS.md`, `.planning/milestones/v4.1-MILESTONE-AUDIT.md`)
- ✅ **v4.2 Cashflow Frequency Normalization & Cadence Toggle** - Phases 27-29 shipped 2026-03-10
- 🚧 **v4.3 Smart Grouped Ledger & Historical Event Injection** - Phases 30-33 (planned)

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

### 🚧 v4.3 Smart Grouped Ledger & Historical Event Injection (Planned)

**Milestone Goal:** Turn the events experience into a usable ledger by grouping upcoming obligations, supporting pay/log-history actions, and letting users inject past completed events without breaking origin-boundary safety.

**Execution Gate:** Pause after each phase for manual browser testing and explicit user approval before starting the next phase.

- [x] **Phase 30: Upcoming Ledger Foundation** - Deliver the read-only grouped Upcoming ledger with clear tabs, sticky chronology, and urgent overdue presentation. (completed 2026-03-10)
- [ ] **Phase 31: Paid Flow Into History** - Let users mark projected events as paid and immediately see them reappear in history with legible motion.
- [ ] **Phase 32: Manual Override Boundary Contract** - Add the backend/manual-override rules that allow explicit pre-origin historical overrides while keeping system-generated guardrails intact.
- [ ] **Phase 33: Historical Injection UI** - Let users log completed historical events from item detail using the manual-override flow without breaking existing platform guarantees.

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
**Plans**: TBD
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
**Plans**: TBD
**Manual Test Gate**: Stop after this phase for browser/API verification that pre-origin system projections stay blocked while manual overrides remain allowed before Phase 33 starts.

### Phase 33: Historical Injection UI
**Goal**: Users can log completed historical events from item detail through an explicit manual-override workflow that preserves existing safety and compatibility guarantees.
**Depends on**: Phase 32
**Requirements**: EVENT-01, SAFE-03
**Success Criteria** (what must be TRUE):
  1. User can open an item-detail dialog to log a completed historical event with date, amount, and note fields.
  2. User can submit a past completed event from item detail and then find it in history as a completed manual entry.
  3. User can use the historical injection flow without breaking existing RBAC scoping, audit attribution, or deployment-facing behavior.
**Plans**: TBD
**Manual Test Gate**: Stop after this phase for final browser verification and explicit approval before milestone closeout.

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 30. Upcoming Ledger Foundation | 1/1 | Complete    | 2026-03-10 |
| 31. Paid Flow Into History | 0/0 | Not started | - |
| 32. Manual Override Boundary Contract | 0/0 | Not started | - |
| 33. Historical Injection UI | 0/0 | Not started | - |

---
*Last updated: 2026-03-10 after creating milestone v4.3 roadmap*
