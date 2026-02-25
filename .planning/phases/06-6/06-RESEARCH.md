# Phase 6: 6 - Research

**Researched:** 2026-02-25
**Domain:** React + shadcn/ui frontend application for HACT dashboard/items/events/completion workflows
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
### Core user journeys and navigation
- Default landing is a portfolio dashboard.
- Mandatory v1 pages: Dashboard, Items, and Events.
- Primary home action emphasizes completing due events.
- Event completion happens inline in list views.
- Use a simple user switcher for active user context in local/dev workflows.
- Primary navigation uses a left sidebar.
- Item net-status opens on a dedicated item detail page.
- Item creation uses a step-by-step wizard.
- Target responsive web (desktop + mobile), not separate apps.
- For non-recurring completion with `prompt_next_date: true`, show an immediate follow-up modal with a clear option to skip scheduling.
- Dashboard/events prioritize nearest due first.
- v1 supports soft delete with confirmation.
- First-run no-data experience uses a guided empty state with CTA.
- Dashboard includes high-level financial summary cards.
- Item detail uses tabbed sections.
- Successful event completion shows inline success with refreshed row/state.

### Visual direction
- Visual style: modern finance dashboard.
- Data screens use medium density for scanability.
- Color strategy: neutral base with status-driven accents (overdue/completed/risk emphasis).
- Component shape language: soft corners with subtle depth.

### Data interaction model
- Item editing uses dedicated form-based edit pages.
- Commitment creation requires selecting parent asset in wizard flow.
- Net-status presentation: summary cards + linked child commitment list.
- Include a basic audit/activity history section in Phase 6 UI.

### State feedback behavior
- Use skeleton loading on major views.
- Empty states are action-oriented with explicit next steps.
- API errors show inline field/page messaging with top-level summary.
- Mutations use confirm-then-refresh behavior (no optimistic default).

### List controls
- Items default sort: recently updated.
- Filters: quick filter chips for common conditions.
- Search: debounced live search.
- Events view: grouped-only experience (no grouped/flat toggle in v1).

### Language and terminology behavior
- Entire UI supports English and Mandarin Chinese with a global header language switcher.
- Language labels: `English | 中文`.
- Language switch applies immediately without reload.
- Missing translations fall back to English.
- User-entered data values are never translated (addresses, vehicle names, subscription names, descriptions, etc.).

### Safeguards and confirmations
- Soft delete uses a simple confirm modal.
- Event completion is one-click (no always-on confirm).
- Navigating away from dirty forms triggers an unsaved-changes warning.
- Follow-up modal defaults to scheduling focus while allowing a clear "Not now" skip.

### Frontend stack preference
- Frontend stack preference is React with shadcn/ui for component foundation.

### Claude's Discretion
- Exact component-level spacing, typography scales, and animation timing.
- Exact chip/filter control visuals and iconography.
- Exact wording variations as long as meaning and bilingual behavior stay aligned.

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope.
</user_constraints>

## Summary

Phase 6 is a net-new frontend delivery phase on top of an API-first backend. The repository currently exposes only `POST /items`, `GET /items/:id/net-status`, `PATCH /events/:id/complete`, and `GET /health` (`src/api/routes/items.routes.js`, `src/api/routes/events.routes.js`, `src/api/app.js`). That means full Dashboard/Items/Events/create-edit-delete flows cannot be completed by UI code alone unless Phase 6 also plans endpoint additions or a temporary local data strategy.

Given the locked decisions, planning should treat this as an app-shell + workflow orchestration phase: responsive left-sidebar navigation, event-first dashboard, inline event completion with follow-up modal behavior, items wizard + edit pages, and consistent loading/error/empty states. The implementation should standardize around React + Vite + shadcn/ui, with React Router for page topology, TanStack Query for server state, React Hook Form + Zod for form workflows, and react-i18next for immediate language switching and English fallback.

The biggest execution risk is API-surface mismatch: UI requirements include list/filter/search/sort/grouping/activity history and soft-delete workflows that do not currently have documented endpoints. Plan 1 should lock the frontend architecture and API client contract; Plan 2 should either (a) implement missing backend endpoints in-phase, or (b) explicitly narrow the UI to currently available API capabilities.

