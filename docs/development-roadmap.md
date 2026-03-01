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
| **5** | Categories Module | Categories UI | 🔄 In Progress |
| **6** | Accounts Module | Accounts UI | ⬜ Not Started |
| **7** | Transaction Import & Automated Sync | Import & Sync UI | ⬜ Not Started |
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

## Current Focus: Phase 5 — Categories

Phase 4 (Transactions) is complete — backend and frontend both shipped and QA-verified (9 bugs found, fixed, and re-tested; 420 frontend tests passing).

Implementation plan saved to [`test-plan/categories/implementation-plan.md`](../test-plan/categories/implementation-plan.md).

**Next actions:**
1. ✅ `@planner` — plan complete (`test-plan/categories/implementation-plan.md`).
2. `@backend-dev` — implement Prisma schema + migration, then `CategoriesModule` (service → controller → DTOs → Swagger). Reference: `transactions/` module.
3. `@test-writer` — write Vitest unit tests for `CategoriesService` + `CategoriesController` (target ≥ 40 tests).
4. `@backend-tester` — validate all endpoints per section 8 of the plan; save to `test-plan/categories/backend-report.md`.
5. `@code-reviewer` — review backend; focus on self-referential relation, depth-limit guard, and soft-vs-hard delete.
6. `@backend-dev` — commit: schema/migration, then service+tests, then controller.
7. Run `npm run generate:api` in `packages/frontend` once Swagger is stable.
8. `@frontend-dev` — implement `CategoriesPage` and feature components per section 5 of the plan.
9. `@test-writer` — Vitest + RTL component tests (target ≥ 30 tests).
10. `@frontend-tester` — expand section 7 into Playwright plan; save to `test-plan/categories/frontend.md`.
11. Update this document: mark Phase 5 as ✅ and set Phase 6 as current focus.

---

## Updating This Document

After completing each phase, update the **Phase Status** table and **Current Focus** section above.
Keep it to a single page — detailed notes belong in the package-level roadmaps.
