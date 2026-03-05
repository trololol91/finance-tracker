# Phase 7 — Transaction Import & Automated Sync: Implementation Plan

**Date**: 2026-03-01  
**Planner**: planner agent  
**Status**: 🟨 Partially Complete — backend core + full frontend done; deferred items below

### Completion summary (as of 2026-03-04)

| Area | Status | Notes |
|------|--------|-------|
| Prisma schema + migration | ✅ Done | ImportJob, SyncSchedule, SyncJob, all enums |
| CryptoService | ✅ Done | AES-256-GCM, unit tested |
| Import service + controller | ✅ Done | CSV/OFX parsing, dedup, bulk insert |
| Sync schedule service + controller | ✅ Done | CRUD, cron registration via SchedulerRegistry, credential encryption |
| SyncSessionStore | ✅ Done | RxJS Subject bridge, MFA callbacks |
| Scraper worker thread | ✅ Done | Phase 7b stub (returns `[]`); full architecture in place |
| ScraperService (orchestrator) | ✅ Done | Worker spawn, SSE wiring, timeout |
| SSE + MFA controller | ✅ Done | `sync-job.controller.ts` |
| ScraperModule registration | ✅ Done | Registered in `app.module.ts` |
| SyncJobStatus / SyncRunStatus constants | ✅ Done | `sync-job-status.ts` — no magic strings |
| `GET /scrapers` endpoint | ✅ Done | `scraper.controller.ts` — public endpoint, lists built-in + plugin scrapers; fixes BUG-03 |
| BUG-01: malformed CSV returns `completed` | ✅ Fixed | `parseCsv` now throws `BadRequestException` on PapaParse errors; job lands in `failed` state |
| BUG-02: DELETE 500 with child SyncJobs | ✅ Fixed | `SyncScheduleService.remove()` calls `syncJob.deleteMany` before `syncSchedule.delete` |
| BUG-04: SSE race condition (stub scraper) | ✅ Fixed | Backend replays terminal event from DB when session is already cleaned up; frontend SSE parser dispatches on `p.status` |
| Backend unit test coverage | ✅ Done | 426 tests passing; 98.39% stmts / 92.37% branch / 96.98% funcs / 98.71% lines; v8 ignores audited and removed where testable |
| Frontend — all components | ✅ Done | FileImportDropzone, ImportJobList, SyncScheduleList/Form/Modal, SyncStatusPanel, MfaModal |
| Frontend — all hooks | ✅ Done | useImportJob, useSyncSchedule, useSyncJob, useSyncStream |
| Frontend — ScraperPage | ✅ Done | Two-tab (Import / Sync) layout |
| Frontend — MfaPage | ✅ Done | `/mfa?scheduleId=…` deep-link page |
| Backend API tests (manual curl) | ✅ Done | 27/30 TC pass; TC-24/26 skipped (stub scraper); see `backend-report.md` |
| Frontend E2E tests (Playwright) | ✅ Done | 25/27 TC pass; 2 skipped; see `frontend-report.md` |
| DISC-001: file size mismatch (5 MB vs 10 MB) | 🔶 Open | Frontend shows "max 10 MB"; backend rejects at 5 MB with HTTP 413 — misleading UX; fix: align `MAX_FILE_SIZE_BYTES` constant or update error handling |
| `scraper.scheduler.ts` (startup re-registration) | ✅ Done | `ScraperScheduler` (OnModuleInit) queries `syncSchedule WHERE enabled=true` and re-registers each cron job in `SchedulerRegistry` on startup. 7 unit tests. Commit: `fe212ee` |
| `scraper.plugin-loader.ts` | 🔜 Phase 8 | No prerequisites — loads scrapers from `SCRAPER_PLUGIN_DIR` Docker volume |
| `push/` module (Web Push + email) | 🔜 Phase 8 (impl); E2E testing deferred | Implementation: no prerequisites. **Automated E2E testing** of push notification bubbles requires the Desktop MCP server (post-Phase-10) — manual checklist remains. |
| Admin endpoints (`/admin/scrapers/*`) | 🔜 Phase 8 | **Prerequisite**: `scraper.plugin-loader.ts` must be implemented first (these endpoints trigger plugin reload/install) |

---

## 1. Overview

Phase 7 adds two major capabilities:

| Capability | What it does |
|------------|-------------|
| **Transaction Import** | User uploads a CSV or OFX file; the backend parses it and bulk-inserts transactions, deduplicating against existing records. Returns a job record with row/imported/skipped counts. |
| **Automated Sync** | User creates a `SyncSchedule` linking an account to a bank institution. The backend runs a Playwright-based scraper on a schedule (or on demand), streams live status over SSE, and pauses for an in-app MFA code entry when challenged. |

Both capabilities share the existing `scraper` backend module (alias `#scraper/*` already declared in `packages/backend/package.json`, directory currently empty). The frontend replaces the `ScraperPage` stub (route `/scraper` already registered).

### Copy-first guidance

**Backend — significant divergence from CRUD**:
- The module/controller/service skeleton *can* be copied from `accounts/`.
- The actual service methods cannot follow CRUD patterns due to: file parsing, SSE streaming, scheduler jobs, and the MFA bridge.
- Explicitly note per sub-section which parts are copy-first vs built from scratch.

**Frontend — significant divergence from list+form+modal**:
- No paginated list + edit modal for Import Jobs or Sync Jobs (status-only views).
- `FileImportDropzone` and `SyncStatusPanel` are purpose-built — do not force-fit `AccountList` / `AccountModal` patterns.
- `SyncScheduleForm` is the only component that resembles the standard form pattern and can be loosely adapted from `AccountForm`.

---

## 2. Prisma Schema Changes

### 2a. New enums

```prisma
enum ImportStatus {
  pending
  processing
  completed
  failed
}

enum SyncRunStatus {
  success
  failed
  mfa_required
}

enum FileType {
  csv
  ofx
}
```

> **No `SyncFrequency` enum** — the cron string is stored as a plain `String` field so new schedules (e.g. `"0 */6 * * *"` every 6 hours) never require a migration.

### 2b. New `ImportJob` model

Tracks a single file-upload-and-parse operation.

```prisma
model ImportJob {
  id             String       @id @default(uuid()) @db.Uuid
  userId         String       @map("user_id") @db.Uuid
  accountId      String?      @map("account_id") @db.Uuid   // target account (optional)
  source         String       @default("file")               // 'csv' | 'ofx' | 'scraper' | 'api'

  filename       String
  fileType       FileType     @map("file_type")
  status         ImportStatus @default(pending)

  rowCount       Int          @default(0) @map("row_count")
  importedCount  Int          @default(0) @map("imported_count")
  skippedCount   Int          @default(0) @map("skipped_count")
  errorMessage   String?      @map("error_message")

  createdAt      DateTime     @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime     @updatedAt      @map("updated_at") @db.Timestamptz

  user           User         @relation(fields: [userId], references: [id])
  account        Account?     @relation(fields: [accountId], references: [id])

  @@index([userId])
  @@index([userId, status])
  @@map("import_jobs")
}
```

### 2c. New `SyncSchedule` model

One schedule per account/bank pair. Stores credentials encrypted at rest.

