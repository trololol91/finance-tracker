# Scraper Plugin System — Enhancement Roadmap

Detailed implementation plans for each milestone live in
[`test-plan/scraper-plugins/`](../../test-plan/scraper-plugins/).

---

## Milestone Status

| # | Milestone | Status |
|---|-----------|--------|
| 1 | Remove Built-ins, Add Startup Seeding | ✅ Done |
| 2 | Dry-run Test Endpoint | ✅ Done |
| 3 | dryRun Flag on Run-Now | ✅ Done |
| 4 | Plugin Input Schema | ✅ Done |
| 5 | Scraper Worker Implementation (Phase 8) | ✅ Done |

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

### Recommended Next Actions

#### Step 1 — Plan

```
@docs/scraper-plugins/roadmap.md

planner — Produce a full implementation plan for Milestone 2 — Dry-run Test
Endpoint. Research the existing scraper admin patterns before writing anything:
read scraper-admin.controller.ts, scraper-admin.service.ts, and their spec
files to understand the established conventions for guards, DTOs, and service
method signatures. Then read bank-scraper.interface.ts to understand
RawTransaction and how login() receives inputs. Save the plan to
test-plan/scraper-plugins/milestone-2-implementation-plan.md.

The plan must cover:
- TestScraperDto shape: inputs (Record<string, string>), lookbackDays (number,
  optional, defaults to plugin maxLookbackDays)
- TestScraperResponseDto shape: bankId, transactions (RawTransaction[]), count
- ScraperAdminService.testScraper(bankId, dto): resolve the plugin from
  ScraperRegistry (404 if absent), call login() then scrapeTransactions() with
  a real Playwright page, return raw results without writing to the database
- Controller action: POST /admin/scrapers/:bankId/test, JwtAuthGuard +
  AdminGuard, 200 on success, 404 if bankId unknown
- How to open and close the Playwright browser within the service method
  (reference how ScraperService or the worker does it today)
- Unit test cases for the service (happy path, 404, login error, scrape error)
  and controller (guard behaviour, response shape delegation)
```

#### Step 2 — Implement

```
@docs/scraper-plugins/roadmap.md
@test-plan/scraper-plugins/milestone-2-implementation-plan.md

backend-dev — Implement Milestone 2 — Dry-run Test Endpoint using the plan
above. Follow all backend conventions: # path aliases, .js ESM extensions on
internal imports, class-validator decorators on DTOs, @ApiProperty on all DTO
fields. Do not spawn a worker thread — run the scrape synchronously in the main
process. After implementing, run npm run typecheck and npm run lint to confirm
the build is clean before finishing.
```

#### Step 3 — Tests

```
@docs/scraper-plugins/roadmap.md
@test-plan/scraper-plugins/milestone-2-implementation-plan.md

test-writer — Extend scraper-admin.service.spec.ts and
scraper-admin.controller.spec.ts with Milestone 2 test cases. Read both spec
files in full before writing anything — match the existing mock setup, factory
patterns, and assertion style exactly.

Service cases to cover:
- Happy path: login() and scrapeTransactions() called; raw results returned
- bankId not in registry: throws NotFoundException
- login() throws: error propagates, browser closed
- scrapeTransactions() throws: error propagates, browser closed

Controller cases to cover:
- 200 with correct response shape delegated from service
- No auth token: 401
- Non-admin user: 403
- Service throws NotFoundException: 404

Run the full spec suite after writing and fix any failures before finishing.
```

#### Step 4 — Live API Testing

```
@docs/scraper-plugins/roadmap.md
@test-plan/scraper-plugins/milestone-2-implementation-plan.md

backend-tester — Run the Milestone 2 API test plan against the running server
at http://localhost:3001. Save the test plan to
test-plan/scraper-plugins/milestone-2-backend.md and the execution report to
test-plan/scraper-plugins/milestone-2-backend-report.md.

Test cases to execute:
- POST /admin/scrapers/:bankId/test — no auth token → 401
- POST /admin/scrapers/:bankId/test — USER role → 403
- POST /admin/scrapers/unknown-bank/test — ADMIN token → 404
- POST /admin/scrapers/cibc/test — ADMIN token, valid inputs → 200 with
  { bankId, transactions, count } shape (do not assert transaction content —
  a real browser session is not available in CI; assert shape only)
```

#### Step 5 — Code Review

```
@docs/scraper-plugins/roadmap.md
@test-plan/scraper-plugins/milestone-2-implementation-plan.md

code-reviewer — Review the Milestone 2 changes in packages/backend/src/scraper/.
Focus on: guard ordering on the new controller action, DTO validation coverage,
error propagation from login() and scrapeTransactions(). Browser lifecycle is the
plugin's responsibility — the service calls login() and scrapeTransactions() directly
with no page argument and no Playwright import. Confirm the response DTO is fully
decorated with @ApiProperty so the OpenAPI spec stays accurate.
```

#### Step 6 — Commit

```
@docs/scraper-plugins/roadmap.md

backend-dev — Commit the Milestone 2 changes with message:
feat(scraper): add dry-run test endpoint POST /admin/scrapers/:bankId/test
```

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

### Recommended Next Actions

#### Step 1 — Plan

```
@docs/scraper-plugins/roadmap.md

planner — Produce a full implementation plan for Milestone 3 — dryRun Flag on
Run-Now. Research the existing scraper sync patterns before writing anything:
read run-sync-now.dto.ts, bank-scraper.interface.ts, scraper.service.ts, and
scraper.worker.ts to understand how ScraperWorkerInput is constructed and
passed to the worker thread, and how the worker currently calls
prisma.transaction.createMany. Also read scraper.service.spec.ts and
scraper.worker.spec.ts to understand the existing mock setup and test
conventions. Save the plan to
test-plan/scraper-plugins/milestone-3-implementation-plan.md.

The plan must cover:
- RunSyncNowDto change: add dryRun?: boolean with @IsOptional() and
  @IsBoolean() decorators; default is false when omitted
- ScraperWorkerInput change: add dryRun: boolean to the interface in
  bank-scraper.interface.ts
- ScraperService.sync() change: read dryRun from the DTO and pass it into the
  worker input object; confirm no other call sites need updating
- scraper.worker.ts change: gate the prisma.transaction.createMany call behind
  if (!input.dryRun); ensure skippedCount is still computed by running dedup
  logic against existing fitids even in dry-run mode; importedCount is 0 on a
  dry run
- SSE event behaviour: all normal events are emitted on a dry run — no
  short-circuit before the scrape; the terminal complete event is emitted with
  importedCount: 0
- Unit test cases for the service and worker (see Step 3 for the full list)
```

#### Step 2 — Implement

```
@docs/scraper-plugins/roadmap.md
@test-plan/scraper-plugins/milestone-3-implementation-plan.md

backend-dev — Implement Milestone 3 — dryRun Flag on Run-Now using the plan
above. Follow all backend conventions: # path aliases, .js ESM extensions on
internal imports, class-validator decorators on DTOs, @ApiProperty on all DTO
fields. The gate must be if (!input.dryRun) — not if (input.dryRun === false)
— so that the falsy default is handled correctly without an explicit comparison.
Do not short-circuit the scrape itself; only gate the database write. After
implementing, run npm run typecheck and npm run lint to confirm the build is
clean before finishing.
```

