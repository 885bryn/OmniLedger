- [2026-02-26][09-10] `frontend npm run typecheck` fails in pre-existing files outside this task scope:
  - `frontend/src/pages/dashboard/dashboard-page.tsx` (`URLSearchParams` type mismatch around `lensParams` spreads)
  - `frontend/src/pages/events/events-page.tsx` (`URLSearchParams` type mismatch around `lensParams` spreads)
  These failures were observed during verification and were not modified by plan 09-10 changes.