```prisma
model SyncSchedule {
  id              String         @id @default(uuid()) @db.Uuid
  userId          String         @map("user_id") @db.Uuid
  accountId       String         @map("account_id") @db.Uuid

  bankId          String         @map("bank_id")          // 'cibc' | 'td' | any future bank — plain String, no enum
  credentialsEnc  String         @map("credentials_enc")  // AES-256-GCM encrypted JSON blob
  cron            String         @default("0 8 * * *")     // standard cron expression
  enabled         Boolean        @default(true)

  lastRunAt            DateTime?      @map("last_run_at")             @db.Timestamptz
  lastRunStatus        SyncRunStatus? @map("last_run_status")
  lastSuccessfulSyncAt DateTime?      @map("last_successful_sync_at")  @db.Timestamptz  // set only on success
  lookbackDays         Int            @default(3)                     @map("lookback_days")  // overlap window in days

  createdAt       DateTime       @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime       @updatedAt      @map("updated_at") @db.Timestamptz

  user            User           @relation(fields: [userId], references: [id])
  account         Account        @relation(fields: [accountId], references: [id])
  syncJobs        SyncJob[]

  @@unique([userId, accountId])
  @@index([userId])
  @@index([userId, enabled])
  @@map("sync_schedules")
}
```

> **Key design choices vs first draft**:
> - `bankId` is `String` not an enum — adding a new bank (e.g. RBC) requires zero migrations.
> - `cron` replaces the `frequency` enum — gives full scheduling flexibility.
> - `lastRunStatus` uses the 3-value `SyncRunStatus` enum; live run status lives only in `SyncJob`.
> - `lastSuccessfulSyncAt` is **distinct** from `lastRunAt` — a failed or MFA-interrupted run updates `lastRunAt` but must not advance `lastSuccessfulSyncAt`, otherwise the next run's start date would skip the failed window.
> - `lookbackDays` (default 3) is the overlap window — see Section 2h for the full date-range strategy.

### 2d. New `SyncJob` model

One record per scraper run (manual or scheduled). Tracks live run status.

```prisma
model SyncJob {
  id               String        @id @default(uuid()) @db.Uuid
  userId           String        @map("user_id") @db.Uuid
  syncScheduleId   String        @map("sync_schedule_id") @db.Uuid

  triggeredBy      String        @default("cron")     @map("triggered_by")  // 'cron' | 'manual'
  requestStartDate DateTime?     @map("request_start_date") @db.Timestamptz  // actual date range requested
  requestEndDate   DateTime?     @map("request_end_date")   @db.Timestamptz

  // Live status — updated by the worker in real time
  status           String        @default("pending")  // 'pending' | 'logging_in' | 'mfa_required' | 'importing' | 'complete' | 'failed'
  message          String?                            // latest status message
  mfaChallenge     String?       @map("mfa_challenge")  // prompt shown to user in MFA modal
  importedCount    Int           @default(0) @map("imported_count")
  skippedCount     Int           @default(0) @map("skipped_count")
  errorMessage     String?       @map("error_message")

  startedAt        DateTime?     @map("started_at")   @db.Timestamptz
  completedAt      DateTime?     @map("completed_at") @db.Timestamptz

  createdAt        DateTime      @default(now()) @map("created_at") @db.Timestamptz
  updatedAt        DateTime      @updatedAt      @map("updated_at") @db.Timestamptz

  user             User          @relation(fields: [userId], references: [id])
  syncSchedule     SyncSchedule  @relation(fields: [syncScheduleId], references: [id])

  @@index([userId])
  @@index([syncScheduleId])
  @@index([userId, status])
  @@map("sync_jobs")
}
```

> `status` is a plain `String` not an enum so new worker states can be added without a migration.

### 2e. Changes to existing models

**`Transaction`** — add `fitid` field (OFX bank-assigned unique ID; preferred dedup key over date+amount+description):
```prisma
fitid   String?  // OFX FITID — bank-assigned unique transaction ID
```
Add to `@@index`: no new index needed; used only for exact-match dedup lookups.

**`User`** — add relation fields and notification preferences:
```prisma
importJobs     ImportJob[]
syncSchedules  SyncSchedule[]
syncJobs       SyncJob[]

// Notification preferences for scraper MFA alerts
notifyPush     Boolean  @default(true)  @map("notify_push")
notifyEmail    Boolean  @default(true)  @map("notify_email")
```

> `notifyPush` defaults `true` only when a push subscription exists; `notifyEmail` is the universal fallback for all devices including iOS without PWA. Both can be active simultaneously — push for speed, email as fallback.

**`Account`** — add relation fields:
```prisma
importJobs     ImportJob[]
syncSchedules  SyncSchedule[]
```

### 2f. Migration names (two, one per sub-phase)

```
20260301_add_import_job           # Phase 7a: ImportJob model, ImportStatus/FileType enums, fitid on Transaction
20260301_add_sync_schedule_job    # Phase 7b: SyncSchedule, SyncJob models, SyncRunStatus enum
```

### 2g. Security note — credential storage

`credentialsEnc` must be an AES-256-GCM encrypted blob produced by a `CryptoService` inside the scraper module. The raw plaintext `{ username, password }` JSON is decrypted in-process only when passed to the scraper worker — the decryption key **never enters the worker**. The `CREDENTIALS_ENCRYPTION_KEY` env var (32-byte hex) must be documented in `.env.example` and validated at startup.

### 2h. Date range strategy, overlap window & deduplication

This section answers four architectural questions raised during planning.

#### Q1 — Different banks have different download windows and UI flows

Each `BankScraper` implementation declares `maxLookbackDays: number` — the maximum date range the bank's export UI accepts per request (e.g. CIBC: 90 days, TD: 365 days). The scheduler never requests a window wider than this cap. The bank-specific navigation (date pickers, dropdowns, export buttons) is entirely encapsulated inside each scraper's `downloadTransactions()` implementation — `SyncScheduleService` only passes `startDate`/`endDate` via `DownloadOptions` and receives raw bytes back.

**Why direct DOM scraping instead of file export:**

The previous design had Playwright click an "Export" button and download a CSV/OFX file, then parse it in `ImportService`. This approach had two hard problems:

1. **TD only filters exports by statement date** — a transaction authorized Feb 25 near a billing cycle boundary appears on the March statement. Requesting Feb 1–Feb 28 would silently miss it.
2. **Credit card exports never include pending transactions** — pending authorizations are visible in the online banking UI but absent from the download.

Direct DOM scraping solves both: Playwright reads the transaction rows rendered on screen, which show **authorization dates** and include **pending items** regardless of the export format's limitations.

**Known bank-specific behaviours (codified in the interface)**:

| Bank | `maxLookbackDays` | `pendingTransactionsIncluded` | Notes |
|------|-------------------|-------------------------------|-------|
| TD   | 365               | `true` \* (credit card UI does show pending) | scrape transactions tab directly |
| CIBC | 90                | `true` \* (pending visible in UI)            | scrape activity list directly |

> \* Whether pending rows are returned depends on what the bank renders — each scraper declares what it actually reads. These values are served to the frontend via `GET /scrapers`.
> Adding a new bank requires only a new scraper file — no schema migrations.

#### Q2 — How does the cron job know what date range to fetch?

Because scrapers read the DOM directly (not an export), there is **no statement-date filter issue** — Playwright navigates to whatever date range is requested and reads what the bank renders on screen. The formula is the same for all banks:

