# Phase 7: Milestone Gap Closure - Research

**Researched:** 2026-02-25  
**Phase requirement focus:** EVNT-03  
**Confidence:** HIGH (repo evidence is direct and current)

## What We Need To Plan Well

- Milestone blockers are concrete and reproducible from code: actor switch does not force query refresh (`frontend/src/app/shell/user-switcher.tsx`, `frontend/src/lib/query-keys.ts`), completion ignores `prompt_next_date` branch (`frontend/src/features/events/complete-event-row-action.tsx`), and Phase 01 verification artifact is missing (`.planning/v1.0-MILESTONE-AUDIT.md`).
- EVNT-03 is backend-satisfied but frontend-partial: API returns `prompt_next_date`, yet UI does not react to it; planning must treat this as UX wiring + regression test correction, not backend logic work.
- Existing tests currently assert the wrong EVNT-03 UX outcome (modal hidden even when `prompt_next_date: true`) in `frontend/src/__tests__/dashboard-events-flow.test.tsx`, so plan scope must include test expectation updates.
- There is a likely hidden closeout risk: audit still lists a broken "Create all required item types" flow at `frontend/src/pages/items/item-create-wizard-page.tsx:54`; even if out of EVNT-03 scope, Phase 7 should explicitly confirm whether milestone-close requires fixing or formally deferring it.

## Key Implementation Decisions

- **Actor-switch cache strategy:** On actor change, immediately clear or invalidate actor-sensitive query namespaces (`dashboard`, `events`, `items`) from `UserSwitcher` so mounted pages refetch without manual refresh.
- **Cache safety posture:** Prefer removing stale actor-bound cache entries before refetch (to avoid cross-user flash), not only invalidating in place.
- **Prompt-next-date UX restoration:** Wire `FollowUpModal` into `CompleteEventRowAction`; open only when completion payload has `prompt_next_date: true`; keep explicit `Not now` close path.
- **Schedule-now interim behavior:** Until dedicated scheduling endpoint exists, route `Schedule next date` to an existing actionable surface (`/items/:itemId/edit` or item detail) and document that behavior as v1.0 interim UX.
- **Verification artifact closure:** Create `.planning/phases/01-domain-model-foundation/01-VERIFICATION.md` from existing Phase 01 plans/summaries and fresh command outputs, then update milestone evidence references.

## Risk Areas

- If actor change only mutates `x-user-id` source without cache lifecycle updates, stale data remains until manual interaction (current blocker persists).
- If EVNT-03 modal is only rendered but not tested for both branches, regressions can re-open the requirement gap.
- If `Schedule next date` has no clear behavior, UX may pass technically but fail manual verification clarity.
- If Phase 01 verification is backfilled without rerunning core commands, audit evidence may be challenged as stale.
- If the "create all item types" flow remains unresolved while milestone flow score expects 3/3, milestone may still report `gaps_found`.

## Suggested Plan Split (2 Plans)

- **Plan 07-01 - Functional gap fixes (code + tests):**
  - Implement actor-switch query invalidation/removal on user change.
  - Wire completion success branch to `prompt_next_date` and render `FollowUpModal` correctly.
  - Define and implement `Schedule next date` action behavior.
  - Update/add frontend tests for actor-switch refresh and modal true/false branches.

- **Plan 07-02 - Verification and milestone evidence closure:**
  - Backfill `.planning/phases/01-domain-model-foundation/01-VERIFICATION.md` with requirements/evidence matrix.
  - Execute and record pending human-needed evidence for Phase 05 LAN and Phase 06 responsive+bilingual UX.
  - Re-run milestone audit and confirm EVNT-03 + flow blockers are closed (or explicitly documented if deferred).

## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| EVNT-03 | User receives `prompt_next_date: true` in completion response when completed event is non-recurring. | Backend already returns signal; Phase 7 must restore frontend branch handling and verification evidence so requirement is fully closed end-to-end. |

## Verification Commands

- Frontend regression scope:
  - `npm --prefix frontend run test -- dashboard-events-flow --runInBand`
  - `npm --prefix frontend run test -- items-workflows --runInBand`
- Backend EVNT/phase-1 evidence refresh:
  - `npm test -- test/api/events-complete.test.js --runInBand`
  - `npm test -- test/db/user-item-domain.test.js --runInBand`
  - `npm test -- test/db/event-audit-domain.test.js --runInBand`
  - `npm test -- test/db/domain-runtime-smoke.test.js --runInBand`
- Pending human verification evidence:
  - `docker compose up -d --build`
  - `docker compose ps`
  - From second LAN device: `curl http://<HOST_LAN_IP>:8080/health`
  - `npm --prefix frontend run dev` (manual responsive + bilingual + completion UX walkthrough)
