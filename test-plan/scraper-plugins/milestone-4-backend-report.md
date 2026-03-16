## API Test Report: Milestone 4 — Plugin Input Schema

**Date:** 2026-03-16
**Environment:** http://localhost:3001
**Test User:** test@example.com (role: USER)
**Account ID used:** `02812bf5-1c75-4905-861d-c1365a982d4d`
**Schedule created:** `53aa8808-6993-4325-b0a2-55417ee5c50c` (deleted after run)

---

### Summary

| Total | Passed | Partial / Note | Failed | Skipped |
|-------|--------|----------------|--------|---------|
| 11    | 11     | 0              | 0      | 0       |

> **Passed** = status code, response shape, and all assertions correct.
> **Partial** = endpoint works but with a notable behaviour difference.
> **Failed** = core assertion fails (wrong status code, missing resource, 500 error).
> **Skipped** = cannot be executed given current data / environment state.

---

### Pre-Run Setup Note — Stale Plugin Files (BUG-ENV-01)

Before tests could be executed, a setup issue was encountered and worked around:

`GET /scrapers` returned `[]` even though `SCRAPER_PLUGIN_DIR` was set and contained `cibc.scraper.js` and `td.scraper.js`. Root cause: the files in the plugin directory were compiled from the pre-Milestone-4 source — they lacked the `inputSchema` property. The `isBankScraper()` type guard (in `scraper.plugin-loader.ts`) now requires `Array.isArray(v.inputSchema)`, so the old plugins were silently skipped on load.

The `seedBuiltins()` method is intentionally copy-on-missing (it never overwrites an existing file), so the new compiled files from `dist/scraper/banks/` were not automatically seeded on the next server startup. Additionally, Node's ESM module cache means that after manually replacing the files in the plugin dir, calling `POST /admin/scrapers/reload` still loaded the cached (old) module — because the file URL had not changed.

**Workaround applied:** The updated compiled files were installed under new filenames (`cibc2.js`, `td2.js`) via `POST /admin/scrapers/install`. Since these were previously-unseen URLs, Node loaded them fresh, `isBankScraper` passed, and both scrapers were registered. Tests could then proceed.

**Recommendation:** In CI/CD and after any deploy that touches `dist/scraper/banks/`, the `SCRAPER_PLUGIN_DIR` should be cleared of the old built-in files so `seedBuiltins()` re-copies the updated versions on next startup. The operator runbook should document this as a deployment step.

---

### Bugs Found

| # | Severity | Status | Description |
|---|----------|--------|-------------|
| BUG-ENV-01 | Medium | NEW | Stale pre-Milestone-4 plugin files in `SCRAPER_PLUGIN_DIR` prevent scrapers from loading after upgrade. `isBankScraper` guard now requires `inputSchema`; old files lack it. `seedBuiltins()` never overwrites; ESM cache prevents reload from picking up file replacements. Server restart alone is insufficient if old files are already present in the plugin dir. |

---

### Results

#### TC-M4-01: GET /scrapers — no auth token → 200

**Status: PASS**

- **Method + Route:** `GET /scrapers` (no Authorization header)
- **Expected status:** 200
- **Actual status:** 200
- **Evidence:**
  ```
  [{"bankId":"cibc",...,"inputSchema":[...]},{"bankId":"td",...,"inputSchema":[...]}]
  --- HTTP 200 ---
  ```
- Route is public — no auth required. Returns array with scraper metadata. ✅

---

#### TC-M4-02: GET /scrapers — valid USER token → 200; `inputSchema` present on all entries; CIBC has `username` and `password` descriptors

**Status: PASS**