#### Step 3 — Tests

```
@docs/scraper-plugins/roadmap.md
@test-plan/scraper-plugins/milestone-3-implementation-plan.md

test-writer — Extend scraper.service.spec.ts and scraper.worker.spec.ts with
Milestone 3 test cases. Read both spec files in full before writing anything —
match the existing mock setup, factory patterns, and assertion style exactly.

Service cases to cover:
- dryRun: true is passed through to the worker input (assert workerInput.dryRun
  is true after calling sync() with a DTO that has dryRun: true)
- dryRun defaults to false when omitted from the DTO (assert
  workerInput.dryRun is false when the DTO has no dryRun field)

Worker cases to cover:
- dryRun: false (default): prisma.transaction.createMany is called with the
  expected transaction rows
- dryRun: true: prisma.transaction.createMany is NOT called; importedCount is
  0 in the terminal complete event; skippedCount reflects dedup against
  existing fitids (mock an existing fitid and assert it appears in skippedCount)

Run the full spec suite after writing and fix any failures before finishing.
```

#### Step 4 — Live API Testing

```
@docs/scraper-plugins/roadmap.md
@test-plan/scraper-plugins/milestone-3-implementation-plan.md

backend-tester — Run the Milestone 3 API test plan against the running server
at http://localhost:3001. Save the test plan to
test-plan/scraper-plugins/milestone-3-backend.md and the execution report to
test-plan/scraper-plugins/milestone-3-backend-report.md.

Test cases to execute:
- POST /scraper/sync/run-now with dryRun: true, ADMIN token → SSE stream
  completes normally; terminal complete event has importedCount: 0
- POST /scraper/sync/run-now without dryRun field, ADMIN token → behaviour
  unchanged; real import proceeds (importedCount reflects actual rows written)
- POST /scraper/sync/run-now with dryRun: "yes" (wrong type), ADMIN token →
  400 validation error
```

#### Step 5 — Code Review

```
@docs/scraper-plugins/roadmap.md
@test-plan/scraper-plugins/milestone-3-implementation-plan.md

code-reviewer — Review the Milestone 3 changes in packages/backend/src/scraper/.
Focus on: dryRun correctly defaults to false in the DTO (@IsOptional() +
@IsBoolean() — confirm the decorator order and that no @IsNotEmpty() blocks
the default); the flag is threaded all the way through from the DTO to the
worker input without being dropped or shadowed; the createMany gate is
if (!input.dryRun) and not a strict equality check; SSE events are emitted
identically for dry and real runs with no short-circuit before the scrape;
skippedCount still reflects real dedup logic even in dry-run mode (dedup runs
against existing fitids regardless of the flag).
```

#### Step 6 — Commit

```
@docs/scraper-plugins/roadmap.md

backend-dev — Commit the Milestone 3 changes with message:
feat(scraper): add dryRun flag to run-now sync endpoint
```

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
- **`inputs` value-type validation:** `TestScraperDto.inputs` uses `@IsObject()` which validates that the field is a plain object but does not validate that record values are strings — a caller can send `{"inputs": {"username": 123}}` and it passes validation. This gap is intentionally deferred to Milestone 4. When `BankCredentials` is replaced with `PluginInputs = Record<string, string>`, introduce a custom `@IsStringRecord()` validator (or a `@ValidateNested` + `@Transform` equivalent) on any DTO that accepts `inputs` or `Record<string, string>` fields so value types are enforced at the HTTP boundary.

### Recommended Next Actions

#### Step 1 — Plan

```
@docs/scraper-plugins/roadmap.md

planner — Produce a full implementation plan for Milestone 4 — Plugin Input
Schema. Research the following files before writing anything:

Backend:
- packages/backend/src/scraper/interfaces/bank-scraper.interface.ts — current
  BankCredentials interface, BankScraper shape, and ScraperWorkerInput (note the
  hardcoded credentials: {username, password} field that must also be updated)
- packages/backend/src/scraper/scraper.plugin-loader.ts — the isBankScraper
  type guard (lines 27–41); understand every field it currently checks so you
  can describe the exact addition needed for inputSchema
- packages/backend/src/scraper/scraper-info.dto.ts — current DTO fields; plan
  where inputSchema: PluginFieldDescriptor[] and its nested @ApiProperty
  decoration should be inserted
- packages/backend/src/scraper/scraper.registry.ts — listAll() method; note
  the explicit field-by-field mapping that must gain the inputSchema property
- packages/backend/src/scraper/sync/dto/create-sync-schedule.dto.ts — current
  username/password fields and their decorators; plan the replacement with
  inputs: Record<string, string> and the custom @IsStringRecord() validator
- packages/backend/src/scraper/sync/dto/update-sync-schedule.dto.ts — current
  PartialType/OmitType pattern; plan the inputs?: Record<string, string>
  replacement that inherits from the updated CreateSyncScheduleDto
- packages/backend/src/scraper/scraper.service.ts — the runWorker() method;
  locate the decrypt call on line 117 (schedule.credentialsEnc) and the
  ScraperWorkerInput construction on line 126; plan both the column rename and
  the inputs cast change
- packages/backend/prisma/schema.prisma — SyncSchedule model; plan the single-
  column rename credentialsEnc / credentials_enc → pluginConfigEnc /
  plugin_config_enc and confirm no data migration is needed
- packages/backend/src/scraper/__TEST__/scraper.plugin-loader.spec.ts — the
  makePlugin() factory helper (line 34); plan which new inputSchema field must
  be added to every call to makePlugin() and which new guard test cases to add
- packages/backend/src/scraper/__TEST__/scraper.registry.spec.ts — the
  makeScraper() factory (line 9) and the listAll() serialisation assertion
  (line 53); plan the inputSchema addition to both the factory and the
  assertion

Frontend:
- packages/frontend/src/features/scraper/types/scraper.types.ts —
  SyncScheduleFormValues interface; plan dropping username and password and
  adding inputs: Record<string, string>; also plan the SyncScheduleFormErrors
  type which is derived from the same interface
- packages/frontend/src/features/scraper/hooks/useSyncSchedule.ts — EMPTY_FORM
  constant (line 22), openCreate (line 85), openEdit (line 92), validateForm
  (line 32), and both mutate call sites in handleSubmit (lines 144–169); plan
  each site's change from username/password to inputs
- packages/frontend/src/features/scraper/components/SyncScheduleForm.tsx —
  the hardcoded credentials row (lines 98–141); plan replacing it with a loop
  over the selected scraper's inputSchema from the useScraperControllerListScrapers
  response, rendering text / password / number / select fields with hint text
  and required markers
- packages/frontend/src/api/model/scraperInfoDto.ts — current Orval-generated
  shape; note it will be fully regenerated by `npm run generate:api` in
  packages/frontend after the backend OpenAPI is stable

Save the plan to test-plan/scraper-plugins/milestone-4-implementation-plan.md.

The plan must cover:
- PluginFieldDescriptor interface definition (key, label, type union, required,
  hint?, options?) and where to place it in bank-scraper.interface.ts
- PluginInputs type alias and replacement of BankCredentials throughout,
  including the ScraperWorkerInput.credentials field rename
- isBankScraper guard addition: check Array.isArray(v.inputSchema)
- inputSchema declaration for cibc.scraper.ts and td.scraper.ts (both need
  username + password fields)
- ScraperInfoDto: add inputSchema field with @ApiProperty; add nested
  PluginFieldDescriptorDto class for Swagger introspection
- ScraperRegistry.listAll(): add inputSchema to the mapped object
- Custom @IsStringRecord() validator: where to place it
  (e.g. packages/backend/src/common/validators/), how it iterates over
  Object.values() to confirm every value is typeof string
- CreateSyncScheduleDto: replace username/password with inputs field decorated
  with @IsObject() and @IsStringRecord(); add dynamic validate() method that
  injects ScraperRegistry, looks up the bankId from the request, and asserts
  all required inputSchema keys are present — document the NestJS custom
  validation approach (ValidatorConstraint + @Validate decorator)
- UpdateSyncScheduleDto: because it extends PartialType(OmitType(...)), verify
  whether inputs? is inherited automatically or needs an explicit override
- Prisma migration: exact command
  (npx prisma migrate dev --name rename-credentials-enc) and confirm no data
  migration SQL is needed beyond the column rename
- scraper.service.ts: rename schedule.credentialsEnc → schedule.pluginConfigEnc
  and update the JSON cast from {username, password} to Record<string, string>
- Frontend: where to run `npm run generate:api` before starting React changes;
  list every generated file that changes
- SyncScheduleFormValues change and cascading impact on EMPTY_FORM, openEdit,
  validateForm, and both mutate call sites
- SyncScheduleForm.tsx render loop design: derive the selected scraper object
  from scrapers?.find(s => s.bankId === values.bankId) then map over
  scraper?.inputSchema; handle the no-scraper-selected state (render nothing
  or a placeholder)
- Test cases for backend and frontend (see Steps 4 and 5)
```

