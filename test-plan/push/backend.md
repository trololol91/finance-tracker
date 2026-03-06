## API Test Plan: Push Notifications Module

### Preconditions
- [ ] Backend running at http://localhost:3001
- [ ] Test user credentials: email=test@example.com password=password123
- [ ] No database seed required (push subscriptions are in-memory)
- [ ] Token obtained via `POST /auth/login`

### Endpoint Inventory

| Method | Route | Auth | Notes |
|--------|-------|------|-------|
| POST | `/push/subscribe` | Yes | Register Web Push subscription |
| DELETE | `/push/subscribe` | Yes | Remove Web Push subscription |

> **Out-of-scope (integration, requires external services)**:
> - `sendNotification` delivery path (VAPID Web Push) — requires real push service + browser subscription registered on a running Service Worker
> - Email fallback (SMTP) — requires SMTP credentials and a live mailbox
> - OS notification toast appearance and deep-link click-through — requires Desktop MCP server (see roadmap Future Enhancements)

---

### Test Cases

#### TC-01: POST /push/subscribe — 401 without token
- **Type**: Security
- **Method + Route**: `POST /push/subscribe`
- **Headers**: none
- **Expected status**: 401
- **Expected response**: `{ message: "Unauthorized", statusCode: 401 }`
- **curl command**:
  ```bash
  curl -s -w "\n--- %{http_code} ---\n" -X POST http://localhost:3001/push/subscribe \
    -H "Content-Type: application/json" \
    -d '{"endpoint":"https://fcm.googleapis.com/fcm/send/x","keys":{"p256dh":"k","auth":"s"}}'
  ```

#### TC-02: DELETE /push/subscribe — 401 without token
- **Type**: Security
- **Method + Route**: `DELETE /push/subscribe`
- **Headers**: none
- **Expected status**: 401
- **curl command**:
  ```bash
  curl -s -w "\n--- %{http_code} ---\n" -X DELETE http://localhost:3001/push/subscribe \
    -H "Content-Type: application/json" \
    -d '{"endpoint":"https://fcm.googleapis.com/fcm/send/x"}'
  ```

#### TC-03: POST /push/subscribe — 201 happy path
- **Type**: Smoke
- **Expected status**: 201
- **Expected response**: `{ message: "Subscribed to push notifications." }`

#### TC-04: POST /push/subscribe — 201 idempotent re-register
- **Type**: Edge Case
- **Description**: Same endpoint registered twice should succeed both times (deduplication in store)
- **Expected status**: 201 both times

#### TC-05: POST /push/subscribe — 201 second distinct endpoint
- **Type**: Smoke
- **Description**: User can register multiple endpoints
- **Expected status**: 201

#### TC-06: POST /push/subscribe — 400 missing endpoint field
- **Type**: Validation
- **Expected status**: 400
- **Expected response**: `message` array contains `endpoint should not be empty` and `endpoint must be a URL address`

#### TC-07: POST /push/subscribe — 400 invalid URL in endpoint
- **Type**: Validation
- **Expected status**: 400
- **Expected response**: `message` contains `endpoint must be a URL address`

#### TC-08: POST /push/subscribe — 400 missing keys.p256dh
- **Type**: Validation
- **Request body**: `{ endpoint: <valid URL>, keys: { auth: "x" } }`
- **Expected status**: 400
- **Expected response**: `message` contains `keys.p256dh should not be empty`

#### TC-09: POST /push/subscribe — 400 missing keys.auth
- **Type**: Validation
- **Request body**: `{ endpoint: <valid URL>, keys: { p256dh: "x" } }`
- **Expected status**: 400
- **Expected response**: `message` contains `keys.auth should not be empty`

#### TC-10: POST /push/subscribe — 400 missing keys object
- **Type**: Validation
- **Request body**: `{ endpoint: <valid URL> }`
- **Expected status**: 400
- **Expected response**: `message` contains both keys field errors

#### TC-11: POST /push/subscribe — 400 empty body
- **Type**: Validation
- **Request body**: `{}`
- **Expected status**: 400
- **Expected response**: `message` array covers all required fields

#### TC-12: DELETE /push/subscribe — 204 happy path
- **Type**: Smoke
- **Expected status**: 204
- **Expected response**: empty body

#### TC-13: DELETE /push/subscribe — 204 non-existent endpoint (idempotent)
- **Type**: Edge Case
- **Description**: Removing an endpoint never registered should return 204, not 404
- **Expected status**: 204

#### TC-14: DELETE /push/subscribe — 400 missing endpoint
- **Type**: Validation
- **Request body**: `{}`
- **Expected status**: 400
- **Expected response**: `message` contains `endpoint must be a URL address`

#### TC-15: DELETE /push/subscribe — 400 invalid URL
- **Type**: Validation
- **Expected status**: 400

#### TC-16: 401 response — no internal stack leak
- **Type**: Security
- **Description**: 401 response body must contain only `{ message, statusCode }`, no `stack`, SQL, or Prisma internals

#### TC-17: POST /push/subscribe — 400 malformed JSON body
- **Type**: Edge Case
- **Description**: Non-JSON body with Content-Type: application/json
- **Expected status**: 400
- **Expected response**: NestJS standard parse error — no stack

#### TC-18: 400 response — no internal leak
- **Type**: Security
- **Description**: Validation error response must not contain `stack`, raw class-validator internals, or Prisma errors

#### TC-19: sendNotification — SKIPPED (integration)
- **Type**: Integration — **SKIPPED**
- **Reason**: Requires real VAPID keys, a browser Service Worker, and a live push service (FCM/APNS). Cannot be exercised via curl alone.

#### TC-20: Email delivery — SKIPPED (integration)
- **Type**: Integration — **SKIPPED**
- **Reason**: Requires SMTP_HOST/USER/PASS configured and a real mailbox. No SMTP server is configured in the dev environment.

#### TC-21: OS notification toast — SKIPPED (desktop)
- **Type**: E2E — **SKIPPED**
- **Reason**: Requires Desktop MCP server for WinRT notification reading. See `docs/desktop-mcp-server.md`.
