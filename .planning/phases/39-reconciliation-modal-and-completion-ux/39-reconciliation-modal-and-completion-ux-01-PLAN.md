---
phase: 39-reconciliation-modal-and-completion-ux
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/features/events/reconcile-ledger-action.tsx
  - frontend/src/locales/en/common.json
  - frontend/src/locales/zh/common.json
  - frontend/src/__tests__/reconcile-ledger-action.test.tsx
autonomous: true
requirements: [UX-02]
must_haves:
  truths:
    - "User gets a shadcn reconciliation surface with amount/date inputs before submission."
    - "Desktop uses centered dialog behavior and mobile uses bottom-sheet behavior."
    - "Validation and API failures stay inline without forcing users out of the reconciliation surface."
  artifacts:
    - path: "frontend/src/features/events/reconcile-ledger-action.tsx"
      provides: "Reusable reconciliation launcher + dialog/sheet form with mutation wiring"
      exports: ["ReconcileLedgerAction"]
    - path: "frontend/src/locales/en/common.json"
      provides: "English reconciliation labels, helper copy, validation, and error text"
      contains: "events.reconcile"
    - path: "frontend/src/locales/zh/common.json"
      provides: "Chinese reconciliation labels, helper copy, validation, and error text"
      contains: "events.reconcile"
    - path: "frontend/src/__tests__/reconcile-ledger-action.test.tsx"
      provides: "Behavior coverage for prefill, inline validation, and failure retry"
  key_links:
    - from: "frontend/src/features/events/reconcile-ledger-action.tsx"
      to: "/events/:id/complete"
      via: "apiRequest PATCH body includes actual_amount and actual_date when provided"
      pattern: "apiRequest<.*>\(`/events/\$\{eventId\}/complete`"
    - from: "frontend/src/features/events/reconcile-ledger-action.tsx"
      to: "frontend/src/components/ui/sheet.tsx"
      via: "mobile bottom-sheet rendering"
      pattern: "SheetContent"
---

<objective>
Create the reconciliation action component contract and UX primitives for phase 39.

Purpose: establish the shadcn-first reconciliation UI behavior (desktop + mobile) before wiring it into Upcoming rows.
Output: reusable `ReconcileLedgerAction` component, i18n copy, and focused tests proving dialog/sheet and inline failure behavior.
</objective>

<execution_context>
@C:/Users/bryan/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/bryan/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/39-reconciliation-modal-and-completion-ux/39-CONTEXT.md
@frontend/src/features/events/mark-paid-ledger-action.tsx
@frontend/src/features/events/log-historical-event-action.tsx
@frontend/src/features/ui/confirmation-dialog.tsx
@frontend/src/components/ui/sheet.tsx
@frontend/src/locales/en/common.json
@frontend/src/locales/zh/common.json

<interfaces>
From frontend/src/features/events/mark-paid-ledger-action.tsx:
```ts
type MarkPaidLedgerActionProps = {
  eventId: string
  itemId: string
  disabled?: boolean
  onSuccess: (payload: CompletionPayload) => void
}
```

