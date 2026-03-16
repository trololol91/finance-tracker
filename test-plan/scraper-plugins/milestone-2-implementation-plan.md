# Milestone 2 — Dry-run Test Endpoint
# Implementation Plan

**Roadmap source:** `docs/scraper-plugins/roadmap.md`
**Milestone status:** ⬜ Not Started → In Progress
**Date drafted:** 2026-03-15
**Backend-only milestone** — no frontend changes, no Prisma migration, no API contract changes to existing endpoints.

---

## 1. Goal

Give plugin developers a way to call a scraper's `login()` and
`scrapeTransactions()` methods against a live Playwright browser session and
inspect the raw `RawTransaction[]` output, without writing anything to the
database. The endpoint runs synchronously in the main NestJS process (no worker
thread) and is restricted to ADMIN users.

---

## 2. Copy-First Guidance

This milestone extends an existing module rather than introducing a new one.

| Layer | Approach |
|-------|----------|
| DTOs (`TestScraperDto`, `TestScraperResponseDto`) | New files. Copy decoration pattern from `scraper-info.dto.ts` and `install-plugin-response.dto.ts`. |
| `ScraperAdminService.testScraper()` | New method on the existing service. Structurally similar to `installPlugin()` — inject a dependency, validate, delegate, return result. The Playwright lifecycle is new logic. |
| Controller action | Copy `reload()` action as the starting point for guard placement and decorator order. Diverges on: `@Param`, `@Body`, `@ApiParam`, `@ApiBody`. |
| Unit tests | Extend the existing describe blocks in both spec files. Copy the mock setup patterns verbatim. |