**Primary recommendation:** Plan Phase 6 as a coordinated frontend + API contract phase, with React/shadcn/ui app shell and strict server-state/form/i18n patterns, while explicitly closing missing endpoint gaps before page-level implementation.

## Standard Stack

### Core
| Library/Tool | Version | Purpose | Why Standard |
|--------------|---------|---------|--------------|
| React | 19.x | UI runtime and component model | Required by locked stack preference; current React docs explicitly deprecate Create React App and push framework/modern tooling paths. |
| Vite | 7.x (docs show 7.3.1) | Frontend dev server and build | Fast local loop; standard React template bootstrap; good fit for single SPA with API backend. |
| TypeScript | 5.x | Type-safe UI/domain contracts | Reduces form and API payload drift in a workflow-heavy dashboard UI. |
| shadcn/ui | latest CLI/components | Component foundation | Locked decision; provides Sidebar/Skeleton/Form patterns directly aligned with required UX behaviors. |
| Tailwind CSS | 4.2 | Styling system and design tokens | Works directly with shadcn/ui install flow and supports fast responsive dashboard implementation. |

### Supporting
| Library/Tool | Version | Purpose | When to Use |
|--------------|---------|---------|-------------|
| react-router | 7.x | SPA routing and page shells | Use for Dashboard/Items/Events/detail/edit/wizard routes. |
| @tanstack/react-query | 5.x | Server-state caching, loading, and invalidation | Use for list/detail fetches, completion mutation refresh, and grouped event views. |
| react-hook-form | 7.x | Form state/performance | Use for item wizard and edit forms with dirty-state tracking. |
| zod + @hookform/resolvers | 4.x + latest | Schema validation for form input | Use to validate wizard/edit steps before API mutations. |
| i18next + react-i18next | latest | Bilingual UI and runtime language switching | Use for immediate `English | 中文` switching with English fallback. |
| date-fns | 3.x | Date sorting/grouping/formatting | Use for nearest-due ordering and event grouping labels. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Router | TanStack Router | Strong option, but React Router has simpler adoption path and broad docs for plain SPA mode. |
| TanStack Query | SWR | SWR is simpler, but Query gives stronger mutation/invalidation patterns for multi-page workflow coordination. |
| React Hook Form + Zod | Formik + Yup | Functional, but RHF integrates directly with shadcn examples and has better rerender profile on larger forms. |

**Installation:**
```bash
npm install react-router @tanstack/react-query react-hook-form zod @hookform/resolvers i18next react-i18next date-fns
```

## Architecture Patterns

