---
phase: 39-reconciliation-modal-and-completion-ux
plan: 02
type: execute
wave: 2
depends_on: [39-reconciliation-modal-and-completion-ux-01]
files_modified:
  - frontend/src/pages/events/events-page.tsx
  - frontend/src/__tests__/events-ledger-page.test.tsx
  - frontend/src/__tests__/dashboard-events-flow.test.tsx
autonomous: false
requirements: [FLOW-06, UX-02]
must_haves:
  truths:
    - "User opens reconciliation from an Upcoming row using a Reconcile action instead of instant completion."
    - "Only one reconciliation interaction can be active at a time and other row actions stay disabled while open/saving."
    - "Completing reconciliation moves the row into History with existing acknowledgement/highlight behavior intact."
    - "User can verify the flow in desktop and mobile layouts before phase handoff."
  artifacts:
    - path: "frontend/src/pages/events/events-page.tsx"
      provides: "Upcoming row integration of ReconcileLedgerAction and one-active-flow coordination"
      contains: "ReconcileLedgerAction"
    - path: "frontend/src/__tests__/events-ledger-page.test.tsx"
      provides: "Ledger regression coverage for reconcile open/close/submit/failure behavior"
    - path: "frontend/src/__tests__/dashboard-events-flow.test.tsx"
      provides: "Dashboard-to-events completion flow assertions updated for Reconcile action"
  key_links:
    - from: "frontend/src/pages/events/events-page.tsx"
      to: "frontend/src/features/events/reconcile-ledger-action.tsx"
      via: "Upcoming row action component replacement"
      pattern: "<ReconcileLedgerAction"
    - from: "frontend/src/pages/events/events-page.tsx"
      to: "handleMarkPaidSuccess"
      via: "onSuccess callback preserves acknowledged -> history transition"
      pattern: "onSuccess=\{\(\) => handleMarkPaidSuccess\(event\)\}"
---

<objective>
Wire reconciliation into Upcoming ledger rows and close phase 39 with test + manual UX verification.

Purpose: satisfy FLOW-06 by replacing instant completion trigger behavior with explicit reconciliation launch while preserving the existing completion transition pipeline.
Output: integrated page behavior, regression test updates, and a blocking browser verification checkpoint for desktop/mobile usability.
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
@.planning/phases/39-reconciliation-modal-and-completion-ux/39-reconciliation-modal-and-completion-ux-01-SUMMARY.md
@frontend/src/pages/events/events-page.tsx
@frontend/src/__tests__/events-ledger-page.test.tsx
@frontend/src/__tests__/dashboard-events-flow.test.tsx

<interfaces>
From frontend/src/pages/events/events-page.tsx:
```ts
const handleMarkPaidSuccess = (event: EventRow) => {
  // acknowledged -> history transition with timer and highlight
}
```