The feature does **not** spawn a worker thread. The scraper is called directly
(synchronously from the caller's perspective) using `await`. This is intentional
— the endpoint is a developer tool, not a production sync job.

---

## 3. Files Affected

| File | Change Type | Detail |
|------|-------------|--------|
| `packages/backend/src/scraper/admin/dto/test-scraper.dto.ts` | New | Request body DTO with class-validator decorators |
| `packages/backend/src/scraper/admin/dto/test-scraper-response.dto.ts` | New | Response DTO with `@ApiProperty` on every field |
| `packages/backend/src/scraper/scraper-admin.service.ts` | Modify | Add `testScraper(bankId, dto)` method; add `ScraperRegistry` to constructor |
| `packages/backend/src/scraper/scraper-admin.controller.ts` | Modify | Add `POST /:bankId/test` action; add `Param` and `Body` decorator imports |
| `packages/backend/src/scraper/__TEST__/scraper-admin.service.spec.ts` | Modify | Extend with `testScraper` describe block (4 cases) |
| `packages/backend/src/scraper/__TEST__/scraper-admin.controller.spec.ts` | Modify | Extend with `testScraper` describe block (4 cases) |

### Directory note

`packages/backend/src/scraper/admin/dto/` does not yet exist. The implementing
agent must create both the `admin/` and `admin/dto/` directories implicitly by
creating the two DTO files at those paths.

---

## 4. No Prisma Changes

This milestone touches no schema models, no migrations, and no seed scripts.
The endpoint reads from `ScraperRegistry` (an in-memory map) and calls Playwright
directly. No transaction records are written under any code path.

---

## 5. API Contract

### Endpoint

```
POST /admin/scrapers/:bankId/test
```

### Authentication and Authorisation

Both `JwtAuthGuard` and `AdminGuard` must be satisfied. These are already applied
at the controller class level (`@UseGuards(JwtAuthGuard, AdminGuard)`) and
therefore the new action inherits them automatically — no per-action guards needed.

### Request

**Path parameter**

| Parameter | Type | Description |
|-----------|------|-------------|
| `bankId` | `string` | The `bankId` registered in `ScraperRegistry` (e.g. `cibc`, `td`) |

**Request body** (`application/json`) — `TestScraperDto`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `inputs` | `Record<string, string>` | Yes | Key-value map of credentials/inputs passed to `plugin.login()`. Values are strings (e.g. `{ "username": "user@example.com", "password": "secret" }`). |
| `lookbackDays` | `number` | No | Number of days back to scrape. Defaults to `plugin.maxLookbackDays` when omitted. Must be a positive integer when provided. |

Example request body:

```json
{
  "inputs": {
    "username": "testuser@example.com",
    "password": "hunter2"
  },
  "lookbackDays": 30
}
```

### Response

**200 OK** — `TestScraperResponseDto`

```json
{
  "bankId": "cibc",
  "transactions": [
    {
      "date": "2026-03-01",
      "description": "TIM HORTONS #1234",
      "amount": -4.75,
      "pending": false,
      "syntheticId": "abc123..."
    }
  ],
  "count": 1
}
```

| Field | Type | Description |
|-------|------|-------------|
| `bankId` | `string` | Echoes the `:bankId` path parameter |
| `transactions` | `RawTransaction[]` | Raw rows returned by `plugin.scrapeTransactions()` — no DB deduplication |
| `count` | `number` | `transactions.length` — convenience field |

**Status codes**

| Status | Condition |
|--------|-----------|
| 200 | Scrape completed; `transactions` array returned (may be empty) |
| 400 | Request body fails class-validator validation |
| 401 | Missing or invalid JWT token |
| 403 | Caller does not have the ADMIN role |
| 404 | `bankId` is not registered in `ScraperRegistry` |
| 500 | `plugin.login()` or `plugin.scrapeTransactions()` throws an unexpected error |

---

## 6. Detailed Implementation Steps

### Step 1 — Create `TestScraperDto`

**File:** `packages/backend/src/scraper/admin/dto/test-scraper.dto.ts`

Imports required:
- `IsObject`, `IsOptional`, `IsInt`, `IsPositive` from `class-validator`
- `ApiProperty`, `ApiPropertyOptional` from `@nestjs/swagger`

Shape:

```typescript
import {IsObject, IsOptional, IsInt, IsPositive} from 'class-validator';
import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';

export class TestScraperDto {
    @ApiProperty({
        description: 'Key-value map of inputs passed directly to plugin.login(). ' +
            'Keys and values are plugin-specific (e.g. username, password, card number).',
        example: {username: 'user@example.com', password: 'hunter2'},
        type: 'object',
        additionalProperties: {type: 'string'}
    })
    @IsObject()
    public inputs!: Record<string, string>;

    @ApiPropertyOptional({
        description:
            'Number of calendar days back from today to scrape. ' +
            'Defaults to the plugin\'s maxLookbackDays when omitted. ' +
            'Must be a positive integer.',
        example: 30
    })
    @IsOptional()
    @IsInt()
    @IsPositive()
    public lookbackDays?: number;
}
```

### Step 2 — Create `TestScraperResponseDto`

**File:** `packages/backend/src/scraper/admin/dto/test-scraper-response.dto.ts`

`RawTransaction` is an interface — Swagger cannot introspect it. Use
`@ApiProperty` with `type: 'array'` and an inline `items` schema that
mirrors the `RawTransaction` interface fields explicitly.

```typescript
import {ApiProperty} from '@nestjs/swagger';
import type {RawTransaction} from '#scraper/interfaces/bank-scraper.interface.js';

export class TestScraperResponseDto {
    @ApiProperty({
        description: 'The bankId that was tested — echoes the :bankId path parameter',
        example: 'cibc'
    })
    public bankId!: string;

    @ApiProperty({
        description: 'Raw transaction rows returned by the scraper. No deduplication or DB write is performed.',
        type: 'array',
        items: {
            type: 'object',
            properties: {
                date:        {type: 'string', example: '2026-03-01', description: 'ISO 8601 date'},
                description: {type: 'string', example: 'TIM HORTONS #1234'},
                amount:      {type: 'number', example: -4.75, description: 'Negative = debit, positive = credit'},
                pending:     {type: 'boolean', example: false},
                syntheticId: {type: 'string', example: 'abc123...', description: 'Stable dedup key'}
            }
        }
    })
    public transactions!: RawTransaction[];

    @ApiProperty({
        description: 'Number of transactions returned — convenience field equal to transactions.length',
        example: 1
    })
    public count!: number;
}
```

### Step 3 — Add `ScraperRegistry` to `ScraperAdminService`

**File:** `packages/backend/src/scraper/scraper-admin.service.ts`

#### 3a. New imports

Add to existing imports:
- `NotFoundException` from `@nestjs/common` (alongside `Injectable`, `BadRequestException`, `Logger`)
- `ScraperRegistry` from `#scraper/scraper.registry.js`
- `chromium` from `playwright` — use a dynamic import inside the method body
  to avoid a hard top-level dependency that would break the test suite unless
  Playwright is installed. See Step 3c for the pattern.
- `TestScraperDto` from `#scraper/admin/dto/test-scraper.dto.js`
- `TestScraperResponseDto` from `#scraper/admin/dto/test-scraper-response.dto.js`
- `RawTransaction` (type-only) from `#scraper/interfaces/bank-scraper.interface.js`

#### 3b. Constructor update

Add `ScraperRegistry` as a constructor parameter:

```typescript
constructor(
    private readonly config: ConfigService,
    private readonly pluginLoader: ScraperPluginLoader,
    private readonly registry: ScraperRegistry
) {}
```

`ScraperRegistry` is already provided in `ScraperModule` — no module-level
change is required. NestJS will inject it automatically once it appears in
the constructor.

#### 3c. `testScraper()` method

```typescript
public async testScraper(
    bankId: string,
    dto: TestScraperDto
): Promise<TestScraperResponseDto>
```

**Full logic:**

1. Call `this.registry.findByBankId(bankId)`. If the result is `undefined`,
   throw `new NotFoundException(`No scraper registered for bankId '${bankId}'`)`.

2. Resolve `lookbackDays`:
   ```typescript
   const lookbackDays = dto.lookbackDays ?? plugin.maxLookbackDays;
   ```

3. Compute date range from `lookbackDays`:
   ```typescript
   const endDate   = new Date();
   const startDate = new Date(endDate.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
   ```

4. Open a Playwright browser. This must use the exact same launch options as
   the Phase 8 worker comment (see `scraper.worker.ts` lines 50–51):
   ```typescript
   const {chromium} = await import('playwright');
   const browser = await chromium.launch({headless: true});
   const page    = await browser.newPage();
   ```
   Use a dynamic `import('playwright')` rather than a top-level import. This
   matches the pattern from the worker comment block and means the test suite
   can mock `playwright` at the module level without Playwright being installed
   in the test environment.

5. Declare `transactions: RawTransaction[] = []` before the `try` block.

6. In the `try` block:
   ```typescript
   await plugin.login(page, dto.inputs as unknown as BankCredentials);
   transactions = await plugin.scrapeTransactions(page, {
       startDate,
       endDate,
       includePending: plugin.pendingTransactionsIncluded
   });
   ```
   The `dto.inputs` value is cast to `BankCredentials` via `as unknown as
   BankCredentials`. This is safe because Milestone 4 will replace
   `BankCredentials` with `PluginInputs = Record<string, string>` — until then
   the cast bridges the type mismatch without a breaking change to the existing
   interface. Add a comment explaining this:
   ```typescript
   // Milestone 4 will replace BankCredentials with PluginInputs = Record<string, string>.
   // Until then, cast is safe: dto.inputs is Record<string, string> and all built-in
   // scrapers destructure only { username, password } from the credentials argument.
   ```

7. In the `finally` block (always executes):
   ```typescript
   await browser.close();
   ```

8. Return the response DTO:
   ```typescript
   return {bankId, transactions, count: transactions.length};
   ```

**Complete method skeleton:**

```typescript
public async testScraper(
    bankId: string,
    dto: TestScraperDto
): Promise<TestScraperResponseDto> {
    const plugin = this.registry.findByBankId(bankId);
    if (!plugin) {
        throw new NotFoundException(`No scraper registered for bankId '${bankId}'`);
    }

    const lookbackDays = dto.lookbackDays ?? plugin.maxLookbackDays;
    const endDate      = new Date();
    const startDate    = new Date(endDate.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

    const {chromium} = await import('playwright');
    const browser = await chromium.launch({headless: true});
    const page    = await browser.newPage();

    let transactions: RawTransaction[] = [];

    try {
        // Milestone 4 will replace BankCredentials with PluginInputs = Record<string, string>.
        // Until then, cast is safe: dto.inputs is Record<string, string> and all built-in
        // scrapers destructure only { username, password } from the credentials argument.
        await plugin.login(page, dto.inputs as unknown as BankCredentials);
        transactions = await plugin.scrapeTransactions(page, {
            startDate,
            endDate,
            includePending: plugin.pendingTransactionsIncluded
        });
    } finally {
        await browser.close();
    }

    this.logger.log(
        `Dry-run scrape for '${bankId}' returned ${transactions.length} transaction(s)`
    );

    return {bankId, transactions, count: transactions.length};
}
```

### Step 4 — Add `POST /:bankId/test` to `ScraperAdminController`

**File:** `packages/backend/src/scraper/scraper-admin.controller.ts`

#### 4a. New imports

Add to the existing import from `@nestjs/common`:
- `Param`
- `Body`

Add to the existing import from `@nestjs/swagger`:
- `ApiParam`

Add new import lines:
```typescript
import {TestScraperDto} from '#scraper/admin/dto/test-scraper.dto.js';
import {TestScraperResponseDto} from '#scraper/admin/dto/test-scraper-response.dto.js';
```

#### 4b. New action

Add after the `install()` action. The class-level `@UseGuards(JwtAuthGuard, AdminGuard)`
already covers this action — no per-action guard decorator is needed.

```typescript
/**
 * POST /admin/scrapers/:bankId/test
 *
 * Run a full login + scrape cycle for the given bankId using the provided
 * inputs, and return the raw RawTransaction[] without writing to the database.
 * Intended as a developer tool for validating plugin correctness.
 */
@Post(':bankId/test')
@HttpCode(HttpStatus.OK)
@ApiOperation({
    summary: 'Dry-run a scraper plugin',
    description:
        'Opens a Playwright browser, calls plugin.login() with the provided inputs, ' +
        'then calls plugin.scrapeTransactions() for the specified lookback period. ' +
        'Returns the raw RawTransaction[] with no database write. ' +
        'Requires ADMIN role. Returns 404 if bankId is not registered.'
})
@ApiParam({
    name: 'bankId',
    description: 'Unique bank identifier registered in ScraperRegistry (e.g. cibc, td)',
    example: 'cibc'
})
@ApiBody({type: TestScraperDto})
@ApiResponse({
    status: 200,
    description: 'Scrape completed. Raw transactions returned.',
    type: TestScraperResponseDto
})
@ApiResponse({status: 400, description: 'Request body fails validation'})
@ApiResponse({status: 401, description: 'Missing or invalid JWT token'})
@ApiResponse({status: 403, description: 'Caller is not an ADMIN user'})
@ApiResponse({status: 404, description: 'No scraper registered for the given bankId'})
public async testScraper(
    @Param('bankId') bankId: string,
    @Body() dto: TestScraperDto
): Promise<TestScraperResponseDto> {
    return this.adminService.testScraper(bankId, dto);
}
```

---

## 7. Playwright Browser Lifecycle

The Phase 8 comment block in `scraper.worker.ts` (lines 50–84) is the
canonical reference for the browser lifecycle pattern. The exact options are:

```typescript
const browser = await chromium.launch({headless: true});
const page    = await browser.newPage();
```

No additional `args` or `executablePath` overrides are specified in the
comment. The `testScraper()` method must replicate this exactly.

**Lifecycle contract:**

- `browser` is opened immediately after the `NotFoundException` guard passes.
- `page` is obtained from `browser.newPage()` before entering `try`.
- The `try` block calls `login()` then `scrapeTransactions()`.
- The `finally` block always calls `await browser.close()`.
- If `login()` throws, `scrapeTransactions()` is not called. The error
  propagates after `finally` closes the browser.
- If `scrapeTransactions()` throws, the error propagates after `finally`
  closes the browser.
- No browser handle can escape the method — the `browser` variable is local.

**Why dynamic `import('playwright')` rather than a top-level import:**

Top-level import of `playwright` would require the package to be importable
in the Vitest test environment. Using a dynamic import inside the method body
allows tests to mock `playwright` at the vi.mock level (or to stub the entire
`testScraper()` method on the service mock used by the controller test) without
needing a real Playwright binary in CI. This is the same pattern implied by
the `/* v8 ignore file */` pragma on `scraper.worker.ts`.

---

## 8. Unit Test Cases

### 8a. Service spec — `scraper-admin.service.spec.ts`

**Setup additions required:**

The existing `beforeEach` constructs `ScraperAdminService` with two arguments:
`mockConfig` and `mockLoader`. The constructor now has a third argument —
`ScraperRegistry`. Add a `mockRegistry` object to `beforeEach`:

```typescript
let mockRegistry: {findByBankId: ReturnType<typeof vi.fn>};

beforeEach(() => {
    vi.clearAllMocks();

    mockConfig   = {get: vi.fn()};
    mockLoader   = {loadPlugins: vi.fn().mockResolvedValue(undefined)};
    mockRegistry = {findByBankId: vi.fn()};

    service = new ScraperAdminService(
        mockConfig as unknown as ConfigService,
        mockLoader as unknown as ScraperPluginLoader,
        mockRegistry as unknown as ScraperRegistry
    );
});
```

**Mock Playwright at module level.** Add before the `describe` block:

```typescript
vi.mock('playwright', () => ({
    chromium: {
        launch: vi.fn()
    }
}));

import {chromium} from 'playwright';
```

**Helper factory inside `describe('testScraper')`:**

```typescript
const makeMockPlugin = (overrides?: Partial<BankScraper>): BankScraper => ({
    bankId: 'cibc',
    displayName: 'CIBC',
    requiresMfaOnEveryRun: true,
    maxLookbackDays: 90,
    pendingTransactionsIncluded: true,
    login: vi.fn().mockResolvedValue(undefined),
    scrapeTransactions: vi.fn().mockResolvedValue([]),
    ...overrides
} as unknown as BankScraper);

const makeMockBrowser = () => {
    const mockPage    = {};
    const mockBrowser = {
        newPage: vi.fn().mockResolvedValue(mockPage),
        close:   vi.fn().mockResolvedValue(undefined)
    };
    vi.mocked(chromium.launch).mockResolvedValue(mockBrowser as unknown as Browser);
    return {mockBrowser, mockPage};
};
```

**Test cases:**

```
describe('testScraper', () => {

    TC-SRV-1: Happy path
    it('should call plugin.login() and plugin.scrapeTransactions() with correct arguments')
    - mockRegistry.findByBankId returns a mock plugin
    - makeMockBrowser() sets up the browser mock
    - dto = { inputs: { username: 'u', password: 'p' } }
    - await service.testScraper('cibc', dto)
    - expect plugin.login to have been called with (mockPage, dto.inputs)
    - expect plugin.scrapeTransactions to have been called with:
        (mockPage, { startDate: expect.any(Date), endDate: expect.any(Date), includePending: true })

    TC-SRV-2: Result shape is correct
    it('should return { bankId, transactions, count } without DB write')
    - plugin.scrapeTransactions returns [{ date: '2026-01-01', description: 'Test', amount: -10, pending: false, syntheticId: 'x' }]
    - result = await service.testScraper('cibc', { inputs: {} })
    - expect(result).toEqual({ bankId: 'cibc', transactions: [...], count: 1 })

    TC-SRV-3: lookbackDays defaults to plugin.maxLookbackDays
    it('should use plugin.maxLookbackDays when lookbackDays is not provided in dto')
    - plugin.maxLookbackDays = 90
    - dto has no lookbackDays
    - call testScraper
    - capture the startDate passed to scrapeTransactions
    - assert Math.round((endDate - startDate) / 86400000) === 90 (within 1 day tolerance)

    TC-SRV-4: lookbackDays from dto overrides plugin default
    it('should use dto.lookbackDays when provided')
    - plugin.maxLookbackDays = 90; dto.lookbackDays = 7
    - capture startDate passed to scrapeTransactions
    - assert window is approximately 7 days

    TC-SRV-5: bankId not registered — NotFoundException
    it('should throw NotFoundException when bankId is not in the registry')
    - mockRegistry.findByBankId returns undefined
    - await expect(service.testScraper('unknown', { inputs: {} })).rejects.toThrow(NotFoundException)
    - expect(chromium.launch).not.toHaveBeenCalled()   // browser never opened

    TC-SRV-6: login() throws — error propagates, browser closed
    it('should close the browser and propagate the error when login() throws')
    - plugin.login throws new Error('Login failed')
    - await expect(service.testScraper('cibc', dto)).rejects.toThrow('Login failed')
    - expect(mockBrowser.close).toHaveBeenCalledOnce()

    TC-SRV-7: scrapeTransactions() throws — error propagates, browser closed
    it('should close the browser and propagate the error when scrapeTransactions() throws')
    - plugin.scrapeTransactions throws new Error('Scrape failed')
    - await expect(service.testScraper('cibc', dto)).rejects.toThrow('Scrape failed')
    - expect(mockBrowser.close).toHaveBeenCalledOnce()

    TC-SRV-8: browser.close() is always called on success
    it('should always close the browser on a successful run')
    - happy-path setup
    - await service.testScraper('cibc', dto)
    - expect(mockBrowser.close).toHaveBeenCalledOnce()
});
```

### 8b. Controller spec — `scraper-admin.controller.spec.ts`

**Setup additions required:**

Add `testScraper` to the mock service shape:

```typescript
mockService = {
    reloadPlugins:  vi.fn().mockResolvedValue(undefined),
    installPlugin:  vi.fn(),
    testScraper:    vi.fn()   // <-- new
};
```

**Test cases:**

```
describe('testScraper', () => {

    TC-CTL-1: Delegates to service and returns 200 response shape
    it('should call adminService.testScraper with bankId and dto and return the result')
    - dto = { inputs: { username: 'u', password: 'p' } }
    - mockService.testScraper.mockResolvedValue({
          bankId: 'cibc',
          transactions: [],
          count: 0
      })
    - result = await controller.testScraper('cibc', dto)
    - expect(mockService.testScraper).toHaveBeenCalledWith('cibc', dto)
    - expect(result).toEqual({ bankId: 'cibc', transactions: [], count: 0 })

    TC-CTL-2: Propagates NotFoundException (→ 404)
    it('should propagate NotFoundException from adminService.testScraper')
    - mockService.testScraper.mockRejectedValue(new NotFoundException('No scraper for cibc'))
    - await expect(controller.testScraper('cibc', dto)).rejects.toThrow(NotFoundException)

    TC-CTL-3: Non-empty transactions are passed through
    it('should return all transactions returned by the service without modification')
    - mockService.testScraper.mockResolvedValue({
          bankId: 'td',
          transactions: [
              { date: '2026-03-01', description: 'Coffee', amount: -3.50, pending: false, syntheticId: 'x' }
          ],
          count: 1
      })
    - result = await controller.testScraper('td', { inputs: {} })
    - expect(result.count).toBe(1)
    - expect(result.transactions).toHaveLength(1)

    TC-CTL-4: Propagates unexpected errors
    it('should propagate unexpected errors from adminService.testScraper')
    - mockService.testScraper.mockRejectedValue(new Error('Playwright crashed'))
    - await expect(controller.testScraper('cibc', dto)).rejects.toThrow('Playwright crashed')
});
```

**Note on 401 / 403 guard tests:**

Guards are applied at the class level via `@UseGuards(JwtAuthGuard, AdminGuard)`.
The controller spec constructs the controller directly (`new ScraperAdminController(mockService)`)
and calls methods directly — NestJS guards are not executed in this style of
unit test. The 401 and 403 cases are therefore covered by the **backend API
test plan** (Section 9), not by the unit spec. This is consistent with the
existing controller spec, which also does not test guard behaviour.

---

## 9. Backend API Test Plan

Save the executed plan to `test-plan/scraper-plugins/milestone-2-backend.md`
and the execution report to `test-plan/scraper-plugins/milestone-2-backend-report.md`.

### Preconditions

- Backend running at `http://localhost:3001`
- At least one scraper registered in `ScraperRegistry` (e.g. `cibc` — requires
  `SCRAPER_PLUGIN_DIR` to be set and the seeded plugin files to have loaded)
- An ADMIN user JWT token available (obtained via `POST /auth/login`)
- A USER-role JWT token available (a second account with role `USER`)
- Playwright is installed (`npx playwright install chromium`) — the endpoint
  will attempt a real browser launch; if Playwright binaries are absent the
  test should assert a 500 error shape rather than skipping

### Test Cases

| # | Method | Route | Auth | Body | Expected Status | Assert |
|---|--------|-------|------|------|-----------------|--------|
| TC-API-1 | POST | `/admin/scrapers/cibc/test` | None | `{ "inputs": {} }` | 401 | `{ statusCode: 401 }` |
| TC-API-2 | POST | `/admin/scrapers/cibc/test` | USER token | `{ "inputs": {} }` | 403 | `{ statusCode: 403 }` |
| TC-API-3 | POST | `/admin/scrapers/unknown-bank/test` | ADMIN token | `{ "inputs": {} }` | 404 | `message` contains `'unknown-bank'` |
| TC-API-4 | POST | `/admin/scrapers/cibc/test` | ADMIN token | `{}` (no `inputs`) | 400 | `message` array includes validation error for `inputs` |
| TC-API-5 | POST | `/admin/scrapers/cibc/test` | ADMIN token | `{ "inputs": {}, "lookbackDays": -1 }` | 400 | `message` includes positive integer error for `lookbackDays` |
| TC-API-6 | POST | `/admin/scrapers/cibc/test` | ADMIN token | `{ "inputs": {}, "lookbackDays": 1.5 }` | 400 | `message` includes integer error for `lookbackDays` |
| TC-API-7 | POST | `/admin/scrapers/cibc/test` | ADMIN token | `{ "inputs": { "username": "x", "password": "y" }, "lookbackDays": 1 }` | 200 or 500 | **200:** body has `bankId` (string), `transactions` (array), `count` (number `=== transactions.length`). **500:** accepted if Playwright binary is absent in test env — assert `{ statusCode: 500 }`. Do not assert transaction content. |

### Response Shape Assertions (TC-API-7 on 200)

```
expect(body).toMatchObject({
    bankId: 'cibc',
    transactions: expect.any(Array),
    count: expect.any(Number)
})
expect(body.count).toBe(body.transactions.length)
```

---

## 10. Interaction with Existing Code

### `ScraperModule` providers

`ScraperRegistry` is already listed as a provider in `ScraperModule` and
exported. `ScraperAdminService` is also a provider in the same module, so NestJS
can inject `ScraperRegistry` into it automatically with no module-level changes.

Confirm this by reading `scraper.module.ts` before implementing. The only
constructor change is in the service — no module file edit is required.

### `BankCredentials` vs `Record<string, string>`

`BankScraper.login()` currently accepts `BankCredentials` (`{ username: string, password: string }`).
`TestScraperDto.inputs` is `Record<string, string>` — a superset that does not
share the typed structure. The cast `dto.inputs as unknown as BankCredentials`
in the service method bridges this without changing the interface.

Milestone 4 (`Plugin Input Schema`) will replace `BankCredentials` with
`PluginInputs = Record<string, string>` across the board, at which point the
cast can be removed and `TestScraperDto.inputs` can be used directly.

### `ScraperService` worker pattern

`ScraperService.sync()` spawns a worker thread via `new Worker(workerPath, {workerData})`.
`testScraper()` does **not** use a worker thread. It runs in the main process
because:
- It is a synchronous developer tool — not a background job.
- No SSE plumbing is needed.
- No `SyncJob` record is created.
- No `SyncSchedule.lastRunAt` is updated.

This diverges intentionally from `ScraperService.sync()`.

---

## 11. Breaking Changes and Migration Notes

No breaking changes. All existing endpoints and their contracts are unchanged.

The only observable change is the addition of:
- `POST /admin/scrapers/:bankId/test` — new endpoint
- Two new DTO files under `scraper/admin/dto/`

No database migration is required. No environment variable changes are required.
No frontend changes are required.

---

## 12. Recommended Agent Sequence

This is a backend-only milestone with no frontend changes and no Figma brief.

1. `backend-dev` — implement Steps 1–4 (DTOs, service method, controller action)
2. `test-writer` — extend `scraper-admin.service.spec.ts` and
   `scraper-admin.controller.spec.ts` with the cases in Section 8
3. `backend-tester` — run the API test plan from Section 9 against the live server;
   save plan to `test-plan/scraper-plugins/milestone-2-backend.md` and report to
   `test-plan/scraper-plugins/milestone-2-backend-report.md`
4. `code-reviewer` — review all changes in `packages/backend/src/scraper/`;
   focus checklist is in `docs/scraper-plugins/roadmap.md` Step 5
5. `backend-dev` — commit: `feat(scraper): add dry-run test endpoint POST /admin/scrapers/:bankId/test`