```
startDate = max(
  lastSuccessfulSyncAt - lookbackDays,   // overlap to catch late-settling transactions
  today - maxLookbackDays                // hard ceiling based on what the bank UI supports
)
endDate = today
```

- **`lastSuccessfulSyncAt`**: updated on the `SyncSchedule` record only when `SyncJob.status` reaches `complete`. A failed or MFA-abandoned run leaves it unchanged so the next run retries the same window.
- **`lookbackDays`** (default 3, per-schedule override): ensures pending transactions that authorized just before the last sync window are re-checked once they settle. The `syntheticId` dedup prevents double-counting.
- **First run** (`lastSuccessfulSyncAt` is null): `startDate = today - maxLookbackDays` — scrapes the full history the bank UI exposes.
- **Multiple cron runs within the same day**: identical window → identical `syntheticId` values → dedup skips all of them. Zero duplicates.

#### Q3 — Handling potential duplicates from overlapping windows

Duplicate detection in `ImportService.bulkInsert()` is two-tier:

| Tier | Source | Key | Reliability |
|------|--------|-----|-------------|
| 1 | Scraped transactions | `syntheticId` (sha256 hash of normalized fields, computed by scraper) | ✅ Reliable for identical rows |
| 2 | Manual CSV/OFX upload with OFX FITID | `(userId, fitid)` — stored in same `Transaction.fitid` column | ✅ Reliable — bank-assigned |
| 3 | Manual CSV upload (no FITID) | `(userId, accountId, date, amount, description)` | ⚠️ Best-effort |

**Tier 1 — pending→settled dedup**: when a pending transaction settles, the bank may change the description or exact date displayed. If the values change, the `syntheticId` will differ and `ImportService` will insert a second row. This is an **accepted limitation of DOM scraping** — the pending row is treated as an independent record. Future work could reconcile pending→posted transitions by matching approximate amount + description within a ±2-day window.

**Tier 3 limitation**: two genuinely identical CSV rows on the same day (e.g. two $5.50 coffee charges) collapse into one. This is an accepted trade-off for manual CSV uploads.

After `bulkInsert()` returns, `SyncScheduleService` updates `lastSuccessfulSyncAt = new Date()` on the `SyncSchedule` record.

The `SyncJob` record stores `requestStartDate` and `requestEndDate` — the actual window passed to the scraper. This lets the UI show "Fetched Jan 1 – Feb 28" in the job history and allows future audit of which date range any run covered.

#### Q4 — How does manual run differ from a scheduled run?

`POST /sync-schedules/:id/run-now` accepts an optional `{ startDate?: string }` (ISO 8601) body:

| Scenario | `startDate` body | Computed window |
|----------|------------------|-----------------|
| Normal manual trigger | omitted | Same calculation as cron: `lastSuccessfulSyncAt - lookbackDays` |
| Re-fetch a specific period | `"2026-01-01"` | `startDate = 2026-01-01`, `endDate = today` |
| First-ever run | omitted | `today - maxLookbackDays` (full bank history) |

The manual run follows the **identical code path** as the scheduled run — same worker, same dedup logic, same SSE stream, same `SyncJob` record update. The only differences are:
- `SyncJob.triggeredBy` is set to `'manual'` instead of `'cron'`
- If `startDate` is explicitly provided in the body, it bypasses the `lastSuccessfulSyncAt` calculation and uses the override directly

The manual run **does** update `lastSuccessfulSyncAt` on success — so if a user manually triggers a catch-up run, the next scheduled cron will start from the new anchor point, not re-fetch the manually covered window.

#### Q5 — Pending transactions: solved by direct DOM scraping

File export APIs (OFX/CSV) never include pending credit card transactions — this is a bank-imposed limitation of the export format, not something configurable. The bank's web UI, however, **does** display pending transactions in the transaction list alongside posted ones.

Because scrapers read the DOM directly, pending transactions **can** be captured:
- `RawTransaction.pending = true` identifies them in the returned data.
- They are inserted into the `transactions` table immediately with their authorization date and amount.
- `BankScraper.pendingTransactionsIncluded = true` signals that this scraper reads pending rows. The frontend does **not** show a warning for these scrapers.

**Pending→settled update behaviour**:
- On the next sync, the settled version of the transaction appears in the DOM (typically with the same date and amount, sometimes with a slightly different description).
- The scraper recomputes `syntheticId` from the settled row's values.
- If the values are identical to the pending row → `syntheticId` matches → dedup skips it. ✅
- If the bank changes the description or date on settlement → `syntheticId` differs → a second row is inserted. The pending row remains as a historical record.
- Full pending→posted reconciliation (match by approximate amount + ±2-day window) is **out of scope for Phase 7** and documented as a known limitation.

**Scrapers that do not read pending rows** (`pendingTransactionsIncluded = false`): these are banks where the UI does not clearly label rows as pending, or where the scraper implementation only reads the posted section of the page. The frontend renders an info banner: *"Pending transactions are not shown. They will appear after they post (1–3 business days)."*

---

## 3. Backend Module Structure

Use the existing `#scraper/*` alias. The module lives at `packages/backend/src/scraper/`.

```
packages/backend/src/scraper/
├── scraper.module.ts              # registers all providers + controllers; imports ScheduleModule
├── scraper.service.ts             # orchestrates sync: resolves bank by bankId, spawns worker
├── scraper.scheduler.ts           # @nestjs/schedule cron runner; loads SyncSchedule records at startup
├── scraper.registry.ts            # BANK_SCRAPER injection token + @RegisterScraper() decorator
├── scraper.plugin-loader.ts       # loads external npm plugins from SCRAPER_PLUGIN_DIR volume
├── scraper.worker.ts              # worker_thread entry point — runs plugin code in isolation
├── sync-session.store.ts          # in-memory Map: sessionId → RxJS Subject (SSE bridge) + MFA callbacks
├── interfaces/
│   └── bank-scraper.interface.ts  # BankScraper, BankCredentials, DownloadOptions, ScraperWorkerInput
├── banks/                         # built-in scrapers — compiled into the app
│   ├── cibc.scraper.ts            # @RegisterScraper() CibcScraper — Phase 7b stub
│   └── td.scraper.ts              # @RegisterScraper() TdScraper   — Phase 7b stub
├── crypto/
│   └── crypto.service.ts          # AES-256-GCM encrypt/decrypt for credentials
├── import/
│   ├── import.controller.ts       # POST /import/upload, GET /import, GET /import/:id
│   ├── import.service.ts          # CSV/OFX parsing, bulk insert, dedup
│   ├── import-job-response.dto.ts
│   ├── upload-import.dto.ts
│   └── __TEST__/
│       ├── import.service.spec.ts
│       └── import.controller.spec.ts
├── sync/
│   ├── sync-schedule.controller.ts  # CRUD /sync-schedules
│   ├── sync-schedule.service.ts     # create/update/remove; encrypt creds; register/update/remove cron
│   ├── sync-job.controller.ts       # GET /sync-schedules/:id/stream (SSE), POST run-now, POST mfa-response
│   ├── dto/
│   │   ├── create-sync-schedule.dto.ts
│   │   ├── update-sync-schedule.dto.ts
│   │   ├── sync-schedule-response.dto.ts
│   │   └── sync-job-response.dto.ts
│   └── __TEST__/
│       ├── sync-schedule.service.spec.ts
│       ├── sync-schedule.controller.spec.ts
│       └── sync-job.controller.spec.ts
└── push/
    ├── push.controller.ts           # POST /push/subscribe, DELETE /push/subscribe
    └── push.service.ts              # web-push sendNotification; nodemailer email
```

