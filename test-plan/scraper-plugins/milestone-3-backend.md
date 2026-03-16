## API Test Plan: Milestone 3 — dryRun Flag on Run-Now

**Feature:** `dryRun` boolean field on `POST /sync-schedules/:id/run-now`
**Coverage level:** Regression
**Reference:** `test-plan/scraper-plugins/milestone-3-implementation-plan.md`

---

### Preconditions

- [ ] Backend running at `http://localhost:3001`
- [ ] Test user credentials: `email=test@example.com`, `password=password123`
- [ ] A `SyncSchedule` record must exist for the test user — create one via `POST /sync-schedules` before running TC-01 through TC-05 and TC-07
- [ ] The `test-bank` scraper plugin must be loaded (verified via `GET /scrapers`)
- [ ] At least one account UUID must exist for the test user (verified via `GET /accounts`)

---

### Endpoint Inventory

| Method | Route | Query params | Notes |
|--------|-------|--------------|-------|
| POST | `/sync-schedules/:id/run-now` | — | Subject of TC-01 through TC-07 |
| GET | `/sync-schedules/:sessionId/stream` | — | SSE stream; secondary subject in TC-01, TC-02 |

### Precondition Endpoints (stimuli only)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/auth/login` | Obtain JWT |
| GET | `/scrapers` | Discover available bank IDs |
| GET | `/accounts` | Discover account UUID |
| POST | `/sync-schedules` | Create a SyncSchedule for test data |
| DELETE | `/sync-schedules/:id` | Teardown |

---

### Test Cases

#### TC-01: dryRun true — happy path with SSE verification
- **Type**: Regression
- **Method + Route**: `POST /sync-schedules/:scheduleId/run-now`
- **Request body**: `{ "dryRun": true }`
- **Auth**: Valid USER JWT
- **Expected status**: 201
- **Expected response**: `{ "sessionId": "<uuid>" }`
- **SSE follow-up**: `GET /sync-schedules/:sessionId/stream` must emit a terminal event with `{ "status": "complete", "importedCount": 0 }`
- **curl command**:
  ```bash
  # Step 1 — trigger run
  curl -s -w "\n--- HTTP %{http_code} ---\n" \
    -X POST "http://localhost:3001/sync-schedules/$SCHED/run-now" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"dryRun": true}'

  # Step 2 — subscribe to SSE stream (replace $SESSION_ID with returned sessionId)
  curl -s -N --max-time 15 \
    "http://localhost:3001/sync-schedules/$SESSION_ID/stream" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Accept: text/event-stream"
  ```

#### TC-02: dryRun omitted — default behaviour unchanged
- **Type**: Regression
- **Method + Route**: `POST /sync-schedules/:scheduleId/run-now`
- **Request body**: `{}` (no `dryRun` field)
- **Auth**: Valid USER JWT
- **Expected status**: 201
- **Expected response**: `{ "sessionId": "<uuid>" }`
- **SSE follow-up**: SSE stream must emit a terminal `complete` event (importedCount is 0 in the Phase 7 stub — this is expected)
- **curl command**:
  ```bash
  curl -s -w "\n--- HTTP %{http_code} ---\n" \
    -X POST "http://localhost:3001/sync-schedules/$SCHED/run-now" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{}'
  ```

#### TC-03: dryRun false — explicit false accepted
- **Type**: Regression
- **Method + Route**: `POST /sync-schedules/:scheduleId/run-now`
- **Request body**: `{ "dryRun": false }`
- **Auth**: Valid USER JWT
- **Expected status**: 201
- **Expected response**: `{ "sessionId": "<uuid>" }`
- **curl command**:
  ```bash
  curl -s -w "\n--- HTTP %{http_code} ---\n" \
    -X POST "http://localhost:3001/sync-schedules/$SCHED/run-now" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"dryRun": false}'
  ```

#### TC-04: dryRun string value rejected
- **Type**: Regression / Validation
- **Method + Route**: `POST /sync-schedules/:scheduleId/run-now`
- **Request body**: `{ "dryRun": "yes" }`
- **Auth**: Valid USER JWT
- **Expected status**: 400
- **Expected response**: `{ "message": ["dryRun must be a boolean value"], "error": "Bad Request", "statusCode": 400 }`
- **curl command**:
  ```bash
  curl -s -w "\n--- HTTP %{http_code} ---\n" \
    -X POST "http://localhost:3001/sync-schedules/$SCHED/run-now" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"dryRun": "yes"}'
  ```

#### TC-05: dryRun numeric value rejected
- **Type**: Regression / Validation
- **Method + Route**: `POST /sync-schedules/:scheduleId/run-now`
- **Request body**: `{ "dryRun": 1 }`
- **Auth**: Valid USER JWT
- **Expected status**: 400
- **Expected response**: `{ "message": ["dryRun must be a boolean value"], "error": "Bad Request", "statusCode": 400 }`
- **curl command**:
  ```bash
  curl -s -w "\n--- HTTP %{http_code} ---\n" \
    -X POST "http://localhost:3001/sync-schedules/$SCHED/run-now" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"dryRun": 1}'
  ```

#### TC-06: No auth token — 401
- **Type**: Security
- **Method + Route**: `POST /sync-schedules/:scheduleId/run-now`
- **Request body**: `{ "dryRun": true }`
- **Auth**: None
- **Expected status**: 401
- **Expected response**: `{ "message": "Unauthorized", "statusCode": 401 }`
- **curl command**:
  ```bash
  curl -s -w "\n--- HTTP %{http_code} ---\n" \
    -X POST "http://localhost:3001/sync-schedules/$SCHED/run-now" \
    -H "Content-Type: application/json" \
    -d '{"dryRun": true}'
  ```

#### TC-07: Non-existent schedule — 404
- **Type**: Edge Case
- **Method + Route**: `POST /sync-schedules/:id/run-now`
- **Request body**: `{ "dryRun": true }`
- **Auth**: Valid USER JWT
- **Precondition note**: The implementation plan specifies `00000000-0000-0000-0000-000000000000` as the test UUID. This ID fails the `ParseUUIDPipe({version: '4'})` guard on the route (version nibble `0` is not `4`) and returns 400, not 404. To reach the 404 path, a proper v4 UUID that does not exist in the database must be used (e.g. `f47ac10b-58cc-4372-a567-0e02b2c3d479`). Both behaviours are documented in the execution report.
- **Expected status**: 404 (with a valid v4 UUID that has no matching row)
- **Expected response**: `{ "message": "Sync schedule with ID <uuid> not found", "error": "Not Found", "statusCode": 404 }`
- **curl command**:
  ```bash
  # Using a valid v4 UUID that does not exist in the database:
  curl -s -w "\n--- HTTP %{http_code} ---\n" \
    -X POST "http://localhost:3001/sync-schedules/f47ac10b-58cc-4372-a567-0e02b2c3d479/run-now" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"dryRun": true}'
  ```

---

### Test Data

| Resource | Purpose | Cleanup |
|----------|---------|---------|
| `SyncSchedule` (bankId=test-bank) | Precondition for TC-01 through TC-05 | `DELETE /sync-schedules/:id` after run |
| `SyncJob` records (3 from TC-01, TC-02, TC-03) | Created automatically by run-now | Not deleted by test (no delete endpoint for jobs) |
