# Phase 18: Export Feedback UX and Audit Visibility - Research

**Researched:** 2026-03-03
**Domain:** Export UX state feedback + audit attribution visibility
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
### Failure recovery UX
- Failure messaging should prioritize a clear retry path.
- Error state should include a one-click retry action in the same UI context.
- Auth/session-related failures should include actionable re-auth guidance.
- Repeated failures should escalate guidance (for example: check connection, refresh session, then retry).

### Loading feedback behavior
- In-progress export feedback should appear inline near the export action.
- Export action should be disabled with a loading label while request is in progress.
- Long-running exports should keep a persistent "still working" hint.
- Loading state should clear when response completion is known (success or failure).

### Success confirmation style
- Success feedback should explicitly confirm export completion and download start.
- Use medium prominence confirmation (inline plus toast-level acknowledgement).
- In admin contexts, success messaging should include contextual attribution (actor/lens context).
- Success feedback should auto-dismiss after a brief readable interval.

### Audit history visibility
- Each export audit entry should include actor, lens context, and timestamp.
- Lens attribution should be shown as readable label plus stable ID.
- Audit visibility should use the existing audit history surface (no new export-only surface).
- Failed export attempts should be recorded with outcome status (not successes-only).

### Claude's Discretion
- Exact copy text for loading/success/failure states, as long as it remains actionable and trust-oriented.
- Exact duration values for brief auto-dismiss behavior.
- Exact visual emphasis patterns for inline vs toast confirmation while maintaining medium prominence.

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UXEX-02 | Export flow shows loading/progress, success, and actionable failure states. | Extend `useExportBackup` into explicit status machine (pending/success/failure classification), keep inline status in `UserSwitcher`, add toast acknowledgement path, and add long-running "still working" hint timer with retry guidance and re-auth copy for 401/session failures. |
| SECU-02 | Export actions are audit-visible with actor/lens attribution. | Write audit rows from `GET /exports/backup.xlsx` with actor/lens from `req.scope` for both success and failure outcomes, then expose those rows in the existing audit history UI with readable actor/lens labels plus stable IDs. |
</phase_requirements>

## Summary

Phase 14-17 already established the core export path: frontend `UserSwitcher` calls `useExportBackup` with a credentialed `GET /exports/backup.xlsx`, backend generates XLSX bytes in `createExportsRouter`, and current inline UX already shows basic pending/success/error states. So this phase is not a net-new export pipeline; it is trust UX hardening plus audit visibility completion.

The largest gap for UXEX-02 is not wiring but semantics: current failure handling is a single generic message, there is no long-running "still working" hint, and there is no toast-level success acknowledgement. The largest gap for SECU-02 is that export route currently writes no `AuditLog` rows, so export actions are invisible in audit history despite existing actor/lens attribution infrastructure elsewhere.

Primary recommendation: implement Phase 18 as two coordinated slices: (1) frontend export-feedback state machine (inline + toast + retry/re-auth guidance + escalation), and (2) backend export audit write + read-path visibility using existing audit surface patterns (no export-only page).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | `^5.90.21` | Export mutation state (`isPending`, `isSuccess`, `isError`) | Already used by `useExportBackup`; supports predictable async state transitions and retry suppression in tests. |
| `react-i18next` / `i18next` | `^16.5.4` / `^25.8.13` | Localized status and guidance text | Existing shell and activity messages are fully localized in `frontend/src/locales/*/common.json`. |
| `express` + `sequelize` | `^5.2.1` + `^6.37.5` | Export route + audit persistence | Existing route/auth/scope stack already computes actor/lens context and has `AuditLog` model + indexes. |
| `exceljs` | `^4.4.0` | Export generation runtime | Existing XLSX serializer already in production path; Phase 18 should not replace this. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest + RTL | `^4.0.18` + `^16.3.2` | Frontend behavior tests for pending/success/failure toasts and copy | Add/extend tests around `UserSwitcher` + hook behavior (`frontend/src/__tests__/user-switcher-export-action.test.tsx`). |
| Jest + Supertest | `^29.7.0` + `^7.2.2` | API integration tests for export audit writes | Extend `test/api/exports-backup-scope.test.js` (or add sibling file) to assert audit rows and attribution tuple. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Keep export UX in `UserSwitcher` + existing toast infra | Build a new export modal/page | Violates "no new export-only surface" direction and increases scope late in milestone. |
| Persist success/failure via separate outcome column | Encode outcome in `action` (`export.backup.succeeded` / `export.backup.failed`) | New DB column is heavier; action encoding is simpler and consistent with existing action taxonomy. |
| Rebuild audit system for exports | Reuse `AuditLog` + existing activity rendering patterns | Reuse reduces risk and aligns with SECU-02 timeline. |