> **Note**: `scraper.worker.ts`, `sync-session.store.ts`, `scraper.plugin-loader.ts`, and everything under `push/` are built from scratch — no CRUD parallel exists.

> **External plugin directory** (mounted Docker volume, separate from `src/scraper/banks/`):
> ```
> /app/plugins/              ← SCRAPER_PLUGIN_DIR env var
> ├── package.json
> └── node_modules/
>     └── @finance-tracker/scraper-rbc/
>         └── index.js       ← export default class RbcScraper implements BankScraper
> ```
> Built-in scrapers always load first; plugins can override by `bankId`.

### BankScraper interface

Defined in `interfaces/bank-scraper.interface.ts`. Every built-in and external scraper implements this contract:

```ts
import type { Page } from 'playwright';

export interface BankScraper {
  /** Unique key stored in SyncSchedule.bankId — plain string, no enum */
  readonly bankId: string;
  readonly displayName: string;
  /**
   * true  = MFA required on every run (e.g. CIBC — sessions expire immediately).
   * false = save Playwright storageState; MFA only needed on session expiry.
   */
  readonly requiresMfaOnEveryRun: boolean;
  /**
   * Maximum calendar days of transaction history the bank UI displays.
   * The scheduler caps the date range so the scraper never navigates beyond this.
   * e.g. CIBC = 90, TD = 365.
   */
  readonly maxLookbackDays: number;
  /**
   * true  — bank UI shows pending/unsettled transactions in the transaction list.
   *         The scraper reads and returns them (with pending: true).
   * false — bank UI only shows posted/settled transactions.
   *         Frontend shows a "Pending transactions not included" info banner.
   */
  readonly pendingTransactionsIncluded: boolean;

  /** Navigate to the login page and complete authentication. */
  login(page: Page, credentials: BankCredentials): Promise<void>;

  /**
   * Navigate to the transactions page, apply the date range, and return all
   * visible rows as structured data. **Direct DOM scraping — no file download.**
   * This bypasses bank export filters (e.g. TD statement-date filtering) and
   * allows capture of pending transactions when pendingTransactionsIncluded = true.
   */
  scrapeTransactions(page: Page, options: ScrapeOptions): Promise<RawTransaction[]>;
}

export interface BankCredentials {
  username: string;
  password: string;
}

export interface ScrapeOptions {
  startDate: Date;
  endDate: Date;
  includePending: boolean;  // passed from BankScraper.pendingTransactionsIncluded
}

/**
 * A single transaction row as read directly from the bank's web UI.
 * The scraper populates this; ImportService upserts it into the database.
 */
export interface RawTransaction {
  date: string;          // ISO 8601 — the date shown in the bank UI
  description: string;
  amount: number;        // negative = debit, positive = credit
  pending: boolean;      // true if the transaction is not yet settled
  /**
   * Stable deduplication key, computed by the scraper as:
   *   sha256(bankId + accountId + date + description + amount.toFixed(2) + String(pending))
   * Stored in Transaction.fitid (same column used for OFX FITID from manual uploads).
   * When a pending transaction settles with identical values, the syntheticId matches
   * the existing record — no duplicate inserted.
   */
  syntheticId: string;
}
```

### @RegisterScraper() decorator + registry

```ts
// scraper.registry.ts
export const BANK_SCRAPER = 'BANK_SCRAPER';  // NestJS multi-provider injection token
export const RegisterScraper = (): ClassDecorator => SetMetadata(BANK_SCRAPER, true);
```

Adding a new built-in bank = one file + one `providers` entry in `ScraperModule`:
```ts
// banks/rbc.scraper.ts
@RegisterScraper()
@Injectable()
export class RbcScraper implements BankScraper {
  readonly bankId = 'rbc';
  // implement login() + downloadTransactions()
}
```

### Worker thread isolation

`scraper.worker.ts` runs plugin code inside a `worker_thread`. The worker receives only `workerData: ScraperWorkerInput` — `DATABASE_URL`, `JWT_SECRET`, and all other env vars are **explicitly excluded** from the worker's `env` option. The plugin never touches the database; it only returns a raw `Buffer` (OFX/CSV bytes) to the main process, which then calls `ImportService.bulkInsert()`.

MFA bridging between worker and main process:
- Worker: `parentPort.postMessage({ type: 'mfa_required', prompt })`
- Main: stores a pending callback in `SyncSessionStore`; emits SSE `mfa_required` event; sends Web Push + email
- User submits code → `POST /sync-schedules/:id/mfa-response` → main calls `worker.postMessage({ type: 'mfa_code', code })`
- Worker: `parentPort.once('message')` resolves → types code into browser → continues

Worker timeout: default 5 minutes; exceeded → `worker.terminate()` → job marked `failed`.

> **Phase 7b scope**: built-in stubs (`cibc.scraper.ts`, `td.scraper.ts`) implement only `login()` and `scrapeTransactions()` as stubs returning an empty array `[]`. Real Playwright automation (form filling, date navigation, row reading) is a post-Phase-7 follow-up. The full architecture — interface, registry, worker thread, plugin loader, session store — **must** be in place in Phase 7b so real scrapers can be dropped in without structural changes.

---

## 4. API Contract

All endpoints require `Authorization: Bearer <JWT>` (JwtAuthGuard). All responses follow the existing `TransactionResponseDto` / `AccountResponseDto` conventions (class-based DTOs with `@ApiProperty`).

### 4a. Transaction Import

| Method | Route | Body | Response | Notes |
|--------|-------|------|----------|-------|
| `POST` | `/scraper/import/upload` | `multipart/form-data`: `file` (CSV/OFX), `accountId?` (string) | `201 ImportJobResponseDto` | File size limit: 5 MB. Parsing is synchronous for MVP (< 10 k rows). |
| `GET` | `/scraper/import` | — | `200 ImportJobResponseDto[]` | List all import jobs for the user, newest first. |
| `GET` | `/scraper/import/:id` | — | `200 ImportJobResponseDto` | Status poll for a single job. |

**`ImportJobResponseDto`**:
```ts
{
  id: string;
  accountId: string | null;
  filename: string;
  fileType: 'csv' | 'ofx';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  rowCount: number;
  importedCount: number;
  skippedCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}
```

**Deduplication rule**: prefer `fitid` exact match when the OFX field is present; fall back to `(userId, accountId, date, amount, description)` for CSV rows that have no `fitid`.

### 4b. Sync Schedules

| Method | Route | Body | Response | Notes |
|--------|-------|------|----------|-------|
| `POST` | `/sync-schedules` | `CreateSyncScheduleDto` | `201 SyncScheduleResponseDto` | Validates `bankId` exists in registry; encrypts credentials; registers cron job. |
| `GET` | `/sync-schedules` | — | `200 SyncScheduleResponseDto[]` | Credentials **never** returned. |
| `GET` | `/sync-schedules/:id` | — | `200 SyncScheduleResponseDto` | |
| `PATCH` | `/sync-schedules/:id` | `UpdateSyncScheduleDto` | `200 SyncScheduleResponseDto` | Re-encrypts credentials if changed; updates cron job. |
| `DELETE` | `/sync-schedules/:id` | — | `204` | Removes cron job; hard-deletes record (no transactions affected). |
| `POST` | `/sync-schedules/:id/run-now` | `{ startDate?: string }` (optional ISO 8601) | `201 { sessionId: string }` | Triggers immediate sync. `startDate` overrides the computed window (useful for re-fetching a missed period). If omitted, uses same calculation as cron: `lastSuccessfulSyncAt - lookbackDays`. Returns `sessionId` immediately; async worker starts. |