From src/api/routes/events.routes.js and Phase 38 summary:
```ts
PATCH /events/:id/complete
Request body supports: { actual_amount?: number, actual_date?: string }
Server defaults omitted values to projected amount and today's date.
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add failing-first reconciliation action tests</name>
  <read_first>
    - frontend/src/features/events/mark-paid-ledger-action.tsx
    - frontend/src/features/events/log-historical-event-action.tsx
    - frontend/src/components/ui/sheet.tsx
    - frontend/src/locales/en/common.json
    - frontend/src/locales/zh/common.json
  </read_first>
  <files>frontend/src/__tests__/reconcile-ledger-action.test.tsx</files>
  <behavior>
    - Test 1: Reconcile action opens with projected amount and today's date prefilled.
    - Test 2: Clearing one or both fields still submits PATCH and omits cleared values from body so backend defaults apply.
    - Test 3: API failure keeps dialog/sheet open, shows inline error text, and allows retry without losing entered values.
    - Test 4: Mobile mode renders a bottom-sheet container with sticky action footer controls.
  </behavior>
  <action>Create `frontend/src/__tests__/reconcile-ledger-action.test.tsx` using Vitest + Testing Library. Mock `useAdminScope`, `useAuth`, `useToast`, and `apiRequest` patterns from existing event tests. Assert explicit labels and behavior with exact text: trigger `Reconcile`, pending label `Saving...`, retry label `Retry`, and inline error message path under `events.reconcile.failed`. For omitted fields, verify request body sent to `apiRequest` excludes `actual_amount` and/or `actual_date` keys rather than sending empty strings. Keep test data deterministic by stubbing current date to `2026-03-24`.</action>
  <verify>
    <automated>npm --prefix frontend test -- reconcile-ledger-action.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `frontend/src/__tests__/reconcile-ledger-action.test.tsx` exists and contains `describe('reconcile ledger action'`.
    - Test file asserts trigger text `Reconcile` and pending text `Saving...`.
    - Test file contains expectation that PATCH payload omits cleared fields (`not.toHaveProperty('actual_amount')` and `not.toHaveProperty('actual_date')`).
    - `npm --prefix frontend test -- reconcile-ledger-action.test.tsx` exits 0 after implementation tasks complete.
  </acceptance_criteria>
  <done>Failing-first reconciliation behavior tests are in place and verify prefill, omission defaults, inline errors, and mobile sheet affordance.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement reusable ReconcileLedgerAction component with dialog+sheet behavior</name>
  <read_first>
    - frontend/src/features/events/mark-paid-ledger-action.tsx
    - frontend/src/features/events/log-historical-event-action.tsx
    - frontend/src/features/ui/confirmation-dialog.tsx
    - frontend/src/components/ui/sheet.tsx
    - frontend/src/locales/en/common.json
    - frontend/src/locales/zh/common.json
  </read_first>
  <files>frontend/src/features/events/reconcile-ledger-action.tsx</files>
  <action>Create `ReconcileLedgerAction` with props `{ eventId, itemId, projectedAmount, projectedDate, disabled, onSuccess, onOpenChange? }`. Render trigger button label from `events.reconcile.button`. On click, open reconciliation surface and prefill local draft fields with projected amount formatted like `formatAmountInput` and date set to today's YYYY-MM-DD. Use shadcn `Dialog` on desktop and `Sheet` (`side="bottom"`) on small screens; include compact projected reference line and two inputs (amount/date). Keep cancellation silent (close only, no toast). During open or save pending, disable trigger actions by honoring `disabled` prop and expose `onOpenChange` callback for parent coordination. Submit via `apiRequest('/events/${eventId}/complete', { method: 'PATCH', body })`, only adding `actual_amount`/`actual_date` when non-empty. Preserve admin lens checks and `TargetUserChip` behavior from existing mark-paid action. Keep failures inline in the surface with retry support and no toast spam.</action>
  <verify>
    <automated>npm --prefix frontend test -- reconcile-ledger-action.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `frontend/src/features/events/reconcile-ledger-action.tsx` exports `ReconcileLedgerAction`.
    - Component imports both dialog primitives and sheet primitives, with `SheetContent` using `side="bottom"`.
    - PATCH request body construction conditionally includes `actual_amount` and `actual_date` only when draft values are present.
    - Inline error element is rendered in-component (contains `text-destructive` styling class) and dialog remains open on failure.
  </acceptance_criteria>
  <done>Reusable reconciliation action component exists with shadcn-consistent desktop/mobile behavior and backend-compatible payload semantics.</done>
</task>

<task type="auto">
  <name>Task 3: Add reconciliation i18n dictionary keys for EN and ZH</name>
  <read_first>
    - frontend/src/locales/en/common.json
    - frontend/src/locales/zh/common.json
    - frontend/src/features/events/mark-paid-ledger-action.tsx
  </read_first>
  <files>frontend/src/locales/en/common.json, frontend/src/locales/zh/common.json</files>
  <action>Add `events.reconcile` object in both locale files with concrete keys used by component: `button`, `pending`, `retry`, `title`, `helper`, `projectedReference`, `fields.amount`, `fields.date`, `errors.amountInvalid`, `errors.generic`, `submit`, and `cancel`. Keep `events.markPaid` keys unchanged for backward compatibility during rollout; do not remove existing keys in this plan.</action>
  <verify>
    <automated>npm --prefix frontend test -- reconcile-ledger-action.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `frontend/src/locales/en/common.json` contains `"reconcile"` under `"events"` with all required keys.
    - `frontend/src/locales/zh/common.json` contains matching `"events.reconcile"` key structure.
    - No missing-translation warnings appear while running reconciliation tests.
  </acceptance_criteria>
  <done>Locale dictionaries include all reconciliation labels and validation text required by the new component.</done>
</task>

</tasks>

<verification>
Run `npm --prefix frontend test -- reconcile-ledger-action.test.tsx` and confirm all reconciliation component tests pass.
</verification>

<success_criteria>
New reconciliation component is available, localized, and test-covered before page-level integration begins.
</success_criteria>

<output>
After completion, create `.planning/phases/39-reconciliation-modal-and-completion-ux/39-reconciliation-modal-and-completion-ux-01-SUMMARY.md`
</output>
