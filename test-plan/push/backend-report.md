## API Test Report: Push Notifications Module
**Date**: 2026-03-05
**Environment**: http://localhost:3001
**Test User**: test@example.com
**Server note**: The development server must be freshly started to include the push module. The initial server instance (pre-commit) did not register `/push` routes — verified by checking `GET /api-json` Swagger spec. After killing the stale process (PID 81008) and restarting `npm run start:dev`, both routes appeared correctly.

---

### Summary

| Total | Passed | Partial / Fail | Failed | Skipped |
|-------|--------|----------------|--------|---------|
| 21    | 18     | 0              | 0      | 3       |

> **Skipped** = requires external service (VAPID push service, SMTP, or Desktop MCP server for OS notification).
> All 18 exercisable TCs passed on first run. Zero bugs found.

---

### Bugs Found

None.

---

### Results

#### ✅ TC-01: POST /push/subscribe — 401 without token
- **Status**: 401 ✅
- **Evidence**: `{"message":"Unauthorized","statusCode":401}`
- **No internal leak**: confirmed — body contains only `message` + `statusCode`

#### ✅ TC-02: DELETE /push/subscribe — 401 without token
- **Status**: 401 ✅
- **Evidence**: `{"message":"Unauthorized","statusCode":401}`

#### ✅ TC-03: POST /push/subscribe — 201 happy path
- **Status**: 201 ✅
- **Evidence**: `{"message":"Subscribed to push notifications."}`
- **Response shape**: correct — no extra fields, message is descriptive

#### ✅ TC-04: POST /push/subscribe — 201 idempotent re-register
- **Status**: 201 ✅ (both calls)
- **Evidence**: Second call with identical endpoint returns same `{"message":"Subscribed to push notifications."}` without error
- **Note**: Store-level deduplication (PushSubscriptionStore.add deduplicates by endpoint) is transparent to the caller — correct behaviour

#### ✅ TC-05: POST /push/subscribe — 201 second distinct endpoint
- **Status**: 201 ✅
- **Evidence**: `{"message":"Subscribed to push notifications."}`

#### ✅ TC-06: POST /push/subscribe — 400 missing endpoint field
- **Status**: 400 ✅
- **Evidence**: `{"message":["endpoint should not be empty","endpoint must be a URL address"],"error":"Bad Request","statusCode":400}`
- **Field-level errors**: ✅ two distinct messages per validator

#### ✅ TC-07: POST /push/subscribe — 400 invalid URL
- **Status**: 400 ✅
- **Evidence**: `{"message":["endpoint must be a URL address"],"error":"Bad Request","statusCode":400}`

#### ✅ TC-08: POST /push/subscribe — 400 missing keys.p256dh
- **Status**: 400 ✅
- **Evidence**: `{"message":["keys.p256dh should not be empty"],"error":"Bad Request","statusCode":400}`
- **Nested validation**: ✅ @ValidateNested + @Type correctly surfaces inner DTO errors with dot-notation path

#### ✅ TC-09: POST /push/subscribe — 400 missing keys.auth
- **Status**: 400 ✅
- **Evidence**: `{"message":["keys.auth should not be empty"],"error":"Bad Request","statusCode":400}`

#### ✅ TC-10: POST /push/subscribe — 400 missing keys object
- **Status**: 400 ✅
- **Evidence**: `{"message":["keys.p256dh should not be empty","keys.auth should not be empty"],"error":"Bad Request","statusCode":400}`
- **Note**: When `keys` is absent entirely, NestJS instantiates the default `new PushSubscriptionKeysDto()` (empty strings) which triggers both `@IsNotEmpty` validators — correct

#### ✅ TC-11: POST /push/subscribe — 400 empty body
- **Status**: 400 ✅
- **Evidence**: `{"message":["endpoint should not be empty","endpoint must be a URL address","keys.p256dh should not be empty","keys.auth should not be empty"],"error":"Bad Request","statusCode":400}`
- **Coverage**: All four required field validators fire simultaneously ✅

#### ✅ TC-12: DELETE /push/subscribe — 204 no content
- **Status**: 204 ✅
- **Response body**: empty ✅ — correct for 204 No Content
- **No lingering JSON response** from the old `{message: "Unsubscribed..."}` pre-fix body ✅

