## API Test Report: Milestone 3 — dryRun Flag on Run-Now

**Date:** 2026-03-15
**Environment:** http://localhost:3001
**Test User:** test@example.com (role: USER)
**Schedule used:** `a62d4aab-1989-4c00-b935-11769c236337` (bankId=test-bank, created during this run)

---

### Summary

| Total | Passed | Partial / Note | Failed | Skipped |
|-------|--------|----------------|--------|---------|
| 7     | 6      | 1              | 0      | 0       |

> **Passed** = status code, response shape, and all assertions correct.
> **Partial** = endpoint works but with a notable behaviour difference from the implementation plan spec (see TC-07).
> **Failed** = core assertion fails.
> **Skipped** = cannot be executed.

---

### Bugs Found

| # | Severity | Status | Description |
|---|----------|--------|-------------|
| BUG-01 | Low | NEW | TC-07: The nil UUID `00000000-0000-0000-0000-000000000000` (specified in the implementation plan as the test ID for the 404 path) returns **400** instead of **404**. The route uses `ParseUUIDPipe({version: '4'})` which rejects the nil UUID because its version nibble is `0`, not `4`. A proper v4 UUID with no matching row correctly returns 404. The implementation plan test vector is incompatible with the pipe configuration. The 404 path itself works correctly; only the documented example UUID is wrong. |

---

### Results

#### TC-01: dryRun: true — 201 and SSE complete with importedCount: 0

**Status: PASS**

**curl — trigger run:**
```bash
curl -s -w "\n--- HTTP %{http_code} ---\n" \
  -X POST "http://localhost:3001/sync-schedules/a62d4aab-1989-4c00-b935-11769c236337/run-now" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

**Response:**
```
{"sessionId":"749c9f07-4594-412e-b27c-15d3af9ca679"}
--- HTTP 201 ---
```

- HTTP status: **201** (expected 201) ✅
- Response shape: `{ sessionId: string }` ✅

**curl — SSE stream:**
```bash
curl -s -N --max-time 15 \
  "http://localhost:3001/sync-schedules/749c9f07-4594-412e-b27c-15d3af9ca679/stream" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: text/event-stream"
```

**SSE response:**
```
id: 1
data: {"status":"complete","importedCount":0,"skippedCount":0}
```

- Terminal event emitted: ✅
- `status: "complete"`: ✅
- `importedCount: 0`: ✅ (expected 0 for dryRun=true)
- `skippedCount: 0`: ✅
- Stream closed after complete event: ✅

---

#### TC-02: dryRun omitted — default behaviour unchanged

**Status: PASS**

**curl:**
```bash
curl -s -w "\n--- HTTP %{http_code} ---\n" \
  -X POST "http://localhost:3001/sync-schedules/a62d4aab-1989-4c00-b935-11769c236337/run-now" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Response:**
```
{"sessionId":"c521096a-25d6-4e7c-a663-1311334c88d7"}
--- HTTP 201 ---
```

- HTTP status: **201** (expected 201) ✅
- Response shape: `{ sessionId: string }` ✅

**curl — SSE stream:**
```bash
curl -s -N --max-time 15 \
  "http://localhost:3001/sync-schedules/c521096a-25d6-4e7c-a663-1311334c88d7/stream" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: text/event-stream"
```

**SSE response:**
```
id: 1
data: {"status":"complete","importedCount":0,"skippedCount":0}
```

- Terminal `complete` event emitted: ✅
- `importedCount: 0`: ✅ (Phase 7 stub; expected and acceptable per implementation plan)
- Stream closed after complete event: ✅

---

#### TC-03: dryRun: false — explicit false accepted

**Status: PASS**

**curl:**
```bash
curl -s -w "\n--- HTTP %{http_code} ---\n" \
  -X POST "http://localhost:3001/sync-schedules/a62d4aab-1989-4c00-b935-11769c236337/run-now" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": false}'
```

**Response:**
```
{"sessionId":"eee0e61a-59cd-49e7-91cc-54800f861c62"}
--- HTTP 201 ---
```

- HTTP status: **201** (expected 201) ✅
- Response shape: `{ sessionId: string }` ✅

---

#### TC-04: dryRun: "yes" — 400 validation error

**Status: PASS**

**curl:**
```bash
curl -s -w "\n--- HTTP %{http_code} ---\n" \
  -X POST "http://localhost:3001/sync-schedules/a62d4aab-1989-4c00-b935-11769c236337/run-now" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": "yes"}'
```

**Response:**
```json
{"message":["dryRun must be a boolean value"],"error":"Bad Request","statusCode":400}
--- HTTP 400 ---
```

- HTTP status: **400** (expected 400) ✅
- Validation message: `"dryRun must be a boolean value"` ✅
- No stack trace or internal error details leaked ✅

---

#### TC-05: dryRun: 1 — 400 validation error

**Status: PASS**

**curl:**
```bash
curl -s -w "\n--- HTTP %{http_code} ---\n" \
  -X POST "http://localhost:3001/sync-schedules/a62d4aab-1989-4c00-b935-11769c236337/run-now" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": 1}'
```

**Response:**
```json
{"message":["dryRun must be a boolean value"],"error":"Bad Request","statusCode":400}
--- HTTP 400 ---
```

