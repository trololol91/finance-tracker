# Milestone 3 — dryRun Flag on Run-Now: Implementation Plan

**Goal:** Allow end-to-end testing of the full sync pipeline — including the worker thread, SSE events, and MFA flow — without committing any transactions to the database. A single boolean flag on the existing `POST /sync-schedules/:id/run-now` endpoint is all that is needed; no new endpoint or response shape is required.

**Milestone status:** `⬜ Not Started` (see `docs/scraper-plugins/roadmap.md`)

---

## Context and Key Findings

### Worker thread and Prisma reality

Reading `scraper.worker.ts` reveals that the current Phase 7 stub **never calls `prisma.transaction.createMany`**. The worker is a thin stub that immediately returns `[]`. The real Playwright + dedup + write logic is deferred to Phase 8 (the comment block inside `scraper.worker.ts` describes the intended Phase 8 implementation).

This means:

- Adding the `if (!input.dryRun)` gate in `scraper.worker.ts` today places the guard in the right structural location, ready for Phase 8 to fill in. The guard does not break any live behaviour because `createMany` is not yet called.
- The dedup `skippedCount` computation described in this milestone will also need to land in the Phase 8 implementation block (inside the worker's real scrape path). For now, the worker returns an empty `RawTransaction[]` and the service sets `skippedCount = 0`.

### Where `ScraperService.sync()` is called

There are exactly two live call sites:

| File | Signature | Notes |
|------|-----------|-------|
| `packages/backend/src/scraper/sync/sync-job.controller.ts` line 73 | `sync(userId, scheduleId, 'manual', dto.startDate)` | The only place that accepts a `RunSyncNowDto` |
| `packages/backend/src/scraper/sync/sync-schedule.service.ts` line 259 | Placeholder comment only — `ScraperService.sync()` will be called here in Step 5 (cron) | Not yet implemented; no `dryRun` needs to be threaded here |

The cron call site does not exist yet. When it is implemented it will always pass `dryRun: false` (cron runs are never dry). No changes to `sync-schedule.service.ts` are required for this milestone.

### `ScraperWorkerInput` currently has no `dryRun` field

The interface lives in `bank-scraper.interface.ts`. It is a plain TypeScript interface — no Prisma model or migration is involved. Adding `dryRun: boolean` is a pure type-level change that propagates through `workerData`.

### How `handleResult` is currently wired

`ScraperService.handleResult()` receives `transactions: RawTransaction[]` from the worker and writes `importedCount = transactions.length`, `skippedCount = 0`. There is a `TODO Phase 8` comment noting that an `ImportService.bulkInsert()` call will replace this stub.

The `dryRun` flag does not need to reach `handleResult` — the worker is the source of truth for whether a write happened. `handleResult` just records what the worker reports. The worker will pass back an empty `transactions` array on a dry run, so `importedCount` will naturally be `0` (once Phase 8 logic is in place the worker will need to report the dry-run distinction explicitly — see the Phase 8 note in Step 4 below).

---

## Copy-First Assessment

**Backend:** This milestone is a narrow field-threading task, not a new CRUD feature. There is no need to copy any existing module. Each change is a targeted edit to an existing file. The pattern does not diverge from anything.

---

## Files to Change

| # | File | Change type |
|---|------|-------------|
| 1 | `packages/backend/src/scraper/sync/dto/run-sync-now.dto.ts` | Add `dryRun?: boolean` field |
| 2 | `packages/backend/src/scraper/interfaces/bank-scraper.interface.ts` | Add `dryRun: boolean` to `ScraperWorkerInput` |
| 3 | `packages/backend/src/scraper/scraper.service.ts` | Thread `dryRun` into the `workerInput` object |
| 4 | `packages/backend/src/scraper/scraper.worker.ts` | Add `if (!input.dryRun)` gate around the write block |
| 5 | `packages/backend/src/scraper/__TEST__/scraper.service.spec.ts` | New test cases for dryRun threading |
| 6 | `packages/backend/src/scraper/__TEST__/scraper.worker.spec.ts` | New spec file — worker unit tests for dryRun |

No Prisma schema change. No migration. No new DTOs. No new controller actions. No new endpoints.

---

## Step-by-Step Implementation

---

### Step 1 — `RunSyncNowDto`: add `dryRun?: boolean`

**File:** `packages/backend/src/scraper/sync/dto/run-sync-now.dto.ts`

**What to change:**

Add `@IsBoolean()` to the imports from `class-validator`. Add `@ApiPropertyOptional` for the new field. Add the `dryRun` property after `startDate`.

**Before:**

```typescript
import {
    IsDateString,
    IsOptional
} from 'class-validator';
import {ApiPropertyOptional} from '@nestjs/swagger';

/** Body accepted by POST /sync-schedules/:id/run-now. */
export class RunSyncNowDto {
    @ApiPropertyOptional({
        description:
            'Override the computed start date for this sync window. ' +
            'ISO 8601 UTC string (e.g. "2025-01-01T00:00:00.000Z"). ' +
            'If omitted the service uses the standard lookback calculation.',
        example: '2025-01-01T00:00:00.000Z'
    })
    @IsOptional()
    @IsDateString()
    public startDate?: string;
}
```

**After:**

```typescript
import {
    IsDateString,
    IsOptional,
    IsBoolean
} from 'class-validator';
import {ApiPropertyOptional} from '@nestjs/swagger';

/** Body accepted by POST /sync-schedules/:id/run-now. */
export class RunSyncNowDto {
    @ApiPropertyOptional({
        description:
            'Override the computed start date for this sync window. ' +
            'ISO 8601 UTC string (e.g. "2025-01-01T00:00:00.000Z"). ' +
            'If omitted the service uses the standard lookback calculation.',
        example: '2025-01-01T00:00:00.000Z'
    })
    @IsOptional()
    @IsDateString()
    public startDate?: string;

    @ApiPropertyOptional({
        description:
            'When true, runs the full scrape pipeline (login, scrape, dedup check) ' +
            'but skips the final database write. All SSE status events are emitted ' +
            'normally; the terminal complete event will have importedCount: 0. ' +
            'Defaults to false when omitted.',
        example: true,
        default: false
    })
    @IsOptional()
    @IsBoolean()
    public dryRun?: boolean;
}
```

**Decorator order note:** `@IsOptional()` must appear before `@IsBoolean()`. `class-validator` processes decorators bottom-to-top at runtime, but by convention optional fields always list `@IsOptional()` first for readability. Do not add `@IsNotEmpty()` — that would contradict `@IsOptional()`.

**Edge cases:**

- Omitting `dryRun` from the request body must produce `undefined` on the DTO instance. The service must treat `undefined` as `false` when building the `workerInput` (see Step 3).
- Sending `dryRun: "yes"` (a string) must return `400 Bad Request` — `@IsBoolean()` enforces boolean type. The `ValidationPipe` must be configured with `transform: true` for this to work correctly with JSON `true`/`false` values (this is already the case project-wide per the global pipe in `main.ts`).
- Sending `dryRun: 1` (a number) must also return `400` — `@IsBoolean()` does not coerce numbers.

**How to verify:** Send `POST /sync-schedules/:id/run-now` with body `{ "dryRun": "yes" }` and confirm `400`. Send with `{ "dryRun": true }` and confirm `201`.

---

### Step 2 — `ScraperWorkerInput`: add `dryRun: boolean`

**File:** `packages/backend/src/scraper/interfaces/bank-scraper.interface.ts`

**What to change:** Add the `dryRun: boolean` field to `ScraperWorkerInput`. The field is non-optional — the service always sets it explicitly (defaulting to `false` when the DTO omits it), so the worker can rely on it being present.

**Before:**

```typescript
export interface ScraperWorkerInput {
    bankId: string;
    credentials: {username: string, password: string};
    startDate: string;   // ISO 8601 UTC
    endDate: string;     // ISO 8601 UTC
    accountId: string;
    jobId: string;
    userId: string;
}
```

**After:**

```typescript
export interface ScraperWorkerInput {
    bankId: string;
    credentials: {username: string, password: string};
    startDate: string;   // ISO 8601 UTC
    endDate: string;     // ISO 8601 UTC
    accountId: string;
    jobId: string;
    userId: string;
    /** When true the worker skips the final prisma.transaction.createMany call. */
    dryRun: boolean;
}
```

**Edge cases:** TypeScript will now require every caller constructing a `ScraperWorkerInput` literal to provide `dryRun`. There is only one such literal — in `ScraperService.runWorker()`. The typecheck (`npm run typecheck`) will fail until Step 3 is applied. Apply Step 2 and Step 3 together before running typecheck.

**How to verify:** `npm run typecheck` passes with zero errors after Step 3 is also applied.

---

### Step 3 — `ScraperService.sync()` and `runWorker()`: thread `dryRun`

**File:** `packages/backend/src/scraper/scraper.service.ts`

**What to change:**

Two modifications are needed:

1. The public `sync()` method signature gains a `dryRun` parameter.
2. `runWorker()` gains a `dryRun` parameter and sets it on the `workerInput`.

**Change 1 — `sync()` signature and call to `runWorker()`:**

The controller currently calls:

```typescript
return this.scraperService.sync(
    currentUser.id,
    scheduleId,
    'manual',
    dto.startDate
);
```

The service signature must become:

```typescript
public async sync(
    userId: string,
    scheduleId: string,
    triggeredBy: 'cron' | 'manual' = 'manual',
    startDateOverride?: string,
    dryRun: boolean = false
): Promise<{sessionId: string}>
```

The `dryRun` parameter is appended at the end with a default of `false` so the cron call site (not yet implemented) and any existing callers require no changes.

Inside `sync()`, forward the parameter to `runWorker()`:

```typescript
void this.runWorker(sessionId, job.id, schedule, startDateOverride, dryRun);
```

**Change 2 — `runWorker()` signature and `workerInput` construction:**

```typescript
private async runWorker(
    sessionId: string,
    jobId: string,
    schedule: SyncSchedule,
    startDateOverride?: string,
    dryRun: boolean = false
): Promise<void>
```

Inside `runWorker()`, the `workerInput` object must include `dryRun`:

```typescript
const workerInput: ScraperWorkerInput = {
    bankId: schedule.bankId,
    credentials,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    accountId: schedule.accountId,
    jobId,
    userId: schedule.userId,
    dryRun
};
```

**Controller call site** (`sync-job.controller.ts` line 73):

```typescript
return this.scraperService.sync(
    currentUser.id,
    scheduleId,
    'manual',
    dto.startDate,
    dto.dryRun ?? false
);
```

The `?? false` coerces `undefined` (DTO field omitted) to `false`. This is the only call site that passes a non-default value for `dryRun`.

**Edge cases:**

- `dto.dryRun` is `undefined` when the field is omitted from the request body. `dto.dryRun ?? false` correctly maps this to `false`.
- `dto.dryRun` is `true` when explicitly sent. This flows unchanged into the worker.
- The cron call site in `sync-schedule.service.ts` is a stub comment — it does not yet call `sync()`. When it is implemented it will use the default `dryRun = false` by omitting the argument, which is correct.

**No other call sites need updating.** The grep in the research phase confirmed only two live callers — the controller and the placeholder comment. The spec file calls are unit test stubs that do not test `runWorker()` directly.

**How to verify:** `npm run typecheck` passes. `npm run lint` passes. The existing service spec tests continue to pass.

---

### Step 4 — `scraper.worker.ts`: gate the write on `!input.dryRun`

**File:** `packages/backend/src/scraper/scraper.worker.ts`

**What to change:**

The current Phase 7 stub posts a `result` message with an empty `RawTransaction[]` immediately. There is no `prisma.transaction.createMany` call in this file today — that call is inside the Phase 8 implementation block described in the JSDoc comment.

The correct approach for this milestone is to add the `dryRun` gate as a structural comment and stub so that Phase 8 naturally drops into it. The Phase 8 implementation block shows exactly where `createMany` will sit.

**Structural change to the Phase 8 comment block:**

The existing Phase 8 comment block ends with:

```typescript
 *       parentPort!.postMessage({ type: 'result', transactions });
```

In the Phase 8 implementation the real code will look like (paraphrased from the comment):

```typescript
const transactions = await scraper.scrapeTransactions(page, { ... });

// --- dryRun gate ---
if (!input.dryRun) {
    // Phase 8: dedup against existing fitids, call prisma.transaction.createMany
    // importedCount = newly inserted rows
    // skippedCount  = rows that matched an existing fitid
}
// On dry run: importedCount = 0, skippedCount reflects dedup result

parentPort!.postMessage({ type: 'result', transactions });
```

For this milestone, update the comment block inside `scraper.worker.ts` to reflect the gate placement so backend-dev implementing Phase 8 sees it immediately. Also update the live stub code at the bottom of the file to read `input.dryRun` (a no-op branch since `transactions` is always `[]`) so the TypeScript compiler validates `input.dryRun` is accessible:

**Before (live stub lines, unchanged today):**

```typescript
const transactions: RawTransaction[] = [];
parentPort.postMessage({type: 'result', transactions});
```

**After (live stub lines):**

```typescript
// Phase 7 stub: return empty transactions immediately regardless of dryRun.
// Phase 8 will replace this block with the real Playwright + dedup + write logic.
// The dryRun gate belongs around prisma.transaction.createMany — not around the
// scrape itself. See the Phase 8 comment block above for placement.
const transactions: RawTransaction[] = [];
// istanbul ignore next — dry-run gate; real createMany deferred to Phase 8
if (!input.dryRun) {
    // Phase 8: prisma.transaction.createMany(dedupedRows) goes here
}
parentPort.postMessage({type: 'result', transactions});
```

**Important:** The `parentPort.postMessage({ type: 'result', transactions })` call is ALWAYS executed, regardless of `dryRun`. SSE events must flow on both dry and real runs. The gate only wraps the database write, never the scrape or the result message.

**Dedup and `skippedCount` on dry run:**

In Phase 8, the dedup logic (query existing `fitid` values from the database) will run regardless of `dryRun`. The split is:

- `dryRun: false` — dedup runs, new rows are written via `createMany`, `importedCount` = rows written, `skippedCount` = rows skipped.
- `dryRun: true` — dedup runs, `createMany` is skipped, `importedCount` = 0, `skippedCount` = rows that would have been skipped.

For the Phase 7 stub (which returns `[]`), `importedCount` is `0` and `skippedCount` is `0` in both cases, so the caller cannot distinguish a dry run from a real run via counts alone in the current implementation. This is expected and acceptable for Phase 7 — the structural gate is in place for Phase 8.

**Edge cases:**

- The `/* v8 ignore file */` directive at the top of `scraper.worker.ts` suppresses coverage for the entire file. The gate `if (!input.dryRun)` inside the stub does not affect coverage metrics.
- The worker reads `workerData as ScraperWorkerInput`. If `dryRun` is missing from `workerData` (e.g. old serialized data), `input.dryRun` will be `undefined`, which is falsy. The `if (!input.dryRun)` gate will execute the write, which is the safe default. In practice, `ScraperService` always sets `dryRun: boolean` explicitly, so this case cannot arise in production.

**How to verify:** `npm run typecheck` resolves `input.dryRun` without error. `npm run lint` passes.

---

### Step 5 — SSE event behaviour

No code changes are needed for this step — it is a behavioural specification for the test author and the reviewer.

**Behaviour on dry run (`dryRun: true`):**

1. `POST /sync-schedules/:id/run-now` with `{ "dryRun": true }` returns `{ sessionId }` immediately (HTTP 201) — identical to a real run.
2. The `pending` status event is emitted to the SSE stream.
3. The `logging_in` status event is emitted.
4. The worker runs the full scrape (login, scrapeTransactions) — no short-circuit.
5. The `result` message arrives at `ScraperService.handleResult()`.
6. `handleResult()` updates the `SyncJob` to `complete` with `importedCount: 0`, `skippedCount: 0` (Phase 7 stub values).
7. The terminal `complete` SSE event is emitted with `{ status: "complete", importedCount: 0, skippedCount: 0 }`.
8. The SSE stream closes.

**Key invariant:** The only observable difference between a dry run and a real run at the SSE level is `importedCount: 0` in the terminal event (in Phase 8; in Phase 7 both are `0` because no real scrape occurs).

**Note on `handleResult()` and dryRun awareness:**

`handleResult()` currently receives `transactions: RawTransaction[]` and computes `importedCount = transactions.length`. In Phase 8, after the worker performs the dedup + write, the result message will need to carry `importedCount` and `skippedCount` directly (the worker is the only party that knows what was written). At that point, either:

- The `result` message shape gains `importedCount` and `skippedCount` fields alongside `transactions`, or
- The worker returns an empty `transactions` array on a dry run so `handleResult()` sees `transactions.length === 0`.

This is a Phase 8 concern, not a Milestone 3 concern. No changes to `handleResult()` are needed now.

---

## Unit Test Plan

This milestone is backend-only. There is no frontend change. There is no UI.

---

### `scraper.service.spec.ts` — new test cases

Add these cases to the existing `sync` describe block in `packages/backend/src/scraper/__TEST__/scraper.service.spec.ts`.

The challenge is that `runWorker()` is private and constructs `workerInput` internally before passing it to `new Worker(path, { workerData: workerInput })`. The mock `Worker` class (already in the spec file) captures the `workerData` via the constructor — but the current mock does not capture or expose `workerData`. The test author needs to extend the mock to record `workerData`.

**Pattern to capture `workerData`:**

Inside the `vi.mock('worker_threads', ...)` factory, extend the `MockWorker` class:

```typescript
// Add to the hoisted worker capture object:
const workerHandlers = vi.hoisted(() => ({
    message: undefined as ((msg: unknown) => void) | undefined,
    error: undefined as ((err: Error) => void) | undefined,
    terminate: vi.fn(),
    lastWorkerData: undefined as unknown  // new field
}));

vi.mock('worker_threads', () => ({
    Worker: class MockWorker {
        constructor(_path: string, options: { workerData: unknown }) {
            workerHandlers.lastWorkerData = options.workerData;
        }
        public on(event: string, handler: (arg: unknown) => void): void { ... }
        public postMessage(_msg: unknown): void { /* no-op */ }
        public terminate(): void { workerHandlers.terminate(); }
    }
}));
```

**Test case 1 — dryRun: true is passed through to the worker input:**

```
it('should pass dryRun: true to the worker input when dto.dryRun is true', async () => {
    await service.sync('user-1', 'sched-1', 'manual', undefined, true);
    await new Promise<void>(resolve => { setImmediate(resolve); });

    const workerInput = workerHandlers.lastWorkerData as ScraperWorkerInput;
    expect(workerInput.dryRun).toBe(true);
});
```

**Test case 2 — dryRun defaults to false when omitted:**

```
it('should pass dryRun: false to the worker input when dryRun is not provided', async () => {
    await service.sync('user-1', 'sched-1', 'manual', undefined);
    await new Promise<void>(resolve => { setImmediate(resolve); });

    const workerInput = workerHandlers.lastWorkerData as ScraperWorkerInput;
    expect(workerInput.dryRun).toBe(false);
});
```

**Test case 3 — dryRun: false is explicit false:**

```
it('should pass dryRun: false to the worker input when dryRun is explicitly false', async () => {
    await service.sync('user-1', 'sched-1', 'manual', undefined, false);
    await new Promise<void>(resolve => { setImmediate(resolve); });

    const workerInput = workerHandlers.lastWorkerData as ScraperWorkerInput;
    expect(workerInput.dryRun).toBe(false);
});
```

---

### `scraper.worker.spec.ts` — new spec file

This file does not yet exist. Create it at `packages/backend/src/scraper/__TEST__/scraper.worker.spec.ts`.

**Important note before writing this spec:** The worker file has `/* v8 ignore file */` at the top, which suppresses all v8 coverage. Vitest respects this directive. The worker can still be tested using module-level mocks — but the approach is different from spawning a real worker thread.

**Testing strategy for `scraper.worker.ts`:**

The worker entry point uses top-level `await`-free imperative code (not a class). It reads `workerData`, calls `parentPort.postMessage()`, and (in Phase 8) would call `prisma.transaction.createMany`. The correct approach is to:

1. Mock `worker_threads` to inject controlled `workerData` (as `workerData`) and a spy `parentPort`.
2. Use Vitest's `vi.resetModules()` + dynamic `import()` to re-execute the module under test with each mock configuration, since the module runs top-level code on import.

**Alternatively**, given that the Phase 7 stub does nothing except post a result, the worker tests for this milestone should be documented as a test-stub specification and deferred to Phase 8 when real `createMany` logic exists. The two behaviours to validate are:

- `dryRun: false` — `prisma.transaction.createMany` is called.
- `dryRun: true` — `prisma.transaction.createMany` is NOT called.

Neither of these is currently testable (there is no `createMany` call in the stub). The spec file should be created now with placeholder `it.todo` tests for both cases, plus one executable test confirming the worker posts a `result` message.

**Cases to write now as live tests:**

```
describe('scraper.worker.ts (Phase 7 stub)', () => {
    it('should post a result message with an empty transactions array', async () => {
        // Mock worker_threads, dynamic-import the worker,
        // assert parentPort.postMessage was called with
        // { type: 'result', transactions: [] }
    });

    it('should post a status message with status loggingIn before the result', async () => {
        // Assert parentPort.postMessage was called first with
        // { type: 'status', status: SyncJobStatus.loggingIn, message: ... }
    });
});
```

**Cases to stub as `it.todo` for Phase 8:**

```
it.todo('dryRun: false — prisma.transaction.createMany is called with deduped rows');
it.todo('dryRun: true — prisma.transaction.createMany is NOT called; importedCount is 0');
it.todo('dryRun: true — skippedCount reflects dedup against existing fitids');
```

**Worker mock setup pattern** (reference from the existing `scraper.service.spec.ts` approach):

```typescript
const mockParentPort = {
    postMessage: vi.fn()
};

vi.mock('worker_threads', () => ({
    workerData: {
        bankId: 'cibc',
        credentials: { username: 'u', password: 'p' },
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-03-15T00:00:00.000Z',
        accountId: 'acct-1',
        jobId: 'job-1',
        userId: 'user-1',
        dryRun: false
    } satisfies ScraperWorkerInput,
    parentPort: mockParentPort
}));
```

Then re-import the worker module dynamically:

```typescript
beforeEach(async () => {
    vi.resetModules();
    mockParentPort.postMessage.mockReset();
    await import('#scraper/scraper.worker.js');
});
```

Note that `vi.resetModules()` is required because the worker module executes top-level code on import. Without it, the second `import()` is a no-op (cached module).

---

## Backend API Test Plan

These test cases are for the `backend-tester` agent to execute against the running server at `http://localhost:3001`.

Save the live test results to `test-plan/scraper-plugins/milestone-3-backend.md` (plan) and `test-plan/scraper-plugins/milestone-3-backend-report.md` (report).

### Endpoint under test

`POST /sync-schedules/:id/run-now`

### Preconditions

- Server running at `http://localhost:3001`.
- A valid JWT token for a regular USER exists (obtain via `POST /auth/login`).
- A `SyncSchedule` record exists for the test user. Note its UUID as `:scheduleId`.

### Test Cases

| TC | Method | Route | Body | Auth | Expected Status | Expected Response |
|----|--------|-------|------|------|----------------|-------------------|
| TC-01 | POST | `/sync-schedules/:scheduleId/run-now` | `{ "dryRun": true }` | USER JWT | 201 | `{ sessionId: "<uuid>" }` |
| TC-02 | POST | `/sync-schedules/:scheduleId/run-now` | `{}` (no dryRun) | USER JWT | 201 | `{ sessionId: "<uuid>" }` — behaviour unchanged |
| TC-03 | POST | `/sync-schedules/:scheduleId/run-now` | `{ "dryRun": false }` | USER JWT | 201 | `{ sessionId: "<uuid>" }` — explicit false accepted |
| TC-04 | POST | `/sync-schedules/:scheduleId/run-now` | `{ "dryRun": "yes" }` | USER JWT | 400 | Validation error: `dryRun must be a boolean value` |
| TC-05 | POST | `/sync-schedules/:scheduleId/run-now` | `{ "dryRun": 1 }` | USER JWT | 400 | Validation error: `dryRun must be a boolean value` |
| TC-06 | POST | `/sync-schedules/:scheduleId/run-now` | `{ "dryRun": true }` | No token | 401 | Unauthorized |
| TC-07 | POST | `/sync-schedules/00000000-0000-0000-0000-000000000000/run-now` | `{ "dryRun": true }` | USER JWT | 404 | `Sync schedule with ID ... not found` |

**TC-01 additional verification:** After receiving the `sessionId`, subscribe to `GET /sync-schedules/:sessionId/stream` and confirm:
- The stream emits at minimum a `pending` status event and a terminal `complete` event.
- The terminal `complete` event contains `"importedCount":0`.
- The stream closes after the `complete` event.

**TC-02 additional verification:** Same SSE subscription as TC-01. Confirm `complete` event is emitted. The Phase 7 stub also produces `importedCount: 0` for a real run — this is expected and acceptable.

---

## Migration Notes

None. This milestone has no Prisma schema changes, no database migrations, and no changes to existing API response shapes.

---

## Breaking Changes

None. `dryRun` is optional on the DTO with a default of `false`. All existing callers that omit the field receive the current behaviour unchanged.

---

## Verification Checklist

After implementation is complete, the implementing agent (`backend-dev`) should confirm all of the following before marking the milestone done:

- [ ] `npm run typecheck` in `packages/backend` — zero errors.
- [ ] `npm run lint` in `packages/backend` — zero errors and zero warnings.
- [ ] `npm test` in `packages/backend` — all existing tests pass; new dryRun tests pass.
- [ ] `POST /sync-schedules/:id/run-now` with `{ "dryRun": "yes" }` → `400`.
- [ ] `POST /sync-schedules/:id/run-now` with `{ "dryRun": true }` → `201` + SSE stream completes with `importedCount: 0`.
- [ ] `POST /sync-schedules/:id/run-now` with no `dryRun` field → `201` + SSE stream completes (behaviour unchanged).

---

## Recommended Agent Sequence

1. `backend-dev` — Implement Steps 1–4 (DTO, interface, service, worker). Run typecheck + lint before finishing.
2. `test-writer` — Extend `scraper.service.spec.ts` with the three new dryRun service cases; create `scraper.worker.spec.ts` with the live stub tests and `it.todo` stubs for Phase 8. Match existing mock setup and assertion style exactly.
3. `backend-tester` — Execute TC-01 through TC-07 against the running server. Save plan and report to `test-plan/scraper-plugins/milestone-3-backend.md` and `milestone-3-backend-report.md`.
4. `code-reviewer` — Review all changes. Focus areas listed in `docs/scraper-plugins/roadmap.md` Step 5.
5. `backend-dev` — Commit: `feat(scraper): add dryRun flag to run-now sync endpoint`.