**`CreateSyncScheduleDto`**:
```ts
{
  accountId: string;     // UUID — must belong to this user
  bankId: string;        // must match a registered BankScraper.bankId (validated against registry)
  username: string;
  password: string;
  cron: string;          // e.g. '0 8 * * *' — validated with cron-validator
  lookbackDays?: number; // overlap window override (default: 3). Increase for banks with slow posting.
}
```

**`SyncScheduleResponseDto`** (credentials omitted):
```ts
{
  id: string;
  accountId: string;
  bankId: string;
  displayName: string;         // from BankScraper.displayName
  supportedFormats: string[];  // from BankScraper.supportedFormats
  cron: string;
  enabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: 'success' | 'failed' | 'mfa_required' | null;
  lastSuccessfulSyncAt: string | null;   // null on first run or if no run has ever succeeded
  lookbackDays: number;
  maxLookbackDays: number;               // from BankScraper.maxLookbackDays
  pendingTransactionsIncluded: boolean;  // from BankScraper — frontend shows info banner when false
  createdAt: string;
  updatedAt: string;
}
```

### 4c. Sync Jobs & SSE

| Method | Route | Body | Response | Notes |
|--------|-------|------|----------|-------|
| `GET` | `/sync-schedules/:id/stream` | — | `text/event-stream` | SSE stream via `@Sse()` + RxJS Observable; auto-closes on `complete`/`failed` event. |
| `POST` | `/sync-schedules/:id/mfa-response` | `{ code: string }` | `200 { ok: true }` | Submits MFA code to paused worker; single-use; 400 if no pending MFA. |

### 4d. Scrapers registry

| Method | Route | Response | Notes |
|--------|-------|----------|-------|
| `GET` | `/scrapers` | `200 ScraperInfoDto[]` | Lists all registered banks (built-in + plugins). Used by frontend to populate the bank picker dynamically. No auth required (public). |

**`ScraperInfoDto`**:
```ts
{
  bankId: string;
  displayName: string;
  requiresMfaOnEveryRun: boolean;
  maxLookbackDays: number;
  pendingTransactionsIncluded: boolean;  // true = pending shown; false = posted only
}
```

### 4e. Push notifications

| Method | Route | Body | Response | Notes |
|--------|-------|------|----------|-------|
| `POST` | `/push/subscribe` | `PushSubscription` (Web Push API object) | `201` | Saves subscription for user. |
| `DELETE` | `/push/subscribe` | — | `204` | Removes subscription. |

### 4f. Admin endpoints (ADMIN role only)

| Method | Route | Notes |
|--------|-------|-------|
| `POST` | `/admin/scrapers/reload` | Re-scans `SCRAPER_PLUGIN_DIR`; registers any new plugins without restart. |
| `POST` | `/admin/scrapers/install` | Runs `npm install <package>` into plugin dir then reloads. High-risk: ADMIN only. |

### 4g. SSE event shapes (`GET /sync-schedules/:id/stream`)

```
event: status
data: { "status": "logging_in", "message": "Navigating to CIBC login..." }

event: mfa
data: { "status": "mfa_required", "mfaChallenge": "Enter the code sent to your phone ending in 1234" }

event: status
data: { "status": "importing", "message": "Downloading transactions..." }

event: complete
data: { "status": "complete", "importedCount": 12, "skippedCount": 3 }

event: failed
data: { "status": "failed", "errorMessage": "Login failed: invalid credentials" }
```

### 4h. Swagger tags

- `@ApiTags('import')` for import endpoints
- `@ApiTags('sync-schedules')` for sync schedule + SSE endpoints
- `@ApiTags('scrapers')` for the registry endpoint
- `@ApiTags('push')` for push subscription endpoints

---

## 5. Backend Implementation Steps

The following steps are ordered to be committed separately per the roadmap's "commit per task" rule.

### Step 1 — ✅ Prisma schema + migration *(copy: no; build from scratch)*
- Add enums and three new models to `prisma/schema.prisma`
- Add relation fields to `User` and `Account`
- Run `npx prisma migrate dev --name add_import_sync_module`
- Run `npx prisma generate`
- **Commit**: `feat(backend): add import/sync Prisma models and migration`

### Step 2 — ✅ `CryptoService` *(copy: no; build from scratch)*
- `packages/backend/src/scraper/crypto/crypto.service.ts`
- Methods: `encrypt(plaintext: string): string`, `decrypt(ciphertext: string): string`
- Uses Node `crypto` module, AES-256-GCM, key from `ConfigService`
- Add `CREDENTIALS_ENCRYPTION_KEY` to `.env.example`
- Unit test: encrypt → decrypt roundtrip, wrong key throws
- **Commit**: `feat(backend): add CryptoService for credential encryption`

### Step 3 — ✅ Import service + controller *(copy skeleton from accounts; service logic built from scratch)*
- `import.service.ts`:
  - `upload(userId, file, accountId?)`: create `ImportJob` record (status=pending), parse CSV/OFX, bulk-upsert transactions with dedup, update job to completed/failed
  - CSV parsing: use `papaparse` (add dependency) — header row expected: `date,description,amount,type`
  - OFX parsing: use `ofx` npm package (add dependency) — extract `STMTTRN` elements
  - Dedup query: `findFirst` by `{ userId, accountId, date, amount, description }`
- `import.controller.ts`:
  - `POST /scraper/import/upload` — `@UseInterceptors(FileInterceptor('file'))`, guard file size ≤ 5 MB, `@Roles` not required beyond JWT
  - `GET /scraper/import` / `GET /scraper/import/:id`
- Unit tests: mock PrismaService, test parse + insert + skip logic
- **Commit**: `feat(backend): add ImportJob service with CSV/OFX parsing`

### Step 4 — ✅ Sync schedule service + controller *(copy skeleton from accounts; diverges at credential handling)*

> **Implementation note**: No standalone `scraper.scheduler.ts` was created initially. Cron job management (add/update/delete) is handled inline in `sync-schedule.service.ts` via `SchedulerRegistry`. ~~**Gap**: cron jobs are not re-registered on server restart~~ — **fixed in Phase 8 Carry-over A**: `scraper.scheduler.ts` (`ScraperScheduler` service, commit `fe212ee`) now re-registers all `enabled=true` schedules on `OnModuleInit`.
- `sync-schedule.service.ts`:
  - Standard CRUD (findAll, findOne, create, update, remove)
  - `create`: validate `accountId` belongs to user; validate `bankId` exists in the scraper registry; encrypt credentials with `CryptoService`; validate `cron` expression with `cron-validator`; register dynamic cron job with `SchedulerRegistry`
  - `update`: re-encrypt credentials if password provided; update cron job if `cron` changed
  - `remove`: remove cron job from `SchedulerRegistry`; hard-delete record
  - Response DTO deliberately omits `credentialsEnc` and `password`