From plan 39-01 output contract:
```ts
type ReconcileLedgerActionProps = {
  eventId: string
  itemId: string
  projectedAmount: number | null
  projectedDate: string
  disabled?: boolean
  onSuccess: (payload: { id: string; status: string; completed_at: string | null }) => void
  onOpenChange?: (open: boolean) => void
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Replace Upcoming row action with ReconcileLedgerAction and single-active-flow coordination</name>
  <read_first>
    - frontend/src/pages/events/events-page.tsx
    - frontend/src/features/events/reconcile-ledger-action.tsx
    - frontend/src/features/events/mark-paid-ledger-action.tsx
    - .planning/phases/39-reconciliation-modal-and-completion-ux/39-CONTEXT.md
  </read_first>
  <files>frontend/src/pages/events/events-page.tsx</files>
  <behavior>
    - Test 1: Upcoming rows show `Reconcile` action label instead of `Mark Paid`.
    - Test 2: Opening one row's reconciliation flow disables other rows' reconcile actions until closed or saved.
    - Test 3: Successful reconcile still triggers existing acknowledged card and history highlight transitions.
    - Test 4: Canceling/closing the reconciliation surface leaves row status unchanged and creates no cancellation status text.
  </behavior>
  <action>Import and use `ReconcileLedgerAction` in Upcoming row rendering, replacing `MarkPaidLedgerAction`. Pass `eventId`, `itemId`, `projectedAmount={event.amount}`, and `projectedDate={event.due_date}`. Add page-level state (e.g., `activeReconcileEventId`) to ensure one reconciliation flow at a time. For each row, compute `disabled` as existing disabled conditions OR another row being active OR that row currently pending acknowledgement/history sync. Wire `onOpenChange` to set/clear the active row id. Keep `onSuccess={() => handleMarkPaidSuccess(event)}` so transition behavior remains unchanged. Do not alter History tab rendering or timer durations.</action>
  <verify>
    <automated>npm --prefix frontend test -- events-ledger-page.test.tsx dashboard-events-flow.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `frontend/src/pages/events/events-page.tsx` no longer imports `MarkPaidLedgerAction` and imports `ReconcileLedgerAction` instead.
    - Upcoming row renderer contains `<ReconcileLedgerAction` with `projectedAmount` and `projectedDate` props.
    - File contains state variable guarding one active reconcile flow (e.g., `activeReconcileEventId`).
    - Existing `handleMarkPaidSuccess` function remains present and is still invoked from action `onSuccess`.
  </acceptance_criteria>
  <done>Upcoming rows launch reconciliation-first completion with one-active-flow safety and preserved completion transitions.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Update ledger and dashboard regression tests for reconciliation launch behavior</name>
  <read_first>
    - frontend/src/__tests__/events-ledger-page.test.tsx
    - frontend/src/__tests__/dashboard-events-flow.test.tsx
    - frontend/src/pages/events/events-page.tsx
    - frontend/src/features/events/reconcile-ledger-action.tsx
  </read_first>
  <files>frontend/src/__tests__/events-ledger-page.test.tsx, frontend/src/__tests__/dashboard-events-flow.test.tsx</files>
  <action>Replace tests that click `Mark Paid` with reconciliation flow steps: click `Reconcile`, assert reconciliation surface opens, submit via reconcile confirm action, then validate existing history transition results. Add assertions for single-active behavior (other rows' `Reconcile` buttons disabled while one dialog/sheet open). Add assertion that close/cancel leaves row in Upcoming unchanged with no extra cancellation message text. Keep existing API mocks and adjust PATCH payload expectations to include `actual_amount` and `actual_date` when edited and omit when cleared. Preserve all non-reconciliation coverage in these files.</action>
  <verify>
    <automated>npm --prefix frontend test -- events-ledger-page.test.tsx dashboard-events-flow.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `frontend/src/__tests__/events-ledger-page.test.tsx` contains `Reconcile` button queries and no `Mark Paid` query usage.
    - Tests include at least one assertion confirming other row action is disabled while reconciliation is active.
    - `frontend/src/__tests__/dashboard-events-flow.test.tsx` flow still verifies no follow-up scheduling modal appears after completion.
    - `npm --prefix frontend test -- events-ledger-page.test.tsx dashboard-events-flow.test.tsx` exits 0.
  </acceptance_criteria>
  <done>Regression suite enforces reconciliation-first behavior and guards against regressions in completion transition UX.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Manual browser verification gate for desktop and mobile reconciliation UX</name>
  <action>Execute the integrated reconciliation flow in a real browser after Tasks 1-2 pass automation, confirm desktop and mobile usability, and explicitly gate phase completion before Phase 40 begins.</action>
  <what-built>Upcoming rows now launch reconciliation dialog/sheet with one-active-flow behavior and preserved completion transition.</what-built>
  <how-to-verify>
    1) Run `npm --prefix frontend dev` and open `/events` in desktop width.
    2) In Upcoming, click `Reconcile` on one row and confirm: projected context visible, amount/date fields prefilled, and another row's `Reconcile` action is disabled while open.
    3) Edit amount/date and submit; confirm row acknowledges then appears in History without page reload.
    4) Re-open on another row, click cancel/close; confirm row remains in Upcoming and no cancellation toast/message appears.
    5) Switch to mobile viewport (or device emulator), open `Reconcile`; confirm bottom-sheet presentation and sticky footer keep submit/cancel reachable while scrolling and keyboard is open.
  </how-to-verify>
  <verify>
    <automated>npm --prefix frontend test -- events-ledger-page.test.tsx dashboard-events-flow.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - Desktop reconciliation flow is usable end-to-end with no blocked controls.
    - Mobile bottom-sheet keeps primary actions reachable while keyboard is open.
    - User response captured as `approved` or issue list for follow-up.
  </acceptance_criteria>
  <done>Manual verification approval is recorded and phase handoff is blocked until `approved` is received or issues are logged for follow-up.</done>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
Automated: `npm --prefix frontend test -- events-ledger-page.test.tsx dashboard-events-flow.test.tsx`.
Manual gate: desktop + mobile browser run-through approved by user before phase 40 planning.
</verification>

<success_criteria>
FLOW-06 and UX-02 are both demonstrably covered: reconciliation launch replaces instant completion, shadcn UX works on desktop/mobile, and completion transition remains stable.
</success_criteria>

<output>
After completion, create `.planning/phases/39-reconciliation-modal-and-completion-ux/39-reconciliation-modal-and-completion-ux-02-SUMMARY.md`
</output>