#### Step 2 — Implement Backend

```
@docs/scraper-plugins/roadmap.md
@test-plan/scraper-plugins/milestone-4-implementation-plan.md

backend-dev — Implement the backend half of Milestone 4 — Plugin Input Schema
using the plan above. Work through the files in this order to avoid type errors
cascading across the build:

1. packages/backend/src/scraper/interfaces/bank-scraper.interface.ts
   - Add PluginFieldDescriptor interface before BankScraper
   - Add `inputSchema: PluginFieldDescriptor[]` as a required property on BankScraper
   - Add `PluginInputs = Record<string, string>` type alias; remove BankCredentials
   - Update ScraperWorkerInput: rename credentials field from
     `{username: string, password: string}` to `inputs: PluginInputs`

2. packages/backend/src/scraper/banks/cibc.scraper.ts and td.scraper.ts
   - Remove the BankCredentials import; import PluginInputs instead
   - Add inputSchema array (username + password fields for both)
   - Update login() signature from (page, credentials: BankCredentials) to
     (page, inputs: PluginInputs)

3. packages/backend/src/scraper/scraper.plugin-loader.ts
   - In isBankScraper, add: Array.isArray(v.inputSchema) to the return
     expression alongside the existing field checks

4. packages/backend/src/common/validators/is-string-record.validator.ts (new)
   - Implement @IsStringRecord() using ValidatorConstraint; validate() returns
     false if the value is not a plain object or if any Object.values() entry
     is not typeof string

5. packages/backend/src/scraper/scraper-info.dto.ts
   - Add a PluginFieldDescriptorDto class with all six fields decorated with
     @ApiProperty (including @ApiPropertyOptional for hint and options)
   - Add `inputSchema: PluginFieldDescriptorDto[]` to ScraperInfoDto

6. packages/backend/src/scraper/scraper.registry.ts
   - In listAll(), add inputSchema: s.inputSchema to the mapped object

7. packages/backend/src/scraper/sync/dto/create-sync-schedule.dto.ts
   - Remove username and password fields entirely
   - Add `inputs: Record<string, string>` with @IsObject(), @IsStringRecord(),
     and @ApiProperty
   - Add a ValidatorConstraint (RequiredInputsConstraint) that injects
     ScraperRegistry, finds the plugin by the DTO's bankId field, and checks
     that every inputSchema entry with required: true has a non-empty string
     value in inputs; decorate the class with @Validate(RequiredInputsConstraint)

8. packages/backend/src/scraper/sync/dto/update-sync-schedule.dto.ts
   - Confirm whether inputs? is inherited via PartialType(OmitType(...)); if
     not, add an explicit `inputs?: Record<string, string>` override

9. packages/backend/prisma/schema.prisma
   - Rename credentialsEnc / credentials_enc → pluginConfigEnc / plugin_config_enc
     on the SyncSchedule model

10. Run: cd packages/backend && npx prisma migrate dev --name rename-credentials-enc
    Verify the generated migration SQL is ALTER TABLE sync_schedules RENAME COLUMN
    credentials_enc TO plugin_config_enc and nothing else.

11. packages/backend/src/scraper/scraper.service.ts
    - Replace schedule.credentialsEnc with schedule.pluginConfigEnc in runWorker()
    - Update the JSON cast from {username, password} to Record<string, string>
    - Update the workerInput construction: rename the credentials key to inputs

Follow all backend conventions: # path aliases, .js ESM extensions on internal
imports, class-validator decorators on all DTO fields, @ApiProperty on all
public DTO properties. After implementing, run npm run typecheck and npm run lint
to confirm the build is clean before finishing.
```

#### Step 3 — Implement Frontend