- **Method + Route:** `GET /scrapers` with `Authorization: Bearer $TOKEN`
- **Expected status:** 200
- **Actual status:** 200
- **Full response:**
  ```json
  [
    {
      "bankId": "cibc",
      "displayName": "CIBC",
      "requiresMfaOnEveryRun": true,
      "maxLookbackDays": 90,
      "pendingTransactionsIncluded": true,
      "inputSchema": [
        {
          "key": "username",
          "label": "Card / Username",
          "type": "text",
          "required": true,
          "hint": "Your CIBC online banking card number or username"
        },
        {
          "key": "password",
          "label": "Password",
          "type": "password",
          "required": true
        }
      ]
    },
    {
      "bankId": "td",
      "displayName": "TD Canada Trust",
      "requiresMfaOnEveryRun": false,
      "maxLookbackDays": 365,
      "pendingTransactionsIncluded": false,
      "inputSchema": [
        {
          "key": "username",
          "label": "Username",
          "type": "text",
          "required": true,
          "hint": "Your TD EasyWeb username"
        },
        {
          "key": "password",
          "label": "Password",
          "type": "password",
          "required": true
        }
      ]
    }
  ]
  ```
- Assertion checks:
  1. Every entry has `inputSchema` array ✅
  2. CIBC `inputSchema` has 2 descriptors ✅
  3. CIBC `inputSchema` has entry with `key === "username"` ✅
  4. CIBC `inputSchema` has entry with `key === "password"` ✅
  5. Each descriptor has `key`, `label`, `type`, `required` ✅
  6. No top-level `username` or `password` field on scraper entry ✅

---

#### TC-M4-03: POST /sync-schedules — no auth token → 401

**Status: PASS**

- **Method + Route:** `POST /sync-schedules` (no Authorization header)
- **Expected status:** 401
- **Actual status:** 401
- **Evidence:**
  ```json
  {"message":"Unauthorized","statusCode":401}
  --- HTTP 401 ---
  ```
- Auth guard fires before any processing. No resource data leaked. ✅

---

#### TC-M4-04: POST /sync-schedules — valid token, complete `inputs` → 201; no credential leakage

**Status: PASS**

- **Method + Route:** `POST /sync-schedules`
- **Body:** `{"bankId":"cibc","accountId":"02812bf5-...","cron":"0 8 * * *","inputs":{"username":"testuser","password":"testpass"}}`
- **Expected status:** 201
- **Actual status:** 201
- **Full response:**
  ```json
  {
    "id": "53aa8808-6993-4325-b0a2-55417ee5c50c",
    "accountId": "02812bf5-1c75-4905-861d-c1365a982d4d",
    "bankId": "cibc",
    "displayName": "CIBC",
    "cron": "0 8 * * *",
    "enabled": true,
    "requiresMfaOnEveryRun": true,
    "maxLookbackDays": 90,
    "pendingTransactionsIncluded": true,
    "lookbackDays": 3,
    "lastRunAt": null,
    "lastRunStatus": null,
    "lastSuccessfulSyncAt": null,
    "createdAt": "2026-03-16T15:40:37.279Z",
    "updatedAt": "2026-03-16T15:40:37.279Z"
  }
  ```
- Assertion checks:
  1. Status 201 ✅
  2. `id` present (UUID) ✅
  3. `bankId: "cibc"` ✅
  4. No top-level `username` field ✅
  5. No top-level `password` field ✅
  6. No top-level `inputs` field ✅
  7. No top-level `pluginConfigEnc` field ✅
  8. `accountId`, `cron`, `enabled`, `lookbackDays` present ✅

---

#### TC-M4-05: POST /sync-schedules — `inputs` missing required key `password` → 400

**Status: PASS**

- **Method + Route:** `POST /sync-schedules`
- **Body:** `{"bankId":"cibc","accountId":"...","cron":"0 8 * * *","inputs":{"username":"testuser"}}`
- **Expected status:** 400
- **Actual status:** 400
- **Evidence:**
  ```json
  {"message":["inputs.password is required for this bank"],"error":"Bad Request","statusCode":400}
  --- HTTP 400 ---
  ```
- `RequiredInputsConstraint` correctly fires and names the missing key. ✅

---

#### TC-M4-06: POST /sync-schedules — `inputs` value is non-string (`username: 123`) → 400

**Status: PASS**

