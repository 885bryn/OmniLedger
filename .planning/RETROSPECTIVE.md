# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v4.5 - Financial Reconciliation Flow

**Shipped:** 2026-03-30
**Phases:** 3 | **Plans:** 6 | **Sessions:** 1

### What Was Built
- Added reconciliation-safe completion fields and API contract while preserving projected values, RBAC, audit attribution, and materialization behavior.
- Replaced instant Upcoming completion with a reusable desktop/mobile reconciliation flow and guarded one-active interaction behavior.
- Shifted settled history and completion-derived metrics to actual-paid chronology with visible over/under variance context.

### What Worked
- Tight phase sequencing (contract -> UX -> downstream metrics) reduced cross-layer ambiguity.
- Checkpoint-driven manual verification caught real UX-state bugs before milestone closeout.

### What Was Inefficient
- Integration-checker and verifier subagent model availability failed in this runtime and required inline fallback verification.
- A few test expectations were brittle around date defaults and needed post-phase hardening.

### Patterns Established
- Keep projected amount immutable in optimistic state and store reconciled value in `actual_amount` to preserve variance context.
- Convert failed human checkpoints directly into explicit regression assertions.

### Key Lessons
1. Manual visual gates are critical for state-transition UX where optimistic rendering can hide business context.
2. DATEONLY handling must always use timezone-safe parsing (`Date.UTC`) when downstream metrics depend on chronology.

### Cost Observations
- Model mix: primarily sonnet workflow agents with inline fallback when provider models were unavailable.
- Sessions: 1 milestone closeout cycle
- Notable: Wave-based execution remained fast; most extra cost came from runtime fallback verification.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v4.5 | 1 | 3 | Introduced reconciliation-first completion with strict manual phase gates and milestone audit cross-reference |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v4.5 | 58 targeted tests passed in final milestone audit suites | milestone-scoped regression suites green | 0 |

### Top Lessons (Verified Across Milestones)

1. Explicit requirement-to-phase traceability prevents hidden completion gaps at milestone close.
2. Human verification checkpoints are high-value for frontend transition quality and should remain mandatory for UX-sensitive phases.
