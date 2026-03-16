## API Test Plan: Milestone 4 — Plugin Input Schema

**Date:** 2026-03-16
**Feature:** Replace hardcoded `{username, password}` credentials with generic `inputs: Record<string, string>` field driven by `inputSchema: PluginFieldDescriptor[]` on each plugin.
**Coverage level:** Regression (all new behaviour) + Security (auth guards, no credential leakage)

---

### Endpoint Inventory

| Method | Route | Auth Required | Description |
|--------|-------|---------------|-------------|
| GET | `/scrapers` | No | List registered scrapers; each entry must now include `inputSchema` |
| POST | `/sync-schedules` | Yes | Create schedule; `inputs` replaces `credentials`; validated by `@IsStringRecord` and `@Validate(RequiredInputsConstraint)` |
| PATCH | `/sync-schedules/:id` | Yes | Update schedule; `inputs` is optional partial patch |

**Note on `/admin/scrapers` (GET):** The task prompt mentions confirming which route is correct — `GET /scrapers` vs `GET /admin/scrapers`. Only `GET /scrapers` exists; `GET /admin/scrapers` returns 404 because the admin controller only defines POST endpoints (`/admin/scrapers/reload`, `/admin/scrapers/install`, `/admin/scrapers/:bankId/test`).

---

### Preconditions

- [ ] Backend running at `http://localhost:3001`
- [ ] Test user: `email=test@example.com`, `password=password123`
  - Register via `POST /auth/register` if account does not exist
- [ ] A valid account UUID belonging to the test user (obtain via `GET /accounts` after auth)
- [ ] Registered scrapers include at least `cibc` and `td` with `inputSchema` on each
- [ ] **Important:** Built-in scrapers are loaded from `SCRAPER_PLUGIN_DIR` via dynamic `import()`. If the plugin dir contains pre-Milestone-4 compiled files (without `inputSchema`), `GET /scrapers` will return `[]` because the `isBankScraper` type guard rejects plugins missing `inputSchema`. In that case the updated compiled files from `dist/scraper/banks/` must be placed in `SCRAPER_PLUGIN_DIR` and the server restarted (or new filenames installed via `POST /admin/scrapers/install`) before TC-M4-02 can pass.

---

### Test Cases

#### TC-M4-01: GET /scrapers — no auth token → 200 (public route)

- **Type:** Smoke / Security
- **Method + Route:** `GET /scrapers`
- **Headers:** None (no Authorization header)
- **Expected status:** 200 — route is public; no auth required
- **Expected response:** Non-empty array of scraper metadata objects
- **curl command:**
  ```bash
  curl -s -w "\n--- HTTP %{http_code} ---\n" http://localhost:3001/scrapers
  ```

---

#### TC-M4-02: GET /scrapers — valid USER token → 200; assert `inputSchema` on all entries; assert CIBC has `username` and `password` descriptors

- **Type:** Regression
- **Method + Route:** `GET /scrapers`
- **Headers:** `Authorization: Bearer $TOKEN`
- **Expected status:** 200
- **Expected response shape:**
  ```json
  [
    {
      "bankId": "cibc",
      "displayName": "CIBC",
      "requiresMfaOnEveryRun": true,
      "maxLookbackDays": 90,
      "pendingTransactionsIncluded": true,
      "inputSchema": [
        { "key": "username", "label": "Card / Username", "type": "text", "required": true, "hint": "..." },
        { "key": "password", "label": "Password", "type": "password", "required": true }
      ]
    },
    ...
  ]
  ```
- **Assertions:**
  1. Every entry has an `inputSchema` array (not absent, not null)
  2. The `cibc` entry's `inputSchema` has at least 2 descriptors
  3. The CIBC `inputSchema` contains an entry with `key === "username"`
  4. The CIBC `inputSchema` contains an entry with `key === "password"`
  5. Each descriptor has `key`, `label`, `type`, `required` fields
  6. No top-level `username` or `password` fields on the scraper entry itself
- **curl command:**
  ```bash
  curl -s -w "\n--- HTTP %{http_code} ---\n" http://localhost:3001/scrapers \
    -H "Authorization: Bearer $TOKEN"
  ```

---

#### TC-M4-03: POST /sync-schedules — no auth token → 401

- **Type:** Security
- **Method + Route:** `POST /sync-schedules`
- **Headers:** None
- **Body:** `{"bankId":"cibc","accountId":"<ACCOUNT_ID>","cron":"0 8 * * *","inputs":{"username":"u","password":"p"}}`
- **Expected status:** 401
- **Expected response:** `{"message":"Unauthorized","statusCode":401}`
- **curl command:**
  ```bash
  curl -s -w "\n--- HTTP %{http_code} ---\n" \
    -X POST http://localhost:3001/sync-schedules \
    -H "Content-Type: application/json" \
    -d '{"bankId":"cibc","accountId":"<ACCOUNT_ID>","cron":"0 8 * * *","inputs":{"username":"u","password":"p"}}'
  ```