**Installation:**
```bash
npm install && npm --prefix frontend install
```

## Architecture Patterns

### Recommended Project Structure
```text
frontend/src/features/export/
  use-export-backup.ts              # Expand to status classification + long-running hint

frontend/src/app/shell/
  user-switcher.tsx                 # Inline state + retry action + admin attribution copy

frontend/src/features/ui/
  toast-provider.tsx                # Extend to support export success/error acknowledgements

src/api/routes/
  exports.routes.js                 # Add audit write for success/failure outcomes

src/domain/audit/ (or existing domain module)
  [optional helper].js              # Shared export audit payload builder if needed

test/api/
  exports-backup-scope.test.js      # Add audit assertions

frontend/src/__tests__/
  user-switcher-export-action.test.tsx
```

### Pattern 1: Export Feedback State Machine at Hook Boundary
**What:** Keep fetch/download logic in `useExportBackup`, but return richer state: `phase` (`idle|pending|success|error`), `errorKind` (`network|session|server`), attempt count, and long-running flag after a timer threshold.
**When to use:** Every export trigger from `UserSwitcher`.
**Why:** Centralizes UX truth and avoids duplicating network classification in component render branches.

### Pattern 2: Dual-Channel Success Feedback (Inline + Toast)
**What:** Keep inline near button (`role="status"`) and add toast emission for medium-prominence confirmation. Auto-dismiss both on short timer; clear stale states on next click.
**When to use:** Successful export completion only.
**Why:** Matches locked decision for explicit trust signal that both completion and download start occurred.

### Pattern 3: Actionable Failure Ladder with Same-Context Retry
**What:** Keep alert inline next to export button with one-click retry. Classify 401/auth failures to include re-auth instruction; escalate copy on repeated failures.
**When to use:** Any failed export response or thrown fetch error.
**Why:** Satisfies actionable recovery and trust requirements without navigation/context switching.

### Pattern 4: Audit Write in Export Route with Outcome Coverage
**What:** In `GET /exports/backup.xlsx`, write audit row for success and failure attempts, using actor/lens tuple from `req.scope` (`actorUserId`, `lensUserId`, mode-aware lens fallback) and timestamp.
**When to use:** Every export request attempt.
**Why:** SECU-02 explicitly requires traceability of all export actions, including failures.

### Pattern 5: Audit Read with Human + Stable Attribution
**What:** For export audit history rendering, map actor/lens as readable label (`username || email`) plus stable ID (UUID). Include explicit all-data lens representation when `lens_user_id` is null and mode is all-data.
**When to use:** Existing audit history surface row rendering.
**Why:** Locked decision requires both human readability and machine-stable attribution.

