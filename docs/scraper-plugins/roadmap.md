# Scraper Plugin System — Enhancement Roadmap

Detailed implementation plans for each milestone live in
[`test-plan/scraper-plugins/`](../../test-plan/scraper-plugins/).

---

## Milestone Status

| # | Milestone | Status |
|---|-----------|--------|
| 1 | Remove Built-ins, Add Startup Seeding | ✅ Done |
| 2 | Dry-run Test Endpoint | ✅ Done |
| 3 | dryRun Flag on Run-Now | 🟨 In Progress |
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
Focus on: guard ordering on the new controller action, correct Playwright
browser lifecycle (browser always closed in finally), DTO validation coverage,
error propagation from login() and scrapeTransactions(), and whether the
service method could leak a browser handle if an unexpected exception is thrown.
Also confirm the response DTO is fully decorated with @ApiProperty so the
OpenAPI spec stays accurate.
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