- `sync-schedule.controller.ts`: CRUD endpoints at `/sync-schedules` (root-level, not nested under `/scraper/`)
- Unit tests: CRUD happy paths + ownership guard + credential never in response
- **Commit**: `feat(backend): add SyncSchedule service and controller`

### Step 5 — ✅ SyncSessionStore + scraper worker + SyncJobService *(copy: no; built from scratch)*

> **Implementation note**: No standalone `SyncJobService` class — the orchestration logic lives in `ScraperService` (`scraper.service.ts`), which follows the same responsibility boundary. Push notifications (`push/` module) are **not** wired — MFA notifications are SSE-only in Phase 7.
- `sync-session.store.ts`:
  - In-memory `Map<sessionId, { subject: Subject<MessageEvent>; mfaResolver: ((code: string) => void) | null }>`
  - Methods: `createSession(sessionId)`, `emit(sessionId, event)`, `resolveMfa(sessionId, code)`, `complete(sessionId)`, `getObservable(sessionId): Observable<MessageEvent>`
  - Sessions are in-memory only — a server restart during a pending MFA challenge will fail that sync run
- `scraper.worker.ts` (worker thread entry point):
  - Receives `workerData: ScraperWorkerInput` — `DATABASE_URL`, `JWT_SECRET`, and all env vars explicitly excluded from worker `env`
  - Resolves the `BankScraper` class by `bankId` (must be passed in `workerData`, not re-resolved from DI)
  - Launches Playwright Chromium; calls `scraper.login(page, credentials)` then `scraper.scrapeTransactions(page, options)`
  - Returns structured `RawTransaction[]` to main thread via `parentPort.postMessage({ type: 'result', transactions })`
  - No file download, no Buffer parsing — the scraper outputs structured data directly
  - MFA bridging: worker posts `{ type: 'mfa_required', prompt }` → main emits SSE → user submits code → main posts `{ type: 'mfa_code', code }` → worker's `parentPort.once('message')` resolves
  - Worker timeout: terminate worker and mark job `failed` after **5 minutes** (configurable; prevents stuck browser)
- `scraper.service.ts` (orchestrator — already in module structure):
  - `sync(userId, scheduleId)`: create `SyncJob` record; decrypt credentials in main process; spawn `worker_thread`; wire `parentPort` messages to `SyncSessionStore`; on worker result (`RawTransaction[]`) call `ImportService.bulkInsert()` directly — no file parsing step
  - Returns `sessionId` immediately (async worker runs in background)
- **Built-in stubs (Phase 7b)**: `banks/cibc.scraper.ts` and `banks/td.scraper.ts` each implement `BankScraper` and return `[]` from `scrapeTransactions()`. Real Playwright DOM navigation is deferred post-Phase 7. **The full architecture — interface, registry, worker thread, plugin loader, session store — must be in place in Phase 7b** so real scrapers can be dropped in without structural changes.
- Unit tests: `sync-job mock tests` in `sync/__TEST__/sync-schedule.service.spec.ts`; state machine transitions (idle→running, running→mfa_required, mfa_required→running→complete, running→failed)
- **Commit**: `feat(backend): add SyncSessionStore, scraper worker thread, and SyncJobService`

### Step 6 — ✅ SSE controller *(copy: no; built from scratch)*
- `sync-job.controller.ts` (SSE + trigger + mfa-response endpoints):
  - `@Get(':id/stream')`, `@Sse()` decorator
  - Subscribe to the per-job `Subject` from `SyncJobService`
  - Map internal events to SSE `MessageEvent` objects
  - Auto-complete the observable when `done` or `error` event received
  - Return `404` if job not found or doesn't belong to user
- Integration note: NestJS `@Sse()` requires `import { Sse, MessageEvent } from '@nestjs/common'`; RxJS `Observable<MessageEvent>` is the return type
- Unit test: mock Subject emissions → verify SSE output sequence
- **Commit**: `feat(backend): add SSE streaming endpoint for sync job status`

### Step 7 — ✅ `ScraperModule` registration
- `scraper.module.ts`: wire all controllers + services; import `MulterModule` for file uploads; import `DatabaseModule`
- Register `ScraperModule` in `app.module.ts`
- Add `#scraper/*` imports to `tsconfig.json` paths if not already present (already in `package.json` imports)
- **Commit**: `feat(backend): register ScraperModule in app.module.ts`

---

## 6. ✅ Frontend Structure — Complete

The frontend already has (and all items below are now implemented):
- Route `/scraper` registered in `src/routes/index.tsx`
- `ScraperPage` stub at `src/pages/ScraperPage.tsx`
- Empty feature directories: `src/features/scraper/{components,hooks,types}/`
- `APP_ROUTES.SCRAPER = '/scraper'` in `src/config/constants.ts`

After `npm run generate:api` the Orval client will generate hooks under `src/api/scraper-import/` and `src/api/scraper-sync/`.

### New route needed

Add `APP_ROUTES.MFA = '/mfa'` to `src/config/constants.ts` for the deep-link MFA page (receiving push notifications).

### Feature directory layout

```
src/features/scraper/
├── components/
│   ├── FileImportDropzone.tsx       # drag-and-drop + file button; CSV/OFX only
│   ├── FileImportDropzone.module.css
│   ├── ImportJobList.tsx            # table of past import jobs
│   ├── ImportJobList.module.css
│   ├── ImportJobStatusBadge.tsx     # status pill (pending/processing/completed/failed)
│   ├── SyncScheduleList.tsx         # list of sync schedules with edit/delete/trigger
│   ├── SyncScheduleList.module.css
│   ├── SyncScheduleForm.tsx         # create/edit form (copy-first from AccountForm pattern)
│   ├── SyncScheduleForm.module.css
│   ├── SyncScheduleModal.tsx        # modal wrapper (copy-first from AccountModal)
│   ├── SyncStatusPanel.tsx          # SSE live feed; shows progress bar + message
│   ├── SyncStatusPanel.module.css
│   └── MfaModal.tsx                 # appears when SyncStatusPanel receives mfa event
│
├── hooks/
│   ├── useImportJob.ts              # wraps Orval upload/list/get hooks
│   ├── useSyncSchedule.ts           # wraps Orval CRUD hooks for schedules
│   ├── useSyncJob.ts                # wraps trigger + list + getById hooks
│   └── useSyncStream.ts             # EventSource wrapper; yields typed SseStatusEvent
│
└── types/
    └── scraper.types.ts             # local UI types / form value shapes
```

### ScraperPage layout

Replace the stub with a two-tab layout:

```
/scraper
├── Tab: "Import"
│   ├── <FileImportDropzone />          — upload area
│   └── <ImportJobList />               — history table
└── Tab: "Sync"
    ├── <SyncScheduleList />            — per-account schedules
    │   └── [Trigger] → opens <SyncStatusPanel />
    └── <SyncScheduleModal />           — add/edit schedule
```

When a Sync Job's SSE stream emits an `mfa` event, `SyncStatusPanel` fires an `onMfaRequired` callback that opens `MfaModal` over the page.

### MFA page (`/mfa`)

Add `MfaPage` (`src/pages/MfaPage.tsx`) for web-push deep-link flow:
- Reads `?scheduleId=` query param (push notification deep-link carries the schedule ID)
- Connects to `GET /sync-schedules/:scheduleId/stream` via `useSyncStream`; waits for `mfa_required` event
- Shows `MfaModal` immediately once `mfa_required` event received
- On submit → `POST /sync-schedules/:scheduleId/mfa-response`
- Redirects to `/scraper` on completion

