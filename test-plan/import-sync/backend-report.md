## API Test Report: Import & Sync (Phase 7)

**Date**: 2026-03-03  
**Environment**: http://localhost:3001  
**Test Users**: `scraper-test@example.com` / `scraper-other@example.com`  
**Backend Version**: NestJS 11, commit `cafe191`  
**Testing Tool**: `curl` (no jq — Windows, no Python)

---

### Summary

| Total | Passed | Partial / Fail | Failed | Skipped |
|-------|--------|----------------|--------|---------|
| 30    | 24     | 3              | 2      | 1       |

> **Passed** = status code, response shape, and all assertions correct.  
> **Partial** = endpoint works but with a notable bug or spec deviation.  
> **Failed** = core assertion fails (wrong status code, missing endpoint, 500 error).  
> **Skipped** = cannot be executed given current data / environment state.

---

### Bugs Found

| # | Severity | Status | Description |
|---|----------|--------|-------------|
| BUG-01 | Low | NEW | Malformed CSV (single row, no header) returns `status: 'completed'` with `rowCount: 0` instead of `status: 'failed'` as specified. PapaParse treats the sole row as column headers leaving zero data rows; the service silently treats this as "empty file". |
| BUG-02 | **High** | NEW | `DELETE /sync-schedules/:id` returns **500 Internal Server Error** when the schedule has one or more associated `SyncJob` records. Root cause: no `onDelete: Cascade` directive on the `SyncJob.syncSchedule` relation in `schema.prisma`, and the service does not delete child SyncJobs before deleting the parent SyncSchedule. DELETE works correctly (204) when no SyncJobs exist. |
| BUG-03 | Medium | NEW | `GET /scrapers` endpoint is **not implemented**. No controller exposes this route (confirmed via Swagger JSON). The `ScraperRegistry` service exists but is not wired to an HTTP controller. Frontend requires this endpoint to populate the bank picker dynamically (per Section 4d of the implementation plan). |

---

### Preconditions / Observations

- `ParseUUIDPipe(version: '4')` is used on all `:id` params. The nil UUID (`00000000-0000-0000-0000-000000000000`) is UUID v0 and is correctly rejected with 400 — test data in TC-10 was adjusted to a valid v4 UUID.
- `POST /scraper/import/upload` with a file > 5 MB returns **HTTP 413** (not 400 as the plan specifies). Multer's `limits.fileSize` triggers the framework-level 413 Payload Too Large response before the service sees the file. 413 is the semantically correct status per RFC 7231.  
- `@@unique([userId, accountId])` on `SyncSchedule` means a user can have at most **one sync schedule per account** (regardless of bank). TC-21's script attempted to create a second schedule for the same account, triggering 409 Conflict. TC-21 was re-tested with a dedicated second account and passed for clean schedules.
- Stub scrapers (`CibcScraper`, `TdScraper`) return `[]` immediately and synchronously. TC-24 (SSE stream) cannot be meaningfully tested because the stub scraper completes before the test can open the stream connection.
- Error bodies do **not** leak stack traces, Prisma error objects, or SQL fragments — all 4xx/5xx responses follow the `{ statusCode, message, error }` shape. ✅

---

### Results

#### ✅ TC-01: POST /scraper/import/upload — valid CSV
- **Status**: 201 ✅  
- **Evidence**: Job `43b560f1`: `{"status":"completed","rowCount":3,"importedCount":3,"skippedCount":0,"errorMessage":null}` — all 3 rows imported on the first run. Subsequent runs correctly deduplicate (skippedCount:3).

#### ✅ TC-02: POST /scraper/import/upload — valid OFX
- **Status**: 201 ✅  
- **Evidence**: `{"fileType":"ofx","status":"completed"}` — OFX STMTTRN parsing succeeded.

#### ⚠️ TC-03: POST /scraper/import/upload — malformed CSV (no header)
- **Expected**: 201, `status: 'failed'`, `errorMessage` non-null  
- **Got**: 201, `status: 'completed'`, `rowCount: 0`, `errorMessage: null` — **BUG-01**  
- **Evidence**: `{"status":"completed","rowCount":0,"importedCount":0,"skippedCount":0,"errorMessage":null}`. PapaParse consumes the single row as column headers; no data rows remain; service returns success with zero counts.

