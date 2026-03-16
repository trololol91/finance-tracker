# Scraper Plugin System — Enhancement Roadmap

Detailed implementation plans for each milestone live in
[`test-plan/scraper-plugins/`](../../test-plan/scraper-plugins/).

---

## Milestone Status

| # | Milestone | Status |
|---|-----------|--------|
| 1 | Remove Built-ins, Add Startup Seeding | ✅ Done |
| 2 | Dry-run Test Endpoint | ⬜ Not Started |
| 3 | dryRun Flag on Run-Now | ⬜ Not Started |
| 4 | Plugin Input Schema | ⬜ Not Started |

---

## Milestone 1 — Remove Built-ins, Add Startup Seeding

**Goal:** Eliminate bank-specific knowledge from the NestJS core. All scrapers —
including the current CIBC and TD implementations — load through the same plugin
path, making them swappable without a redeploy.

### Key Changes

- Remove `CibcScraper` and `TdScraper` from `scraper.module.ts` providers and the
  `BANK_SCRAPER` factory provider.
- Delete (or relocate) the DI-only class wrappers in `banks/cibc.scraper.ts` and
  `banks/td.scraper.ts`; keep the scraping logic as standalone `.js` plugin files
  bundled with the distribution.
- Extend `ScraperPluginLoader.onModuleInit()` with a seeding step that runs before
  `loadPlugins()`:
  - Resolves the built-in plugin source paths (relative to the compiled output).
  - Copies each file into `SCRAPER_PLUGIN_DIR` if it does not already exist there
    (idempotent — never overwrites an operator-modified version).
  - Logs a `skip` message when the file is already present.

### Files Affected

| File | Change |
|------|--------|
| `packages/backend/src/scraper/scraper.module.ts` | Remove `CibcScraper`, `TdScraper` imports and `BANK_SCRAPER` factory provider |
| `packages/backend/src/scraper/banks/cibc.scraper.ts` | Convert to a standalone ESM plugin (no NestJS DI); keep `BankScraper` default export |
| `packages/backend/src/scraper/banks/td.scraper.ts` | Same conversion as CIBC |
| `packages/backend/src/scraper/scraper.plugin-loader.ts` | Add `seedBuiltins()` step before `loadPlugins()` |
| `packages/backend/src/scraper/__TEST__/scraper.plugin-loader.spec.ts` | Add seeding tests (idempotency, copy-on-missing) |

### Decision Notes

- **Startup hook over Prisma seed:** Seeding is handled entirely inside
  `ScraperPluginLoader.onModuleInit()`. This keeps filesystem concerns in the
  scraper module, runs automatically on every boot (including Docker), and
  requires no manual operator steps (`npm run seed`).
- `ScraperRegistry` already accepts an empty `BANK_SCRAPER` injection via
  `@Optional()` (see `scraper.registry.ts` line 21) — removing the factory
  provider requires no further registry changes.
- One code path for all scrapers means the admin `reload` and `install` endpoints
  already cover built-ins with no extra work.

---

## Milestone 2 — Dry-run Test Endpoint

**Goal:** Give plugin developers a way to inspect raw scraper output without
writing any data to the database.

### Key Changes

- Add `POST /admin/scrapers/:bankId/test` to `ScraperAdminController`.
  - Guard: `JwtAuthGuard` + `AdminGuard` (ADMIN role only).
  - Request body: `TestScraperDto` — `inputs: Record<string, string>`, `lookbackDays`.
  - Behaviour: decrypt credentials, run the full scrape through `ScraperService`
    (or a new `ScraperAdminService` method), skip the `prisma.transaction.createMany`
    call, and return the raw `RawTransaction[]`.
  - Response shape: `{ bankId: string; transactions: RawTransaction[]; count: number }`.
- Add `TestScraperDto` and `TestScraperResponseDto` in
  `scraper/admin/dto/`.

### Files Affected

