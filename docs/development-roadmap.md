# Finance Tracker — Master Development Roadmap

This document coordinates both packages. Use it to decide **what to work on next**.
Detailed implementation notes live in the package-level roadmaps:

- Backend: [`packages/backend/docs/development-roadmap.md`](../packages/backend/docs/development-roadmap.md)
- Frontend: [`packages/frontend/docs/development-roadmap.md`](../packages/frontend/docs/development-roadmap.md)

---

## Phase Status

| Phase | Backend | Frontend | Status |
|-------|---------|----------|--------|
| **1** | DB Setup + Users Module | — | ✅ Complete |
| **2** | Authentication Module | Auth UI (Login / Register) | ✅ Complete |
| **3** | Secure Users Module | User Profile Management | ✅ Complete |
| **4** | Transactions Module | Transactions UI | ✅ Complete |
| **5** | Categories Module | Categories UI | ✅ Complete |
| **6** | Accounts Module | Accounts UI | ✅ Complete |
| **7** | Transaction Import & Automated Sync | Import & Sync UI | 🟨 Partially Complete |
| **8** | Phase 7 carry-overs | — | 🟨 In Progress (2/4 done) |
| **9** | — | Dashboard & UX Redesign (sidebar, Settings, navigation, layout) | ⬜ Not Started |
| **10** | MCP Server | MCP App UIs | ⬜ Not Started |
| **11** | Reports Module *(optional)* | Analytics Views | ⬜ Not Started |

---

## Phase Dependencies

```
Backend Phase 1 (DB + Users)
        │
        ▼
Backend Phase 2 (Auth) ──────────────► Frontend Phase 1 (Auth UI)
        │                                       │
        ▼                                       ▼
Backend Phase 3 (Secure Users) ──────► Frontend Phase 2 (Profile)
        │                                       │
        ▼                                       ▼
Backend Phase 4 (Transactions) ──────► Frontend Phase 3 (Transactions UI)
        │                                       │
        ▼                                       ▼
Backend Phase 5 (Categories) ────────► Frontend Phase 5 (Categories UI)
Backend Phase 6 (Accounts) ──────────► Frontend Phase 6 (Accounts UI)
Backend Phase 7 (Import/Sync) ───────► Frontend Phase 7 (Import & Sync UI)
        │                                       │
        ├─ File import (CSV/OFX)               ├─ FileImportDropzone
        ├─ Scraper + scheduler                 ├─ SyncScheduleForm
        ├─ SSE live status                     ├─ SyncStatusPanel + useSyncStream
        ├─ MFA worker bridge                   ├─ MfaModal (in-app)
        └─ Web Push + email notifications      └─ /mfa page + service worker
                                                
Backend Phase 8 (Carry-overs)
                                       Phase 9 (Dashboard & UX Redesign)
                                        ├─ Main dashboard / home page
                                        ├─ Sidebar navigation
                                        ├─ Settings page
                                        └─ Feature placement / IA decisions
Backend Phase 10 (MCP Server) ───────► Frontend Phase 10 (MCP App UIs)
Backend Phase 11 (Reports) ──────────► Frontend Phase 11 (Analytics Views)
```

> **Rule:** Frontend can start 1–2 days after the corresponding backend phase reaches a stable Swagger spec. Use MSW mocks in the meantime.

---

## Agent Workflow

Seven agents are available under `.github/agents/`. Use them in this sequence for each phase.

### Step 1 — Plan (always first)

Invoke the **`planner`** agent:

```
@planner Plan Phase 5: Categories module — both backend and frontend.
Research the existing patterns in the transactions/ feature and produce a
full implementation plan including Prisma schema, API contract, DTOs,
frontend components, hooks, and test strategy.
```

The planner **never edits files** — it only produces a step-by-step plan. Review it, then proceed.

### Step 2 — Backend implementation

Hand off to **`backend-dev`** using the planner's output:

```
@backend-dev Implement the plan above for the Categories backend module.
Follow all backend conventions (# aliases, ESM .js extensions, Prisma, Vitest).
```

Backend checklist (from the package roadmap):
- [ ] Prisma schema updated + migration created
- [ ] Module / controller / service / DTOs implemented
- [ ] `app.module.ts` updated
- [ ] Swagger decorators on all endpoints and DTOs
- [ ] Unit tests passing (`npm test` in `packages/backend`)
- [ ] Zero lint errors (`npm run lint`)

### Step 3 — Backend unit tests

Hand off to **`test-writer`** immediately after backend implementation:

```
@test-writer Write comprehensive Vitest tests for the [feature] backend module
just implemented. Cover all service methods (happy path + error paths) and
controller endpoints.
```

### Step 4 — Backend API testing

Hand off to **`backend-tester`** once unit tests pass to validate the live running API:

```
@backend-tester Run the backend API test plan from test-plan/[feature]/implementation-plan.md
against the running server. Cover all endpoints, auth guards, validation errors,
and edge cases. Save the plan to test-plan/[feature]/backend.md and the
report to test-plan/[feature]/backend-report.md.
```

Apply any bugs found via `@backend-dev` → "Fix Failing Tests" handoff before proceeding.

### Step 5 — Backend code review

Hand off to **`code-reviewer`** once API tests pass:

```
@code-reviewer Review the backend changes for the [feature] module in
packages/backend. Check conventions, TypeScript quality, security, Prisma
query efficiency, and test coverage.
```

Apply any critical fixes via `@backend-dev` → "Apply Fixes" handoff.

### Step 6 — Backend commits

**Commit per task/section**, not once at the end of the phase. Each task that produces a working, tested unit of code gets its own commit. Tests are included in the same commit as the code they cover.

Hand off to **`backend-dev`** after each task clears review:

```
@backend-dev Commit the Prisma schema + migration for Phase 5 now that it
is reviewed and clean. Use the commit format from copilot-instructions.md.
```

Example sequence for a categories backend phase:

```
feat(backend): add categories prisma schema and migration
feat(backend): add categories service and DTOs with unit tests
feat(backend): add categories controller and module registration
feat(backend): link transactions to categories via optional FK
```

Each commit message body follows the `copilot-instructions.md` format: what changed, file counts, test count. Scope `(backend)` in the summary keeps `git log packages/backend/` clean.

---

### Step 7 — Regenerate API client

Once the backend commit is merged, regenerate the Orval client in the frontend:

```bash
cd packages/frontend && npm run generate:api
```

This updates `src/api/` with typed React Query hooks and DTO types for the new endpoints.

### Step 8 — Frontend implementation

Hand off to **`frontend-dev`**:

```
@frontend-dev Implement the [feature] UI based on the plan above.
The backend is complete and the Orval client has been regenerated.
Use generated hooks from src/api/[feature]/ — do not hand-write fetch calls.
```

Frontend checklist:
- [ ] Page component + route registered
- [ ] Feature components / hooks / types created
- [ ] Uses Orval-generated hooks (no manual fetch calls)
- [ ] DTO types imported from `src/api/model/` (not redefined)
- [ ] Dev server starts without errors
- [ ] Page opens in Simple Browser without blank screen
- [ ] Zero TypeScript errors (`get_errors`)
- [ ] Zero ESLint warnings (`npx eslint <file> --max-warnings 0`)

> **Cross-feature integration rule:** If this feature requires changes to files belonging to a *previously completed feature* (e.g. adding a category selector to `TransactionForm`, linking accounts to transactions), each such integration point **must be listed as its own explicit numbered step** in the Current Focus section of this roadmap. Do not rely on "implement per section X of the plan" to surface these tasks — they will be overlooked at review time.

### Step 9 — Frontend unit tests

Hand off to **`test-writer`**:

```
@test-writer Write Vitest + React Testing Library tests for the [feature]
frontend components just implemented. Use accessibility-first queries and
test all user interactions.
```

### Step 10 — Frontend code review

Hand off to **`code-reviewer`**:

```
@code-reviewer Review the frontend changes for the [feature] UI in
packages/frontend. Check conventions, TypeScript quality, accessibility,
and test coverage.
```

Apply any critical fixes via `@frontend-dev` → "Apply Frontend Fixes" handoff.

### Step 11 — Frontend E2E testing

Hand off to **`frontend-tester`** once the frontend clears code review:

```
@frontend-tester Expand the frontend test scope in test-plan/[feature]/implementation-plan.md
into a full Playwright test plan. Save it to test-plan/[feature]/frontend.md,
execute it against the running app, and save the report to
test-plan/[feature]/frontend-report.md.
```

Apply any bugs found via `@frontend-dev` → "Fix Failing Tests" handoff before committing.

### Step 12 — Frontend commits

**Commit per task/section**, same rule as the backend. Tests travel with the component they cover in the same commit.

Hand off to **`frontend-dev`** after each task clears review:

```
@frontend-dev Commit the categories types and Orval-generated hooks now
that they are reviewed and clean. Use the commit format from
copilot-instructions.md.
```

Example sequence for a categories frontend phase:

```
feat(frontend): add categories types and regenerate Orval API client
feat(frontend): add CategoryList and CategoryListItem components with tests
feat(frontend): add CategoryForm and DeleteCategoryModal with tests
feat(frontend): add CategoriesPage and /categories route
```

Scope `(frontend)` in the summary keeps `git log packages/frontend/` clean.

---

> **Note**: Example prompts above use `[feature]` as a placeholder. Replace with the actual feature name (e.g. `categories`, `accounts`) when invoking each agent.

---

## Parallel Work Strategy

Each phase has two naturally sequential workstreams (BE → FE), but different *phases* can sometimes overlap:

| Situation | Strategy |
|-----------|----------|
| Backend Phase N is in progress | Start FE planning/design for Phase N in parallel |
| Backend Phase N has stable Swagger | Start FE Phase N implementation; run `generate:api` |
| Backend Phase N is complete, FE not started | Use MSW mocks for initial FE work |
| Two independent features (e.g. Categories + Accounts) | Implement one backend, then the other — avoid parallel BE to prevent migration conflicts |

---

## Completed: Phase 6 — Accounts Module

Phase 6 (Accounts) is complete — backend and frontend both shipped and fully tested (741 frontend tests passing, 0 type errors, 0 lint warnings; account selector wired into TransactionForm, TransactionList, TransactionListItem, TransactionFilters, and TransactionsPage; 18/18 Playwright TCs passing).

Implementation plan: [`test-plan/accounts/implementation-plan.md`](../test-plan/accounts/implementation-plan.md)

**Phase 6 progress:**

1. ✅ `@planner` — plan complete (`test-plan/accounts/implementation-plan.md`).
2. ✅ `@backend-dev` — Prisma schema (`AccountType` enum + `Account` model) + migration + `AccountsModule` (service, controller, 3 DTOs, Swagger).
3. ✅ `@test-writer` — backend unit tests (35 cases: service + controller).
4. ✅ `@backend-tester` — 38-case live API test plan + report (`test-plan/accounts/backend.md`, `backend-report.md`).
5. ✅ `@code-reviewer` — backend review; critical fixes applied.
6. ✅ `@backend-dev` — backend committed: schema/migration → service+tests → controller.
7. ✅ `npm run generate:api` in `packages/frontend` — Orval client regenerated.
8. ✅ `@frontend-dev` — `account.types.ts`, `useAccountForm`, `AccountForm`, `AccountModal`, `AccountList`, `AccountsSummary`, `AccountsErrorBoundary`, `AccountsPage` (replaced stub).
9. ✅ `@test-writer` — frontend unit tests for all accounts components (115 tests across 6 files).
10. ✅ `@code-reviewer` — frontend review; critical fixes applied.
11. ✅ `@frontend-tester` — Playwright E2E: 18 TCs, all pass, 0 bugs. `test-plan/accounts/frontend.md` + `frontend-report.md` written. Commit `1548783` (test quality fixes: typed `makeAccount` factories, stale fixture, misleading comment).
12. ✅ **Cross-feature Step A** — `accountId` select wired into `TransactionForm`. Tests updated in `TransactionForm.test.tsx`.
13. ✅ **Cross-feature Step B** — Account column added to `TransactionList` / `TransactionListItem`. Tests updated in `TransactionListItem.test.tsx`.
14. ✅ **Cross-feature Step C** — `accountId` filter dropdown wired into `TransactionFilters`. Tests updated in `TransactionFilters.test.tsx`.
15. ✅ Cross-feature TCs TC-45–TC-51 added to `test-plan/transactions/frontend.md`.
16. ✅ `@frontend-dev` — frontend committed (commit `55043c0`): 35 files, 698 tests.
17. ✅ Phase 6 fully complete — Playwright E2E done; test quality fixes committed (`1548783`); 741 tests passing.

## Current Focus: Phase 7 — Transaction Import & Automated Sync (Partially Complete)

Phase 7 core is complete — all backend services/controllers, the worker thread, SSE streaming, and the full frontend are shipped and QA-verified. The four remaining items listed below carry over to Phase 8.

Implementation plan: [`test-plan/import-sync/implementation-plan.md`](../test-plan/import-sync/implementation-plan.md)

**Phase 7 completed work:**