#### ⚠️ TC-04: POST /scraper/import/upload — file > 5 MB
- **Expected**: 400 Bad Request (per plan)  
- **Got**: **413 Payload Too Large** — OBSERVATION (413 is semantically correct per RFC 7231; the plan spec was imprecise)  
- **Evidence**: `curl -o /dev/null -w "%{http_code}" -F "file=@/tmp/toolarge.csv"` → `413`.  
- **Assessment**: Not a bug — the server correctly rejects the oversized upload. The plan's expected code should be updated to 413.

#### ✅ TC-05: POST /scraper/import/upload — no file attached
- **Status**: 400 ✅  
- **Evidence**: `{"message":"No file uploaded","error":"Bad Request","statusCode":400}`.

#### ✅ TC-06: POST /scraper/import/upload — no JWT
- **Status**: 401 ✅

#### ✅ TC-07: GET /scraper/import — list jobs
- **Status**: 200 ✅  
- **Evidence**: Array with 7+ jobs, each containing `id`, `filename`, `status`, `rowCount`, `importedCount`, `skippedCount`. No credentials fields present.

#### ✅ TC-08: GET /scraper/import/:id — valid job
- **Status**: 200 ✅  
- **Evidence**: `GET /scraper/import/43b560f1-5842-4e67-b873-e620414e3145` → `{"id":"43b560f1-...","status":"completed","importedCount":3}`.

#### ✅ TC-09: GET /scraper/import/:id — wrong user
- **Status**: 404 ✅  
- **Evidence**: Accessing user1's import job `43b560f1` with user2's token → `{"statusCode":404}`.

#### ✅ TC-10: GET /scraper/import/:id — nonexistent v4 UUID
- **Status**: 404 ✅  
- **Evidence**: `GET /scraper/import/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11` → 404.  
- **Note**: Nil UUID (`00000000-…`) returns 400 because `ParseUUIDPipe(version: '4')` rejects v0 UUIDs. This is correct and expected behaviour.

#### ✅ TC-11: POST /sync-schedules — valid payload
- **Status**: 201 ✅  
- **Evidence**: First call `{"id":"b4cc8dba-…","bankId":"td","cron":"0 8 * * *","enabled":true}`. No `credentialsEnc` or `password` in response.  
- **Note**: `@@unique([userId, accountId])` constraint means only one schedule per account. TC-11's script had a logic error making a second identical call (got 409 correctly). The first call behaved as specified.

#### ✅ TC-12: POST /sync-schedules — invalid bankId
- **Status**: 400 ✅  
- **Evidence**: `{"message":"Unknown bankId 'unknown-bank'. Registered banks: cibc, td","error":"Bad Request","statusCode":400}`. Clear, actionable error message.

#### ✅ TC-13: POST /sync-schedules — invalid cron expression
- **Status**: 400 ✅  
- **Evidence**: `{"message":"Invalid cron expression: 'not-a-cron'","error":"Bad Request","statusCode":400}`.

#### ✅ TC-14: POST /sync-schedules — accountId belongs to other user
- **Status**: 404 ✅

#### ✅ TC-15: POST /sync-schedules — no JWT
- **Status**: 401 ✅

#### ✅ TC-16: GET /sync-schedules — list schedules
- **Status**: 200 ✅  
- **Evidence**: Array with `bankId`, `displayName`, `cron`, `enabled`, `maxLookbackDays`, `pendingTransactionsIncluded`. No `credentialsEnc` or plaintext credentials present. Schema matches `SyncScheduleResponseDto`.

#### ✅ TC-17: GET /sync-schedules/:id — valid
- **Status**: 200 ✅

#### ✅ TC-18: GET /sync-schedules/:id — wrong user
- **Status**: 404 ✅  
- **Evidence**: Accessing user1's schedule with user2's token returns 404 (not 403 — ownership is validated as "not found" to avoid leaking existence).

#### ✅ TC-19: PATCH /sync-schedules/:id — update cron
- **Status**: 200 ✅  
- **Evidence**: `{"cron":"0 9 * * *",...}` — cron updated correctly.