---

#### TC-M4-04: POST /sync-schedules — valid token, all required `inputSchema` fields in `inputs` → 201; no credential leakage; correct `bankId`

- **Type:** Regression (happy path)
- **Method + Route:** `POST /sync-schedules`
- **Headers:** `Authorization: Bearer $TOKEN`, `Content-Type: application/json`
- **Body:**
  ```json
  {
    "bankId": "cibc",
    "accountId": "<valid-account-uuid>",
    "cron": "0 8 * * *",
    "inputs": { "username": "testuser", "password": "testpass" }
  }
  ```
- **Expected status:** 201
- **Expected response assertions:**
  1. HTTP status 201
  2. Response has `id` field (UUID)
  3. Response has `bankId: "cibc"`
  4. Response does **not** have a top-level `username` field
  5. Response does **not** have a top-level `password` field
  6. Response does **not** have a top-level `inputs` field
  7. Response does **not** have a top-level `pluginConfigEnc` field (no encrypted blob leakage)
  8. Response shape includes `accountId`, `cron`, `enabled`, `lookbackDays`
- **Note:** Save the returned `id` as `SCHEDULE_ID` for TC-M4-09, TC-M4-10, TC-M4-11 and cleanup
- **curl command:**
  ```bash
  SCHEDULE_ID=$(curl -s \
    -X POST http://localhost:3001/sync-schedules \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"bankId":"cibc","accountId":"<ACCOUNT_ID>","cron":"0 8 * * *","inputs":{"username":"testuser","password":"testpass"}}' \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
  echo "SCHEDULE_ID=$SCHEDULE_ID"
  ```

---

#### TC-M4-05: POST /sync-schedules — valid token, `inputs` missing required key (`password` omitted for CIBC) → 400; error references missing field

- **Type:** Regression (validation)
- **Method + Route:** `POST /sync-schedules`
- **Headers:** `Authorization: Bearer $TOKEN`, `Content-Type: application/json`
- **Body:**
  ```json
  {
    "bankId": "cibc",
    "accountId": "<valid-account-uuid>",
    "cron": "0 8 * * *",
    "inputs": { "username": "testuser" }
  }
  ```
- **Expected status:** 400
- **Expected response assertions:**
  1. Status 400
  2. Error message references `password` or `inputs.password`
- **curl command:**
  ```bash
  curl -s -w "\n--- HTTP %{http_code} ---\n" \
    -X POST http://localhost:3001/sync-schedules \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"bankId":"cibc","accountId":"<ACCOUNT_ID>","cron":"0 8 * * *","inputs":{"username":"testuser"}}'
  ```

---

#### TC-M4-06: POST /sync-schedules — valid token, `inputs` value is a non-string type (`username: 123`) → 400 from `@IsStringRecord()`

- **Type:** Regression (validation)
- **Method + Route:** `POST /sync-schedules`
- **Headers:** `Authorization: Bearer $TOKEN`, `Content-Type: application/json`
- **Body:**
  ```json
  {
    "bankId": "cibc",
    "accountId": "<valid-account-uuid>",
    "cron": "0 8 * * *",
    "inputs": { "username": 123, "password": "secret" }
  }
  ```
- **Expected status:** 400
- **Expected response assertions:**
  1. Status 400
  2. Error message references string constraint on `inputs` values (e.g. "Each value in the object must be a string")
- **curl command:**
  ```bash
  curl -s -w "\n--- HTTP %{http_code} ---\n" \
    -X POST http://localhost:3001/sync-schedules \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"bankId":"cibc","accountId":"<ACCOUNT_ID>","cron":"0 8 * * *","inputs":{"username":123,"password":"secret"}}'
  ```

---

#### TC-M4-07: POST /sync-schedules — valid token, `inputs` field entirely absent → 400

- **Type:** Regression (validation)
- **Method + Route:** `POST /sync-schedules`
- **Headers:** `Authorization: Bearer $TOKEN`, `Content-Type: application/json`
- **Body:**
  ```json
  {
    "bankId": "cibc",
    "accountId": "<valid-account-uuid>",
    "cron": "0 8 * * *"
  }
  ```
- **Expected status:** 400
- **Expected response assertions:**
  1. Status 400
  2. Error message references `inputs` field missing or not being an object
- **curl command:**
  ```bash
  curl -s -w "\n--- HTTP %{http_code} ---\n" \
    -X POST http://localhost:3001/sync-schedules \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"bankId":"cibc","accountId":"<ACCOUNT_ID>","cron":"0 8 * * *"}'
  ```