| File | Change |
|------|--------|
| `packages/backend/src/scraper/scraper-admin.controller.ts` | Add `POST /:bankId/test` action |
| `packages/backend/src/scraper/scraper-admin.service.ts` | Add `testScraper(bankId, dto)` method |
| `packages/backend/src/scraper/admin/dto/test-scraper.dto.ts` | New — request body DTO |
| `packages/backend/src/scraper/admin/dto/test-scraper-response.dto.ts` | New — response DTO |
| `packages/backend/src/scraper/__TEST__/scraper-admin.service.spec.ts` | Extend with test-scraper cases |
| `packages/backend/src/scraper/__TEST__/scraper-admin.controller.spec.ts` | Extend with test-scraper cases |

### Decision Notes

- The endpoint runs in the main process using a direct scraper call rather than
  spawning a worker thread — avoids SSE plumbing for a synchronous dev tool.
- Returns `404` if `bankId` is not registered in `ScraperRegistry`.
- Inputs are not persisted; they are passed directly to the scraper's
  `login()` method and discarded after the call.

---

## Milestone 3 — dryRun Flag on Run-Now

**Goal:** Allow end-to-end testing of the full sync pipeline — including the
worker thread, SSE events, and MFA flow — without committing any transactions to
the database.

### Key Changes

- Add `dryRun?: boolean` (default `false`) to `RunSyncNowDto`
  (`packages/backend/src/scraper/sync/dto/run-sync-now.dto.ts`).
- Thread the flag through `ScraperService.sync()` → `ScraperWorkerInput` →
  the worker thread.
- In the worker thread, gate the `prisma.transaction.createMany` call behind
  `if (!input.dryRun)`.
- The SSE stream emits all normal status events including the terminal
  `complete` event; the `importedCount` in a dry-run response will be `0`
  and `skippedCount` will reflect what would have been deduped.
- Add `dryRun: boolean` to `ScraperWorkerInput` in
  `bank-scraper.interface.ts`.

### Files Affected

| File | Change |
|------|--------|
| `packages/backend/src/scraper/sync/dto/run-sync-now.dto.ts` | Add `dryRun?: boolean` field |
| `packages/backend/src/scraper/interfaces/bank-scraper.interface.ts` | Add `dryRun: boolean` to `ScraperWorkerInput` |
| `packages/backend/src/scraper/scraper.service.ts` | Pass `dryRun` into worker input |
| `packages/backend/src/scraper/scraper.worker.ts` | Gate `createMany` on `!input.dryRun` |
| `packages/backend/src/scraper/__TEST__/scraper.service.spec.ts` | Add dry-run cases |
| `packages/backend/src/scraper/__TEST__/scraper.worker.spec.ts` | Add dry-run cases |

### Decision Notes

- Result is returned via SSE as normal — no new endpoint or response shape
  needed; the caller distinguishes dry-run from a real run by the flag it
  passed, not by the response format.
- DB write is the only step skipped; deduplication logic still runs against
  existing `Transaction.fitid` values so `skippedCount` is accurate.

---

## Milestone 4 — Plugin Input Schema

**Goal:** Allow plugin authors to declare any inputs their plugin needs from
the user — authentication fields, account selectors, configuration values, or
anything else. The platform stores and passes inputs as opaque encrypted JSON;
it does not interpret or constrain the field set. The frontend renders the
correct form dynamically from the schema with no hardcoded field lists.

### Key Changes

#### Backend

- Add `PluginFieldDescriptor` interface and replace `BankCredentials` with
  `PluginInputs = Record<string, string>` in `bank-scraper.interface.ts`:
  ```typescript
  interface PluginFieldDescriptor {
      key: string;           // field name in stored JSON
      label: string;         // shown in the UI form
      type: 'text' | 'password' | 'select' | 'number';
      required: boolean;
      hint?: string;         // optional helper text below the field
      options?: string[];    // values for type: 'select'
  }
  ```
- Add `inputSchema: PluginFieldDescriptor[]` as a **required** field on
  `BankScraper`. Update `isBankScraper` type guard to check for its presence.
- Update CIBC and TD plugins to declare their `inputSchema`:
  ```typescript
  inputSchema: [
      { key: 'username', label: 'Username', type: 'text',     required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
  ]
  ```