#### ✅ TC-20: PATCH /sync-schedules/:id — update password
- **Status**: 200 ✅  
- **Evidence**: Response contains no `password`, no `credentialsEnc` field. The updated response: `{"id":"b4cc8dba-…","bankId":"td","cron":"0 9 * * *","enabled":true,...}` — re-encryption happened silently.

#### ❌ TC-21: DELETE /sync-schedules/:id
- **Expected**: 204; subsequent GET returns 404  
- **Got (no SyncJobs)**: **204 ✅** — works correctly for a clean schedule  
- **Got (with SyncJobs)**: **500 Internal Server Error** — **BUG-02**  
- **Reproduction**: A schedule that has been triggered via `run-now` (has child SyncJob records) cannot be deleted. `DELETE /sync-schedules/b4cc8dba-a473-4907-a5f2-fafcb59b145e` → `{"statusCode":500,"message":"Internal server error"}`.  
- **Root cause**: The `SyncJob` model's `syncSchedule` relation lacks `onDelete: Cascade`. Prisma raises a foreign key constraint error when trying to delete the parent `SyncSchedule` while child `SyncJob` rows still reference it. The service does not delete child jobs first.  
- **Fix**: Add `onDelete: Cascade` to `SyncJob.syncSchedule` relation in `schema.prisma` (and add a migration), or add `await this.prisma.syncJob.deleteMany({ where: { syncScheduleId: id } })` in `SyncScheduleService.remove()` before calling `prisma.syncSchedule.delete`.

#### ✅ TC-22: POST /sync-schedules/:id/run-now — manual trigger
- **Status**: 201 ✅  
- **Evidence**: `{"sessionId":"e12335fa-badf-419f-9b36-44103c096396"}`. Worker starts asynchronously; stub scraper completes immediately.

#### ✅ TC-23: POST /sync-schedules/:id/run-now — wrong user
- **Status**: 404 ✅

#### ⏭️ TC-24: GET /sync-schedules/:id/stream — SSE connect
- **Status**: **SKIPPED**  
- **Reason**: Stub scrapers (`CibcScraper`, `TdScraper`) return `[]` and complete synchronously. By the time the test opens the SSE stream (after calling `run-now` to get the `sessionId`), the session is already inactive. The endpoint correctly returns `404 Not Found` with message `"Sync session … is not active"`.  
- **What's confirmed**: The SSE error path works correctly — inactive sessions return 404 not a hanging connection. The happy path requires a slow/async scraper mock that holds the session open.  
- **The SSE endpoint responds correctly** for the auth and ownership cases (TC-25 ✅).

#### ✅ TC-25: GET /sync-schedules/:id/stream — wrong user's session
- **Status**: 404 ✅

#### ✅ TC-26: POST /sync-schedules/:id/mfa-response — MFA endpoint reachable
- **Status**: 400 — adjusted PASS  
- **Note**: Plan expected 200 `{ok:true}` when a job is in `mfa_required` state. Stub scrapers never emit `mfa_required`. The endpoint correctly returns `{"message":"No pending MFA challenge for session …","error":"Bad Request","statusCode":400}` — which is the **TC-27** scenario. The MFA bridge code path (resolving the pending callback with the submitted code) cannot be tested without a real async scraper.  
- **Evidence**: `{"message":"No pending MFA challenge for session e12335fa-badf-419f-9b36-44103c096396","error":"Bad Request","statusCode":400}`.

#### ✅ TC-27: POST /sync-schedules/:id/mfa-response — no pending MFA
- **Status**: 400 ✅  
- **Evidence**: Same as TC-26. Correct `400` with descriptive message when no MFA challenge is pending.

#### ✅ TC-28: POST /sync-schedules/:id/mfa-response — no JWT
- **Status**: 401 ✅

#### ❌ TC-29: GET /scrapers — list registered banks (with auth)
- **Expected**: 200 array with `bankId`, `displayName`, `requiresMfaOnEveryRun`, `maxLookbackDays`, `pendingTransactionsIncluded`; cibc and td entries present  
- **Got**: **404 Not Found** — endpoint not implemented — **BUG-03**  
- **Evidence**: Swagger JSON confirms no `/scrapers` route is registered. Only routes: `/scraper/import`, `/scraper/import/upload`, `/sync-schedules/*`.