#### ✅ TC-13: DELETE /push/subscribe — 204 non-existent endpoint (idempotent)
- **Status**: 204 ✅
- **Evidence**: No error when removing an endpoint that was never registered
- **Behaviour**: Correct — unsubscribe is a fire-and-forget store removal; missing endpoints silently no-op

#### ✅ TC-14: DELETE /push/subscribe — 400 missing endpoint
- **Status**: 400 ✅
- **Evidence**: `{"message":["endpoint should not be empty","endpoint must be a URL address"],"error":"Bad Request","statusCode":400}`

#### ✅ TC-15: DELETE /push/subscribe — 400 invalid URL
- **Status**: 400 ✅
- **Evidence**: `{"message":["endpoint must be a URL address"],"error":"Bad Request","statusCode":400}`

#### ✅ TC-16: 401 response — no internal stack leak
- **Status**: 401 ✅
- **Evidence**: `{"message":"Unauthorized","statusCode":401}`
- **Contains `stack`**: No ✅ | **Contains Prisma error**: No ✅ | **Contains SQL**: No ✅

#### ✅ TC-17: POST /push/subscribe — 400 malformed JSON
- **Status**: 400 ✅
- **Evidence**: `{"message":"Unexpected token 'n', \"not-json\" is not valid JSON","error":"Bad Request","statusCode":400}`
- **Note**: Standard NestJS JSON parse error. The message echoes the user's raw input in the error string — this is the built-in NestJS behavior, not specific to this module. No stack trace present. ✅

#### ✅ TC-18: 400 response — validation body shape
- **Status**: 400 ✅
- **Evidence**: `{"message":["endpoint must be a URL address"],"error":"Bad Request","statusCode":400}`
- **Contains `stack`**: No ✅ | **Contains Prisma error**: No ✅

#### ⏭ TC-19: sendNotification Web Push delivery — SKIPPED
- **Reason**: Requires VAPID keys configured, a browser Service Worker with a real push subscription, and a live FCM/APNS endpoint. Cannot exercise via curl against a local dev server.

#### ⏭ TC-20: Email delivery fallback — SKIPPED
- **Reason**: No SMTP server configured in dev environment (`SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` absent). Service correctly logs a warning and disables the email transporter; confirmed by startup log: `SMTP_HOST / SMTP_USER / SMTP_PASS not set — email notifications disabled`.

#### ⏭ TC-21: OS notification toast appearance and click-through — SKIPPED
- **Reason**: Requires Desktop MCP server for WinRT `UserNotificationListener` event capture. Automated E2E of browser push notification → OS toast → deep-link click cannot be driven by Playwright alone. Manual verification checklist is in `test-plan/import-sync/implementation-plan.md` Section 10.

---

### Test Data Created

| Resource | Notes | Cleaned Up |
|----------|-------|------------|
| Push subscriptions (in-memory) | Two subscriptions registered for `test@example.com` during TC-03–TC-05; TC-12 deleted EP1. EP2 remains in memory. | Auto-cleared on server restart |

No database records were created. Push subscriptions are stored in `PushSubscriptionStore` (in-process `Map`) and do not persist to the database. A server restart clears all subscriptions.

---

### Testing Gaps — Retrospective

1. **Delivery path untestable locally**: `sendNotification` → `sendWebPush` and `sendEmail` cannot be verified without external dependencies (VAPID push service, SMTP). To close this gap, a staging environment with real SMTP credentials and a VAPID key pair is needed, or an integration test harness that mocks the push service at the network level (e.g. sinon HTTP interceptor or a local FCM simulator).

2. **Stale push subscription purge path (404/410)**: The `sendWebPush` method purges subscriptions that receive a 404 or 410 response from the push service. This path is covered by unit tests (`push.service.spec.ts`) but cannot be triggered via the HTTP API alone.

3. **Multi-user isolation**: All subscriptions are namespaced by `userId` in the store. Cross-user isolation (user A cannot see or delete user B's subscriptions) is correct by design (the `CurrentUser` decorator provides the authenticated user ID), but a second user account would be needed to exercise this boundary via the API.