### Anti-Patterns to Avoid
- **Only log successful exports:** violates locked requirement to record failed attempts.
- **Generic failure copy for all cases:** misses re-auth guidance and escalation path.
- **No timer-based long-running hint:** users lose trust during slow workbook generation.
- **Writing audit with `user_id` only:** drops lens context needed for admin traceability.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Async status orchestration | Manual promise flags across component state | React Query mutation state + small derived state in hook | Existing pattern already in place and test-proven. |
| Toast lifecycle | New ad hoc DOM toasts for export only | Extend existing `ToastProvider` | Centralized accessibility and dismissal behavior already exists. |
| Audit attribution model | Custom export-specific audit table | Existing `AuditLog` model with actor/lens fields | DB schema and indexes already support tuple persistence and lookup. |
| Scope resolution | Client-provided owner/lens overrides | Server-side `req.scope` from `requireAuth` | Maintains SCOP trust boundary and avoids spoofing. |

**Key insight:** this phase should compose existing primitives (React Query mutation state, toast provider, `req.scope`, `AuditLog`) rather than adding new surfaces or schemas.

## Common Pitfalls

### Pitfall 1: Pending State Clears Too Early
**What goes wrong:** Loading indicator resets before blob download and users can double-trigger export.
**Why it happens:** Pending lifecycle tied to click, not full mutation completion.
**How to avoid:** Bind disabled/loading strictly to mutation pending status; keep button disabled until promise resolves/rejects.
**Warning signs:** Duplicate fetches in tests after repeated click during pending.

### Pitfall 2: Session Expiry Looks Like Generic Network Failure
**What goes wrong:** User sees "try again" when they actually need to sign in again.
**Why it happens:** Raw fetch path does not classify HTTP status or emit session-expired UX event.
**How to avoid:** Classify `response.status === 401` and show re-auth guidance; optionally dispatch existing session-expired event for consistency.
**Warning signs:** 401 export tests assert generic connection copy.

### Pitfall 3: Missing Failed Export Audit Rows
**What goes wrong:** Audit history only shows completed exports and hides suspicious/problematic attempts.
**Why it happens:** Audit write occurs only after successful serialization/send.
**How to avoid:** Capture outcome in both success and catch path before response finalization.
**Warning signs:** Tests only assert `export.backup.succeeded` action presence.

### Pitfall 4: Lens Attribution Ambiguity in Admin All-Data Mode
**What goes wrong:** UI shows blank lens for null `lens_user_id`, making trace ambiguous.
**Why it happens:** owner-lens assumptions applied to all-data mode.
**How to avoid:** Render explicit lens label (e.g., "All users") while preserving stable lens ID semantics (null for all-data).
**Warning signs:** Activity rows display empty/unknown lens for admin-all export entries.

### Pitfall 5: Audit Surface Scope Ambiguity
**What goes wrong:** Export rows are persisted but not visible where users check history.
**Why it happens:** Existing audit UI is item-centric (`/items/:id/activity`) and export events are global.
**How to avoid:** Decide early how existing surface will include export rows (recommended: extend existing activity feed contract to include actor/lens-relevant export rows) and lock tests to that decision.
**Warning signs:** Backend tests pass for audit writes, frontend has no path to render `export.*` actions.

## Code Examples

Verified patterns from this repository:

### Existing export button state binding (current pattern)
```tsx
<button
  type="button"
  disabled={exportBackup.isPending}
>
  {exportBackup.isPending ? t('shell.exportingBackup') : t('shell.exportBackupAction')}
</button>
```
Source: `frontend/src/app/shell/user-switcher.tsx`

### Existing export trigger boundary (current pattern)
```ts
const mutation = useMutation<void, Error>({
  mutationFn: async () => {
    const response = await fetch(`${API_BASE_URL}/exports/backup.xlsx`, {
      method: 'GET',
      credentials: 'include',
    })
    if (!response.ok) throw new Error('Export failed...')
    const blob = await response.blob()
    triggerBrowserDownload(blob, filename)
  },
})
```
Source: `frontend/src/features/export/use-export-backup.ts`

