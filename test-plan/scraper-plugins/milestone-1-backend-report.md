# API Test Report: Scraper Plugins — Milestone 1 Regression

**Date:** 2026-03-15
**Executed by:** Claude Code (backend-tester)
**Plan reference:** `test-plan/scraper-plugins/milestone-1-backend.md`
**Implementation plan:** `test-plan/scraper-plugins/milestone-1-implementation-plan.md`
**Server:** `http://localhost:3001`
**SCRAPER_PLUGIN_DIR:** `C:/Users/richm/AppData/Local/Temp/scraper-plugins`

---

## Server Status

**Running** — all endpoints reachable.

---

## Test Case Results

| TC | Method + Route | Auth | Expected | Actual | Result |
|----|----------------|------|----------|--------|--------|
| TC-01 | GET `/scrapers` | None | 200, array with `cibc` + `td` | 200, `[cibc, td]` ✓ | ✅ PASS |
| TC-02 | GET `/scrapers` shape | None | All 5 fields present per entry | `bankId`, `displayName`, `requiresMfaOnEveryRun`, `maxLookbackDays`, `pendingTransactionsIncluded` ✓ | ✅ PASS |
| TC-03 | POST `/admin/scrapers/reload` | None | 401 | 401 `{"message":"Unauthorized","statusCode":401}` | ✅ PASS |
| TC-04 | POST `/admin/scrapers/reload` | USER | 403 | 403 `{"message":"Admin access required","error":"Forbidden","statusCode":403}` | ✅ PASS |
| TC-05 | POST `/admin/scrapers/reload` | ADMIN | 200 | 200 `{"message":"Plugin reload complete"}` | ✅ PASS |
| TC-06 | POST `/admin/scrapers/install` | ADMIN | 201 | 201 `{"message":"Plugin test-bank.js installed and loaded successfully","filename":"test-bank.js"}` | ✅ PASS |
| TC-07 | POST `/admin/scrapers/install` | None | 401 | 401 `{"message":"Unauthorized","statusCode":401}` | ✅ PASS |
| TC-08 | POST `/admin/scrapers/install` | USER | 403 | 403 `{"message":"Admin access required","error":"Forbidden","statusCode":403}` | ✅ PASS |

**Summary: 8 passed / 0 failed / 0 skipped**

---

## Observations

**TC-01 / TC-02 — scrapers load as plugins:** With `SCRAPER_PLUGIN_DIR` set and `dist/` built,
`seedBuiltins()` copied `cibc.scraper.js` and `td.scraper.js` into the plugin directory on startup.
Both appear in `GET /scrapers` with correct shapes — confirming the plugin loader path works end-to-end.

**TC-06 — install + immediate availability:** After `POST /admin/scrapers/install`, a subsequent
`GET /scrapers` returned `[cibc, td, test-bank]` — the installed plugin was immediately registered
without a server restart, confirming `reloadPlugins()` runs after install.

**Auth responses:** `"Admin access required"` is the application's custom `AdminGuard` message.
This is correct behaviour.

---

## Conclusion

All 8 test cases pass. The Milestone 1 refactor introduces no regressions. Built-in scrapers
(`cibc`, `td`) now load exclusively through the plugin system — the `BANK_SCRAPER` factory
provider is gone from the NestJS core and all endpoints behave identically to pre-refactor.