1. ✅ Prisma schema + migration (ImportJob, SyncSchedule, SyncJob, enums)
2. ✅ CryptoService (AES-256-GCM)
3. ✅ ImportService + ImportController (CSV/OFX parsing, dedup, bulk insert)
4. ✅ SyncScheduleService + SyncScheduleController (CRUD, cron via SchedulerRegistry, credential encryption)
5. ✅ SyncSessionStore + scraper worker thread + ScraperService orchestrator
6. ✅ SSE + MFA controller (`sync-job.controller.ts`)
7. ✅ ScraperModule registered in `app.module.ts`
8. ✅ SyncJobStatus/SyncRunStatus constants (`sync-job-status.ts`)
9. ✅ `GET /scrapers` public endpoint (`scraper.controller.ts`) — lists built-in + plugin scrapers; fixes BUG-03
10. ✅ BUG-01 fixed: malformed CSV now correctly lands in `failed` state with `errorMessage`
11. ✅ BUG-02 fixed: `SyncScheduleService.remove()` deletes child `SyncJob` rows before deleting the schedule (fixes 500 on DELETE)
12. ✅ BUG-04 fixed: SSE race condition resolved — backend replays terminal event from DB; frontend SSE parser dispatches on `p.status`
13. ✅ Frontend: all components (FileImportDropzone, ImportJobList, SyncScheduleList/Form/Modal, SyncStatusPanel, MfaModal)
14. ✅ Frontend: all hooks (useImportJob, useSyncSchedule, useSyncJob, useSyncStream)
15. ✅ Frontend: ScraperPage (two-tab layout) + MfaPage (`/mfa` route)
16. ✅ Backend unit tests (426 passing, 98.39% stmt / 92.37% branch coverage; v8 ignores audited); Playwright E2E (25/27 TC pass)

**Phase 7 open minor issue:**
- 🔶 DISC-001: Frontend `FileImportDropzone` displays "max 10 MB" but backend rejects at 5 MB (HTTP 413). Fix: align frontend constant to 5 MB and update the helper text. No backend change needed.

**Phase 7 carry-overs → Phase 8 (see below):**
- ✅ `scraper.scheduler.ts` — startup cron re-registration (done, commit `fe212ee`)
- ✅ `scraper.plugin-loader.ts` — external plugin loading (done)
- `push/` module — Web Push + email for MFA alerts (implementation: no prerequisites; E2E testing blocked on Desktop MCP server)
- Admin endpoints — `/admin/scrapers/reload` and `/admin/scrapers/install` (prerequisite: plugin-loader)

---

## Current Focus: Phase 8 — Phase 7 Carry-overs

Phase 8 completes the four deferred Phase 7 items. The carry-overs are small, self-contained, and have no schema migrations.

**Recommended next actions — Phase 7 carry-overs (complete first):**

1. ✅ `@backend-dev` — **Carry-over A**: `scraper.scheduler.ts` implemented — `ScraperScheduler` (OnModuleInit) queries `syncSchedule WHERE enabled=true` and re-registers each cron job in `SchedulerRegistry` on startup. 7 unit tests. Commit: `fe212ee`.
2. ✅ `@backend-dev` — **Carry-over B**: `scraper.plugin-loader.ts` implemented — `ScraperPluginLoader` (OnModuleInit) scans `SCRAPER_PLUGIN_DIR` for `.js` files, dynamically imports each, validates the default export against `BankScraper`, and registers valid plugins into `ScraperRegistry`. `ScraperRegistry.register()` method added. 15 unit tests (12 plugin-loader + 3 registry).
3. `@backend-dev` — **Carry-over C** (prerequisite: carry-over B): Implement admin endpoints `POST /admin/scrapers/reload` and `POST /admin/scrapers/install` (ADMIN role only). Commit: `feat(scraper): add admin plugin reload and install endpoints`.
4. `@backend-dev` — **Carry-over D** (no code prerequisites; E2E testing requires Desktop MCP server): Implement `push/` module — `POST /push/subscribe`, `DELETE /push/subscribe`, Web Push VAPID `sendNotification`, nodemailer email fallback. Wire MFA notification call into `ScraperService.handleMfaRequired()`. Add `VAPID_*` and `SMTP_*` vars to `.env.example`. Commit: `feat(scraper): add Web Push + email MFA notifications`.
   > **Testing note**: Automated E2E verification of OS-level notification bubbles requires the Desktop MCP server (see Future Enhancements). The manual checklist in `test-plan/import-sync/implementation-plan.md` Section 10 remains the verification method until then.

---

## Upcoming: Phase 9 — Dashboard & UX Redesign

Phase 9 is frontend-only (no new backend modules). The goal is a cohesive, navigable app shell: a proper home/dashboard page, a persistent sidebar, a Settings page, and an information-architecture pass to decide where each existing feature lives.

**Scope areas to resolve during planning:**