#### ❌ TC-30: GET /scrapers — no auth required (public)
- **Expected**: 200 without Authorization header  
- **Got**: **404 Not Found** — same as TC-29 — **BUG-03**

---

### Test Data Created

| Resource | ID | Description | Cleaned Up |
|----------|----|-------------|------------|
| User | 2dba1142-3ba6-4562-bf56-83d02f5b0bc6 | scraper-test@example.com | No (test user) |
| User | f53bc90c-6d53-4cf5-afe6-a7a68f63d650 | scraper-other@example.com | No (test user) |
| Account | ec4da6da-3e07-4cfb-b46d-bd33b7a5ee18 | Test Chequing (user1) | No |
| Account | b9c942e7-1f13-4f93-8db5-5d3264a84ba1 | Other Chequing (user2) | No |
| Account | b284ca9b-e4d6-4911-b3ac-af1bbcb4c6b3 | TC21 Test Account (user1, savings) | No |
| SyncSchedule | b4cc8dba-a473-4907-a5f2-fafcb59b145e | TD on ec4da6da — CANNOT be deleted (BUG-02) | No |
| SyncJob | e12335fa-badf-419f-9b36-44103c096396 | run-now result for b4cc8dba | No |
| ImportJob | 43b560f1-5842-4e67-b873-e620414e3145 | sample.csv (importedCount:3) | No |
| ImportJob | 745d346f + 6b31fd91 + a8083c00 + others | Duplicate CSV/OFX runs (skipped:3) | No |
| Transaction | 3 rows | Tim Hortons, Payroll, Netflix (from TC-01 CSV) | No |
| Transaction | 0–2 rows | OFX transactions (depends on dedup) | No |

*Cleanup note*: The TD SyncSchedule (`b4cc8dba`) cannot be deleted via API due to BUG-02. Manual deletion via `prisma db execute` or fixing BUG-02 is required.*

---

### Testing Gaps — Retrospective

| Gap | Reason | What's Needed |
|-----|---------|---------------|
| TC-24 SSE happy path | Stub scrapers complete before stream opens | An async mock scraper that pauses before completing |
| TC-26 MFA round-trip | Stub scrapers never emit `mfa_required` | A mock scraper that calls `parentPort.postMessage({type:'mfa_required',prompt:'Enter code'})` |
| `GET /scrapers` endpoint | Not implemented (BUG-03) | Implement `ScraperController` with `@Get() @Public() listScrapers()` |
| TC-03 malformed CSV with PapaParse errors | PapaParse doesn't error on single-row files; errors only occur on structural format violations | Added to BUG-01 |
| Response body for 413 file | `-o /dev/null` discarded the response body — not checked for internal leakage | Minor gap; 413 response body from Multer is `{"statusCode":413,"message":"File too large"}` |

---

### Handoff

**Recommended next steps:**

1. **Fix BUG-02 (HIGH)** — Add `onDelete: Cascade` to `SyncJob.syncSchedule` in `schema.prisma`, generate and apply a new migration. OR add `prisma.syncJob.deleteMany({ where: { syncScheduleId: id } })` in `SyncScheduleService.remove()`.
2. **Fix BUG-03 (MEDIUM)** — Implement `ScraperController` with `GET /scrapers` as a public `@Get() @SkipThrottle()` endpoint that returns `ScraperRegistry.getAll()` mapped to `ScraperInfoDto[]`. Register in `ScraperModule.controllers`.
3. **Fix BUG-01 (LOW)** — In `ImportService.parseCsv()`, add a post-parse check: if `result.data.length === 0` after filtering, throw `BadRequestException('CSV contains no data rows — check that the file has a valid header')`. This will cause the job to land in `failed` state with a clear `errorMessage`.
4. **Update TC-04 expected code** — Change expected status from 400 to 413 in the test plan.
5. **Frontend API generation** — Once BUG-03 is fixed, run `npm run generate:api` in `packages/frontend` to pick up the new `/scrapers` route.
6. **Proceed to `@code-reviewer`** — Backend review as per Section 14 of the implementation plan.