---

#### TC-M4-08: POST /sync-schedules — valid token, `bankId` not in registry → 400; assert descriptive error

- **Type:** Edge Case
- **Method + Route:** `POST /sync-schedules`
- **Headers:** `Authorization: Bearer $TOKEN`, `Content-Type: application/json`
- **Body:**
  ```json
  {
    "bankId": "unknown-bank",
    "accountId": "<valid-account-uuid>",
    "cron": "0 8 * * *",
    "inputs": { "username": "u", "password": "p" }
  }
  ```
- **Expected status:** 400 (service throws `BadRequestException` for unregistered bankId)
- **Expected response assertions:**
  1. Status 400
  2. Error message mentions `unknown-bank` or lists registered banks
  3. No stack trace or internal details leaked
- **curl command:**
  ```bash
  curl -s -w "\n--- HTTP %{http_code} ---\n" \
    -X POST http://localhost:3001/sync-schedules \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"bankId":"unknown-bank","accountId":"<ACCOUNT_ID>","cron":"0 8 * * *","inputs":{"username":"u","password":"p"}}'
  ```

---

#### TC-M4-09: PATCH /sync-schedules/:id — valid token, `inputs: {}` (no credential change), change `cron` → 200; schedule updated

- **Type:** Regression
- **Precondition:** `SCHEDULE_ID` from TC-M4-04
- **Method + Route:** `PATCH /sync-schedules/:id`
- **Headers:** `Authorization: Bearer $TOKEN`, `Content-Type: application/json`
- **Body:**
  ```json
  { "cron": "0 9 * * *", "inputs": {} }
  ```
- **Expected status:** 200
- **Expected response assertions:**
  1. Status 200
  2. Response `cron` equals `"0 9 * * *"`
  3. No credential fields leaked in response (`username`, `password`, `inputs`, `pluginConfigEnc` must all be absent)
- **curl command:**
  ```bash
  curl -s -w "\n--- HTTP %{http_code} ---\n" \
    -X PATCH "http://localhost:3001/sync-schedules/$SCHEDULE_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"cron":"0 9 * * *","inputs":{}}'
  ```

---

#### TC-M4-10: PATCH /sync-schedules/:id — valid token, `inputs: {"password": "new-secret"}` → 200; schedule updated

- **Type:** Regression
- **Precondition:** `SCHEDULE_ID` from TC-M4-04
- **Method + Route:** `PATCH /sync-schedules/:id`
- **Headers:** `Authorization: Bearer $TOKEN`, `Content-Type: application/json`
- **Body:**
  ```json
  { "inputs": { "password": "new-secret" } }
  ```
- **Expected status:** 200
- **Expected response assertions:**
  1. Status 200
  2. Response has `id` matching `SCHEDULE_ID`
  3. No `password` or `inputs` or `pluginConfigEnc` field in response (credentials not leaked)
- **curl command:**
  ```bash
  curl -s -w "\n--- HTTP %{http_code} ---\n" \
    -X PATCH "http://localhost:3001/sync-schedules/$SCHEDULE_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"inputs":{"password":"new-secret"}}'
  ```

---

#### TC-M4-11: PATCH /sync-schedules/:id — valid token, `inputs` value is a non-string type → 400

- **Type:** Regression (validation)
- **Precondition:** `SCHEDULE_ID` from TC-M4-04
- **Method + Route:** `PATCH /sync-schedules/:id`
- **Headers:** `Authorization: Bearer $TOKEN`, `Content-Type: application/json`
- **Body:**
  ```json
  { "inputs": { "password": 999 } }
  ```
- **Expected status:** 400
- **Expected response assertions:**
  1. Status 400
  2. Error message references the string constraint on `inputs` values
- **curl command:**
  ```bash
  curl -s -w "\n--- HTTP %{http_code} ---\n" \
    -X PATCH "http://localhost:3001/sync-schedules/$SCHEDULE_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"inputs":{"password":999}}'
  ```

---

### Cleanup

After all test cases complete, delete the schedule created in TC-M4-04:

```bash
curl -s -w "\n--- HTTP %{http_code} ---\n" \
  -X DELETE "http://localhost:3001/sync-schedules/$SCHEDULE_ID" \
  -H "Authorization: Bearer $TOKEN"
# Expected: 204
```

---

### Coverage Matrix

| Endpoint | TC IDs |
|----------|--------|
| `GET /scrapers` | TC-M4-01, TC-M4-02 |
| `POST /sync-schedules` | TC-M4-03, TC-M4-04, TC-M4-05, TC-M4-06, TC-M4-07, TC-M4-08 |
| `PATCH /sync-schedules/:id` | TC-M4-09, TC-M4-10, TC-M4-11 |