Register route in `src/routes/index.tsx` as a `PrivateRoute`.

### `useSyncStream` hook

Use the browser `EventSource` API directly (Orval does not generate SSE hooks):

```ts
// src/features/scraper/hooks/useSyncStream.ts
import { useEffect, useState } from 'react';

export type SseStatus = 'idle' | 'running' | 'mfa_required' | 'completed' | 'failed';

export interface SyncStreamEvent {
  status: SseStatus;
  progress?: number;
  message?: string;
  mfaChallenge?: string;
  importedCount?: number;
  skippedCount?: number;
  errorMessage?: string;
}

export function useSyncStream(jobId: string | null) { ... }
```

The hook manages `EventSource` lifecycle: opens on non-null `jobId`, closes on `done`/`error` events or unmount.

---

## 7. Test Strategy

### Unit testing (Vitest)

| Layer | What to unit-test |
|-------|------------------|
| `ImportService` | CSV parse happy path, OFX parse happy path, dedup skip, file type detection, max-row guard |
| `SyncScheduleService` | CRUD, credential never in response, ownership guard throws 404 |
| `SyncJobService` | State machine transitions (idle→running, running→mfa_required, mfa_required→running→completed, running→failed) |
| `CryptoService` | Encrypt/decrypt roundtrip; wrong key throws |
| `SyncSseController` | SSE observable emits correct `MessageEvent` shapes; completes on `done` |
| `ImportController` | File size guard 400, missing file 400, 201 on success |
| Frontend: `useSyncStream` | Opens EventSource on non-null jobId; closes on unmount; parses events |
| Frontend: `FileImportDropzone` | Rejects non-CSV/OFX via `accept`; renders state based on upload status |
| Frontend: `SyncStatusPanel` | Renders progress bar; calls onMfaRequired when mfa event received |
| Frontend: `MfaModal` | Submits code; shows error on API failure; closes on success |
| Frontend: `SyncScheduleForm` | Validates required fields; shows institution select |

### Integration testing (backend)

See Section 9 (Backend API Test Plan).

### E2E testing (Playwright)

See Section 10 (Frontend Test Scope).

---

## 8. Dependencies to Add

### Backend
```bash
# packages/backend
npm install papaparse ofx @types/papaparse
npm install cron-validator
npm install web-push nodemailer @types/web-push @types/nodemailer
npm install @nestjs/platform-express  # likely already present; for FileInterceptor/MulterModule
```

### `.env.example` additions
```env
# Scraper module
CREDENTIALS_ENCRYPTION_KEY=<32-byte hex string>   # AES-256-GCM key for credential storage
SCRAPER_PLUGIN_DIR=/app/plugins                   # Docker volume path for external plugins
SCRAPER_SESSION_DIR=.scraper-session              # Playwright storageState directory (gitignored)
PLAYWRIGHT_HEADLESS=true                         # Set false locally for debugging login flows
VAPID_PUBLIC_KEY=<VAPID public key>               # Web Push VAPID
VAPID_PRIVATE_KEY=<VAPID private key>
VAPID_SUBJECT=mailto:admin@example.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

> `SCRAPER_SESSION_DIR` stores encrypted Playwright `storageState` JSON files for banks with `requiresMfaOnEveryRun = false`. Add `.scraper-session/` to `.gitignore` — these files contain auth cookies.

### Frontend
No new npm dependencies; `EventSource` is built-in.

---

## 9. Backend API Test Plan

*(For `backend-tester` agent)*

### Preconditions
- Backend running at `http://localhost:3000`
- Valid JWT token for a test user (`testUser`)
- At least one `Account` record owned by `testUser`
- Sample files:
  - `sample-transactions.csv` (header: `date,description,amount,type`)
  - `sample-transactions.ofx`
  - `malformed.csv` (missing header)
  - `too-large.csv` (> 5 MB)

### TC-01 — POST /scraper/import/upload — valid CSV
- **Precondition**: valid JWT, `sample-transactions.csv`, optional `accountId`
- **Expect**: `201`, body has `status: 'completed'`, `importedCount > 0`

### TC-02 — POST /scraper/import/upload — valid OFX
- **Expect**: `201`, `fileType: 'ofx'`, `importedCount > 0`

### TC-03 — POST /scraper/import/upload — malformed file
- **Expect**: `201` (job created), body has `status: 'failed'`, `errorMessage` non-null

### TC-04 — POST /scraper/import/upload — file > 5 MB
- **Expect**: `400 Bad Request`

### TC-05 — POST /scraper/import/upload — no file attached
- **Expect**: `400 Bad Request`

### TC-06 — POST /scraper/import/upload — no JWT
- **Expect**: `401 Unauthorized`

### TC-07 — GET /scraper/import — list jobs
- **Expect**: `200`, array, each item has `id`, `filename`, `status`

### TC-08 — GET /scraper/import/:id — valid job id
- **Expect**: `200`, matches created job

### TC-09 — GET /scraper/import/:id — wrong user's job
- **Expect**: `404 Not Found`

### TC-10 — GET /scraper/import/:id — nonexistent id
- **Expect**: `404 Not Found`

### TC-11 — POST /sync-schedules — valid payload
- **Precondition**: `accountId` from `testUser`'s accounts, valid `bankId` (e.g. `'td'`)
- **Body**: `{ accountId, bankId: 'td', username: 'user', password: 'pass', cron: '0 8 * * *' }`
- **Expect**: `201`, body has `id`, `bankId`, `cron`, `enabled: true`; no `credentialsEnc` / `password` field visible

### TC-12 — POST /sync-schedules — invalid bankId
- **Body**: `{ bankId: 'unknown-bank', ... }`
- **Expect**: `400 Bad Request`

### TC-13 — POST /sync-schedules — invalid cron expression
- **Body**: `{ cron: 'not-a-cron', ... }`
- **Expect**: `400 Bad Request`

### TC-14 — POST /sync-schedules — accountId belongs to other user
- **Expect**: `404 Not Found`

### TC-15 — POST /sync-schedules — no JWT
- **Expect**: `401`

### TC-16 — GET /sync-schedules — list schedules
- **Expect**: `200`, array, items contain `bankId`, `cron`, `enabled`; no credentials fields

### TC-17 — GET /sync-schedules/:id
- **Expect**: `200`

### TC-18 — GET /sync-schedules/:id — wrong user's schedule
- **Expect**: `404`

### TC-19 — PATCH /sync-schedules/:id — update cron
- **Body**: `{ cron: '0 9 * * *' }`
- **Expect**: `200`, response has updated `cron`

### TC-20 — PATCH /sync-schedules/:id — update password (re-encrypt)
- **Body**: `{ password: 'newpass' }`
- **Expect**: `200`, no plaintext credential visible in response

### TC-21 — DELETE /sync-schedules/:id
- **Expect**: `204`; subsequent `GET /sync-schedules/:id` returns `404`

### TC-22 — POST /sync-schedules/:id/run-now — trigger manual sync
- **Precondition**: existing enabled schedule belonging to `testUser`
- **Expect**: `201`, body has `sessionId: string`

### TC-23 — POST /sync-schedules/:id/run-now — schedule not owned by user
- **Expect**: `404`