```
@docs/scraper-plugins/roadmap.md
@test-plan/scraper-plugins/milestone-4-implementation-plan.md

frontend-dev — Implement the frontend half of Milestone 4 — Plugin Input Schema.
The backend OpenAPI must be stable before starting. Run API regeneration first:

  cd packages/frontend && npm run generate:api

Confirm these generated files have changed before proceeding:
- packages/frontend/src/api/model/scraperInfoDto.ts — must now include
  inputSchema: PluginFieldDescriptor[] (or the equivalent inline type)
- packages/frontend/src/api/model/createSyncScheduleDto.ts — must have inputs
  instead of username/password
- packages/frontend/src/api/model/updateSyncScheduleDto.ts — must have inputs?

If any of these files did not change, the backend swagger is not yet updated —
stop and notify the user before continuing.

Then implement in this order:

1. packages/frontend/src/features/scraper/types/scraper.types.ts
   - In SyncScheduleFormValues: remove username and password; add
     inputs: Record<string, string>
   - SyncScheduleFormErrors is a Partial<Record<keyof SyncScheduleFormValues, string>>
     — it will automatically reflect the removal of username/password; no manual
     change needed there

2. packages/frontend/src/features/scraper/hooks/useSyncSchedule.ts
   - EMPTY_FORM: replace username: '' and password: '' with inputs: {}
   - openCreate(): no change needed beyond the EMPTY_FORM update
   - openEdit(): replace username: '' and password: '' with inputs: {}
   - validateForm(): remove the username/password required checks; add a loop
     over the selected plugin's inputSchema (passed in as a new parameter or
     derived from the scrapers list) that checks every required: true key has
     a non-empty value in inputs; errors for input fields use the key as the
     error key (e.g. errors['inputs.username'])
   - handleSubmit create path: replace username/password in the mutate data
     with inputs: formValues.inputs
   - handleSubmit update path: replace the username/password conditional logic
     with inputs: formValues.inputs if any key is non-empty, else omit the
     inputs field entirely

3. packages/frontend/src/features/scraper/components/SyncScheduleForm.tsx
   - Remove the hardcoded credentials <div className={styles.row}> block
     (lines 98–141 in the current file)
   - After the Bank selector section, derive the selected scraper:
     const selectedScraper = scrapers?.find(s => s.bankId === values.bankId)
   - Render a loop over selectedScraper?.inputSchema ?? []; for each descriptor:
     - type 'text':     <input type="text"> with id="ss-input-{descriptor.key}",
                        value={values.inputs[descriptor.key] ?? ''}, required
                        only when descriptor.required and !editMode
     - type 'password': <input type="password"> with
                        autoComplete={editMode ? 'new-password' : 'current-password'},
                        placeholder={editMode ? 'Leave blank to keep unchanged' : ''}
     - type 'number':   <input type="number">
     - type 'select':   <select> with descriptor.options?.map() for the option
                        elements; include a blank "Select…" default option
     - For every field: render descriptor.hint (if present) as a
                        <span className={styles.hint}> below the input, matching
                        the existing hint pattern already used for Account and
                        Schedule fields
     - Error display: check errors[`inputs.${descriptor.key}`] and render a
                      <span role="alert" className={styles.error}> if set
   - When no bank is selected (selectedScraper is undefined), render nothing in
     place of the input schema section — do not crash

Use @/ and @features/ path aliases throughout. Do not use relative imports.
After implementing, run npm run typecheck and npm run lint in packages/frontend
to confirm the build is clean.
```

#### Step 4 — Tests

```
@docs/scraper-plugins/roadmap.md
@test-plan/scraper-plugins/milestone-4-implementation-plan.md

test-writer — Write Vitest tests for the Milestone 4 backend changes and React
Testing Library tests for the frontend changes. Read every existing spec file
before writing anything — match the existing mock setup, factory patterns, and
assertion style exactly.

Backend — packages/backend/src/scraper/__TEST__/scraper.plugin-loader.spec.ts:
- Update the makePlugin() factory helper to include an inputSchema array
  (e.g. [{key: 'username', label: 'Username', type: 'text', required: true}])
  so existing tests continue to compile and pass
- Add: isBankScraper returns false when inputSchema property is absent
- Add: isBankScraper returns false when inputSchema is present but not an array
- Add: isBankScraper returns true when inputSchema is a valid PluginFieldDescriptor[]

Backend — packages/backend/src/scraper/__TEST__/scraper.registry.spec.ts:
- Update the makeScraper() factory helper to include inputSchema: [] so the
  type compiles
- Update the existing listAll() serialisation assertion (currently at line 53)
  to include inputSchema: [] in the expected object shape
- Add: listAll() includes the inputSchema array from the plugin when it is
  non-empty; assert the descriptor shape is passed through unmodified

Backend — packages/backend/src/scraper/__TEST__/create-sync-schedule.dto.spec.ts
(new file if it does not already exist):
- Happy path: inputs contains all required keys from the plugin's inputSchema
  and a non-required key → 0 validation errors
- Missing required key: inputs is missing a key marked required: true in the
  plugin's inputSchema → validation error on the inputs field
- Empty string for required key: inputs[key] === '' → validation error
- inputs value is a number: inputs: {username: 123} → @IsStringRecord() fires
- inputs field entirely absent → @IsObject() / @IsNotEmpty() fires
- bankId does not match any registered plugin → validation error (or 404
  depending on how RequiredInputsConstraint handles missing registry entry —
  document the chosen behaviour)

Frontend — SyncScheduleForm.test.tsx (co-locate with SyncScheduleForm.tsx):
- Renders a text input for a descriptor with type: 'text' and the correct label
- Renders a password input for a descriptor with type: 'password'
- Renders a number input for a descriptor with type: 'number'
- Renders a select element for a descriptor with type: 'select' and correct
  option elements matching the options array
- Renders hint text below the field when descriptor.hint is defined
- Does not render hint text when descriptor.hint is undefined
- Required text field blocks form submission when empty (required: true)
- Non-required field does not block form submission when empty (required: false)
- Renders nothing in the input schema section when no bank is selected
  (values.bankId is '')
- In edit mode, password field placeholder is 'Leave blank to keep unchanged'

Run the full spec suite after writing and fix any failures before finishing.
```

#### Step 5 — Live API Testing

```
@docs/scraper-plugins/roadmap.md
@test-plan/scraper-plugins/milestone-4-implementation-plan.md

backend-tester — Run the Milestone 4 API test plan against the running server
at http://localhost:3001. Save the test plan to
test-plan/scraper-plugins/milestone-4-backend.md and the execution report to
test-plan/scraper-plugins/milestone-4-backend-report.md.

Test cases to execute:

GET /admin/scrapers (or GET /scrapers — confirm the correct route):
- No auth token → 401
- Valid auth token → 200; each entry in the response array has an inputSchema
  array; for the 'cibc' entry assert inputSchema contains at least two
  descriptors with keys 'username' and 'password'

POST /scraper/sync/schedules (create):
- No auth token → 401
- Valid token, all required inputSchema fields present in inputs →
  201 with the created schedule; assert no username or password fields appear
  at the top level of the response body
- Valid token, inputs object present but missing a required key (e.g. omit
  'password') → 422 (Unprocessable Entity) with a validation error message
  referencing the missing required input
- Valid token, inputs value is a non-string type, e.g.
  {"inputs": {"username": 123, "password": "secret"}} → 400 validation error
  from @IsStringRecord()
- Valid token, inputs field entirely absent from request body → 400 validation
  error
- Valid token, bankId does not match any registered plugin → document expected
  status (400 from RequiredInputsConstraint or 422); assert a descriptive error
  message is returned

PATCH /scraper/sync/schedules/:id (update):
- Valid token, inputs: {} (no changes to stored credentials) → 200, schedule
  updated (cron or enabled changed without touching inputs)
- Valid token, inputs: {password: 'new-secret'} → 200, schedule updated
- Valid token, inputs value is a non-string type → 400

All requests authenticated as a USER-role account; add an ADMIN-role variant
only where the endpoint requires it.
```

#### Step 6 — Code Review