### Recommended Project Structure
```text
frontend/
|- src/
|  |- app/
|  |  |- router.tsx                  # route tree and layout wiring
|  |  |- providers.tsx               # QueryClient, i18n, theme/app providers
|  |  `- shell/
|  |     |- app-shell.tsx            # left sidebar + global header
|  |     `- language-switcher.tsx    # English | 中文 immediate switch
|  |- pages/
|  |  |- dashboard/
|  |  |- items/
|  |  |  |- item-list-page.tsx
|  |  |  |- item-detail-page.tsx     # tabbed detail sections
|  |  |  |- item-create-wizard/
|  |  |  `- item-edit-page.tsx
|  |  `- events/
|  |- features/
|  |  |- events/                     # completion row actions + follow-up modal
|  |  |- items/                      # filters, chips, debounced search
|  |  `- audit/                      # activity history widgets
|  |- lib/
|  |  |- api-client.ts               # fetch wrapper + x-user-id + error mapping
|  |  |- query-keys.ts
|  |  |- i18n.ts                     # fallbackLng: 'en'
|  |  `- formatters.ts               # locale-aware number/date formatting
|  `- components/ui/                 # shadcn generated components
```

### Pattern 1: App Shell + Route-Scoped Workflows
**What:** One persistent left-sidebar shell with route-level pages for Dashboard, Items, Events, plus detail/edit/wizard subroutes.
**When to use:** Entire phase.
**Why:** Matches locked navigation decision and keeps mobile/desktop consistency.

### Pattern 2: Server-State First UI
**What:** Use Query for all remote reads/mutations; invalidate/refetch after successful mutations (confirm-then-refresh, non-optimistic default).
**When to use:** All list/detail and completion actions.
**Why:** Directly matches required mutation behavior and success-state refresh semantics.

### Pattern 3: Canonical API Adapter Layer
**What:** Centralize headers (`x-user-id`), response mapping, and issue-envelope parsing in one client layer.
**When to use:** Every network call.
**Why:** Existing API has category-based error envelopes; central mapping avoids page-level duplication.

### Pattern 4: Form Wizard + Dirty Guard
**What:** RHF + Zod multi-step wizard for item creation and single-page edit forms, with route leave warnings on dirty state.
**When to use:** Item create/edit flows.
**Why:** Locked decisions require wizard flow and unsaved-changes warning.

### Anti-Patterns to Avoid
- **Page-level fetch logic without shared query keys:** causes stale/inconsistent post-mutation state.
- **Manual translation inline in components:** risks missing fallback behavior and untranslated UI drift.
- **One-off local state for API errors:** breaks consistent issue-envelope rendering.
- **Optimistic mutation defaults:** violates explicit confirm-then-refresh decision.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Server caching/invalidation | Custom fetch cache store | TanStack Query | Handles stale data, retries, invalidation, and loading lifecycle correctly. |
| Complex form orchestration | Ad-hoc `useState` form trees | React Hook Form + Zod | Better performance and validation consistency for multi-step/edit workflows. |
| i18n fallback resolution | Manual `if/else` language maps | i18next/react-i18next with `fallbackLng: 'en'` | Native fallback and runtime language switching are already solved. |
| Accessible modal/sheet/dropdown behavior | Custom focus-trap + keyboard logic | shadcn/Radix primitives | Prevents accessibility regressions and interaction edge-case bugs. |
| Date grouping/sorting math | Manual timezone/date parsing helpers | date-fns | Reduces timezone/sorting bugs in nearest-due/grouped event lists. |

**Key insight:** Phase 6 complexity is orchestration and consistency, not raw component authoring; using ecosystem primitives prevents slow, bug-prone custom infrastructure.

## Common Pitfalls

### Pitfall 1: Planning UI pages without endpoint coverage
**What goes wrong:** Dashboard/Items/Events screens are built, but key actions cannot be wired.
**Why it happens:** Current API surface is narrower than Phase 6 UX scope.
**How to avoid:** Start with an endpoint contract matrix (required vs existing) before UI implementation tasks.
**Warning signs:** Placeholder data hooks, TODO network calls, or disabled CTAs in core journeys.

### Pitfall 2: Breaking bilingual guarantees with mixed translation boundaries
**What goes wrong:** Labels switch language, but parts of UI remain stale or user-entered values get incorrectly translated.
**Why it happens:** No strict split between UI string keys and raw user data fields.
**How to avoid:** Translate only static interface text; treat user-entered values as opaque content.
**Warning signs:** Address/vehicle text appearing translated or partially localized.

### Pitfall 3: Incorrect due-date prioritization
**What goes wrong:** Dashboard/events show wrong order for nearest due items.
**Why it happens:** Mixed date formats, timezone assumptions, or client-side unstable sorting.
**How to avoid:** Normalize dates at adapter boundary and apply one deterministic comparator for due ordering.
**Warning signs:** Order changes after reload or differs between pages.

### Pitfall 4: Inconsistent completion feedback and modal trigger behavior
**What goes wrong:** Completion succeeds but row state does not refresh, or follow-up modal appears at wrong times.
**Why it happens:** Mutation success path does not consistently invalidate and branch on payload flags.
**How to avoid:** Centralize completion mutation handler using API payload contract (`prompt_next_date`) and shared UI feedback utility.
**Warning signs:** Duplicate toasts, stale completed rows, or modal appearing for non-target scenarios.

### Pitfall 5: Overly custom responsive shell
**What goes wrong:** Sidebar/mobile behavior becomes brittle across breakpoints.
**Why it happens:** Rebuilding shell mechanics from scratch.
**How to avoid:** Use shadcn Sidebar provider/trigger structure and only theme tokens/spacing.
**Warning signs:** Keyboard shortcut/focus/collapse inconsistencies between desktop and mobile.

## Code Examples

Verified patterns from official sources:

### React Router app bootstrap
```tsx
// Source: https://reactrouter.com/start/declarative/installation
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./app";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
```

### i18n runtime language switch + fallback
```ts
// Sources:
// - https://react.i18next.com/latest/usetranslation-hook
// - https://www.i18next.com/principles/fallback
import i18next from "i18next";