- **Method + Route:** `POST /sync-schedules`
- **Body:** `{"bankId":"cibc","accountId":"...","cron":"0 8 * * *","inputs":{"username":123,"password":"secret"}}`
- **Expected status:** 400
- **Actual status:** 400
- **Evidence:**
  ```json
  {"message":["inputs.username is required for this bank","Each value in the object must be a string"],"error":"Bad Request","statusCode":400}
  --- HTTP 400 ---
  ```
- `@IsStringRecord()` fires with "Each value in the object must be a string" ✅
- Note: The response also includes `"inputs.username is required for this bank"` from `RequiredInputsConstraint`. This is because `username: 123` (a number) does not satisfy the string-key lookup, so the required-inputs validator also flags it as missing. Both messages are accurate and non-leaking. ✅

---

#### TC-M4-07: POST /sync-schedules — `inputs` field absent → 400

**Status: PASS**

- **Method + Route:** `POST /sync-schedules`
- **Body:** `{"bankId":"cibc","accountId":"...","cron":"0 8 * * *"}` (no `inputs` key)
- **Expected status:** 400
- **Actual status:** 400
- **Evidence:**
  ```json
  {"message":["Each value in the object must be a string","inputs must be an object"],"error":"Bad Request","statusCode":400}
  --- HTTP 400 ---
  ```
- `"inputs must be an object"` references the missing field. ✅

---

#### TC-M4-08: POST /sync-schedules — `bankId: "unknown-bank"` → 400 with descriptive error

**Status: PASS**

- **Method + Route:** `POST /sync-schedules`
- **Body:** `{"bankId":"unknown-bank","accountId":"...","cron":"0 8 * * *","inputs":{"username":"u","password":"p"}}`
- **Expected status:** 400 (documented as `BadRequestException` in service code)
- **Actual status:** 400
- **Evidence:**
  ```json
  {"message":"Unknown bankId 'unknown-bank'. Registered banks: cibc, td","error":"Bad Request","statusCode":400}
  --- HTTP 400 ---
  ```
- Error message names the unknown bankId and lists registered banks ✅
- No stack trace or Prisma internals leaked ✅
- **Observation:** The error enumerates all registered bankIds (`"Registered banks: cibc, td"`). This is actionable developer information. It is not a security concern since scraper bankIds are public (they also appear in `GET /scrapers`).

---

#### TC-M4-09: PATCH /sync-schedules/:id — `inputs: {}`, `cron` changed → 200

**Status: PASS**

- **Method + Route:** `PATCH /sync-schedules/53aa8808-6993-4325-b0a2-55417ee5c50c`
- **Body:** `{"cron":"0 9 * * *","inputs":{}}`
- **Expected status:** 200
- **Actual status:** 200
- **Evidence:**
  ```json
  {
    "id": "53aa8808-6993-4325-b0a2-55417ee5c50c",
    "bankId": "cibc",
    "cron": "0 9 * * *",
    "enabled": true,
    ...
  }
  --- HTTP 200 ---
  ```
- `cron` updated to `"0 9 * * *"` ✅
- No credential fields in response ✅

---

#### TC-M4-10: PATCH /sync-schedules/:id — `inputs: {"password": "new-secret"}` → 200

**Status: PASS**

- **Method + Route:** `PATCH /sync-schedules/53aa8808-6993-4325-b0a2-55417ee5c50c`
- **Body:** `{"inputs":{"password":"new-secret"}}`
- **Expected status:** 200
- **Actual status:** 200
- **Evidence:**
  ```json
  {
    "id": "53aa8808-6993-4325-b0a2-55417ee5c50c",
    "bankId": "cibc",
    "cron": "0 9 * * *",
    "updatedAt": "2026-03-16T15:41:54.674Z",
    ...
  }
  --- HTTP 200 ---
  ```
- `id` matches `SCHEDULE_ID` ✅
- No `password`, `inputs`, or `pluginConfigEnc` in response ✅
- `updatedAt` changed from TC-M4-09 value, confirming a write occurred ✅

---

#### TC-M4-11: PATCH /sync-schedules/:id — `inputs: {"password": 999}` → 400