1. **Main dashboard / home page** — a `/dashboard` (or `/`) route that acts as the app’s home screen after login. Could be a summary view of recent transactions, account balances, and quick-action shortcuts — or it could be the existing Transactions page promoted to that role with dashboard widgets added around it. This is a key IA decision to make during planning.
2. **Sidebar navigation** — replace or augment the current top-nav with a persistent sidebar that lists all primary sections (Dashboard, Transactions, Accounts, Categories, Sync, Settings). Must be responsive (collapsible on small viewports).
3. **Settings page** — `/settings` route grouping user-level preferences: profile, password change, notification preferences, connected accounts, and any future preference categories.
4. **Feature placement / information architecture** — decide which pages are primary sidebar items vs. nested under Settings or a parent section. Document the final IA map in the implementation plan.

**Recommended next action:**

1. `@planner` — Plan Phase 9: Dashboard & UX Redesign. Research the current routing structure in `packages/frontend/src/routes/`, the existing nav component, and all current pages. Decide whether the Transactions page becomes the dashboard or a new `/dashboard` route is introduced. Produce a full IA decision map and implementation plan in `test-plan/dashboard-ux/implementation-plan.md`.

---

## Future Enhancements (Post-Phase 11)

These are not phases — they have no backend/frontend deliverables in this repo. They are standalone tools or infrastructure improvements that would benefit the project and the broader agent workflow.

---

### Budgets Module *(deferred)*

**Status:** Deferred from Phase 8  
**Complexity:** Medium — requires new Prisma models (`Budget`, `BudgetCategory`), a budgets backend module (CRUD + period rollup queries), and a frontend dashboard with spend-vs-budget visualizations.

When prioritized, invoke `@planner` to produce a full implementation plan following the standard agent workflow. The backend should be modeled after the `categories/` module; the frontend will diverge from the standard list+form pattern due to the charting/analytics requirements.

---

### Desktop OS MCP Server

**Status:** Not started  
**Blocking:** Phase 7 web push notification test (currently manual — see `test-plan/import-sync/implementation-plan.md` Section 10)  
**Design notes:** [`docs/desktop-mcp-server.md`](desktop-mcp-server.md)

#### Problem

Playwright MCP only controls the browser viewport. OS-level surfaces — notification toast bubbles, system dialogs, tray icons, cross-app flows — are invisible to it. This forces some tests to remain manual (e.g. confirming the Phase 7 push notification appears and deep-links to `/mfa`).

#### Solution

A standalone MCP server that exposes OS automation tools to any MCP-capable agent:

| Tool | Description |
|---|---|
| `desktop_screenshot()` | Full desktop or specific window capture |
| `desktop_click(x, y)` | OS-level mouse injection |
| `desktop_send_keys(text)` | OS-level keyboard injection |
| `desktop_find_window(title)` | Enumerate and locate open windows |
| `desktop_read_notification()` | Read buffered OS notifications (WinRT / UNUserNotificationCenter) |
| `desktop_ocr_region(x,y,w,h)` | Extract text from a screen region |
| `desktop_get_accessibility_tree(hwnd)` | UIA (Windows) / AXUIElement (macOS) tree |

#### Platform backends

- **Windows**: `pywin32` + `winrt` (`UserNotificationListener`) + `SendInput`
- **macOS**: `pyobjc` + `CGEvent` + `UNUserNotificationCenter` + Apple Vision OCR

#### How it unblocks Phase 7

Once available and registered in `.vscode/mcp.json`, the `frontend-tester` agent can:
1. Call `desktop_read_notification()` → gets the buffered WinRT notification payload (instant, event-driven — no polling race with the 5s toast dismiss window)
2. Assert title/body content
3. Call `desktop_click(x, y)` → clicks the toast
4. Playwright resumes — asserts navigation to `/mfa?jobId=…`

The manual checklist in `test-plan/import-sync/implementation-plan.md` Section 10 would be replaced with automated steps once this server exists.

#### Key design decision: event buffering

The MCP server runs a background OS watcher thread that subscribes to notification events natively (instant, event-driven). The LLM polls `read_notification()` at leisure — no sub-second reaction time needed. See [`docs/desktop-mcp-server.md`](desktop-mcp-server.md) for full architecture notes.

#### Recommended handoff when ready

```
@backend-dev Build the Desktop OS MCP server per docs/desktop-mcp-server.md.
Implement as a standalone Node.js or Python MCP server with Windows backend first.
Register it in .vscode/mcp.json alongside the Playwright MCP.
```

---

## Updating This Document

After completing each phase, update the **Phase Status** table and **Current Focus** section above.
Keep it to a single page — detailed notes belong in the package-level roadmaps.
