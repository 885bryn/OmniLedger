# Requirements: Household Asset & Commitment Tracker (HACT) API

**Defined:** 2026-02-23
**Core Value:** Users can see each asset together with its linked obligations and timeline status so they can make clear, timely household financial decisions.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Accounts

- [x] **ACCT-01**: User can be stored as an account with UUID id, username, email, and password hash.

### Ledger Items

- [x] **ITEM-01**: User can create an item with type `RealEstate`, `Vehicle`, `FinancialCommitment`, or `Subscription`.
- [x] **ITEM-02**: User can create an item with `attributes` stored as JSONB so type-specific and custom fields can coexist.
- [x] **ITEM-03**: User can create a `FinancialCommitment` item linked to a parent asset using `parent_item_id`.
- [ ] **ITEM-04**: User can create an item through `POST /items` and receive default attribute keys auto-populated based on item type.
- [ ] **ITEM-05**: User can request `GET /items/:id/net-status` and receive the item with attributes plus nested linked child commitments.

### Events and Timeline

- [x] **EVNT-01**: User can store timeline events for an item with event type, due date, amount, status, and recurrence flag.
- [ ] **EVNT-02**: User can complete an event through `PATCH /events/:id/complete` and the event status becomes `Completed`.
- [ ] **EVNT-03**: User receives `prompt_next_date: true` in completion response when the completed event is non-recurring.

### Audit History

- [ ] **AUDT-01**: User actions are recorded in `AuditLog` with user id, action, and timestamp when event completion is performed.

### Delivery and Runtime

- [ ] **DEPL-01**: User can run API and PostgreSQL together with `docker-compose.yml` for local network hosting.
- [ ] **DEPL-02**: User can run the API against PostgreSQL using Sequelize models for `Users`, `Items`, `Events`, and `AuditLog`.

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Insights

- **INSI-01**: User can view aggregated net worth and commitment trend analytics over time.
- **INSI-02**: User can receive proactive alerts for upcoming due items and risk conditions.

### Integrations

- **INTG-01**: User can import financial/account data from external providers.
- **INTG-02**: User can sync reminders to external calendar and notification systems.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Frontend application UI | Current scope is backend API and deployment setup only |
| Production cloud infrastructure and CI/CD | Requirement is local docker-compose hosting |
| Real-time collaboration or multi-tenant org model | Not required for initial household-focused API scope |
| Predictive forecasting engine | Higher complexity and lower priority than core ledger correctness |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ACCT-01 | Phase 1 | Complete |
| ITEM-01 | Phase 1 | Complete |
| ITEM-02 | Phase 1 | Complete |
| ITEM-03 | Phase 1 | Complete |
| ITEM-04 | Phase 2 | Pending |
| ITEM-05 | Phase 3 | Pending |
| EVNT-01 | Phase 1 | Complete |
| EVNT-02 | Phase 4 | Pending |
| EVNT-03 | Phase 4 | Pending |
| AUDT-01 | Phase 4 | Pending |
| DEPL-01 | Phase 5 | Pending |
| DEPL-02 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-02-23*
*Last updated: 2026-02-23 after roadmap traceability mapping*
