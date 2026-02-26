- [2026-02-26][09-10] `frontend npm run typecheck` fails in pre-existing files outside this task scope:
  - `frontend/src/pages/dashboard/dashboard-page.tsx` (`URLSearchParams` type mismatch around `lensParams` spreads)
  - `frontend/src/pages/events/events-page.tsx` (`URLSearchParams` type mismatch around `lensParams` spreads)
  These failures were observed during verification and were not modified by plan 09-10 changes.
- [2026-02-26][09-12] `frontend npm test -- src/__tests__/items-workflows.test.tsx --runInBand` fails in pre-existing test wiring outside this task scope:
  - `ItemSoftDeleteDialog` and `ItemEditPage` now require auth context (`useAuth`) and the suite does not wrap routes with `AuthProvider` or mock `useAuth`.
  - Failures reproduce before/without 09-12 task files and were only surfaced while running the plan's verification command.
