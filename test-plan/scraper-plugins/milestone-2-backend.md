# API Test Plan: Scraper Plugins — Milestone 2

**Feature:** Dry-run Test Endpoint — `POST /admin/scrapers/:bankId/test`
**Milestone:** 2 — backend-only, no API contract changes to existing endpoints
**Date drafted:** 2026-03-15
**Implementation plan reference:** `test-plan/scraper-plugins/milestone-2-implementation-plan.md`

---

## Endpoint Under Test

```
POST /admin/scrapers/:bankId/test
```

Guards: `JwtAuthGuard` + `AdminGuard` (inherited from class level).
Runs synchronously in the main process — no worker thread, no DB write.

---

## Preconditions

- [ ] Backend running at `http://localhost:3001`
- [ ] `SCRAPER_PLUGIN_DIR` set and built-in plugins seeded (so `cibc` is registered)
- [ ] Admin JWT: `POST /auth/login` with `admin@example.com` / `Admin123!`
- [ ] User JWT: `POST /auth/login` with `user@example.com` / `User123!`

```bash
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"Admin123!"}' \
  | sed 's/.*"accessToken":"\([^"]*\)".*/\1/')

USER_TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"User123!"}' \
  | sed 's/.*"accessToken":"\([^"]*\)".*/\1/')
```

---

## Test Cases

### TC-API-1 — No auth token → 401

```bash
curl -s -w '\n--- HTTP %{http_code} ---\n' \
  -X POST http://localhost:3001/admin/scrapers/cibc/test \
  -H 'Content-Type: application/json' \
  -d '{"inputs":{}}'
```

Expected: `401`, body `{"message":"Unauthorized","statusCode":401}`

---

### TC-API-2 — USER role → 403

```bash
curl -s -w '\n--- HTTP %{http_code} ---\n' \
  -X POST http://localhost:3001/admin/scrapers/cibc/test \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{"inputs":{}}'
```

Expected: `403`

---

### TC-API-3 — Unknown bankId → 404

```bash
curl -s -w '\n--- HTTP %{http_code} ---\n' \
  -X POST http://localhost:3001/admin/scrapers/unknown-bank/test \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"inputs":{}}'
```

Expected: `404`, `message` contains `'unknown-bank'`

---

### TC-API-4 — Missing `inputs` field → 400

```bash
curl -s -w '\n--- HTTP %{http_code} ---\n' \
  -X POST http://localhost:3001/admin/scrapers/cibc/test \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{}'
```

Expected: `400`, `message` array includes validation error for `inputs`

---

### TC-API-5 — Negative `lookbackDays` → 400

```bash
curl -s -w '\n--- HTTP %{http_code} ---\n' \
  -X POST http://localhost:3001/admin/scrapers/cibc/test \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"inputs":{},"lookbackDays":-1}'
```

Expected: `400`, `message` includes positive integer error for `lookbackDays`

---

### TC-API-6 — Float `lookbackDays` → 400

```bash
curl -s -w '\n--- HTTP %{http_code} ---\n' \
  -X POST http://localhost:3001/admin/scrapers/cibc/test \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"inputs":{},"lookbackDays":1.5}'
```

Expected: `400`, `message` includes integer error for `lookbackDays`

---

### TC-API-7 — ADMIN + valid inputs → 200 or 500

```bash
curl -s -w '\n--- HTTP %{http_code} ---\n' \
  -X POST http://localhost:3001/admin/scrapers/cibc/test \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"inputs":{"username":"test@example.com","password":"testpass"},"lookbackDays":1}'
```

Expected:
- `200` if Playwright binary is available — body has `bankId` (string), `transactions` (array), `count` (number === `transactions.length`). Do not assert transaction content.
- `500` if Playwright binary is absent — assert `{ statusCode: 500 }`. Mark as PASS.

---

## Response Shape Assertions (TC-API-7 on 200)

```
body.bankId     → string
body.transactions → array
body.count      → number === body.transactions.length
```