i18next.init({
  fallbackLng: "en"
});

// in a component
// const { i18n } = useTranslation();
// i18n.changeLanguage("zh");
```

### shadcn sidebar shell composition
```tsx
// Source: https://ui.shadcn.com/docs/components/sidebar
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main>
        <SidebarTrigger />
        {children}
      </main>
    </SidebarProvider>
  );
}
```

### TanStack Query provider baseline
```tsx
// Source: https://tanstack.com/query/latest/docs/framework/react/overview
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Backend-only delivery (no UI runtime) | Full SPA frontend shell + workflows | Phase 6 | Requires frontend build/runtime, design tokens, and route architecture decisions. |
| Endpoint-by-endpoint backend evolution | UX-journey-driven client + API contract planning | Phase 6 | Forces early contract mapping to avoid blocked pages/actions. |
| Single-language operational responses | Bilingual UI with runtime switch and fallback | Phase 6 | Requires centralized i18n strategy and strict translation boundaries. |

**Deprecated/outdated:**
- Treating frontend as "just templates" without server-state architecture.
- Implementing workflow pages before confirming API contract completeness.

## Open Questions

1. **Which API endpoints (list/edit/delete/events/activity/users) are in-scope for Phase 6?**
   - What we know: Current routes are limited to create item, net-status detail, complete event, and health.
   - What's unclear: Whether missing endpoints should be added in this phase or mocked/deferred.
   - Recommendation: Add a Phase 6 API contract appendix and treat missing endpoints as first-class tasks in Plan 1.

2. **What is the canonical actor source for user switcher options?**
   - What we know: Backend currently uses `x-user-id` header for actor context.
   - What's unclear: No documented user-list endpoint for populating local/dev user switcher.
   - Recommendation: Add a minimal user lookup/list contract or a deterministic dev fixture strategy.

3. **Soft delete contract details (entity scope + recoverability) are unspecified.**
   - What we know: UI must support soft delete with confirmation.
   - What's unclear: Which records are soft-deletable and what API semantics are expected.
   - Recommendation: Define API behavior and list refresh consequences before implementing delete UX.

4. **Activity history source for item detail is unspecified.**
   - What we know: Phase 6 UI must include basic audit/activity history section.
   - What's unclear: No endpoint currently exposes activity timeline payloads.
   - Recommendation: Define minimal read API for activity history in same phase scope.

## Sources

### Primary (HIGH confidence)
- `C:/Users/bryan/Documents/Opencode/House ERP/.planning/phases/06-6/06-CONTEXT.md` - locked UX, stack, and behavior decisions.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/api/routes/items.routes.js` - current item route surface.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/api/routes/events.routes.js` - current event route surface.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/api/app.js` - shared error-envelope handling and mounted routers.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/api/errors/http-error-mapper.js` - API error contract shape and categories.
- `https://reactrouter.com/start/declarative/installation` - BrowserRouter install/bootstrap pattern.
- `https://ui.shadcn.com/docs/installation/vite` - shadcn with Vite/Tailwind setup.
- `https://ui.shadcn.com/docs/components/sidebar` - left-sidebar shell and provider structure.
- `https://ui.shadcn.com/docs/components/skeleton` - skeleton loading component pattern.
- `https://tailwindcss.com/docs/installation/using-vite` - Tailwind Vite plugin setup.
- `https://react.i18next.com/latest/usetranslation-hook` - runtime language switch API.
- `https://www.i18next.com/principles/fallback` - fallback language behavior.

### Secondary (MEDIUM confidence)
- `https://vite.dev/guide/` - current Vite major/version and scaffold guidance.
- `https://tanstack.com/query/latest/docs/framework/react/overview` - Query provider and server-state model guidance.
- `https://react-hook-form.com/get-started` - form integration and validation patterns.
- `https://react.dev/learn/installation` - current React installation guidance and CRA deprecation note.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - official docs verify tools and setup patterns; exact package pinning intentionally left as major-line guidance.
- Architecture: HIGH - directly constrained by locked decisions and verified current backend/API code surface.
- Pitfalls: HIGH - derived from explicit mismatch between required UX scope and currently implemented endpoints/contracts.

**Research date:** 2026-02-25
**Valid until:** 2026-03-18
