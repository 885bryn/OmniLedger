---
phase: 10-financial-contract-occurrence-foundation
plan: 01
subsystem: api
tags: [sequelize, financial-item, transactions, validation, jest]
requires:
  - phase: 9-rbac-scope-admin-safety-mode
    provides: owner-scoped request context and actor/lens audit attribution
provides:
  - FinancialItem parent contract schema with explicit subtype/frequency/default-amount/status fields
  - Transactional one-time create flow that persists parent plus first occurrence atomically
  - API validation contract for optional linked asset confirmation and linked-asset ownership checks
affects: [phase-10-plan-02, events-projection, item-create-api]
tech-stack:
  added: []
  patterns: [managed-sequelize-transaction, contract-first-validation, linked-asset-guardrails]
key-files:
  created:
    - src/db/migrations/20260226100000-financial-item-contract-foundation.js
  modified:
    - src/db/models/item.model.js
    - src/domain/items/default-attributes.js
    - src/domain/items/minimum-attribute-keys.js
    - src/domain/items/create-item.js
    - src/domain/items/item-event-sync.js
    - src/api/routes/items.routes.js
    - src/domain/items/item-create-errors.js
    - src/api/errors/http-error-mapper.js
    - test/api/items-create.test.js
key-decisions:
  - "Persisted FinancialItem contract fields as explicit Item columns while retaining attributes for due-date/event metadata."
  - "Required confirm_unlinked_asset when linked_asset_item_id is omitted for FinancialItem creates."
  - "Limited automatic first-occurrence materialization to FinancialItem frequency one_time in this plan."
patterns-established:
  - "Financial contract validation failures map to financial_contract_invalid with issue-level field codes."
  - "Linked asset checks run inside the same managed transaction before parent and child writes."
requirements-completed: [FIN-01, FIN-03]
duration: 6 min
completed: 2026-02-26
---

# Phase 10 Plan 01: Financial Contract Foundation Summary

**FinancialItem parent contracts now persist explicit subtype/frequency/default-amount/status fields, and one-time creates atomically write parent plus first pending occurrence with confirmation-gated optional asset linking.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-26T20:57:38Z
- **Completed:** 2026-02-26T21:03:59Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Added migration + model support for explicit FinancialItem parent contract fields (`title`, `type`, `frequency`, `default_amount`, `status`, optional `linked_asset_item_id`).
- Added create-path validation for FinancialItem contract requirements, recurrence frequency constraints, and no-asset confirmation intent (`confirm_unlinked_asset`).
- Implemented one-time create semantics that persist FinancialItem parent + first pending Event occurrence in one transaction and rollback safely on linked-asset validation failures.
- Expanded `POST /items` regressions to cover FIN-01 required field behavior and FIN-03 atomic one-time persistence/rollback guarantees.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add explicit FinancialItem parent contract fields and subtype/frequency constraints** - `1cc2cf5` (feat)
2. **Task 2: Implement transactional one-time create path with optional-asset confirmation contract** - `a8dd258` (feat)

## Files Created/Modified
- `src/db/migrations/20260226100000-financial-item-contract-foundation.js` - Adds FinancialItem contract columns and linked-asset FK/index.
- `src/db/models/item.model.js` - Extends Item schema with FinancialItem enums/columns and model-level required-contract validation.
- `src/domain/items/create-item.js` - Validates FinancialItem payload contract, enforces confirmation/linked-asset guards, and keeps create+event writes transactional.
- `src/domain/items/item-event-sync.js` - Restricts FinancialItem auto-occurrence creation to one-time frequency and uses contract title/default amount.
- `test/api/items-create.test.js` - Adds FIN-01/FIN-03 regression coverage for contract field requirements and rollback-safe one-time creation.

## Decisions Made
- Chose explicit `Items` columns for FinancialItem contract persistence to move required parent semantics out of implicit JSON-only behavior.
- Kept linked asset optional, but made omission explicit via `confirm_unlinked_asset` to force intentional risky saves.
- Added dedicated `financial_contract_invalid` API error category so client corrections remain actionable and field-specific.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added missing API error category mapping for financial contract failures**
- **Found during:** Task 2 (transactional one-time create path)
- **Issue:** New FinancialItem validation failures were surfaced as generic invalid payload responses instead of a dedicated contract category.
- **Fix:** Added `FINANCIAL_CONTRACT_INVALID` to item-create errors and HTTP error mapper category messages.
- **Files modified:** src/domain/items/item-create-errors.js, src/api/errors/http-error-mapper.js
- **Verification:** `npm test -- test/api/items-create.test.js --runInBand`
- **Committed in:** `a8dd258`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Auto-fix improved error-contract clarity without expanding scope.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FinancialItem contract baseline and one-time atomic persistence are in place for occurrence projection/read-model work in Plan 10-02.
- Recurrence projection beyond one-time remains intentionally deferred to upcoming phase plans.

---
*Phase: 10-financial-contract-occurrence-foundation*
*Completed: 2026-02-26*

## Self-Check: PASSED

- Verified file exists: `.planning/phases/10-financial-contract-occurrence-foundation/10-01-SUMMARY.md`
- Verified commits exist: `1cc2cf5`, `a8dd258`