- Extend `ScraperInfoDto` and `GET /scrapers` response to include `inputSchema`
  per entry so the frontend always has the full field descriptor available.
- Update `CreateSyncScheduleDto`: replace `username` + `password` fields with
  `inputs: Record<string, string>`. Validate that all `required: true` keys
  from the plugin's registered `inputSchema` are present in the submitted
  `inputs` object (dynamic cross-field validation against the registry).
- Update `UpdateSyncScheduleDto`: replace `username?` + `password?` with
  `inputs?: Record<string, string>` (partial update — absent means unchanged).
- Rename `credentials_enc` → `plugin_config_enc` in the Prisma schema
  (one-column rename migration; no data migration needed — column is opaque
  encrypted JSON).
- Update `CryptoService` callers to use the renamed column.

#### Frontend

- Regenerate Orval types after backend OpenAPI update:
  - `scraperInfoDto.ts` gains `inputSchema: PluginFieldDescriptor[]`
  - `createSyncScheduleDto.ts` replaces `username`/`password` with `inputs`
  - `updateSyncScheduleDto.ts` same replacement
- Update `SyncScheduleFormValues` in `scraper.types.ts`: drop `username` and
  `password`; add `inputs: Record<string, string>`.
- Update `useSyncSchedule.ts`:
  - `openCreate()` initialises `inputs: {}`
  - `openEdit()` resets `inputs: {}` (stored inputs are never transmitted back)
  - Validation checks that all `required: true` keys in the selected plugin's
    `inputSchema` have a non-empty value in `inputs`
- Replace hardcoded username/password fields in `SyncScheduleForm.tsx` with a
  loop over the selected plugin's `inputSchema`:
  - `type: 'text'` → `<input type="text">`
  - `type: 'password'` → `<input type="password">`
  - `type: 'number'` → `<input type="number">`
  - `type: 'select'` + `options` → `<select>`
  - `hint` → helper text rendered below the field
  - `required: true` → field is marked required and blocks form submission

### Files Affected

#### Backend

| File | Change |
|------|--------|
| `packages/backend/src/scraper/interfaces/bank-scraper.interface.ts` | Add `PluginFieldDescriptor`; add `inputSchema` to `BankScraper`; replace `BankCredentials` with `PluginInputs` |
| `packages/backend/src/scraper/banks/cibc.scraper.ts` | Add `inputSchema` declaration |
| `packages/backend/src/scraper/banks/td.scraper.ts` | Add `inputSchema` declaration |
| `packages/backend/src/scraper/scraper.plugin-loader.ts` | Update `isBankScraper` guard to check `inputSchema` |
| `packages/backend/src/scraper/scraper-info.dto.ts` | Add `inputSchema: PluginFieldDescriptor[]` field |
| `packages/backend/src/scraper/scraper.registry.ts` | Pass `inputSchema` through `listAll()` |
| `packages/backend/src/scraper/sync/dto/create-sync-schedule.dto.ts` | Replace `username`/`password` with `inputs: Record<string, string>` |
| `packages/backend/src/scraper/sync/dto/update-sync-schedule.dto.ts` | Replace `username?`/`password?` with `inputs?: Record<string, string>` |
| `packages/backend/src/scraper/scraper.service.ts` | Update encrypt/decrypt to use `inputs` and `plugin_config_enc` |
| `packages/backend/prisma/schema.prisma` | Rename `credentials_enc` → `plugin_config_enc` on `SyncSchedule` model |
| `packages/backend/prisma/migrations/` | New migration for column rename |
| `packages/backend/src/scraper/__TEST__/scraper.plugin-loader.spec.ts` | Update `isBankScraper` guard tests; add `inputSchema` validation case |
| `packages/backend/src/scraper/__TEST__/scraper.registry.spec.ts` | Add `inputSchema` serialisation test |
| `packages/backend/src/scraper/__TEST__/create-sync-schedule.dto.spec.ts` | Replace credential field tests with `inputs` validation tests |

#### Frontend

