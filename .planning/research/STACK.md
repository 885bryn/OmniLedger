# Stack Research

**Domain:** HACT v3.0 data portability export stack deltas (server-side XLSX backup export)
**Researched:** 2026-03-01
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `exceljs` | 4.4.0 | Server-side XLSX workbook generation with multi-sheet output, styles, filters, and stream writing | Best fit for Node/Express because it supports formatting (`numFmt`, styles), worksheet UX features (`views` freeze panes, `autoFilter`), and stream/file/buffer output from one API. |
| `content-disposition` | 1.0.1 | RFC-compliant `Content-Disposition` header generation for safe download filenames | Handles Unicode + ASCII fallback safely for attachment filenames; avoids hand-rolled header bugs. |
| Node.js built-ins (`stream`, `Intl.DateTimeFormat`) | 22.x runtime (existing) | Backpressure-safe response streaming and locale/timezone-aware date text formatting | Keeps infra minimal: no new export worker or frontend export engine required for this milestone. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `luxon` | 3.7.2 | Explicit timezone conversion before writing date values/text | Use if event history exports must render a user-selected timezone (not just server timezone). |
| existing `express-session` + scope middleware | current | Reuse authenticated actor/scope for RBAC-correct export datasets | Required for admin all-data/owner-lens correctness in export endpoint authorization. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| existing `jest` + `supertest` | Verify RBAC and response headers/streaming behavior | Add integration tests for owner/admin/lens export matrix and header assertions. |
| `exceljs` (test-time readback) | Validate workbook shape and formatting in tests | Use to assert sheet names, header rows, frozen panes, filters, and column formats. |

## Integration Points (Explicit)

- Backend API: add `GET /exports/backup.xlsx` route under `src/api/routes` with `requireAuth`, then enforce scope via existing `req.scope` and domain query services.
- Backend domain: add export assembler service (for Assets, Financial Contracts, Event History) in `src/domain` that flattens records and writes workbook rows incrementally.
- Backend response delivery: set `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, set `Content-Disposition` using `content-disposition`, set `Cache-Control: no-store`, then stream workbook to `res`.
- Backend CORS: update `Access-Control-Allow-Headers` in `src/api/app.js` to include locale headers if used (for example `Accept-Language`, `X-Timezone`).
- Frontend: add export trigger using existing `fetch` wrapper patterns, but handle Blob download path (do not parse JSON for this endpoint) and show existing loading/toast UX.
- Frontend locale/timezone: send `Accept-Language` + timezone (IANA, e.g. `Asia/Taipei`) so server can produce locale-aware date text/format choices deterministically.

## Installation

```bash
# Required for v3.0 export
npm install exceljs@4.4.0 content-disposition@1.0.1

# Optional (only if explicit timezone conversion is needed server-side)
npm install luxon@3.7.2
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `exceljs` | `xlsx` (`sheetjs` CE) | Use `xlsx` if you only need raw data export and do not need rich styling UX; CE docs position advanced styling in Pro. |
| `exceljs` | `xlsx-populate` | Use `xlsx-populate` when template-preservation/editing existing files is the primary goal and memory footprint is acceptable. |
| `content-disposition` | `res.attachment(filename)` only | Use native Express helper only when filename charset edge cases are low risk and strict RFC handling is not required. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Client-side XLSX generation in React for this backup flow | Leaks full dataset to browser memory, weakens server RBAC boundary, and creates inconsistent admin-lens behavior. | Server-side generation in Node + authenticated download endpoint. |
| New infra for export jobs (Redis queue, object storage pipeline) in this milestone | Adds operational scope not required for on-demand backup download in current architecture. | In-request stream export over existing Express server. |
| Temporary file writes + `res.download(path)` for routine exports | Introduces cleanup race conditions and filesystem path-risk handling overhead. | Stream workbook directly to response (`workbook.xlsx.write(res)` or streaming writer). |
| Manual `Content-Disposition` string concatenation | Easy to mishandle Unicode/escaping and break downloads across clients. | `content-disposition` package or vetted Express helper usage. |

## Stack Patterns by Variant

**If export size is moderate (typical household dataset):**
- Use standard `ExcelJS.Workbook()` and `workbook.xlsx.write(res)`.
- Keep style features enabled (headers, `numFmt`, frozen top row, filters).

**If export size grows large (high-row event history):**
- Use `ExcelJS.stream.xlsx.WorkbookWriter` with row commits.
- Enable `useStyles: true` only for columns/sheets that need formatting to balance memory/perf.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `exceljs@4.4.0` | Node 18+ practical baseline | Project runtime is Node 22, so compatibility risk is low. |
| `content-disposition@1.0.1` | Current Express/Node | Stable utility used broadly in Express ecosystem. |
| `luxon@3.7.2` | Node 18+ / modern Intl | Safe optional add for timezone-explicit formatting logic. |

## Sources

- https://raw.githubusercontent.com/exceljs/exceljs/master/README.md - streaming writer, `write(stream)`, styles/`numFmt`, frozen views, and `autoFilter` capabilities (HIGH)
- https://expressjs.com/en/api.html - `res.attachment()` and `res.download()` behavior + file-path security notes (HIGH)
- https://github.com/jshttp/content-disposition - RFC-aware attachment filename handling and Unicode fallback behavior (HIGH)
- https://docs.sheetjs.com/docs/ - CE positioning: data processing focus; advanced styling called out in Pro messaging (MEDIUM)
- https://github.com/dtjohnson/xlsx-populate - template-edit focus and output APIs (`outputAsync`/`toFileAsync`) for tradeoff comparison (MEDIUM)
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat - locale/timezone formatting behavior for built-in date formatting (MEDIUM)
- npm versions verified via `npm view` on 2026-03-01: `exceljs` 4.4.0, `xlsx` 0.18.5, `xlsx-populate` 1.21.0, `content-disposition` 1.0.1, `luxon` 3.7.2, `date-fns-tz` 3.2.0 (HIGH)

---
*Stack research for: HACT v3.0 Data Portability export*
*Researched: 2026-03-01*
