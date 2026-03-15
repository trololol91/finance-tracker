# Scraper Plugin System — Enhancement Roadmap

Detailed implementation plans for each milestone live in
[`test-plan/scraper-plugins/`](../../test-plan/scraper-plugins/).

---

## Milestone Status

| # | Milestone | Status |
|---|-----------|--------|
| 1 | Remove Built-ins, Add Startup Seeding | ⬜ Not Started |
| 2 | Dry-run Test Endpoint | ⬜ Not Started |
| 3 | dryRun Flag on Run-Now | ⬜ Not Started |
| 4 | Polymorphic Credentials | ⬜ Not Started |
| 5 | Custom Scraper Type | ⬜ Not Started |

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
  - Request body: `TestScraperDto` — `username`, `password`, `lookbackDays`.
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
- Credentials are not persisted; they are passed directly to the scraper's
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

## Milestone 4 — Polymorphic Credentials

**Goal:** Support scrapers that authenticate via API token, API key, or OAuth2
(not only username/password browser automation), with proper DTO validation per
credential type.

### Key Changes

- Extend `BankCredentials` in `bank-scraper.interface.ts` to a discriminated
  union:
  ```
  type BankCredentials =
    | { type: 'browser';    username: string; password: string }
    | { type: 'api_token';  token: string }
    | { type: 'api_key';    apiKey: string; apiSecret?: string }
    | { type: 'oauth2';     clientId: string; clientSecret: string; refreshToken: string }
  ```
- Add `ApiScraper` interface alongside `BankScraper` for API-based scrapers
  (no Playwright `page` parameter; direct HTTP calls).
- Update `CreateSyncScheduleDto` to accept the union using `@ValidateIf` on
  each credential field, keyed on the `credentialType` discriminant property.
- `credentials_enc` column already stores encrypted JSON — no Prisma migration
  needed.
- Update `CryptoService` encrypt/decrypt callers to handle the new union shape.

### Files Affected

| File | Change |
|------|--------|
| `packages/backend/src/scraper/interfaces/bank-scraper.interface.ts` | Extend `BankCredentials` union; add `ApiScraper` interface |
| `packages/backend/src/scraper/sync/dto/create-sync-schedule.dto.ts` | Add `credentialType` + conditional credential fields |
| `packages/backend/src/scraper/scraper.service.ts` | Update credential decryption to handle union |
| `packages/backend/src/scraper/__TEST__/create-sync-schedule.dto.spec.ts` | Validate each credential shape |

### Decision Notes

- No schema migration — `credentials_enc` is an opaque `String` column that
  holds arbitrary encrypted JSON. The union type is enforced at the DTO layer
  only.
- Existing `browser` scrapers (CIBC, TD) continue to work: their persisted
  credential JSON already contains `username` + `password`; a migration script
  can backfill `type: 'browser'` if needed, or the decrypt path can default to
  `'browser'` when the `type` field is absent.
- `ApiScraper` is additive — `ScraperRegistry` and the plugin loader accept
  any object satisfying either interface (a type union in the type guard).

---

## Milestone 5 — Custom Scraper Type

**Goal:** Allow plugin authors to declare what credential fields their scraper
needs at runtime, so the frontend can render the correct form dynamically
without hardcoding per-bank field lists.

### Key Changes

- Add an optional `credentialSchema: CredentialFieldDescriptor[]` property to
  `BankScraper` (and `ApiScraper`), where `CredentialFieldDescriptor` is:
  ```typescript
  interface CredentialFieldDescriptor {
      key: string;           // field name stored in credentials JSON
      label: string;         // human-readable label
      type: 'text' | 'password' | 'select';
      required: boolean;
      options?: string[];    // for type: 'select'
  }
  ```
- Add `scraperType: 'browser' | 'api' | 'custom'` to `ScraperInfoDto` so the
  frontend knows whether to show the built-in browser-credential form or
  render from `credentialSchema`.
- Extend `GET /scrapers` response to include `scraperType` and
  `credentialSchema` (omitted when absent).
- Credentials are stored as `Record<string, string>` encrypted in the existing
  `credentials_enc` column — no migration needed.
- `isBankScraper` type guard in `scraper.plugin-loader.ts` is updated to
  treat `credentialSchema` as optional (presence is not required for
  validation).

### Files Affected

| File | Change |
|------|--------|
| `packages/backend/src/scraper/interfaces/bank-scraper.interface.ts` | Add `CredentialFieldDescriptor`; add optional `credentialSchema` to `BankScraper` |
| `packages/backend/src/scraper/scraper-info.dto.ts` | Add `scraperType`, `credentialSchema` fields |
| `packages/backend/src/scraper/scraper.registry.ts` | Pass `credentialSchema` through `listAll()` |
| `packages/backend/src/scraper/__TEST__/scraper.registry.spec.ts` | Add `credentialSchema` serialisation test |

### Decision Notes

- `credentialSchema` is intentionally a runtime descriptor array rather than a
  JSON Schema object — it is simpler to render in React without a JSON Schema
  form library, and covers all real-world scraper credential patterns.
- Milestone 4 and Milestone 5 are complementary: M4 handles typed union
  validation for the DTO layer; M5 handles dynamic form rendering for the
  frontend. They can be implemented independently.

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