**Status: PASS**

- **Method + Route:** `PATCH /sync-schedules/53aa8808-6993-4325-b0a2-55417ee5c50c`
- **Body:** `{"inputs":{"password":999}}`
- **Expected status:** 400
- **Actual status:** 400
- **Evidence:**
  ```json
  {"message":["Each value in the object must be a string"],"error":"Bad Request","statusCode":400}
  --- HTTP 400 ---
  ```
- `@IsStringRecord()` fires on the `UpdateSyncScheduleDto` ✅

---

### Route Inventory Clarification

The task prompt asked to confirm whether the correct route is `GET /scrapers` or `GET /admin/scrapers`. The answer:

- `GET /scrapers` — exists and is public (200 with no auth)
- `GET /admin/scrapers` — returns 404 regardless of auth. The `ScraperAdminController` is mounted at `/admin/scrapers` but only defines POST routes (`/reload`, `/install`, `/:bankId/test`). There is no GET handler on that controller.

---

### Cleanup

The schedule created in TC-M4-04 (`53aa8808-6993-4325-b0a2-55417ee5c50c`) was deleted after TC-M4-11:

```bash
curl -s -w "\n--- HTTP %{http_code} ---\n" \
  -X DELETE "http://localhost:3001/sync-schedules/53aa8808-6993-4325-b0a2-55417ee5c50c" \
  -H "Authorization: Bearer $TOKEN"
# Response: --- HTTP 204 ---
```

---

### Test Data Created

| Resource | ID | Description | Cleaned Up |
|----------|----|-------------|------------|
| SyncSchedule | `53aa8808-6993-4325-b0a2-55417ee5c50c` | CIBC M4 test schedule, accountId=`02812bf5-1c75-4905-861d-c1365a982d4d` | Yes (DELETE 204) |
| Plugin file | `cibc2.js` in `SCRAPER_PLUGIN_DIR` | Cache-busting copy of updated cibc scraper | No (no delete endpoint; harmless duplicate of `cibc.scraper.js`; overwrites same `bankId` in registry) |
| Plugin file | `td2.js` in `SCRAPER_PLUGIN_DIR` | Cache-busting copy of updated td scraper | No (same as above) |

The `cibc2.js` and `td2.js` files remain in `SCRAPER_PLUGIN_DIR`. They register the same `bankId` values (`cibc`, `td`) as the built-in files, so the last-loaded version wins in the registry map. They do not create duplicate entries. On the next server restart, `seedBuiltins()` will detect `cibc.scraper.js` and `td.scraper.js` already present (still the old versions) and skip seeding — so `cibc2.js`/`td2.js` will be loaded and will correctly register the Milestone-4 versions until BUG-ENV-01 is resolved.

---

### Testing Gaps — Retrospective

1. **`GET /admin/scrapers` (no handler):** The admin controller has no GET route at its root path. If a future milestone adds a `GET /admin/scrapers` admin-only list (with more detail than the public route), that would need its own test plan. Currently returns 404.

2. **Cross-user PATCH guard:** The `PATCH /sync-schedules/:id` endpoint restricts updates to the schedule owner. This was not tested with a second user account. A second user attempting to PATCH another user's schedule should receive 404 (not 403, to avoid leaking existence). This gap existed in prior milestones.

3. **`inputs` merge semantics on PATCH:** TC-M4-10 sends `{"inputs":{"password":"new-secret"}}` and the server accepts it. The implementation plan states `inputs` is a partial patch (merge). It was not verified whether the stored config retains the original `username` alongside the new `password`, or replaces the entire `inputs` object with just `{"password":"new-secret"}`. This would require running a subsequent sync to confirm which credentials are actually used — not testable via the REST API alone.

4. **`test-bank.js` in plugin dir lacks `inputSchema`:** The `test-bank.js` installed during Milestone 1 testing also lacks `inputSchema` and will be silently skipped by `isBankScraper`. It is not loaded in the current server state. This is consistent with the Milestone 4 upgrade: all external plugins must now declare `inputSchema` to pass the guard.
