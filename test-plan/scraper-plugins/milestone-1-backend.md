## API Test Plan: Scraper Plugins - Milestone 1 Regression

**Feature**: Remove Built-ins, Add Startup Seeding
**Milestone**: Milestone 1 - no API contract changes
**Date drafted**: 2026-03-15
**Coverage level**: Regression (smoke-level per milestone scope)
**Implementation plan reference**: test-plan/scraper-plugins/milestone-1-implementation-plan.md Section 12

---

### Endpoint Inventory

| Method | Route | Auth required | Subject of TC |
|--------|-------|---------------|---------------|
| GET | /scrapers | No | TC-01, TC-02 |
| POST | /admin/scrapers/reload | Yes (ADMIN) | TC-03, TC-04, TC-05 |
| POST | /admin/scrapers/install | Yes (ADMIN) | TC-06, TC-07, TC-08 |

Coverage diff: all three endpoints are the subject of at least one TC.

---

### Preconditions

- [ ] Backend running at http://localhost:3001 (PORT=3001 per packages/backend/.env)
- [ ] PostgreSQL accessible at localhost:5432
- [ ] Database seeded via packages/backend/prisma/seed.ts:
  - Admin: admin@example.com / Admin123! (role: ADMIN)
  - Regular user: user@example.com / User123! (role: USER)
- [ ] SCRAPER_PLUGIN_DIR env var set or absent -- TC-01 and TC-06 document both outcomes
- [ ] Minimal valid .js plugin file available locally for TC-06

---

### Auth Setup

    ADMIN_TOKEN=$(curl -s -X POST http://localhost:3001/auth/login       -H 'Content-Type: application/json'       -d '{"email":"admin@example.com","password":"Admin123!"}'       | jq -r '.accessToken')

    USER_TOKEN=$(curl -s -X POST http://localhost:3001/auth/login       -H 'Content-Type: application/json'       -d '{"email":"user@example.com","password":"User123!"}'       | jq -r '.accessToken')

---

### Test Cases

#### TC-01: GET /scrapers - 200 happy path, no auth required
- **Type**: Regression
- **Method + Route**: GET /scrapers
- **Auth**: None
- **Expected status**: 200
- **Expected response**: JSON array. Each element must have: bankId, displayName, requiresMfaOnEveryRun, maxLookbackDays, pendingTransactionsIncluded. If SCRAPER_PLUGIN_DIR is set and built-in plugins were seeded, cibc and td appear. If not set, empty array [] is correct.
- **curl command**:

    curl -s -w '\n--- HTTP %{http_code} ---\n' http://localhost:3001/scrapers | jq .

#### TC-02: GET /scrapers - response shape validation
- **Type**: Regression
- **Method + Route**: GET /scrapers
- **Auth**: None
- **Precondition**: TC-01 returned at least one entry (requires SCRAPER_PLUGIN_DIR set); skip if array is empty
- **Expected status**: 200
- **Expected response**: Each element has all five documented fields; body does not contain stack, Prisma error text, or SQL fragments
- **curl command**:

    curl -s http://localhost:3001/scrapers | jq '.[0] | keys'
    # Expected keys include: bankId, displayName, maxLookbackDays, pendingTransactionsIncluded, requiresMfaOnEveryRun

#### TC-03: POST /admin/scrapers/reload - 401 without token
- **Type**: Security / Regression
- **Method + Route**: POST /admin/scrapers/reload
- **Auth**: None
- **Expected status**: 401
- **Expected response**: {message: Unauthorized, statusCode: 401} -- no stack trace, no Prisma error
- **curl command**:

    STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3001/admin/scrapers/reload)
    echo Status: $STATUS
    curl -s -X POST http://localhost:3001/admin/scrapers/reload | jq .

#### TC-04: POST /admin/scrapers/reload - 403 regular user (non-admin)
- **Type**: Security / Regression
- **Method + Route**: POST /admin/scrapers/reload
- **Auth**: USER_TOKEN (role: USER, not ADMIN)
- **Expected status**: 403
- **Expected response**: {message: Forbidden resource, error: Forbidden, statusCode: 403}
- **curl command**:

    curl -s -w '\n--- HTTP %{http_code} ---\n'       -X POST http://localhost:3001/admin/scrapers/reload       -H 'Authorization: Bearer $USER_TOKEN' | jq .

#### TC-05: POST /admin/scrapers/reload - 200 admin happy path
- **Type**: Regression
- **Method + Route**: POST /admin/scrapers/reload
- **Auth**: ADMIN_TOKEN (role: ADMIN)
- **Expected status**: 200
- **Expected response**: {message: Plugin reload complete}
- **curl command**:

    curl -s -w '\n--- HTTP %{http_code} ---\n'       -X POST http://localhost:3001/admin/scrapers/reload       -H 'Authorization: Bearer $ADMIN_TOKEN' | jq .

#### TC-06: POST /admin/scrapers/install - 201 happy path (valid .js plugin file)
- **Type**: Regression
- **Method + Route**: POST /admin/scrapers/install
- **Auth**: ADMIN_TOKEN (role: ADMIN)
- **Preconditions**: SCRAPER_PLUGIN_DIR must be set (otherwise service returns 400)
- **Expected status**: 201
- **Expected response**: {message: Plugin test-bank.js installed and loaded successfully, filename: test-bank.js}
- **curl command**:

    printf 'export default { bankId: "test-bank", displayName: "Test Bank", requiresMfaOnEveryRun: false, maxLookbackDays: 90, pendingTransactionsIncluded: false, login: async () => {}, scrapeTransactions: async () => [] };' > /tmp/test-bank.js

    curl -s -w '\n--- HTTP %{http_code} ---\n'       -X POST http://localhost:3001/admin/scrapers/install       -H 'Authorization: Bearer $ADMIN_TOKEN'       -F 'file=@/tmp/test-bank.js' | jq .

- **Cleanup**: Delete test-bank.js from SCRAPER_PLUGIN_DIR after the run.

#### TC-07: POST /admin/scrapers/install - 401 without token
- **Type**: Security / Regression
- **Method + Route**: POST /admin/scrapers/install
- **Auth**: None
- **Expected status**: 401
- **Expected response**: {message: Unauthorized, statusCode: 401}
- **curl command**:

    printf 'x' > /tmp/dummy.js
    STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3001/admin/scrapers/install -F 'file=@/tmp/dummy.js')
    echo Status: $STATUS