```
@docs/scraper-plugins/roadmap.md
@test-plan/scraper-plugins/milestone-4-implementation-plan.md

code-reviewer — Review the Milestone 4 changes across both packages. Focus on:

Backend:
- isBankScraper guard: confirm Array.isArray(v.inputSchema) was added and that
  a plugin object with no inputSchema property is correctly rejected at load time
- @IsStringRecord() validator: confirm it iterates Object.values() and returns
  false for any non-string value including numbers, booleans, null, and arrays;
  confirm it also returns false for non-plain-object inputs (e.g. arrays)
- Dynamic validation in CreateSyncScheduleDto: confirm the
  RequiredInputsConstraint cannot be bypassed — e.g. if the bankId in the
  request refers to an unregistered plugin, does the constraint throw or skip?
  The chosen behaviour must be consistent with what the backend-tester documented
- Prisma migration: open the generated migration file and confirm it contains
  only an ALTER TABLE ... RENAME COLUMN statement and no data modification SQL;
  confirm no other migration was generated unintentionally
- scraper.service.ts: confirm schedule.pluginConfigEnc replaces every occurrence
  of schedule.credentialsEnc; confirm the JSON cast in runWorker() is now
  `as Record<string, string>` not `as {username: string, password: string}`;
  confirm the workerInput uses the inputs key
- ScraperRegistry.listAll(): confirm inputSchema is mapped through and not
  accidentally omitted from the returned object
- UpdateSyncScheduleDto: confirm inputs? is correctly optional and that the
  PartialType/OmitType inheritance chain does not accidentally make inputs
  required or strip it

Frontend:
- Orval-generated files: confirm scraperInfoDto.ts, createSyncScheduleDto.ts,
  and updateSyncScheduleDto.ts all reflect the backend schema changes and were
  not hand-edited
- SyncScheduleForm.tsx render loop: confirm the loop handles all four field
  types (text, password, number, select) and that a descriptor with an unknown
  type does not crash the component (e.g. falls through silently or renders a
  text input as a safe default)
- useSyncSchedule.ts validation: confirm the required-field check for inputs
  uses the inputSchema from the correct scraper (the one matching values.bankId)
  and does not validate against a stale or wrong scraper's schema
- Type safety: confirm no uses of `as any` or suppressed TypeScript errors were
  introduced; confirm SyncScheduleFormErrors no longer references username or
  password keys
```

#### Step 7 — Commit

```
@docs/scraper-plugins/roadmap.md

backend-dev — Commit the Milestone 4 changes with message:
feat(scraper): add plugin input schema and dynamic credential fields
```

---

## Milestone 5 — Scraper Worker Implementation (Phase 8)

**Goal:** Replace the Phase 7 stub in `scraper.worker.ts` with real scraping logic.
Validate the complete end-to-end pipeline — MFA bridge, dryRun gate, deduplication,
`prisma.transaction.createMany`, and SSE events — using a new built-in stub plugin
(`banks/stub.scraper.ts`) rather than live CIBC or TD bank automation. After this
milestone, the worker is production-ready for any plugin whose `BankScraper`
implementation handles the real browser automation.

> **Design change (implemented):** Browser/page lifecycle is the plugin's responsibility.
> The worker does not launch Playwright or create a `Page` — plugins call
> `chromium.launch()` and `browser.newPage()` themselves inside `login()` and
> `scrapeTransactions()`. `scraper-admin.service.ts` (the dry-run test endpoint) follows
> the same contract. This was a deliberate deviation from the original plan to keep the
> framework agnostic of browser technology.

### Key Changes

#### 1. `scraper.worker.ts` — replace Phase 7 stub with real implementation

The worker implements the full Phase 8 pipeline without managing browser lifecycle
directly — that is the plugin's responsibility:

- Dynamically import the plugin by absolute file path:
  `const mod = await import(input.pluginPath)` — no NestJS DI in the worker.
- Call `scraper.login(input.inputs)`.
  - If `login` throws `MfaRequiredError`: post `{ type: 'mfa_required', prompt }` to
    the main thread, then `await` a `parentPort.once('message')` reply carrying
    `{ type: 'mfa_code', code }`. Call `scraper.submitMfa(code)` to resume.
- Call `scraper.scrapeTransactions(input.inputs, { startDate, endDate, includePending: true })`.
- Run deduplication (see item 8 below).
- Gate `prisma.transaction.createMany` behind `if (!input.dryRun)` — this is where
  Milestone 3's `dryRun` flag is actually enforced at the write step.
- Post `{ type: 'result', transactions: newRows, importedCount, skippedCount }` to the
  main thread.
- Always `await prisma.$disconnect()` in a `finally` block.

> **Note:** The worker does not call `chromium.launch()` or `browser.close()` — plugins
> own their browser session entirely. The `finally` block only disconnects Prisma.

Worker timeout: `ScraperService` already terminates the worker after 5 minutes
(`WORKER_TIMEOUT_MS = 5 * 60 * 1000`) and marks the job `failed`. No change needed
in the service for this milestone.

#### 2. `ScraperWorkerInput` — add `pluginPath` and `databaseUrl` fields

Add two new required fields to the interface in `bank-scraper.interface.ts`:

```typescript
pluginPath: string;    // absolute path to the compiled .js plugin file
databaseUrl: string;   // DATABASE_URL passed explicitly — process.env is not shared
                       // across worker_thread V8 isolates
```

`userId`, `accountId`, and `dryRun` are already present in the interface. No further
additions are needed there.

#### 3. `ScraperService.runWorker()` — resolve `pluginPath` before spawning

Before constructing `workerInput`, call `registry.getPluginPath(schedule.bankId)` to
obtain the absolute plugin file path, then add it — along with
`process.env.DATABASE_URL` — to the `workerInput` object:

```typescript
const pluginPath = this.registry.getPluginPath(schedule.bankId);
if (!pluginPath) throw new NotFoundException(`No plugin path for bankId ${schedule.bankId}`);

const workerInput: ScraperWorkerInput = {
    ...existingFields,
    pluginPath,
    databaseUrl: process.env.DATABASE_URL ?? '',
};
```

`ScraperService` gains a constructor dependency on `ScraperRegistry`.

#### 4. `ScraperRegistry` — store plugin file path alongside scraper instance

Change the internal map from `Map<string, BankScraper>` to
`Map<string, { scraper: BankScraper; pluginPath: string }>`.

Update the public API:

| Method | Change |
|--------|--------|
| `register(scraper, pluginPath)` | Add `pluginPath: string` second parameter |
| `findByBankId(bankId)` | Returns `BankScraper \| undefined` — unchanged |
| `has(bankId)` | Unchanged |
| `listAll()` | Unchanged (maps scraper fields; `pluginPath` not exposed in DTO) |
| `getPluginPath(bankId)` | **New** — returns `string \| undefined` |

Update the NestJS constructor injection path: scrapers injected via the
`BANK_SCRAPER` multi-provider token are registered without a file path
(`pluginPath: ''`). Only plugins loaded by `ScraperPluginLoader` have a real path.

#### 5. `ScraperPluginLoader` — pass file path to `register()`

In `loadPlugins()`, after a successful `isBankScraper(plugin)` check, call:

```typescript
this.registry.register(plugin, filePath);
```

`filePath` is already available in the loop as the absolute path used for the dynamic
`import()`. No other changes to the loader are needed.

#### 6. `MfaRequiredError` class — new shared error

Add `MfaRequiredError` to `bank-scraper.interface.ts` (or a co-located
`bank-scraper.errors.ts` — either is acceptable):

```typescript
export class MfaRequiredError extends Error {
    constructor(public readonly prompt: string) {
        super(`MFA required: ${prompt}`);
        this.name = 'MfaRequiredError';
    }
}
```

Plugin authors throw this from `login()` when the bank presents an OTP/MFA screen.
The worker catches it, suspends, forwards the prompt to the main thread, and resumes
once the user submits a code.

