# API Test Report: Scraper Plugins — Milestone 2

**Date:** 2026-03-15
**Executed by:** Claude Code (backend-tester)
**Plan reference:** `test-plan/scraper-plugins/milestone-2-backend.md`
**Implementation plan:** `test-plan/scraper-plugins/milestone-2-implementation-plan.md`
**Server:** `http://localhost:3001`
**SCRAPER_PLUGIN_DIR:** `C:/Users/richm/AppData/Local/Temp/scraper-plugins`

---

## Server Status

**Running** — all endpoints reachable.

---

## Test Case Results

| TC | Method + Route | Auth | Expected | Actual | Result |
|----|----------------|------|----------|--------|--------|
| TC-API-1 | POST `/admin/scrapers/cibc/test` | None | 401 | 401 `{"message":"Unauthorized","statusCode":401}` | ✅ PASS |
| TC-API-2 | POST `/admin/scrapers/cibc/test` | USER | 403 | 403 `{"message":"Admin access required","error":"Forbidden","statusCode":403}` | ✅ PASS |
| TC-API-3 | POST `/admin/scrapers/unknown-bank/test` | ADMIN | 404 | 404 `{"message":"No scraper registered for bankId 'unknown-bank'","error":"Not Found","statusCode":404}` | ✅ PASS |
| TC-API-4 | POST `/admin/scrapers/cibc/test` — no `inputs` | ADMIN | 400 | 400 `{"message":["inputs must be an object"],"error":"Bad Request","statusCode":400}` | ✅ PASS |
| TC-API-5 | POST `/admin/scrapers/cibc/test` — `lookbackDays:-1` | ADMIN | 400 | 400 `{"message":["lookbackDays must be a positive number"],"error":"Bad Request","statusCode":400}` | ✅ PASS |
| TC-API-6 | POST `/admin/scrapers/cibc/test` — `lookbackDays:1.5` | ADMIN | 400 | 400 `{"message":["lookbackDays must be an integer number"],"error":"Bad Request","statusCode":400}` | ✅ PASS |
| TC-API-7 | POST `/admin/scrapers/cibc/test` — valid inputs | ADMIN | 200 or 500 | 200 `{"bankId":"cibc","transactions":[],"count":0}` | ✅ PASS |

**Summary: 7 passed / 0 failed / 0 skipped**

---

## Observations

**TC-API-7 — 200 with correct shape:** The endpoint returned `{ bankId: "cibc", transactions: [], count: 0 }`.
Playwright launched successfully, the plugin's `login()` and `scrapeTransactions()` were called,
and the results returned without a DB write. The empty `transactions` array is expected — the test
credentials (`test@example.com` / `testpass`) are not real CIBC credentials, so the scraper's
stub login returns no transactions. Shape is correct: `bankId` is a string, `transactions` is an
array, `count === transactions.length`.

**TC-API-3 — 404 message contains bankId:** The error message `"No scraper registered for bankId 'unknown-bank'"`
correctly echoes the unknown bankId, making it actionable for API consumers.

**Validation messages (TC-API-4–6):** All three validation cases return specific, field-level
error messages from class-validator rather than a generic 400 — correct behaviour.

---

## Conclusion

All 7 test cases pass. The `POST /admin/scrapers/:bankId/test` endpoint is correctly
implemented: auth guards work, DTO validation fires on all invalid inputs, unknown
bankIds return 404 with a useful message, and a valid request returns the correct
`{ bankId, transactions, count }` shape with no DB write.