- HTTP status: **400** (expected 400) ✅
- Validation message: `"dryRun must be a boolean value"` ✅
- No stack trace or internal error details leaked ✅

---

#### TC-06: No auth token — 401

**Status: PASS**

**curl:**
```bash
curl -s -w "\n--- HTTP %{http_code} ---\n" \
  -X POST "http://localhost:3001/sync-schedules/a62d4aab-1989-4c00-b935-11769c236337/run-now" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

**Response:**
```json
{"message":"Unauthorized","statusCode":401}
--- HTTP 401 ---
```

- HTTP status: **401** (expected 401) ✅
- No resource data leaked ✅

---

#### TC-07: Non-existent schedule — 404 (partial: implementation plan UUID incompatible with pipe)

**Status: PARTIAL** (see BUG-01)

The implementation plan specifies `00000000-0000-0000-0000-000000000000` as the test UUID. This ID is the nil UUID, which has version nibble `0`. The route declares `@Param('id', new ParseUUIDPipe({version: '4'}))` — the pipe rejects the nil UUID before the handler executes.

**Attempt 1 — nil UUID (implementation plan vector):**

```bash
curl -s -w "\n--- HTTP %{http_code} ---\n" \
  -X POST "http://localhost:3001/sync-schedules/00000000-0000-0000-0000-000000000000/run-now" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

**Response:**
```json
{"message":"Validation failed (uuid v 4 is expected)","error":"Bad Request","statusCode":400}
--- HTTP 400 ---
```

- HTTP status: **400** (expected 404 per plan) — pipe rejects before the handler

**Attempt 2 — valid v4 UUID not in database:**

```bash
curl -s -w "\n--- HTTP %{http_code} ---\n" \
  -X POST "http://localhost:3001/sync-schedules/f47ac10b-58cc-4372-a567-0e02b2c3d479/run-now" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

**Response:**
```json
{"message":"Sync schedule with ID f47ac10b-58cc-4372-a567-0e02b2c3d479 not found","error":"Not Found","statusCode":404}
--- HTTP 404 ---
```

- HTTP status: **404** (expected 404) ✅
- Error message format: correct, no internal details leaked ✅
- 404 path is working correctly with a valid v4 UUID

**Assessment:** The 404 handler works correctly. The implementation plan's example test UUID is incompatible with the `ParseUUIDPipe({version: '4'})` guard. This is a documentation issue in the plan, not a bug in the implementation. Classified as BUG-01 (Low severity).

---

### Implementation Verification

The following source locations confirm `dryRun` is fully implemented as per the plan:

| File | Evidence |
|------|---------|
| `run-sync-now.dto.ts` | `@IsOptional() @IsBoolean() public dryRun?: boolean` — field present with correct decorators |
| `sync-job.controller.ts` line 78 | `dto.dryRun ?? false` passed as 5th argument to `scraperService.sync()` |
| `scraper.service.ts` | `dryRun = false` param on both `sync()` and `runWorker()`; threaded into `workerInput` |
| `scraper.worker.ts` line 92 | `if (!input.dryRun)` gate present around the Phase 8 write block |

---

### Test Data Created

| Resource | ID | Description | Cleaned Up |
|----------|----|-------------|------------|
| SyncSchedule | `a62d4aab-1989-4c00-b935-11769c236337` | test-bank schedule, accountId=`02812bf5-1c75-4905-861d-c1365a982d4d` | Yes (DELETE 204) |
| SyncJob | `749c9f07-4594-412e-b27c-15d3af9ca679` | TC-01 dry run job | No (no delete endpoint for jobs) |
| SyncJob | `c521096a-25d6-4e7c-a663-1311334c88d7` | TC-02 real run job | No (no delete endpoint for jobs) |
| SyncJob | `eee0e61a-59cd-49e7-91cc-54800f861c62` | TC-03 dry run (false) job | No (no delete endpoint for jobs) |

The three `SyncJob` records remain in the database. They have `status=complete`, `importedCount=0`, and are owned by `test@example.com`. They do not affect any financial data and will not interfere with future test runs since sync job IDs are unique UUIDs generated per run.

---

### Testing Gaps — Retrospective

1. **Phase 7 stub limits dry-run differentiation at SSE level.** Both `dryRun: true` and `dryRun: false` produce `importedCount: 0` in the current Phase 7 stub (no real scrape occurs). The only way to confirm the dry-run gate actually suppresses a write is through unit tests (`scraper.worker.spec.ts`), not via live API testing. When Phase 8 real scraping lands, TC-01 should be re-run against a live bank with known transactions to confirm `importedCount: 0` while TC-02 produces `importedCount > 0`.

2. **TC-07 nil UUID discrepancy.** The implementation plan example UUID `00000000-0000-0000-0000-000000000000` should be updated to a proper v4 UUID for the 404 test case. Any UUID with version nibble `4` and no matching database row achieves the documented intent. Recommend the plan be updated to use `f47ac10b-58cc-4372-a567-0e02b2c3d479` or note that a nil UUID tests the pipe guard (400), not the not-found handler (404).

3. **No cross-user ownership test.** The `assertJobOwner` method in `sync-job.controller.ts` throws 404 if the session belongs to a different user. This ownership guard on the `run-now` endpoint (which looks up the schedule, not a job) should be confirmed with a second user account. Not tested in this run — would require registering a second user.