Also add `submitMfa` as an **optional** method on the `BankScraper` interface:

```typescript
submitMfa?(code: string): Promise<void>;
```

The worker checks `typeof scraper.submitMfa === 'function'` before calling it.
Banks where sessions persist between runs and MFA is rare may omit the method; banks
with `requiresMfaOnEveryRun: true` should implement it. The plugin is responsible for
retaining any browser/page reference needed to submit the code — the worker passes
only the code string.

#### 7. `banks/stub.scraper.ts` — new built-in test plugin

A minimal `BankScraper` implementation that validates the full pipeline in CI and
local dev without live bank credentials or a real browser:

```typescript
export default {
    bankId: 'stub',
    displayName: 'Stub Bank (test only)',
    requiresMfaOnEveryRun: false,
    maxLookbackDays: 365,
    pendingTransactionsIncluded: false,
    inputSchema: [
        { key: 'username', label: 'Username', type: 'text', required: true },
    ],

    async login(_inputs: PluginInputs): Promise<void> {
        // No-op — resolves immediately without launching a browser.
    },

    async scrapeTransactions(
        _inputs: PluginInputs,
        _options: ScrapeOptions
    ): Promise<RawTransaction[]> {
        // Returns 3 hardcoded rows with predictable syntheticId values.
        return [
            { date: '2024-01-15', description: 'Stub Grocery',   amount: -42.00,  pending: false, syntheticId: 'stub-aaa-0001' },
            { date: '2024-01-16', description: 'Stub Coffee',     amount: -4.50,   pending: false, syntheticId: 'stub-bbb-0002' },
            { date: '2024-01-17', description: 'Stub Salary',     amount: 2500.00, pending: false, syntheticId: 'stub-ccc-0003' },
        ];
    },
};
```

The stub does not launch a browser or reference any page object — it is safe to run
in unit tests with no Playwright dependency. The `syntheticId` values match what the
real `stub.scraper.ts` emits so dedup tests are deterministic.

Add `'stub.scraper.js'` to `BUILTIN_PLUGINS` in `ScraperPluginLoader` so the stub is
seeded into `SCRAPER_PLUGIN_DIR` alongside CIBC and TD on startup.

#### 8. Worker database access — instantiate `PrismaClient` directly

The worker does not have access to NestJS DI. It instantiates its own `PrismaClient`
using the `databaseUrl` from `workerData`:

```typescript
const prisma = new PrismaClient({ datasources: { db: { url: input.databaseUrl } } });
```

After writing (or after the dryRun skip), call `await prisma.$disconnect()` in the
`finally` block. Browser cleanup is the plugin's responsibility — the worker has no
browser reference to close.

#### 9. Deduplication query before write

Before calling `createMany`, query existing `fitid` values for the scraped rows to
identify duplicates:

```typescript
const existingFitids = new Set(
    (await prisma.transaction.findMany({
        where: { userId: input.userId, fitid: { in: transactions.map(t => t.syntheticId) } },
        select: { fitid: true },
    })).map(r => r.fitid)
);
const newRows = transactions.filter(t => !existingFitids.has(t.syntheticId));
const skippedCount = transactions.length - newRows.length;
```

Map `RawTransaction` fields to `Transaction` Prisma model fields before passing to
`createMany`. The `fitid` column maps to `RawTransaction.syntheticId`.

#### 10. Worker `result` message — updated shape

After writing (or skipping the write on dryRun), post:

```typescript
parentPort!.postMessage({
    type: 'result',
    transactions: newRows,
    importedCount: input.dryRun ? 0 : newRows.length,
    skippedCount,
});
```

Update the `WorkerMessage` union type to include `importedCount` and `skippedCount`
on the `result` variant:

```typescript
| { type: 'result'; transactions: RawTransaction[]; importedCount: number; skippedCount: number }
```

Update `ScraperService.handleResult()` to read `importedCount` and `skippedCount`
from the message directly instead of computing them from `transactions.length`. Remove
the Phase 7 `// TODO Phase 8` comment block.

### Files Affected

| File | Change |
|------|--------|
| `packages/backend/src/scraper/interfaces/bank-scraper.interface.ts` | Add `MfaRequiredError` class; add optional `submitMfa?(code: string)` to `BankScraper` (no page — plugin retains its own browser reference); update `login` and `scrapeTransactions` signatures (no page param); add `pluginPath: string` and `databaseUrl: string` to `ScraperWorkerInput`; extend `result` variant of `WorkerMessage` with `importedCount` and `skippedCount` |
| `packages/backend/src/scraper/scraper.worker.ts` | Replace Phase 7 stub with full Phase 8 implementation: dynamic plugin import, login + MFA bridge, scrapeTransactions, dedup query, dryRun-gated createMany, result message, `prisma.$disconnect()` in finally (no Playwright in worker — plugins own browser lifecycle) |
| `packages/backend/src/scraper/banks/stub.scraper.ts` | **New** — built-in stub test plugin (`bankId: 'stub'`) returning 3 hardcoded transactions; no real browser calls |
| `packages/backend/src/scraper/scraper.registry.ts` | Internal map changed to `Map<string, { scraper: BankScraper; pluginPath: string }>`; `register()` gains `pluginPath` parameter; add `getPluginPath(bankId)` method |
| `packages/backend/src/scraper/scraper.plugin-loader.ts` | Add `'stub.scraper.js'` to `BUILTIN_PLUGINS`; pass `filePath` as second arg to `registry.register()` |
| `packages/backend/src/scraper/scraper.service.ts` | Inject `ScraperRegistry`; call `registry.getPluginPath()` in `runWorker()`; add `pluginPath` and `databaseUrl` to `workerInput`; update `handleResult()` to read `importedCount`/`skippedCount` from message |
| `packages/backend/src/scraper/__TEST__/scraper.worker.spec.ts` | Replace Phase 7 stub tests with Phase 8 real-logic tests using stub scraper |
| `packages/backend/src/scraper/__TEST__/scraper.registry.spec.ts` | Update `register()` call sites to pass `pluginPath`; add `getPluginPath()` tests |
| `packages/backend/src/scraper/__TEST__/scraper.plugin-loader.spec.ts` | Update `registry.register` spy assertion to include `filePath` argument; add `stub.scraper.js` seeding test |
| `packages/backend/src/scraper/__TEST__/scraper.service.spec.ts` | Add `ScraperRegistry` mock; assert `pluginPath` and `databaseUrl` in worker input; assert `importedCount`/`skippedCount` read from message not recomputed |

### Decision Notes

- **Why pass `pluginPath` not the scraper object:** Worker threads run in a separate
  V8 isolate. `workerData` serialisation only works for plain objects — class
  instances, closures, and NestJS DI context cannot be transferred across thread
  boundaries. The worker must re-import the plugin module independently using the
  file path.

- **Why a stub plugin, not CIBC/TD:** Real bank scrapers require live credentials, a
  visible browser session, and an accessible bank website. These are unavailable in CI
  and in most local dev environments. The stub lets us validate the complete worker
  pipeline — dynamic import, MFA bridge, dryRun gate, dedup query,
  `prisma.transaction.createMany`, and all SSE events — with deterministic hardcoded
  data and no external dependencies.