| File | Change |
|------|--------|
| `packages/frontend/src/api/model/scraperInfoDto.ts` | Regenerated — gains `inputSchema` |
| `packages/frontend/src/api/model/createSyncScheduleDto.ts` | Regenerated — `inputs` replaces `username`/`password` |
| `packages/frontend/src/api/model/updateSyncScheduleDto.ts` | Regenerated — `inputs?` replaces `username?`/`password?` |
| `packages/frontend/src/features/scraper/types/scraper.types.ts` | `SyncScheduleFormValues`: drop `username`/`password`; add `inputs: Record<string, string>` |
| `packages/frontend/src/features/scraper/hooks/useSyncSchedule.ts` | Update `openCreate`, `openEdit`, and validation to use `inputs` + `inputSchema` |
| `packages/frontend/src/features/scraper/components/SyncScheduleForm.tsx` | Replace hardcoded credential fields with `inputSchema`-driven render loop |

### Decision Notes

- **No fixed credential taxonomy.** There is no `browser | api_token | api_key`
  union. The plugin declares exactly what it needs — a password field, an
  account number, a region selector, a list of sub-accounts — with no platform
  constraint on field count or meaning.
- **Dynamic validation without hardcoding.** The DTO validates `inputs` by
  looking up the plugin's `inputSchema` from `ScraperRegistry` at request time.
  Required field enforcement is driven by the schema, not by static DTO
  decorators.
- **One form component for all plugins.** `SyncScheduleForm.tsx` renders
  entirely from `inputSchema`. A newly installed plugin with novel fields works
  immediately — no frontend changes required.
- **Column rename is the only migration.** `credentials_enc` → `plugin_config_enc`
  is a rename only; the column type and existing encrypted JSON values are
  unchanged. Existing rows remain valid.
- **Edit mode behaviour unchanged.** Stored inputs are never transmitted back
  to the client. On edit, `inputs` resets to `{}` — the user must re-enter
  values they wish to change, identical to the current username/password
  behaviour.

---

## Test Plan

Per-milestone backend API test plans, unit test specs, and execution reports are
stored under [`test-plan/scraper-plugins/`](../../test-plan/scraper-plugins/).

Each milestone's implementation plan will follow the naming convention:

```
test-plan/scraper-plugins/milestone-1-implementation-plan.md
test-plan/scraper-plugins/milestone-1-backend.md
test-plan/scraper-plugins/milestone-1-backend-report.md
...
```

---

## Recommended Next Actions

Each milestone follows the same agent sequence. Replace `<N>` and `<milestone-title>` with the
milestone you are working on.

### Step 1 — Plan

```
With planner, produce a full implementation plan for Milestone <N> — <milestone-title>
from docs/scraper-plugins/roadmap.md. Research the existing scraper module patterns,
then save the plan to test-plan/scraper-plugins/milestone-<N>-implementation-plan.md.
```

### Step 2 — Implement

```
With backend-dev, implement Milestone <N> — <milestone-title> using the plan at
test-plan/scraper-plugins/milestone-<N>-implementation-plan.md.
Follow all backend conventions: # aliases, ESM .js extensions, Prisma, Vitest.
```

### Step 3 — Tests

```
With test-writer, write comprehensive Vitest tests for the Milestone <N> changes.
Cover all service methods (happy path + error paths) and controller endpoints.
Reference the implementation plan at test-plan/scraper-plugins/milestone-<N>-implementation-plan.md.
```

### Step 4 — Live API Testing

```
With backend-tester, run the Milestone <N> API test plan against the running server.
Save the plan to test-plan/scraper-plugins/milestone-<N>-backend.md and
the report to test-plan/scraper-plugins/milestone-<N>-backend-report.md.
```

### Step 5 — Code Review

```
With code-reviewer, review the Milestone <N> backend changes in packages/backend/src/scraper/.
Check conventions, TypeScript quality, security, and test coverage.
```

### Step 6 — Commit

```
With backend-dev, commit the Milestone <N> changes now that they are reviewed and clean.
```

---

> **Rule:** Each milestone that produces a working, tested, reviewed unit of code gets its own
> commit. Tests travel with the code they cover in the same commit.