#### TC-08: POST /admin/scrapers/install - 403 regular user (non-admin)
- **Type**: Security / Regression
- **Method + Route**: POST /admin/scrapers/install
- **Auth**: USER_TOKEN (role: USER, not ADMIN)
- **Expected status**: 403
- **Expected response**: {message: Forbidden resource, error: Forbidden, statusCode: 403}
- **curl command**:

    printf 'x' > /tmp/dummy.js
    curl -s -w '\n--- HTTP %{http_code} ---\n'       -X POST http://localhost:3001/admin/scrapers/install       -H 'Authorization: Bearer $USER_TOKEN'       -F 'file=@/tmp/dummy.js' | jq .

---

### Test Data Created During Execution

| TC | Resource | Description | Cleanup required |
|----|----------|-------------|------------------|
| TC-06 | Plugin file in SCRAPER_PLUGIN_DIR | test-bank.js | Manual delete from plugin dir |
| TC-07, TC-08 | /tmp/dummy.js | Temp file on test runner | rm /tmp/dummy.js |

---

### Testing Gaps / Known Limitations

1. SCRAPER_PLUGIN_DIR not set: TC-06 will receive 400 instead of 201 and must be marked SKIPPED. TC-01 returns [] -- still a valid PASS per the implementation plan.
2. Non-.js upload rejection (400): The controller rejects non-.js files via multer fileFilter. This edge case is outside the Section 12 scope and is omitted from this regression run.
3. dist/ staleness: If nest build has not been run after source changes, the running server reflects pre-refactor compiled code. This is surfaced as a precondition note in the report.