- **Why `submitMfa` is optional on `BankScraper`:** Banks that use
  `requiresMfaOnEveryRun: true` must implement it. Banks where sessions persist
  between runs may never encounter an MFA challenge in normal operation and can omit
  it. The worker checks `typeof scraper.submitMfa === 'function'` before calling,
  providing a safe default for plugins that do not declare the method. The signature
  is `submitMfa(code: string)` — no `page` parameter. The plugin retains its own
  browser/page reference (e.g. a module-level variable) between `login()` and
  `submitMfa()` calls.

- **Why `DATABASE_URL` in `workerData`:** Worker threads are separate V8 isolates.
  `process.env` is not automatically inherited from the main thread in all Node.js
  versions and hosting environments. Passing the URL explicitly via `workerData`
  ensures the worker can always instantiate `PrismaClient` regardless of environment
  configuration.

- **Why dedup runs in the worker, not in `ScraperService`:** The Phase 7 architecture
  deferred dedup to Phase 8 with a comment stub in `handleResult()`. Placing the dedup
  and write inside the worker keeps the thread self-contained and ensures
  `importedCount`/`skippedCount` are computed atomically alongside the write. The
  service no longer needs to know about transaction contents — it only forwards counts
  from the message.

- **`ScraperService.handleResult()` simplification:** The Phase 7 stub in
  `handleResult()` set `importedCount = transactions.length` and `skippedCount = 0`
  directly. In Phase 8, these values arrive in the `result` message from the worker.
  The service reads them verbatim — no recomputation.

### Recommended Next Actions

#### Step 1 — Plan ✅ Done

```
@docs/scraper-plugins/roadmap.md

planner — Produce a full implementation plan for Milestone 5 — Scraper Worker
Implementation. Research the following files before writing anything:

1. packages/backend/src/scraper/scraper.worker.ts — understand the Phase 7 stub
   (lines 86–94) and the Phase 8 comment block (lines 43–85) that describes the
   intended implementation
2. packages/backend/src/scraper/interfaces/bank-scraper.interface.ts — understand
   BankScraper, PluginInputs, ScraperWorkerInput, RawTransaction, and WorkerMessage;
   identify the fields that need to be added (pluginPath, databaseUrl, MfaRequiredError,
   submitMfa?, importedCount, skippedCount)
3. packages/backend/src/scraper/scraper.service.ts — understand how runWorker()
   constructs workerInput; identify where pluginPath and databaseUrl must be added;
   understand handleResult() and what the Phase 7 TODO comment says
4. packages/backend/src/scraper/scraper.registry.ts — understand the current
   Map<string, BankScraper> structure; plan the metadata change and getPluginPath()
5. packages/backend/src/scraper/scraper.plugin-loader.ts — understand how register()
   is called today; plan the filePath argument addition and stub seeding
6. packages/backend/src/scraper/banks/cibc.scraper.ts — read to understand the plugin
   file export shape; the stub must match the same pattern
7. packages/backend/src/scraper/__TEST__/scraper.worker.spec.ts — read the existing
   Phase 7 stub tests; plan how to replace them with Phase 8 stub-plugin tests
8. packages/backend/src/scraper/__TEST__/scraper.registry.spec.ts — read the
   makeScraper() factory and register() call sites; plan the pluginPath additions
9. packages/backend/src/scraper/__TEST__/scraper.service.spec.ts — read the existing
   mock setup; plan ScraperRegistry injection and new assertions

Save the plan to test-plan/scraper-plugins/milestone-5-implementation-plan.md.

The plan must cover:
- bank-scraper.interface.ts: MfaRequiredError class, optional submitMfa?, pluginPath
  and databaseUrl additions to ScraperWorkerInput, updated WorkerMessage result variant
- scraper.worker.ts: full Phase 8 implementation replacing the stub — chromium.launch,
  dynamic import(input.pluginPath), login + MFA bridge, scrapeTransactions, dedup
  query, dryRun-gated createMany, PrismaClient instantiation with databaseUrl,
  $disconnect in finally, result message with importedCount and skippedCount
- banks/stub.scraper.ts: complete implementation of the stub plugin
- scraper.registry.ts: internal metadata map change, register() signature, getPluginPath()
- scraper.plugin-loader.ts: stub added to BUILTIN_PLUGINS, filePath passed to register()
- scraper.service.ts: ScraperRegistry injection, pluginPath + databaseUrl in workerInput,
  handleResult() reading counts from message
- Test strategy: which parts to unit-test (stub plugin, registry, service), which parts
  to integration-test (worker with real stub scraper — no Playwright browser needed
  because the stub ignores the page argument), which parts to mark as manual-only
  (real CIBC/TD browser automation)
```

#### Step 2 — Implement Backend ✅ Done

```
@docs/scraper-plugins/roadmap.md
@test-plan/scraper-plugins/milestone-5-implementation-plan.md

backend-dev — Implement Milestone 5 — Scraper Worker Implementation using the plan
above. Work through the files in this order to avoid type errors cascading:

1. packages/backend/src/scraper/interfaces/bank-scraper.interface.ts
   - Add MfaRequiredError class (export it — the worker and plugin authors both need it)
   - Update login(inputs) and scrapeTransactions(inputs, options) — no page parameter
   - Add optional submitMfa?(code: string): Promise<void> to BankScraper (no page —
     plugin retains its own browser reference between login() and submitMfa())
   - Add pluginPath: string and databaseUrl: string to ScraperWorkerInput
   - Extend the result variant of WorkerMessage: add importedCount: number and
     skippedCount: number alongside the existing transactions field

2. packages/backend/src/scraper/banks/stub.scraper.ts (new file)
   - Implement the stub plugin as described in the roadmap Key Changes section 7
   - Default export only — same shape as cibc.scraper.ts and td.scraper.ts
   - login() and scrapeTransactions() must NOT call any page methods

3. packages/backend/src/scraper/scraper.registry.ts
   - Change internal map type to Map<string, { scraper: BankScraper; pluginPath: string }>
   - Update register() to accept pluginPath: string as second parameter (default '' for
     NestJS constructor injection path)
   - Update findByBankId() to return scraper from the metadata object
   - Update has() and listAll() accordingly
   - Add getPluginPath(bankId: string): string | undefined

4. packages/backend/src/scraper/scraper.plugin-loader.ts
   - Add 'stub.scraper.js' to BUILTIN_PLUGINS
   - In loadPlugins(), change registry.register(plugin) to registry.register(plugin, filePath)

5. packages/backend/src/scraper/scraper.service.ts
   - Inject ScraperRegistry via constructor (add to constructor parameters and DI)
   - In runWorker(), call registry.getPluginPath(schedule.bankId); throw NotFoundException
     if undefined
   - Add pluginPath and databaseUrl: process.env.DATABASE_URL ?? '' to workerInput
   - In handleResult(), read importedCount and skippedCount from the message object
     instead of computing them; remove the Phase 7 TODO comment block

6. packages/backend/src/scraper/scraper.worker.ts
   - Replace the Phase 7 stub block with the full Phase 8 implementation
   - Import MfaRequiredError and PrismaClient; do NOT import or launch Playwright —
     plugins own browser lifecycle entirely
   - Call scraper.login(input.inputs) and scraper.scrapeTransactions(input.inputs, {...})
     with no page argument
   - Call scraper.submitMfa(code) — no page argument
   - finally block: only prisma.$disconnect(); no browser.close()
   - See the roadmap Key Changes sections 1, 8, 9, and 10 for the exact implementation

Follow all backend conventions: # path aliases, .js ESM extensions on internal imports.
The worker is exempt from NestJS DI conventions — use direct imports and direct
PrismaClient instantiation. After implementing, run npm run typecheck and npm run lint
to confirm the build is clean before finishing.
```

