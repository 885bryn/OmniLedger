# Feature Research

**Domain:** Household asset + commitment tracking API
**Researched:** 2026-02-23
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Asset + liability/commitment CRUD with typed categories | Competitors center on unified account/asset tracking and organization | LOW | Required base model (`items` + `type` + `attributes`); API-first fit |
| Parent-child linkage between assets and obligations | Users expect context like mortgage tied to property or loan tied to vehicle | MEDIUM | Requires reliable self-reference and validation rules |
| Timeline events for due dates and completions | Products consistently emphasize bills/subscriptions/maintenance tracking | MEDIUM | Core operational object for reminders, completion, and history |
| Recurring and one-time commitment support | Bills and subscriptions are a universal expectation | MEDIUM | Recurrence rules + next-occurrence materialization are required |
| Net status endpoint (asset value minus linked obligations) | Users expect at-a-glance "where do I stand" views | MEDIUM | Aggregate query across parent + children; return nested detail for UI |
| Filtering, sorting, and pagination on list endpoints | Baseline for any practical dashboard/client integration | LOW | Keep query params simple and documented |
| Audit history for key mutations | Financial tools are expected to preserve traceability | MEDIUM | Already aligned to PROJECT requirement for event completion audit logging |
| Stable API contract + validation errors | API consumers expect deterministic behavior and actionable errors | LOW | OpenAPI spec + consistent error schema is enough for v1 |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Commitment-aware net status with nested child obligations | Gives immediate, decision-ready view for each asset (not just global totals) | MEDIUM | Directly aligns with HACT core value and required nested response |
| Action-hint responses (for example `prompt_next_date` on non-recurring completion) | Reduces client logic and enables guided workflows with less UI guesswork | LOW | Already in scope and rare in generic finance trackers |
| Typed default attributes by item category | Faster creation and cleaner data quality without frequent schema migrations | MEDIUM | Keep defaults server-side and versioned |
| Asset lifecycle event model (payments + maintenance in one ledger) | Combines home/vehicle ownership operations with financial commitments | MEDIUM | Differentiates from pure budgeting apps and pure inventory apps |
| Household-ready multi-user sharing hooks (ownership, visibility fields) | Enables future family/couple workflows without major data remodel | MEDIUM | Add fields and policy scaffolding now; defer full auth policy engine |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time bank aggregation in v1 | "Auto-sync everything" expectation from Mint-style tools | High integration and compliance overhead; distracts from core ledger reliability | Support manual and API-imported events first; define import contract |
| Full budgeting engine (envelopes/zero-based rules) | Users conflate asset tracking with full personal finance suite | Expands domain and UX drastically; weak fit with current core value | Keep to asset/commitment ledger + net status; export data for budgeting tools |
| In-app payment execution/autopay | Desire to "take action directly" | Adds regulatory, fraud, and failure-handling burden beyond MVP | Store due/paid events and reminders only |
| AI assistant in core API v1 | Market pressure toward AI everywhere | Low trust if underlying data quality is immature; adds opaque behavior | Build deterministic analytics endpoints first; add AI later on top |
| Complex forecasting/simulation engine at launch | Attractive for planning scenarios | High model complexity and low validation confidence in greenfield phase | Ship simple forward schedule of known commitments first |

## Feature Dependencies

```text
Typed item model + validation
    -> Asset/commitment CRUD
        -> Parent-child linkage
            -> Net status aggregation

Event model (one-time + recurring)
    -> Event completion workflow
        -> Audit history
            -> Action-hint response (`prompt_next_date`)

Pagination/filtering
    -> Usable dashboard/consumer integrations

Auth policy engine (defer)
    -> Multi-user collaboration actions

External account aggregation (defer)
    -> Advanced automation and auto-reconciliation
```

### Dependency Notes

- **Net status requires parent-child linkage:** without explicit relationships, liability rollups are unreliable.
- **Action hints require event semantics:** `prompt_next_date` only makes sense when recurrence + completion state are modeled correctly.
- **Auditability requires mutation boundaries:** completion and update endpoints must emit history records atomically.
- **Collaboration depends on auth model:** add ownership metadata now, but defer full sharing permissions until post-validation.
- **Automation depends on stable core schema:** external integrations should not start until item/event contracts stabilize.

## MVP Definition

### Launch With (v1)

Minimum viable product - what's needed to validate the concept.

- [x] Item CRUD for assets and commitments with typed defaults and UUID keys - core ledger foundation.
- [x] Parent-child linkage and nested net-status retrieval - core value delivery for "what I own vs owe".
- [x] Event lifecycle endpoints (create/list/complete) with one-time + recurring support - commitment tracking baseline.
- [x] Completion audit logging plus `prompt_next_date` hinting - traceability and workflow continuity.
- [x] Basic list/search ergonomics (filter, sort, paginate) - necessary for real clients.

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] Idempotency keys + webhook events - when first external clients require robust automation.
- [ ] Lightweight household sharing scopes - when multi-user demand is validated.
- [ ] CSV import/export and migration helpers - when onboarding friction becomes top complaint.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] External account aggregation connectors - defer until schema and ops are stable.
- [ ] Scenario forecasting/simulation models - defer until enough historical data exists.
- [ ] Embedded payments/autopay orchestration - defer due to compliance/operational burden.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Asset/commitment CRUD + typed defaults | HIGH | MEDIUM | P1 |
| Parent-child linking + nested net status | HIGH | MEDIUM | P1 |
| Event completion + audit logging + prompt hints | HIGH | MEDIUM | P1 |
| Recurrence handling for commitments | HIGH | MEDIUM | P1 |
| Filtering/sorting/pagination | MEDIUM | LOW | P1 |
| Collaboration scopes | MEDIUM | MEDIUM | P2 |
| Webhooks + idempotency | MEDIUM | MEDIUM | P2 |
| External account aggregation | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Competitor A | Competitor B | Our Approach |
|---------|--------------|--------------|--------------|
| Unified account/asset visibility | Monarch: all accounts in one place | Empower: connect all accounts for full picture | API-level unified `items` model with explicit type system |
| Recurring bills/subscriptions tracking | Quicken Simplifi: upcoming bills/subscriptions | Rocket Money: subscription tracking/cancellation focus | Event-first commitment tracking linked directly to assets |
| Home operations (inventory/maintenance/projects) | HomeZada: home inventory + maintenance + projects | Typical budget apps: limited or absent | Treat maintenance as first-class event in same ledger as obligations |
| Forecasting/planning depth | Quicken/Kubera include cash flow and advanced planning | Varies by segment | Defer advanced simulation; prioritize deterministic status + timeline |

## Sources

- Monarch Money feature pages (account aggregation, net worth, recurring detection, goals): https://www.monarchmoney.com/ (official site)
- Quicken Simplifi product/features page (projected cash flow, bills/subscriptions, reporting): https://www.quicken.com/products/simplifi/ (official site)
- Rocket Money feature pages (subscriptions, budgeting, net worth, alerts): https://www.rocketmoney.com/ (official site)
- Empower tools and dashboard pages (net worth, budgeting/cash flow, transactions): https://www.empower.com/personal-investors (official site)
- Kubera product page (unified asset tracking, reporting, nested portfolios, cash forecasting): https://www.kubera.com/ (official site)
- HomeZada feature pages (inventory, maintenance, projects, home finances): https://www.homezada.com/ (official site)

---
*Feature research for: Household asset + commitment tracking API*
*Researched: 2026-02-23*