### Existing audit attribution write shape (current pattern)
```js
await models.AuditLog.create({
  user_id: attribution.actorUserId,
  actor_user_id: attribution.actorUserId,
  lens_user_id: attribution.lensUserId,
  action: "event.completed",
  entity: `event:${event.id}`,
  timestamp: completedAt
}, { transaction });
```
Source: `src/domain/events/complete-event.js`

### Existing activity attribution render pattern (current pattern)
```tsx
{t('items.activity.attribution.tuple', {
  actor: getActorLabel(row),
  lens: getLensLabel(row),
})}
```
Source: `frontend/src/features/audit/item-activity-timeline.tsx`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Export endpoint returned JSON envelopes | Endpoint returns XLSX attachment bytes | Phase 16 | UX now depends on client download feedback quality, not JSON status payloads. |
| Basic export UX with inline pending/success/error | Pending/success/error exists but no long-running hint or differentiated recovery | Phase 16 baseline | UXEX-02 needs trust-focused refinement, not architectural rewrite. |
| Audit attribution infra absent in early schema | `AuditLog` now includes `actor_user_id` and `lens_user_id` with indexes | 2026-02-26 migration | SECU-02 can be completed by wiring export actions into existing model. |

**Deprecated/outdated for this phase:**
- Export failure copy that does not distinguish re-auth from connectivity.
- Assuming item-only actions are sufficient for audit history completeness.

## Open Questions

1. **Which exact existing audit history surface should render export rows?**
   - What we know: repository currently exposes item-centric history (`/items/:id/activity`) and no dedicated/global audit route.
   - What's unclear: whether product expectation is to inject export rows into that existing feed or another pre-existing admin history view outside current code snapshot.
   - Recommendation: default to extending current existing activity surface contract (no new export-only page), and lock with UI/API tests.

2. **How should all-data lens be displayed with stable ID semantics?**
   - What we know: admin all-data scope resolves `lensUserId` as `null` by design.
   - What's unclear: whether UI should display literal `null`, a sentinel label, or both label+token.
   - Recommendation: display readable label "All users" and preserve stable ID as `null` in payload.

3. **Should export route emit existing `SESSION_EXPIRED_EVENT` behavior?**
   - What we know: raw fetch in `useExportBackup` bypasses `apiRequest` and therefore bypasses automatic session-expired event dispatch.
   - What's unclear: desired UX parity with other authenticated GET calls.
   - Recommendation: either classify 401 in export hook with explicit re-auth CTA or migrate export request onto shared client utility while keeping blob handling.

## Sources

### Primary (HIGH confidence)
- Repository context: `.planning/phases/18-export-feedback-ux-and-audit-visibility/18-CONTEXT.md`
- Requirements: `.planning/REQUIREMENTS.md`
- Current state: `.planning/STATE.md`
- Frontend export flow: `frontend/src/features/export/use-export-backup.ts`, `frontend/src/app/shell/user-switcher.tsx`, `frontend/src/__tests__/user-switcher-export-action.test.tsx`
- Existing audit UI pattern: `frontend/src/features/audit/item-activity-timeline.tsx`, `frontend/src/__tests__/item-activity-attribution.test.tsx`
- Export API route: `src/api/routes/exports.routes.js`
- Scope/actor derivation: `src/api/auth/require-auth.js`, `src/api/auth/scope-context.js`
- Audit schema/model: `src/db/models/audit-log.model.js`, `src/db/migrations/20260226093000-expand-audit-log-actor-lens-attribution.js`
- Existing audit write patterns: `src/domain/events/complete-event.js`, `src/domain/items/create-item.js`

### Secondary (MEDIUM confidence)
- Existing backend export integration tests: `test/api/exports-backup-scope.test.js`

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all required libraries and patterns already exist in repository and are actively used.
- Architecture: MEDIUM - one product-surface decision (where export audit rows appear) remains to be locked for planning.
- Pitfalls: HIGH - failure modes are directly observable from current code paths/tests.

**Research date:** 2026-03-03
**Valid until:** 2026-04-02
