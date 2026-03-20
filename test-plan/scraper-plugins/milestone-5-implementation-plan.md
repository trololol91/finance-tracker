# Milestone 5 — Scraper Worker Implementation (Phase 8)

**Feature area:** `packages/backend/src/scraper/`
**Goal:** Replace the Phase 7 stub in `scraper.worker.ts` with a full scraping pipeline:
dynamic plugin loading, login, MFA bridge, `scrapeTransactions`, deduplication, dryRun-gated
`createMany`, and direct `PrismaClient` usage in the worker thread. Validate the pipeline end-to-end
with a new built-in stub plugin (`banks/stub.scraper.ts`) that returns 3 hardcoded transactions
without launching a real browser.

> **Design note:** Plugins own their own browser lifecycle. The framework (worker, admin service)
> never calls `chromium.launch()` or passes `Page` objects. Each plugin instantiates and closes its
> own browser internally. The `BankScraper` interface has no `page` parameters anywhere.

**No schema migrations required.** The `Transaction.fitid` column already exists.

---

## Table of Contents

1. [Layer Overview](#1-layer-overview)
2. [bank-scraper.interface.ts changes](#2-bank-scraperinterface-ts-changes)
3. [banks/stub.scraper.ts — new built-in test plugin](#3-banksstubscraperts--new-built-in-test-plugin)
4. [scraper.registry.ts changes](#4-scraperregistryts-changes)
5. [scraper.plugin-loader.ts changes](#5-scraperplugin-loaderts-changes)
6. [scraper.service.ts changes](#6-scraperservicets-changes)
7. [scraper.worker.ts — full Phase 8 implementation](#7-scraperworkerts--full-phase-8-implementation)
8. [Test Strategy](#8-test-strategy)
9. [scraper.registry.spec.ts updates](#9-scraperregistryspects-updates)
10. [scraper.plugin-loader.spec.ts updates](#10-scraperplugin-loaderspects-updates)
11. [scraper.service.spec.ts updates](#11-scraperservicespects-updates)
12. [scraper.worker.spec.ts replacement](#12-scraperworkerspects-replacement)
13. [Backend API Test Plan](#13-backend-api-test-plan)
14. [Commit Sequence](#14-commit-sequence)

---

## 1. Layer Overview

### Copy-first guidance

**All layers of Milestone 5 diverge from the standard CRUD module pattern.** The changes below are
modifications to an existing specialised subsystem (worker thread, plugin registry, plugin loader)
and must be implemented from the existing code rather than copied from `transactions/` or similar
modules.

- `bank-scraper.interface.ts` — additive field additions; no copy needed, edit in place.
- `stub.scraper.ts` — copy the shape of `cibc.scraper.ts` but replace methods with stubs.
- `scraper.registry.ts` — structural change to internal map; edit in place.
- `scraper.plugin-loader.ts` — two small targeted additions; edit in place.
- `scraper.service.ts` — inject registry, update `runWorker`, update `handleResult`; edit in place.
- `scraper.worker.ts` — replace the Phase 7 stub block entirely with the Phase 8 block described in
  the comment; this is the primary deliverable of Milestone 5.

---

## 2. bank-scraper.interface.ts changes

**File:** `packages/backend/src/scraper/interfaces/bank-scraper.interface.ts`

### 2.1 MfaRequiredError class

Move `MfaRequiredError` from `cibc.scraper.ts` into this interface file so both the worker thread
and plugin authors can import it from a single stable location without creating a circular dependency
on any specific bank plugin.

Add the following export to `bank-scraper.interface.ts`:

```typescript
export class MfaRequiredError extends Error {
    constructor(public readonly prompt: string) {
        super(`MFA required: ${prompt}`);
        this.name = 'MfaRequiredError';
    }
}
```

**Why here and not in `cibc.scraper.ts`:** `scraper.worker.ts` needs to import `MfaRequiredError`
to catch it in the `login()` error handler. `scraper.worker.ts` already imports from this interface
file. If `MfaRequiredError` stays in `cibc.scraper.ts`, the worker would have a hard dependency on
one specific plugin. Moving it to the interface file keeps the worker plugin-agnostic.

The export in `cibc.scraper.ts` (`export class MfaRequiredError`) should be **removed** and replaced
with a re-export: `export { MfaRequiredError } from '#scraper/interfaces/bank-scraper.interface.js';`
This preserves backwards compatibility for any plugin that currently imports it from `cibc.scraper.ts`.

Remove the `/* v8 ignore file */` directive from `bank-scraper.interface.ts` if it is present — the
interface file is now testable because it contains a class.

### 2.2 Optional submitMfa on BankScraper

Add the following optional method to the `BankScraper` interface:

```typescript
/**
 * Called by the worker after the main thread delivers an MFA code.
 * Only required for banks that use MFA (requiresMfaOnEveryRun: true or session-expiry MFA).
 * The plugin is responsible for its own browser/page state.
 */
submitMfa?(code: string): Promise<void>;
```

This is `?` optional because:
- Not all banks require MFA.
- The worker guards the call with `if (typeof scraper.submitMfa === 'function')`.
- Existing plugins compiled before Milestone 5 remain valid without recompiling.

### 2.3 pluginPath and databaseUrl on ScraperWorkerInput

Add two required fields to `ScraperWorkerInput`:

```typescript
export interface ScraperWorkerInput {
    bankId: string;
    inputs: PluginInputs;
    startDate: string;   // ISO 8601 UTC
    endDate: string;     // ISO 8601 UTC
    accountId: string;
    jobId: string;
    userId: string;
    /** When true the worker skips the final prisma.transaction.createMany call. */
    dryRun: boolean;
    /**
     * Absolute file:// URL to the compiled plugin .js file.
     * Resolved by ScraperService from ScraperRegistry.getPluginPath(bankId).
     * The worker calls dynamic import(pluginPath) to load the BankScraper instance.
     */
    pluginPath: string;
    /**
     * Full DATABASE_URL connection string.
     * Passed to `new PrismaClient({ datasources: { db: { url: databaseUrl } } })`
     * inside the worker so it can write transactions without NestJS DI.
     */
    databaseUrl: string;
}
```

### 2.4 WorkerMessage result variant — add importedCount and skippedCount

Update the `result` union member:

```typescript
export type WorkerMessage =
    | {type: 'status', status: string, message: string}
    | {type: 'mfa_required', prompt: string}
    | {type: 'result', transactions: RawTransaction[], importedCount: number, skippedCount: number};
```

The worker computes both counts itself (before vs after dedup) and includes them in the `result`
message. `ScraperService.handleResult()` reads them directly instead of recomputing.

---

## 3. banks/stub.scraper.ts — new built-in test plugin

**File:** `packages/backend/src/scraper/banks/stub.scraper.ts`

This is a fully deterministic scraper with no real browser calls. Its purpose is:
1. To serve as the target plugin during worker integration tests (the test specifies
   `bankId: 'stub'` and the worker dynamically imports this file).
2. To give operators a safe bankId for smoke-testing a `POST /admin/scrapers/:bankId/test`
   call without touching any real bank portal.

### Shape

Copy the structural pattern of `cibc.scraper.ts` exactly. The file begins with `/* v8 ignore file */`
because it contains no branching logic worth unit-testing independently.

```typescript
/* v8 ignore file */
import type {
    BankScraper,
    PluginInputs,
    PluginFieldDescriptor,
    ScrapeOptions,
    RawTransaction
} from '#scraper/interfaces/bank-scraper.interface.js';

const stubScraper: BankScraper = {
    bankId: 'stub',
    displayName: 'Stub Bank (test only)',
    requiresMfaOnEveryRun: false,
    maxLookbackDays: 90,
    pendingTransactionsIncluded: true,

    inputSchema: [
        {
            key: 'username',
            label: 'Username',
            type: 'text',
            required: true,
            hint: 'Any value — this scraper is a test stub'
        }
    ] satisfies PluginFieldDescriptor[],

    login(_inputs: PluginInputs): Promise<void> {
        return Promise.resolve();
    },

    scrapeTransactions(_inputs: PluginInputs, _options: ScrapeOptions): Promise<RawTransaction[]> {
        return Promise.resolve([
            {
                date: '2026-01-01',
                description: 'Stub Transaction A',
                amount: -42.00,
                pending: false,
                syntheticId: 'stub-aaa-0001'
            },
            {
                date: '2026-01-15',
                description: 'Stub Transaction B',
                amount: 100.00,
                pending: false,
                syntheticId: 'stub-bbb-0002'
            },
            {
                date: '2026-01-20',
                description: 'Stub Transaction C',
                amount: -7.50,
                pending: true,
                syntheticId: 'stub-ccc-0003'
            }
        ]);
    }
};

export default stubScraper;
```

**Key properties:**
- `bankId: 'stub'` is the lookup key. The worker resolves the plugin path via registry.
- `syntheticId` values are stable string literals — not computed from hashes — so tests can assert
  exact values without mocking a hash function.
- `login()` is a no-op — no browser instantiation needed; demonstrates plugin-owned browser pattern.
- `scrapeTransactions()` ignores `_options` (date range, includePending) and always returns all 3
  rows, making test assertions simple and stable.
- The amounts cover the three debit/credit/pending variants that tests need to check after dedup.

### BUILTIN_PLUGINS update

`stub.scraper.ts` is a built-in plugin. It will be added to `BUILTIN_PLUGINS` in
`scraper.plugin-loader.ts` (see Section 5), so it is seeded into `SCRAPER_PLUGIN_DIR` on startup
and becomes loadable by the worker at runtime.

---

## 4. scraper.registry.ts changes

**File:** `packages/backend/src/scraper/scraper.registry.ts`

### 4.1 Internal map type change

Change the internal map from `Map<string, BankScraper>` to a metadata object:

```typescript
private readonly scraperMap: Map<string, { scraper: BankScraper; pluginPath: string }>;
```

The constructor must be updated to initialise entries with an empty `pluginPath` because scrapers
injected via the `BANK_SCRAPER` DI token at NestJS module init do not have a file path available at
construction time. The DI path is a backwards-compatibility mechanism — in Phase 8 all scrapers
arrive via `ScraperPluginLoader.loadPlugins()` which calls `register()` with a real path.

```typescript
constructor(
    @Optional() @Inject(BANK_SCRAPER) scrapers: BankScraper[] | undefined
) {
    const list = scrapers ?? [];
    this.scraperMap = new Map(
        list.map(s => [s.bankId, { scraper: s, pluginPath: '' }])
    );
}
```

### 4.2 register() signature change

```typescript
public register(scraper: BankScraper, pluginPath = ''): void {
    this.scraperMap.set(scraper.bankId, { scraper, pluginPath });
}
```

The default `''` preserves backwards compatibility for any test or call site that calls
`register(scraper)` without a path.

### 4.3 findByBankId() update

```typescript
public findByBankId(bankId: string): BankScraper | undefined {
    return this.scraperMap.get(bankId)?.scraper;
}
```

### 4.4 has() — no change needed

`has()` calls `this.scraperMap.has(bankId)` which operates on the map key regardless of value type.
No code change required.

### 4.5 listAll() update

```typescript
public listAll(): ScraperInfoDto[] {
    return Array.from(this.scraperMap.values()).map(({ scraper: s }) => ({
        bankId: s.bankId,
        displayName: s.displayName,
        requiresMfaOnEveryRun: s.requiresMfaOnEveryRun,
        maxLookbackDays: s.maxLookbackDays,
        pendingTransactionsIncluded: s.pendingTransactionsIncluded,
        inputSchema: s.inputSchema
    }));
}
```

### 4.6 New getPluginPath() method

```typescript
/**
 * Returns the absolute file:// URL of the compiled plugin for the given bankId,
 * or undefined if the bankId is not registered or the plugin was registered via
 * NestJS DI (no file path available).
 */
public getPluginPath(bankId: string): string | undefined {
    const entry = this.scraperMap.get(bankId);
    if (!entry || !entry.pluginPath) return undefined;
    return entry.pluginPath;
}
```

`ScraperService.runWorker()` calls this and throws `NotFoundException` when the result is `undefined`
(see Section 6).

---

## 5. scraper.plugin-loader.ts changes

**File:** `packages/backend/src/scraper/scraper.plugin-loader.ts`

### 5.1 Add stub.scraper.js to BUILTIN_PLUGINS

```typescript
const BUILTIN_PLUGINS = ['cibc.scraper.js', 'td.scraper.js', 'stub.scraper.js'];
```

### 5.2 Pass filePath as second arg to registry.register()

In `loadPlugins()`, the loop already constructs `filePath` (the absolute OS path to the `.js` file).
Convert it to a `file://` URL before passing to `register()` so the worker can use it directly in
`import()` without an additional conversion step.

Current call:
```typescript
this.registry.register(plugin);
```

Updated call:
```typescript
this.registry.register(plugin, pathToFileURL(filePath).href);
```

`pathToFileURL` is already imported at the top of the file for the `href` used in `loadModule()`.
No new import is needed.

**Why `file://` URL not OS path:** The worker calls `import(input.pluginPath)`. On all platforms,
`import()` requires either a bare specifier or a fully-qualified URL. An absolute OS path (e.g.
`C:\plugins\cibc.scraper.js`) is not valid for `import()` on Windows without conversion. Using
`file://` URLs is consistent and cross-platform.

---

## 6. scraper.service.ts changes

**File:** `packages/backend/src/scraper/scraper.service.ts`

### 6.1 Inject ScraperRegistry

Add `ScraperRegistry` to the constructor. `ScraperRegistry` is already a provider in `ScraperModule`
so no module registration change is required.

```typescript
constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly sessionStore: SyncSessionStore,
    private readonly pushService: PushService,
    private readonly registry: ScraperRegistry
) {}
```

Add the import:
```typescript
import {ScraperRegistry} from '#scraper/scraper.registry.js';
```

### 6.2 runWorker() — add pluginPath and databaseUrl to workerInput

In `runWorker()`, after resolving `inputs`, add:

```typescript
const pluginPath = this.registry.getPluginPath(schedule.bankId);
if (!pluginPath) {
    throw new NotFoundException(
        `No plugin registered for bankId '${schedule.bankId}'`
    );
}
```

Then add the two new fields to the `workerInput` literal:

```typescript
const workerInput: ScraperWorkerInput = {
    bankId: schedule.bankId,
    inputs,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    accountId: schedule.accountId,
    jobId,
    userId: schedule.userId,
    dryRun,
    pluginPath,
    databaseUrl: process.env['DATABASE_URL'] ?? ''
};
```

**Why `process.env['DATABASE_URL']` not `ConfigService`:** `ConfigService` is a NestJS DI construct.
The worker thread has no NestJS context — it needs a plain connection string string it can pass
directly to `new PrismaClient(...)`. Reading it from `process.env` in the main thread (before
spawning) and passing it via `workerData` is the correct approach.

### 6.3 handleResult() — read counts from message instead of recomputing

**Current implementation (Phase 7):**
```typescript
private async handleResult(
    sessionId: string,
    jobId: string,
    schedule: SyncSchedule,
    transactions: RawTransaction[]
): Promise<void> {
    // TODO Phase 8: const {importedCount, skippedCount} = ...
    const importedCount = transactions.length;
    const skippedCount = 0;
    ...
}
```

**Phase 8 replacement:** Change the signature to accept the full result message object instead of
just the `transactions` array, and read `importedCount`/`skippedCount` directly from it.

New signature:
```typescript
private async handleResult(
    sessionId: string,
    jobId: string,
    schedule: SyncSchedule,
    result: { transactions: RawTransaction[]; importedCount: number; skippedCount: number }
): Promise<void> {
    const { importedCount, skippedCount } = result;
    ...
}
```

Remove the TODO comment and the two recomputed lines. The `transactions` field is no longer used in
`handleResult()` itself — the worker has already written them to the database. The field can be kept
in the result object for potential future use (e.g. logging) but no longer drives any calculation.

Update the call site in `handleWorkerMessage()`:
```typescript
} else {
    await this.handleResult(
        sessionId, jobId, schedule, msg
    );
}
```

Where `msg` is the full `result` variant of `WorkerMessage`, which now includes `importedCount`
and `skippedCount`.

**Impact on existing scraper.service.spec.ts:** The `handleResult` tests that access the private
method directly will need their `InternalService` interface updated (see Section 11).

---

## 7. scraper.worker.ts — full Phase 8 implementation

**File:** `packages/backend/src/scraper/scraper.worker.ts`

### 7.1 New imports

Replace the existing Phase 7 imports block with:

```typescript
import { parentPort, workerData } from 'worker_threads';
import { PrismaClient } from '#generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import type {
    ScraperWorkerInput,
    RawTransaction,
    BankScraper
} from '#scraper/interfaces/bank-scraper.interface.js';
import { MfaRequiredError } from '#scraper/interfaces/bank-scraper.interface.js';
import { SyncJobStatus } from '#scraper/sync-job-status.js';
```

Note: `MfaRequiredError` must be the **runtime class** for `instanceof` checks, not just the type —
import it as a value (not `import type`). No `playwright` import is needed; plugins manage their
own browsers.

### 7.2 Full replacement block (lines 86–94 in Phase 7)

Delete lines 86–94 entirely and replace with the following. The comment block on lines 42–85
describing the Phase 8 implementation should also be removed (it becomes the actual code).

```typescript
const adapter = new PrismaPg({ connectionString: input.databaseUrl });
const prisma = new PrismaClient({ adapter });

let importedCount = 0;
let skippedCount  = 0;

try {
    // 1. Dynamically load the plugin. pluginPath is a file:// URL resolved
    //    by ScraperService from ScraperRegistry.getPluginPath().
    const mod = await import(input.pluginPath) as { default: BankScraper };
    const scraper = mod.default;

    // 2. Attempt login — throws MfaRequiredError if bank shows OTP screen.
    //    The plugin owns its own browser/page; no page is passed from the worker.
    try {
        await scraper.login(input.inputs);
    } catch (err) {
        if (!(err instanceof MfaRequiredError)) throw err;

        // 3. Signal the main thread and suspend until the user submits the code.
        parentPort!.postMessage({ type: 'mfa_required', prompt: err.prompt });
        const { code } = await new Promise<{ code: string }>(r =>
            parentPort!.once('message', r)
        );

        // 4. Submit the MFA code if the plugin supports it.
        if (typeof scraper.submitMfa === 'function') {
            await scraper.submitMfa(code);
        }
    }

    // 5. Scrape — only reached once the session is fully authenticated.
    const transactions: RawTransaction[] = await scraper.scrapeTransactions(input.inputs, {
        startDate:      new Date(input.startDate),
        endDate:        new Date(input.endDate),
        includePending: true,
    });

    // 6. Deduplication: find existing fitids for this user.
    const syntheticIds = transactions.map(t => t.syntheticId);
    const existing = await prisma.transaction.findMany({
        where: {
            userId:  input.userId,
            fitid:   { in: syntheticIds }
        },
        select: { fitid: true }
    });
    const existingFitids = new Set(existing.map(r => r.fitid));
    const newTransactions = transactions.filter(
        t => !existingFitids.has(t.syntheticId)
    );

    skippedCount  = transactions.length - newTransactions.length;
    importedCount = newTransactions.length;

    // 7. Persist — gated on dryRun.
    if (!input.dryRun && newTransactions.length > 0) {
        await prisma.transaction.createMany({
            data: newTransactions.map(t => ({
                userId:          input.userId,
                accountId:       input.accountId,
                fitid:           t.syntheticId,
                date:            new Date(t.date),
                originalDate:    new Date(t.date),
                description:     t.description,
                amount:          t.amount,
                transactionType: t.amount >= 0 ? 'income' : 'expense',
                isActive:        true
            }))
        });
    }

    parentPort!.postMessage({
        type:           'result',
        transactions,
        importedCount,
        skippedCount
    });

} finally {
    await prisma.$disconnect();
    // Note: browser lifecycle is the plugin's responsibility — no browser.close() here.
}
```

### 7.3 transactionType mapping

The `Transaction.transactionType` field is a `TransactionType` enum (`income | expense | transfer`).
The worker infers it from the sign of `amount`:
- `amount >= 0` → `'income'`
- `amount < 0` → `'expense'`

`'transfer'` is not assigned by the scraper — transfers require two matching rows and bank-specific
detection logic beyond the scope of Phase 8.

### 7.4 dryRun gate placement

The `if (!input.dryRun)` gate wraps only `prisma.transaction.createMany`. The dedup query (`findMany`)
runs on every invocation, even dry runs, because:
- `skippedCount` must reflect real dedup state to be meaningful.
- Dry run users need to see what would have been imported vs skipped.

`importedCount` on a dry run is set to `newTransactions.length` (the rows that would have been
imported), not `0`. If the caller wants to distinguish dry-run results from live imports, it reads
the `dryRun` field from the job record.

### 7.5 finally block

`prisma.$disconnect()` is called in the finally block and runs regardless of whether the scrape
succeeded or failed. There is no `browser.close()` call in the worker — plugins are responsible
for closing their own browser. This keeps the framework plugin-agnostic and avoids double-close
errors if a plugin's `login()` or `scrapeTransactions()` already closes the browser on failure.

### 7.6 Worker file-level comment update

Replace the entire JSDoc comment at the top of `scraper.worker.ts` to remove Phase 7/Phase 8
references and describe the final implementation:

```typescript
/**
 * Scraper worker thread entry point.
 *
 * Runs inside a Node.js worker_thread. Does not use NestJS DI.
 * Communicates exclusively via parentPort.postMessage / parentPort.once('message').
 *
 * MFA bridge:
 *   Worker → main: postMessage({ type: 'mfa_required', prompt })
 *   Main → worker: postMessage({ type: 'mfa_code', code })
 *   Worker: const { code } = await new Promise(r => parentPort.once('message', r))
 */
```

---

## 8. Test Strategy

### 8.1 What to unit-test with mocks

| File | What to mock | What to verify |
|------|-------------|----------------|
| `scraper.registry.spec.ts` | Nothing (pure in-memory) | `getPluginPath()` returns path from `register(scraper, path)`, `''` from DI-init, `undefined` for unknown bankId |
| `scraper.plugin-loader.spec.ts` | `fs/promises`, `loadModule` | `register()` is called with `(plugin, fileUrl)` — the second arg matches `file://` pattern |
| `scraper.service.spec.ts` | `Worker` (already mocked), `ScraperRegistry` | `pluginPath` and `databaseUrl` are present in `workerData`; `NotFoundException` if no pluginPath; `handleResult()` reads counts from message not transactions array |

### 8.2 What to integration-test with real stub plugin

| File | What runs for real | Playwright needed? |
|------|-------------------|--------------------|
| `scraper.worker.spec.ts` | Dynamic `import(stub.scraper.js)`, `scrapeTransactions()` returning 3 rows, `prisma.transaction.findMany` (mocked), `prisma.transaction.createMany` (mocked), MFA bridge via `parentPort.once` | No — plugins own their own browser; `stubScraper` has no browser calls |

The worker spec should not mock `import()` — it should let the worker load the real
`stub.scraper.ts` module. This is the integration point that validates the dynamic plugin loading
pipeline without a browser.

To load the real stub scraper file, `pluginPath` in `mockState.workerData` must be set to the
actual `file://` URL of the compiled `stub.scraper.js` output. In Vitest, the compiled output lives
under `dist/` or is resolved via Vite's module resolution. The preferred approach is to import
`stubScraper` in the test file itself to discover its source path using `import.meta.url` resolution,
or to use `pathToFileURL(require.resolve('#scraper/banks/stub.scraper.js')).href`.

Alternatively: mock the `import()` call within the worker using `vi.mock` to return
`{ default: stubScraper }` without touching the filesystem. This is simpler in Vitest and avoids
compiled-output path resolution issues.

### 8.3 What is manual-only

| Scenario | Why manual |
|----------|-----------|
| Real CIBC login | Requires live credentials, VPN, and a real browser launched by the plugin. |
| Real TD login | Same as above. |
| MFA code via phone/SMS | Cannot be automated without physical device access. |

---

## 9. scraper.registry.spec.ts updates

**File:** `packages/backend/src/scraper/__TEST__/scraper.registry.spec.ts`

### 9.1 makeScraper() factory — no change needed

`makeScraper(bankId)` returns a `BankScraper`. The factory signature stays the same. The registry
constructor accepts `BankScraper[]` and now sets `pluginPath: ''` internally.

### 9.2 Existing tests that call register(scraper)

All existing `registry.register(rbc)` calls in `describe('ScraperRegistry.register', ...)` continue
to work because the new `register()` signature has `pluginPath = ''` as a default. No test changes
are needed for these three existing tests.

### 9.3 New tests to add in describe('ScraperRegistry.register')

**TC-R-01:** `register(scraper, filePath) stores the pluginPath and getPluginPath() returns it`
```
registry.register(makeScraper('rbc'), 'file:///plugins/rbc.scraper.js');
expect(registry.getPluginPath('rbc')).toBe('file:///plugins/rbc.scraper.js');
```

**TC-R-02:** `register(scraper) without pluginPath stores empty string; getPluginPath() returns undefined`
```
registry.register(makeScraper('rbc'));
expect(registry.getPluginPath('rbc')).toBeUndefined();
```

**TC-R-03:** `getPluginPath() returns undefined for unregistered bankId`
```
const registry = new ScraperRegistry([]);
expect(registry.getPluginPath('unknown')).toBeUndefined();
```

**TC-R-04:** `scrapers injected via constructor (DI path) have getPluginPath() return undefined`
```
const registry = new ScraperRegistry([makeScraper('cibc')]);
expect(registry.getPluginPath('cibc')).toBeUndefined();
```

**TC-R-05:** `overwriting a registration via register() updates the pluginPath`
```
registry.register(makeScraper('cibc'), 'file:///v1/cibc.scraper.js');
registry.register(makeScraper('cibc'), 'file:///v2/cibc.scraper.js');
expect(registry.getPluginPath('cibc')).toBe('file:///v2/cibc.scraper.js');
```

**TC-R-06:** `findByBankId() still returns the scraper object after pluginPath change`
```
const scraper = makeScraper('rbc');
registry.register(scraper, 'file:///plugins/rbc.scraper.js');
expect(registry.findByBankId('rbc')).toBe(scraper);
```

---

## 10. scraper.plugin-loader.spec.ts updates

**File:** `packages/backend/src/scraper/__TEST__/scraper.plugin-loader.spec.ts`

### 10.1 Existing tests that assert register() call shape

There are currently 4 tests that assert `mockRegistry.register` was called with a `BankScraper`
object:

```typescript
expect(mockRegistry.register).toHaveBeenCalledWith(plugin);
expect(mockRegistry.register).toHaveBeenCalledWith(cibc);
expect(mockRegistry.register).toHaveBeenCalledWith(rbc);
```

After the change, `register()` is called as `register(plugin, fileUrlString)`. These assertions
must be updated to match the two-argument form:

```typescript
// Before:
expect(mockRegistry.register).toHaveBeenCalledWith(plugin);

// After:
expect(mockRegistry.register).toHaveBeenCalledWith(
    plugin,
    expect.stringMatching(/^file:\/\//)
);
```

Apply this to all 4 call sites:
1. `'should register a valid plugin from a .js file'` — update single `toHaveBeenCalledWith`
2. `'should register all valid plugins when multiple files are present'` — update two
   `toHaveBeenCalledWith(cibc)` and `toHaveBeenCalledWith(rbc)` assertions
3. `'should skip a plugin that throws during import and continue with the next'` — update
   `toHaveBeenCalledWith(good)`

### 10.2 seedBuiltins test — count update

The existing test `'should copy all built-in plugins on a clean install'` asserts:
```typescript
expect(vi.mocked(copyFile)).toHaveBeenCalledTimes(2);
```

After adding `stub.scraper.js` to `BUILTIN_PLUGINS`, this becomes 3. Update to:
```typescript
expect(vi.mocked(copyFile)).toHaveBeenCalledTimes(3);
```

### 10.3 New test — stub.scraper.js is copied on clean install

**TC-PL-01:** `'should copy stub.scraper.js to plugin dir on clean install'`
```
mockConfig.get.mockReturnValue('/plugins');
const enoent = Object.assign(new Error('ENOENT'), {code: 'ENOENT'});
vi.mocked(access).mockRejectedValue(enoent);
vi.mocked(copyFile).mockResolvedValue(undefined);

await callSeedBuiltins(loader);

const copyArgs = vi.mocked(copyFile).mock.calls.map(([src]) => src as string);
expect(copyArgs.some(src => src.includes('stub.scraper.js'))).toBe(true);
```

### 10.4 New test — register() called with file:// URL second arg

**TC-PL-02:** `'should call registry.register with the plugin file URL as second argument'`
```
mockConfig.get.mockReturnValue('/plugins');
vi.mocked(readdir).mockResolvedValue([makeDirent('cibc.js')]);
const plugin = makePlugin('cibc');
spyLoadModule(loader).mockResolvedValue({default: plugin});

await loader.loadPlugins();

expect(mockRegistry.register).toHaveBeenCalledWith(
    plugin,
    expect.stringMatching(/^file:\/\//)
);
```

---

## 11. scraper.service.spec.ts updates

**File:** `packages/backend/src/scraper/__TEST__/scraper.service.spec.ts`

### 11.1 Add ScraperRegistry mock

Add a `mockRegistry` object to the `beforeEach` setup:

```typescript
let mockRegistry: {
    getPluginPath: ReturnType<typeof vi.fn>;
};

// in beforeEach:
mockRegistry = {
    getPluginPath: vi.fn().mockReturnValue('file:///plugins/cibc.scraper.js')
};
```

Update the `ScraperService` constructor call to pass it as the fifth argument:

```typescript
service = new ScraperService(
    prisma,
    cryptoService,
    sessionStore,
    pushService,
    mockRegistry as unknown as ScraperRegistry
);
```

Add the import:
```typescript
import type {ScraperRegistry} from '#scraper/scraper.registry.js';
```

### 11.2 Existing runWorker integration tests — assert pluginPath and databaseUrl in workerData

The three existing dryRun tests in `describe('sync', ...)` that assert `workerInput.dryRun` can also
gain assertions for the two new fields:

```typescript
const workerInput = workerHandlers.lastWorkerData as ScraperWorkerInput;
expect(workerInput.pluginPath).toBe('file:///plugins/cibc.scraper.js');
expect(workerInput.databaseUrl).toEqual(expect.any(String));
```

These can be added to the existing `dryRun: true` and `dryRun: false` tests rather than creating
separate tests.

### 11.3 New test — NotFoundException when getPluginPath returns undefined

**TC-SV-01:** `'sync() should throw NotFoundException when no plugin is registered for bankId'`
```typescript
mockRegistry.getPluginPath.mockReturnValue(undefined);

await service.sync('user-1', 'sched-1', 'manual');
await new Promise<void>(resolve => { setImmediate(resolve); });

// The worker error handler fires, updating the job to 'failed'
expect(prisma.syncJob.update).toHaveBeenCalledWith(
    expect.objectContaining({
        data: expect.objectContaining({ status: 'failed' })
    })
);
```

Note: Because `runWorker()` is called async via `void this.runWorker(...)`, a `NotFoundException`
thrown inside it routes to `handleWorkerError()`. The test should wait a tick and then assert the
job was marked failed. If the plan is to throw synchronously before the Worker is created, the test
should assert `handleWorkerError` was called instead.

**Alternative approach:** Change `runWorker()` to throw synchronously before spawning the worker,
and have the `void this.runWorker(...)` caller propagate via the `error` event. Either approach is
acceptable as long as the job lands in `failed` status and the SSE emits a `failed` event.

### 11.4 handleResult() interface and tests

The `InternalService` interface in `describe('handleResult', ...)` must be updated to match the new
signature:

```typescript
interface InternalService {
    handleResult: (
        sessionId: string,
        jobId: string,
        schedule: SyncSchedule,
        result: { transactions: RawTransaction[]; importedCount: number; skippedCount: number }
    ) => Promise<void>;
}
```

Update all 4 `handleResult` call sites in the test suite. Before:
```typescript
await svc.handleResult('job-1', 'job-1', mockSchedule, []);
```

After:
```typescript
await svc.handleResult('job-1', 'job-1', mockSchedule, {
    transactions: [],
    importedCount: 0,
    skippedCount: 0
});
```

And the import-count test (TC currently named `'should report importedCount equal to transactions array length'`)
must be updated. Before:
```typescript
const fakeTxs = [{} as RawTransaction, {} as RawTransaction];
await svc.handleResult('job-4', 'job-4', mockSchedule, fakeTxs);
// asserts '"importedCount":2'
```

After:
```typescript
await svc.handleResult('job-4', 'job-4', mockSchedule, {
    transactions: [{} as RawTransaction, {} as RawTransaction],
    importedCount: 2,
    skippedCount: 0
});
// asserts '"importedCount":2'
```

Add a new test:

**TC-SV-02:** `'handleResult reads skippedCount from the message object'`
```typescript
sessionStore.createSession('job-skip');
const received: string[] = [];
sessionStore.getObservable('job-skip').subscribe(e => received.push(e.data as string));

await svc.handleResult('job-skip', 'job-skip', mockSchedule, {
    transactions: [],
    importedCount: 1,
    skippedCount: 3
});

const completeEvent = received.find(d => d.includes('"complete"'));
expect(completeEvent).toContain('"skippedCount":3');
expect(completeEvent).toContain('"importedCount":1');
```

### 11.5 handleWorkerMessage — result branch passes full message to handleResult

The existing test `'should call handleResult for result messages'` sends:
```typescript
{type: 'result', transactions: []}
```

Update it to include the new required fields:
```typescript
{type: 'result', transactions: [], importedCount: 0, skippedCount: 0}
```

---

## 12. scraper.worker.spec.ts replacement

**File:** `packages/backend/src/scraper/__TEST__/scraper.worker.spec.ts`

The existing Phase 7 tests are replaced in their entirety. The describe block name changes from
`'scraper.worker.ts (Phase 7 stub)'` to `'scraper.worker.ts (Phase 8)'`.

### 12.1 Additional mocks required

The worker now uses:
1. `#generated/prisma/client.js` (`PrismaClient`) and `@prisma/adapter-pg` (`PrismaPg`)
2. `import(input.pluginPath)` (dynamic plugin load)

No `playwright` mock is needed — plugins own their own browser, and `stubScraper` has no browser
calls at all.

#### PrismaClient mock

```typescript
const prismaMocks = vi.hoisted(() => ({
    findMany:   vi.fn().mockResolvedValue([]),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
    disconnect: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('#generated/prisma/client.js', () => ({
    PrismaClient: class MockPrismaClient {
        public transaction = {
            findMany:   prismaMocks.findMany,
            createMany: prismaMocks.createMany
        };
        public $disconnect = prismaMocks.disconnect;
        constructor(_opts: unknown) {}
    }
}));

vi.mock('@prisma/adapter-pg', () => ({
    PrismaPg: class MockPrismaPg {
        constructor(_opts: unknown) {}
    }
}));
```

#### Dynamic import mock (plugin loading)

The worker calls `import(input.pluginPath)`. Mock it so the stub scraper is returned without
touching the filesystem:

```typescript
import stubScraper from '#scraper/banks/stub.scraper.js';

// In vi.mock or beforeEach — intercept import() for the plugin path
vi.mock(import.meta.resolve('#scraper/banks/stub.scraper.js'), () => ({
    default: stubScraper
}));
```

Alternatively, configure `mockState.workerData.pluginPath` to the resolved module URL and use
`vi.doMock` to intercept that specific URL. The exact approach depends on Vitest's module
resolution support for dynamic mocks. The test author should verify which technique Vitest supports
for intercepting `import(url)` calls where `url` is a `file://` string known at test time.

A simpler fallback: spy on the top-level `import()` by wrapping the dynamic import inside the
worker in a helper function (similar to how `loadModule()` is a protected override in
`ScraperPluginLoader`). This would require a small refactor to `scraper.worker.ts` — expose an
async `loadPlugin(path: string): Promise<BankScraper>` helper that tests can spy on. However,
since the worker uses top-level execution code (not a class), the spy approach requires the
worker to export this helper. This is not the current architecture.

The recommended approach for Milestone 5 is to set `pluginPath` to the real compiled output path
of `stub.scraper.js` (resolved via `import.meta.resolve` in the test file at import time), so the
worker's `import()` actually loads the real module. This is an integration test, not a pure unit
test — loading the real stub plugin without a browser is the whole point.

### 12.2 mockState.workerData default — Phase 8 shape

```typescript
const mockState = vi.hoisted(() => ({
    postMessage: vi.fn(),
    once: vi.fn(),
    workerData: {
        bankId: 'stub',
        inputs: { username: 'test-user' },
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-03-15T00:00:00.000Z',
        accountId: 'acct-1',
        jobId: 'job-1',
        userId: 'user-1',
        dryRun: false,
        pluginPath: /* resolved at test setup */ '',
        databaseUrl: 'postgresql://test:test@localhost:5432/test'
    } as ScraperWorkerInput
}));
```

The `parentPort` mock must expose `once` in addition to `postMessage` so the MFA bridge can work:

```typescript
vi.mock('worker_threads', () => ({
    get workerData() {
        return mockState.workerData;
    },
    get parentPort() {
        return {
            postMessage: mockState.postMessage,
            once: mockState.once
        };
    }
}));
```

### 12.3 Test cases — Phase 8 suite

**TC-W-01:** `'posts loggingIn status message before result'`
- Same assertion as Phase 7: `postMessage` call with `{type:'status', status: SyncJobStatus.loggingIn}`
  appears at index 0.

**TC-W-02:** `'posts result message with 3 transactions from stub scraper'`
- `postMessage` call with `{type:'result', transactions: [...], importedCount: ..., skippedCount: ...}`
- `resultMsg.transactions` has length 3.
- `resultMsg.transactions[0].syntheticId` is `'stub-aaa-0001'`.

**TC-W-03:** `'dryRun: false — prisma.transaction.createMany is called with deduped rows'`
- `mockState.workerData.dryRun = false`
- `mockPrismaFindMany.mockResolvedValue([])` (no existing rows)
- `mockPrismaCreateMany` should be called once with `data` array of length 3.

**TC-W-04:** `'dryRun: true — prisma.transaction.createMany is NOT called'`
- `mockState.workerData.dryRun = true`
- After `importWorker()`, assert `mockPrismaCreateMany` was NOT called.
- Assert `resultMsg.importedCount` is 3 (would-have-been count).

**TC-W-05:** `'dedup: existing fitids are skipped; skippedCount reflects real dedup'`
- `mockPrismaFindMany.mockResolvedValue([{ fitid: 'stub-aaa-0001' }])`
- After import: `createMany` called with `data` array of length 2 (not 3).
- `resultMsg.skippedCount` is 1.
- `resultMsg.importedCount` is 2.

**TC-W-06:** `'dedup: all 3 rows already exist — createMany not called; importedCount 0'`
- `mockPrismaFindMany.mockResolvedValue([
    { fitid: 'stub-aaa-0001' },
    { fitid: 'stub-bbb-0002' },
    { fitid: 'stub-ccc-0003' }
  ])`
- `mockPrismaCreateMany` should NOT be called.
- `resultMsg.importedCount` is 0, `resultMsg.skippedCount` is 3.

**TC-W-07:** `'MFA bridge: posts mfa_required, awaits code, calls submitMfa if defined'`
- This test requires a scraper that throws `MfaRequiredError` from `login()`.
- Mock the plugin import to return a scraper where `login()` throws
  `new MfaRequiredError('Enter your OTP')` and `submitMfa` is a spy.
- Configure `mockState.once` to immediately call its callback with `{ code: '123456' }`.
- Assert `postMessage` was called with `{type:'mfa_required', prompt: 'Enter your OTP'}`.
- Assert the `submitMfa` spy was called with `('123456')` — no page argument.

**TC-W-08:** `'MFA bridge: submitMfa is not called when scraper does not define it'`
- Same as TC-W-07 but the mock scraper has no `submitMfa` field.
- Assert no error is thrown and the result message is still posted.

**TC-W-09:** `'prisma.$disconnect is called in finally on success'`
- After a clean run: assert `mockPrismaDisconnect` was called once.
- No `browser.close()` assertion — the plugin owns browser lifecycle.

**TC-W-10:** `'prisma.$disconnect is called in finally on error'`
- Configure `scrapeTransactions()` to throw `new Error('Network error')`.
- Import the worker and expect it to reject.
- Assert `mockPrismaDisconnect` was called once.
- Assert `postMessage` was NOT called with `{type:'result', ...}`.
- The worker exits with an unhandled rejection — the error propagates to the main thread's
  `worker.on('error', ...)` handler in real usage.

**TC-W-11:** `'includes the bankId in the loggingIn status message'` (migrated from Phase 7)
- Keep the existing assertion that `statusMsg.message` contains `'stub'`.

**TC-W-12:** `'posts result regardless of dryRun: true'` (migrated from Phase 7)
- Confirm result message is always posted regardless of dryRun.

---

## 13. Backend API Test Plan

This section is for the `backend-tester` agent. Save the full test plan to
`test-plan/scraper-plugins/milestone-5-backend.md` and the report to
`milestone-5-backend-report.md`.

Milestone 5 is a worker-thread change with no new HTTP endpoints. The test plan validates the
observable HTTP behaviour that changes as a result of the worker change.

### Preconditions

- Backend running with `DATABASE_URL` set.
- `SCRAPER_PLUGIN_DIR` set to a writable directory (e.g. `/tmp/plugins`).
- Authenticated user token available. Admin token available.
- A `SyncSchedule` exists for `bankId: 'stub'` (create via `POST /sync-schedules`).

### TC-API-01: GET /scrapers — stub bank appears in list

- **Method/Route:** `GET /scrapers`
- **Auth:** None (public endpoint)
- **Expected status:** 200
- **Response:** Array includes object with `bankId: 'stub'`, `displayName: 'Stub Bank (test only)'`

### TC-API-02: POST /admin/scrapers/stub/test — dry run succeeds with stub

- **Method/Route:** `POST /admin/scrapers/stub/test`
- **Auth:** Admin token
- **Body:** `{}`
- **Expected status:** 201 or 200
- **Response:** `{ dryRun: true, bankId: 'stub', importedCount: number, skippedCount: number }`
- **Notes:** On first run, `importedCount` should be 3 (all 3 stub rows are new). On second run,
  `skippedCount` should be 3 (all already exist from first run if dryRun was false; still 0 if
  first run was also dryRun).

### TC-API-03: POST /sync-schedules/:id/run-now — live run imports stub transactions

- **Method/Route:** `POST /sync-schedules/:id/run-now` with stub schedule ID
- **Auth:** User token
- **Body:** `{ dryRun: false }`
- **Expected status:** 201 (returns `{ sessionId }`)
- **Verification:** Subscribe to `GET /sync-schedules/:id/stream` with the sessionId and observe
  the SSE event sequence:
  1. `{status: 'pending', ...}`
  2. `{status: 'logging_in', ...}`
  3. `{status: 'complete', importedCount: 3, skippedCount: 0}` (on first run)
- **Follow-up:** GET transactions for the account and verify 3 rows with `fitid` values
  `stub-aaa-0001`, `stub-bbb-0002`, `stub-ccc-0003`.

### TC-API-04: POST /sync-schedules/:id/run-now — second run deduplicates

- **Method/Route:** Same as TC-API-03
- **Precondition:** TC-API-03 has already run and imported 3 rows.
- **Expected SSE terminal event:** `{status: 'complete', importedCount: 0, skippedCount: 3}`

### TC-API-05: POST /sync-schedules/:id/run-now — dryRun: true does not create transactions

- **Method/Route:** Same as TC-API-03
- **Body:** `{ dryRun: true }`
- **Precondition:** Fresh account with no existing stub transactions.
- **Expected SSE terminal event:** `{status: 'complete', importedCount: 3, skippedCount: 0}`
- **Verification:** GET transactions returns 0 rows (nothing written to DB).

### TC-API-06: POST /sync-schedules/:id/run-now — unknown bankId schedule returns failed status

- **Method/Route:** `POST /sync-schedules/:id/run-now` with a schedule that has `bankId: 'unknown'`
- **Auth:** User token
- **Expected:** The job eventually reaches `status: 'failed'` with `errorMessage` containing
  `'No plugin registered'` (or similar). The SSE stream emits a failed event.

### TC-API-07: GET /scrapers — stub bank has correct inputSchema

- **Method/Route:** `GET /scrapers`
- **Expected:** The stub entry's `inputSchema` array contains exactly one element:
  `{ key: 'username', label: 'Username', type: 'text', required: true, hint: '...' }`

---

## 14. Commit Sequence

The following commits, in order, keep the codebase compiling and tests passing after each step.

**Commit 1:** `feat(scraper): add MfaRequiredError, submitMfa, pluginPath, databaseUrl to interface`
- Files: `bank-scraper.interface.ts`, `cibc.scraper.ts` (re-export MfaRequiredError)
- TypeScript must compile after this commit. `scraper.service.ts` will have type errors until
  Commit 3 — either apply Commits 1-3 together in a single commit or apply Commit 3 immediately
  before running `tsc`.

**Commit 2:** `feat(scraper): add stub.scraper.ts built-in test plugin`
- Files: `banks/stub.scraper.ts`

**Commit 3:** `feat(scraper): update ScraperRegistry to store pluginPath metadata`
- Files: `scraper.registry.ts`
- All registry spec tests must pass after this commit.

**Commit 4:** `feat(scraper): pass pluginPath to registry.register() in plugin-loader`
- Files: `scraper.plugin-loader.ts`
- All plugin-loader spec tests must pass after this commit (update spec call sites in same commit).

**Commit 5:** `feat(scraper): inject ScraperRegistry into ScraperService; thread pluginPath and databaseUrl`
- Files: `scraper.service.ts`
- All service spec tests must pass after this commit (update spec in same commit).

**Commit 6:** `feat(scraper): implement Phase 8 scraper worker with dynamic plugin loading and dedup`
- Files: `scraper.worker.ts`
- All worker spec tests must pass after this commit (update spec in same commit).

**Combined commit option:** The above 6 commits can be combined into a single commit if the
implementer prefers to avoid intermediate type errors:
`feat(scraper): implement Phase 8 scraper worker with stub plugin and dedup`

---

## Appendix: File List

| File | Action | Section |
|------|--------|---------|
| `packages/backend/src/scraper/interfaces/bank-scraper.interface.ts` | Modify | 2 |
| `packages/backend/src/scraper/banks/cibc.scraper.ts` | Modify (re-export MfaRequiredError) | 2.1 |
| `packages/backend/src/scraper/banks/stub.scraper.ts` | Create | 3 |
| `packages/backend/src/scraper/scraper.registry.ts` | Modify | 4 |
| `packages/backend/src/scraper/scraper.plugin-loader.ts` | Modify | 5 |
| `packages/backend/src/scraper/scraper.service.ts` | Modify | 6 |
| `packages/backend/src/scraper/scraper.worker.ts` | Modify (full Phase 8 replacement) | 7 |
| `packages/backend/src/scraper/__TEST__/scraper.registry.spec.ts` | Modify | 9 |
| `packages/backend/src/scraper/__TEST__/scraper.plugin-loader.spec.ts` | Modify | 10 |
| `packages/backend/src/scraper/__TEST__/scraper.service.spec.ts` | Modify | 11 |
| `packages/backend/src/scraper/__TEST__/scraper.worker.spec.ts` | Replace | 12 |