#### Step 3 — Tests

```
@docs/scraper-plugins/roadmap.md
@test-plan/scraper-plugins/milestone-5-implementation-plan.md

test-writer — Write Vitest tests for the Milestone 5 changes. Read every existing spec
file before writing anything — match the existing mock setup, factory patterns, and
assertion style exactly.

packages/backend/src/scraper/__TEST__/scraper.registry.spec.ts:
- Update all register() call sites to pass a second pluginPath argument (e.g. '/tmp/test.js')
- Update the BANK_SCRAPER constructor injection path: confirm register() with no
  pluginPath (or empty string) does not throw
- Add: getPluginPath() returns the path that was passed to register()
- Add: getPluginPath() returns undefined for an unregistered bankId
- Add: register() with a pluginPath overwrites a previous registration including its path

packages/backend/src/scraper/__TEST__/scraper.plugin-loader.spec.ts:
- Update the registry.register spy assertion: confirm the second argument (filePath)
  is the absolute path to the loaded .js file
- Add: stub.scraper.js is copied to SCRAPER_PLUGIN_DIR on seedBuiltins() if absent
- Add: stub.scraper.js seeding is skipped if the file already exists (idempotent)

packages/backend/src/scraper/__TEST__/scraper.service.spec.ts:
- Add ScraperRegistry to the mock module — mock getPluginPath() to return a test path
- Add: runWorker() includes pluginPath from registry.getPluginPath() in workerData
- Add: runWorker() includes databaseUrl in workerData
- Add: runWorker() throws NotFoundException when registry.getPluginPath() returns undefined
- Add: handleResult() reads importedCount and skippedCount from the worker message
  rather than computing from transactions.length
- Update existing workerData assertions to include the new required fields

packages/backend/src/scraper/__TEST__/scraper.worker.spec.ts:
- Replace the Phase 7 stub tests with Phase 8 tests using the stub plugin
- Do NOT mock playwright — the worker does not import or use it
- Mock PrismaClient: mock transaction.findMany() to return [] (no existing fitids) and
  transaction.createMany() to resolve; assert prisma.$disconnect() called in finally
- Mock import() for input.pluginPath to return the stub plugin default export
- Test: result message contains importedCount: 3 and skippedCount: 0 for a clean run
  (stub returns 3 rows, no existing fitids)
- Test: dedup — when findMany returns existing fitids for 1 of 3 stub rows, skippedCount
  is 1 and importedCount is 2 and createMany is called with only the 2 new rows
- Test: dryRun: true — createMany is NOT called; importedCount is 0; skippedCount still
  computed correctly
- Test: MFA bridge — mock login() to throw MfaRequiredError('Enter OTP'); assert
  mfa_required message posted with correct prompt; simulate mfa_code reply from main;
  assert submitMfa(code) called with just the code string (no page argument)
- Test: prisma.$disconnect() called in finally when login throws a non-MFA error

Run the full spec suite after writing and fix any failures before finishing.
```

#### Step 3 — Tests ✅ Done

#### Step 4 — Live API Testing

```
@docs/scraper-plugins/roadmap.md
@test-plan/scraper-plugins/milestone-5-implementation-plan.md

backend-tester — Run the Milestone 5 API test plan against the running server at
http://localhost:3001. Save the test plan to
test-plan/scraper-plugins/milestone-5-backend.md and the execution report to
test-plan/scraper-plugins/milestone-5-backend-report.md.

Test cases to execute:

POST /scraper/sync/run-now with bankId: 'stub' and dryRun: false, USER token:
- Expect: SSE stream emits logging_in, then complete; terminal event has
  importedCount: 3, skippedCount: 0 (first run — no existing fitids)

POST /scraper/sync/run-now with bankId: 'stub' and dryRun: false, USER token (second run):
- Expect: all 3 stub rows deduplicated; terminal event has importedCount: 0,
  skippedCount: 3

POST /scraper/sync/run-now with bankId: 'stub' and dryRun: true, USER token:
- Expect: SSE complete event has importedCount: 0; no Transaction rows written to DB

GET /admin/scrapers with ADMIN token:
- Expect: 200; response includes a 'stub' entry with displayName 'Stub Bank (test only)'
  and inputSchema containing a 'username' text field

POST /scraper/sync/run-now without auth token:
- Expect: 401

POST /admin/scrapers/:bankId/test with bankId: 'stub', ADMIN token:
- Expect: dry-run result with 3 transactions and importedCount: 3 (this endpoint
  already existed — confirm it still works after the worker change)
```

#### Step 5 — Code Review

```
@docs/scraper-plugins/roadmap.md
@test-plan/scraper-plugins/milestone-5-implementation-plan.md

code-reviewer — Review the Milestone 5 changes in packages/backend/src/scraper/.
Focus on:

- scraper.worker.ts: confirm the worker does NOT import or call playwright/chromium —
  browser lifecycle is entirely the plugin's responsibility; confirm PrismaClient.$disconnect()
  is in a finally block and fires even when login() throws a non-MFA error; confirm the
  dryRun gate is if (!input.dryRun) not a strict equality check; confirm dedup query
  uses userId as a filter to prevent cross-user collisions; confirm importedCount is 0
  on dryRun (not newRows.length)
- MFA bridge: confirm the worker posts mfa_required before awaiting the reply; confirm
  parentPort.once('message') is used (not 'on') so the listener is removed after the
  first code submission; confirm submitMfa(code) is called with only the code string
  (no page argument) and only when typeof scraper.submitMfa === 'function'
- Dynamic import: confirm import(input.pluginPath) is awaited; confirm the worker does
  not assume a specific export shape before validating the default export
- scraper.registry.ts: confirm register() does not crash when pluginPath is empty string
  (NestJS constructor injection path); confirm getPluginPath() returns undefined for
  unknown bankIDs rather than throwing
- scraper.service.ts: confirm getPluginPath() failure path throws NotFoundException
  (not a generic Error) before spawning the worker; confirm databaseUrl is
  process.env.DATABASE_URL and a missing env var results in an empty string (not
  undefined) to avoid workerData serialisation issues; confirm the Phase 7 TODO block
  in handleResult() is fully removed
- stub.scraper.ts: confirm login() and scrapeTransactions() accept (inputs, options)
  with no page argument; confirm syntheticId values are stable strings that will reliably
  trigger dedup on second run
- WorkerMessage result variant: confirm importedCount and skippedCount are required
  (not optional) on the result variant so the service never reads undefined
```

#### Step 6 — Commit

```
@docs/scraper-plugins/roadmap.md

backend-dev — Commit the Milestone 5 changes with message:
feat(scraper): implement Phase 8 scraper worker with stub plugin and dedup
```

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