### TC-24 — GET /sync-schedules/:id/stream — SSE connect
- **Precondition**: active sync run (trigger via TC-22 first)
- **Expect**: `200 text/event-stream`, `Content-Type: text/event-stream`; receives at least one `status` event before timeout

### TC-25 — GET /sync-schedules/:id/stream — wrong user's schedule
- **Expect**: `404`

### TC-26 — POST /sync-schedules/:id/mfa-response — valid code on mfa_required job
- **Precondition**: job in `mfa_required` state (stub scraper forced into this state)
- **Body**: `{ code: '123456' }`
- **Expect**: `200 { ok: true }`

### TC-27 — POST /sync-schedules/:id/mfa-response — no pending MFA
- **Precondition**: job in `pending` or `complete` state (no active MFA wait)
- **Expect**: `400 Bad Request`

### TC-28 — POST /sync-schedules/:id/mfa-response — no JWT
- **Expect**: `401`

### TC-29 — GET /scrapers — list registered banks
- **Expect**: `200`, array; each item has `bankId`, `displayName`, `supportedFormats`, `requiresMfaOnEveryRun`; at minimum `['cibc', 'td']` present

### TC-30 — GET /scrapers — no auth required
- **Expect**: `200` without `Authorization` header (public endpoint)

---

## 10. Frontend Test Scope

*(For `frontend-tester` agent — expand into Playwright test plan)*

**Coverage level**: Full regression

**Preconditions**:
- Backend running, user logged in as `testUser`
- At least one `Account` owned by `testUser` (for schedule creation)
- Sample CSV file available locally for upload

### Tab navigation
- Navigating to `/scraper` shows two tabs: "Import" and "Sync"
- Clicking each tab switches content area

### Import tab — File upload (happy paths)
- Drag-and-drop a valid CSV onto the dropzone → dropzone shows accepted state
- Click "Browse" button → file picker opens; selecting CSV starts upload
- After successful upload: job row appears in `ImportJobList` with `completed` badge and non-zero `importedCount`
- OFX file upload: same flow, badge shows `ofx`

### Import tab — File upload (error states)
- Dropping a `.txt` file: dropzone rejects with "Only CSV or OFX files are accepted"
- Uploading oversized file (> 5 MB): error toast or inline message
- Server error (mock 500): error message shown without crashing the page

### Import tab — Job list
- `ImportJobList` renders rows for all past jobs
- Status badge color: grey (pending), blue (processing), green (completed), red (failed)
- Clicking a row expands detail (filename, rowCount, skippedCount, errorMessage if failed)

### Sync tab — Schedule management (happy paths)
- "Add Schedule" button opens `SyncScheduleModal`
- Filling in bank (TD), credentials, account, cron expression → submit → schedule row appears in list
- Editing a schedule (PATCH): modal pre-fills existing values; changes are reflected after save
- Deleting a schedule: confirmation prompt → row removed on confirm

### Sync tab — Schedule management (error states)
- Submitting form with missing required fields: inline validation errors
- Duplicate account: 409 shown as form-level error

### Sync tab — Trigger & live status
- Clicking "Sync Now" on a schedule creates a `SyncJob` and opens `SyncStatusPanel`
- `SyncStatusPanel` shows progress bar advancing with SSE events
- Latest `message` shown beneath the progress bar
- On `completed`: "Sync complete – 12 imported, 3 skipped" confirmation

### Sync tab — MFA challenge
- When SSE emits `mfa` event: `MfaModal` opens automatically over the page
- Modal shows `mfaChallenge` prompt text
- Entering a 6-digit code and confirming: modal closes; `SyncStatusPanel` continues
- Dismissing modal without code: modal closes but `SyncStatusPanel` shows "Waiting for MFA code" message

### MFA page (`/mfa?scheduleId=…`)
- Navigating to `/mfa?scheduleId=<id>` while logged in: SSE stream connects; `MfaModal` shown once `mfa_required` event received
- Submitting correct code: redirected to `/scraper`
- Navigating to `/mfa?scheduleId=<id>` while logged out: redirected to `/login`

### Auth guard
- Navigating to `/scraper` while logged out → redirect to `/login`

### Web push notification — MFA deep-link *(manual verification required)*

> **Note:** Playwright cannot observe OS-level notification bubbles. The steps below **cannot be automated** and must be verified manually by the developer. The `frontend-tester` agent should include this section in `frontend.md` as a clearly marked manual checklist and note it as out-of-scope for Playwright automation.

**Manual checklist (perform in a real Chrome browser):**

1. Open the app and navigate to `/scraper`.
2. When prompted for notification permission, click **Allow**.
3. Trigger a sync that advances to the `mfa_required` state (use a test schedule against the stub scraper).
4. Confirm an OS-level push notification appears in the system notification center/tray with the expected title and body text (e.g. "MFA Required — open the app to continue").
5. Click the notification and confirm Chrome deep-links to `/mfa?scheduleId=<id>`.
6. Confirm `MfaModal` is shown on the resulting page.

**What is already covered automatically (Playwright):**
- The `/mfa?scheduleId=…` page behaviour once the user lands on it (see "MFA page" section above).
- The `MfaModal` interaction flows (code entry, submit, dismiss).
- The push subscription API call (`POST /notifications/subscribe`) can be verified via Playwright network interception.

---

## 11. Cross-Feature Integration Points

Phase 7 does **not** require changes to previously completed features (Transactions, Categories, Accounts) — the import service writes directly to the `transactions` table using existing Prisma model, no UI changes to `TransactionsPage` are needed.

However, the following integration surfaces must be explicitly confirmed during implementation:

1. **`AccountsPage`**: After a CSV import or sync with `accountId` set, the account's `currentBalance` computed field automatically updates (it is computed server-side on each `GET /accounts` call) — **no code change needed**, but this must be verified in E2E tests.

2. **`TransactionsPage`**: Imported transactions appear automatically in the transactions list with the correct `accountId` filter — **no code change needed**, but must be smoke-tested.

---

## 12. Breaking Changes & Migration Notes

- **None** for existing endpoints — all new endpoints are additive.
- `User` and `Account` Prisma models gain new relation fields but no column changes.
- The migration adds three new tables and four new enums — safe to apply to an existing database.
- The `CREDENTIALS_ENCRYPTION_KEY` env var is **required** at backend startup once `ScraperModule` is registered. Document in `README.md` and `.env.example`.

---

## 13. Post-Backend Step

After the backend Swagger is stable (Step 7 complete), run:

```bash
cd packages/frontend && npm run generate:api
```

This regenerates `src/api/` with typed React Query hooks for all scraper endpoints. Do **not** start frontend implementation until this step completes.

---

## 14. Recommended Agent Handoff Sequence

1. `@backend-dev` — Steps 1–7 (Prisma → CryptoService → Import → Sync Schedule → Sync Job/Worker → SSE → Module registration). Commit per step.
2. `@test-writer` — Unit tests for all services and controllers (use the test list in Section 7).
3. `@backend-tester` — Live API tests per Section 9.
4. `@code-reviewer` — Backend review.
5. Run `npm run generate:api` in `packages/frontend`.
6. `@frontend-dev` — Frontend implementation per Section 6.
7. `@test-writer` — Frontend unit tests per Section 7.
8. `@code-reviewer` — Frontend review.
9. `@frontend-tester` — Playwright E2E per Section 10 (save to `test-plan/import-sync/frontend.md` and `frontend-report.md`).
