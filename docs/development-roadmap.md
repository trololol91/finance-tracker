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
| **7** | Transaction Import & Automated Sync | Import & Sync UI | ⬜ In Progress |
| **8** | Budgets Module *(optional)* | Dashboard & Analytics | ⬜ Not Started |
| **9** | Reports Module *(optional)* | Analytics Views | ⬜ Not Started |
| **10** | MCP Server | MCP App UIs | ⬜ Not Started |

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
                                                
Backend Phase 8 (Budgets) ───────────► Frontend Phase 8 (Dashboard/Analytics)
Backend Phase 9 (Reports) ───────────► Frontend Phase 9 (Analytics Views)
Backend Phase 10 (MCP Server) ───────► Frontend Phase N (MCP App UIs)
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

## Current Focus: Phase 7 — Transaction Import & Automated Sync

Phase 6 (Accounts) is complete — backend and frontend both shipped and QA-verified (741 frontend tests, 0 type errors, 0 lint warnings, 18/18 Playwright TCs passing).

Implementation plan: [`test-plan/import-sync/implementation-plan.md`](../test-plan/import-sync/implementation-plan.md)

**Recommended next actions:**

1. `@backend-dev` — **Step 1**: Add `ImportJob`, `SyncSchedule`, `SyncJob` Prisma models + new enums (`ImportStatus`, `SyncStatus`, `FileType`, `SyncFrequency`) + relation fields on `User` and `Account`. Run migration `add_import_sync_module`. Commit: `feat(backend): add import/sync Prisma models and migration`.
2. `@backend-dev` — **Step 2**: Implement `CryptoService` (AES-256-GCM) in `src/scraper/sync/crypto.service.ts`. Add `CREDENTIALS_ENCRYPTION_KEY` to `.env.example`. Commit: `feat(backend): add CryptoService for credential encryption`.
3. `@backend-dev` — **Step 3**: Implement `ImportService` + `ImportController` (`POST /scraper/import/upload`, `GET /scraper/import`, `GET /scraper/import/:id`). Add `papaparse` + `ofx-js` dependencies. Commit: `feat(backend): add ImportJob service with CSV/OFX parsing`.
4. `@backend-dev` — **Step 4**: Implement `SyncScheduleService` + `SyncScheduleController` (CRUD at `/scraper/sync/schedules`). Encrypt credentials on create/update; omit from response DTO. Commit: `feat(backend): add SyncSchedule service and controller`.
5. `@backend-dev` — **Step 5**: Implement `SyncJobService` + `SyncWorkerService` (stub strategy pattern; `TdScraperStrategy` returns mock data). State machine: idle → running → mfa_required → completed/failed. Commit: `feat(backend): add SyncJob service and scraper worker stub`.
6. `@backend-dev` — **Step 6**: Implement `SyncSseController` (`GET /scraper/sync/jobs/:id/stream`) using `@Sse()` + RxJS Observable. Commit: `feat(backend): add SSE streaming endpoint for sync job status`.
7. `@backend-dev` — **Step 7**: Create `ScraperModule`, register all controllers/services, wire `MulterModule`. Register `ScraperModule` in `app.module.ts`. Commit: `feat(backend): register ScraperModule in app.module.ts`.
8. `@test-writer` — Backend unit tests for all scraper services and controllers (30+ cases).
9. `@backend-tester` — Live API tests per TC-01–TC-30 in the implementation plan.
10. `@code-reviewer` — Backend review.
11. Run `npm run generate:api` in `packages/frontend`.
12. `@frontend-dev` — Replace `ScraperPage` stub; implement `FileImportDropzone`, `ImportJobList`, `SyncScheduleList`, `SyncScheduleForm`/`Modal`, `SyncStatusPanel`, `MfaModal`, `useSyncStream`. Add `MfaPage` + `/mfa` route.
13. **Cross-feature Step A** — Verify imported transactions appear in `TransactionsPage` with correct `accountId` filter (smoke-test only; no code change expected).
14. **Cross-feature Step B** — Verify `AccountsPage` `currentBalance` reflects newly imported transactions (smoke-test only; no code change expected).
15. `@test-writer` — Frontend unit tests.
16. `@code-reviewer` — Frontend review.
17. `@frontend-tester` — Playwright E2E per Section 10 of the implementation plan.

---

## Future Enhancements (Post-Phase 10)

These are not phases — they have no backend/frontend deliverables in this repo. They are standalone tools or infrastructure improvements that would benefit the project and the broader agent workflow.

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
