# Development Roadmap - Finance Tracker Backend

This document outlines the implementation order for building the Finance Tracker backend with multi-user support.

## Design Decision

**Architecture:** Multi-user from the start
**Reason:** Financial data requires strict user isolation. Retrofitting multi-user later is extremely difficult and error-prone.

## Current State

- ✅ Docker + PostgreSQL setup complete
- ✅ NestJS scaffolding in place
- ⚠️ Users module exists (stub with mock data)
- ⚠️ Transactions module exists (stub with mock data, no user association)
- ❌ No database integration
- ❌ No authentication
- ❌ No ORM configured

## Implementation Order

### Standard Checklist for Each Phase

**Every phase should complete these tasks to maintain quality and consistency:**

#### ✅ **Core Implementation**
- [ ] Business logic implemented in service layer
- [ ] Controller with proper HTTP methods and status codes
- [ ] DTOs with class-validator decorators
- [ ] All imports use path aliases (no relative imports)

#### ✅ **Documentation**
- [ ] Swagger decorators on all endpoints (`@ApiOperation`, `@ApiResponse`, `@ApiParam`, `@ApiBody`)
- [ ] Swagger decorators on all DTOs (`@ApiProperty` with descriptions and examples)
- [ ] Added to appropriate `@ApiTags` group
- [ ] Test endpoints in Swagger UI

#### ✅ **Testing**
- [ ] Unit tests for service (business logic)
- [ ] Unit tests for controller (endpoint behavior)
- [ ] Test error cases (404, 400, 409, etc.)
- [ ] All tests passing (`npm test`)
- [ ] No linting errors (`npm run lint`)

#### ✅ **Security & Validation**
- [ ] Input validation on all DTOs
- [ ] Response DTOs exclude sensitive fields
- [ ] Authentication guards applied (if needed)
- [ ] User data scoped by userId (if applicable)
- [ ] SQL injection prevention (parameterized queries)

#### ✅ **Database**
- [ ] Prisma schema updated (if needed)
- [ ] Migration created (`npx prisma migrate dev`)
- [ ] Migration tested on fresh database
- [ ] Foreign key relationships correct

---

### Phase 1: Database Setup & Users Module ✅ **COMPLETE**

**Priority:** CRITICAL - Foundation for everything else

**Tasks:**
1. **~~Choose and Configure ORM~~** ✅
   - ✅ Prisma installed and configured
   - ✅ Database connection configured
   - ✅ Connected to Docker PostgreSQL

2. **~~Define User Model in Prisma Schema~~** ✅ (`prisma/schema.prisma`)
   - ✅ User model created with all fields
   - ✅ UserRole enum (USER, ADMIN)
   - ✅ Migration created and applied
   - ✅ Prisma Client generated (types available in `@generated/prisma`)
   - **Note:** No entity files needed - Prisma generates types automatically

3. **~~Create User DTOs~~** ✅ (`src/users/dto/`)
   - ✅ `create-user.dto.ts` - email, password, firstName, lastName, timezone, currency
   - ✅ `update-user.dto.ts` - partial update fields (firstName, lastName, timezone, currency, isActive)
   - ✅ `user-response.dto.ts` - excludes passwordHash and deletedAt
   - ✅ All with proper class-validator decorators
   - ✅ All with Swagger `@ApiProperty` decorators

4. **~~Implement Users Service~~** ✅ (`src/users/users.service.ts`)
   - ✅ `create(createUserDto)` - hash password with bcrypt (saltRounds: 10), save to DB
   - ✅ `findOne(id)` - get user by ID (excludes soft-deleted users)
   - ✅ `findByEmail(email)` - for authentication (excludes soft-deleted users)
   - ✅ `update(id, updateUserDto)` - update user info
   - ✅ `remove(id)` - soft delete (sets deletedAt timestamp and isActive=false)

5. **~~Implement Users Controller~~** ✅ (`src/users/users.controller.ts`)
   - ✅ POST `/users` - register new user (public for now)
   - ✅ GET `/users/:id` - get user profile
   - ✅ PATCH `/users/:id` - update user
   - ✅ DELETE `/users/:id` - soft delete user
   - ✅ All endpoints return UserResponseDto (excludes sensitive fields)
   - ✅ Proper HTTP status codes (201 for create, 204 for delete)
   - ✅ Full Swagger documentation

**Testing & Documentation:** ✅
- ✅ 22 unit tests (15 service, 7 controller) - all passing
- ✅ Swagger UI configured with JWT auth support
- ✅ All endpoints documented and testable in Swagger

**Deployment & Security:** ✅
- ✅ Production-ready Dockerfile with Prisma support
- ✅ docker-compose.yml with auto-migrations
- ✅ Secure environment variable configuration (no defaults)
- ✅ DEPLOYMENT.md with security checklist

**Validation:**
- ✅ Test user creation via API
- ✅ Verify password is hashed in database
- ✅ Confirm email uniqueness constraint works

**Estimated Time:** 1-2 days

---

### Phase 2: Authentication Module ✅ **COMPLETE**

**Priority:** HIGH - Required before securing any endpoints

**Tasks:**
1. **~~Install Dependencies~~** ✅
   ```bash
   npm install @nestjs/passport @nestjs/jwt passport passport-jwt
   npm install -D @types/passport-jwt
   ```

2. **~~Create Auth Module~~** ✅ (`src/auth/`)
   - ✅ `auth.module.ts`
   - ✅ `auth.service.ts`
   - ✅ `auth.controller.ts`
   - ✅ `strategies/jwt.strategy.ts`
   - ✅ `guards/jwt-auth.guard.ts`
   - ✅ `decorators/current-user.decorator.ts`

3. **~~Implement Auth Service~~** ✅ (`src/auth/auth.service.ts`)
   - ✅ `register(createUserDto)` - create user + return JWT
   - ✅ `login(email, password)` - validate credentials + return JWT
   - ✅ `validateUser(email, password)` - check password hash
   - ✅ `generateToken(user)` - create JWT with user.id payload

4. **~~Create JWT Strategy~~** ✅ (`src/auth/strategies/jwt.strategy.ts`)
   - ✅ Extract JWT from Authorization header
   - ✅ Validate token signature
   - ✅ Load user from database
   - ✅ Attach user to request object

5. **~~Create Guards & Decorators~~** ✅
   - ✅ `jwt-auth.guard.ts` - protect routes requiring authentication
   - ✅ `current-user.decorator.ts` - extract user from request
   - Optional: `roles.guard.ts` - for future role-based access

6. **~~Implement Auth Controller~~** ✅ (`src/auth/auth.controller.ts`)
   - ✅ POST `/auth/register` - create new user account
   - ✅ POST `/auth/login` - authenticate and get JWT
   - ✅ GET `/auth/me` - get current user info (protected)

7. **~~Environment Configuration~~** ✅
   - ✅ JWT_SECRET already in .env
   - ✅ Configure token expiration (e.g., 7 days)
   - Set up refresh token strategy (optional for v1)

**Phase 2 Checklist:** (Use Standard Checklist above)
- [x] **Core:** Auth service, controller, DTOs, guards, decorators implemented
- [x] **Documentation:** Swagger decorators on auth endpoints, test login/register in Swagger UI
- [x] **Testing:** Unit tests for auth service and controller (token generation, validation, login flow)
- [x] **Security:** JWT properly configured, tokens validated, passwords compared with bcrypt
- [x] **Database:** No schema changes needed (uses existing User model)

**Testing & Documentation:** ✅
- ✅ 29 unit tests (14 service, 10 controller, 5 strategy) - all passing
- ✅ Swagger decorators on all endpoints with examples
- ✅ JWT auth support via "Authorize" button

**Validation:**
- ✅ Register new user and receive JWT
- ✅ Login with credentials and receive JWT
- ✅ Access protected route with valid JWT
- ✅ Verify invalid JWT is rejected
- ✅ Test @CurrentUser() decorator
- ✅ Test in Swagger UI with "Authorize" button

**Estimated Time:** 1-2 days

---

### Phase 3: Secure Users Module ✅ **COMPLETE**

**Priority:** HIGH - Lock down user endpoints

**Tasks:**
1. **~~Add Guards to Users Controller~~** ✅
   - ✅ Protect all endpoints except initial registration
   - ✅ Use `@UseGuards(JwtAuthGuard)`
   - ✅ Add `@CurrentUser()` to endpoints
   - ✅ POST /users remains public (registration)
   - ✅ GET, PATCH, DELETE require JWT authentication
   - ✅ All protected endpoints return 401 without token
   - ✅ Swagger updated with `@ApiBearerAuth()` decorator

2. **~~Implement Ownership Guards~~** ✅
   - ✅ Users can only view/update their own profile
   - ✅ Created `OwnershipGuard` to check `user.id === params.id`
   - ✅ Admin role exception implemented (future enhancement ready)
   - ✅ Applied to GET, PATCH, DELETE endpoints
   - ✅ Returns 403 Forbidden when accessing other users' resources
   - ✅ 8 tests for OwnershipGuard (100% coverage)

3. **~~Update Users Service~~** ✅
   - ✅ All methods require authenticated user ID parameter
   - ✅ Service enforces ownership validation (defense-in-depth)
   - ✅ `findOne(authenticatedUserId, targetUserId)` - verifies ownership
   - ✅ `update(authenticatedUserId, targetUserId, dto)` - verifies ownership
   - ✅ `remove(authenticatedUserId, targetUserId)` - verifies ownership
   - ✅ Throws ForbiddenException when users try to access other users' data
   - ✅ 3 additional tests for ownership enforcement at service layer
   - ✅ 85 total tests passing (18 users service, 7 users controller)

**Phase 3 Checklist:** ✅ **COMPLETE**
- [x] **Core:** Guards implemented and applied to Users controller, service layer enforces ownership
- [x] **Documentation:** Swagger updated with `@ApiBearerAuth()` decorator
- [x] **Testing:** Unit tests for ownership validation, unauthorized access attempts (85 tests passing)
- [x] **Security:** All endpoints protected except public registration, ownership verified at guard and service layers
- [x] **Database:** No changes needed

**Validation:** ✅
- ✅ Cannot access other users' profiles (enforced at guard and service layers)
- ✅ Cannot update other users' data (ForbiddenException thrown)
- ✅ Unauthenticated requests are rejected (401 Unauthorized)
- ✅ Ownership violations return 403 Forbidden
- ✅ Swagger "Authorize" button works correctly
- ✅ 97.43% code coverage maintained

**Estimated Time:** 0.5-1 day → **Actual: 1 day**

---

### Phase 4: Transactions Module with User Context

**Priority:** HIGH - Core business logic

**Tasks:**
1. **~~Define Transaction Model in Prisma Schema~~** ✅ (`prisma/schema.prisma`)
   ```typescript
   - id: UUID (primary key)
   - user_id: UUID (foreign key to users, not null)
   - amount: decimal(10,2) (not null)
   - description: string
   - notes: string (optional, for additional comments/details)
   - category_id: UUID (foreign key to categories, optional)
   - account_id: UUID (foreign key to accounts, optional)
   - transaction_type: enum ('income', 'expense', 'transfer')
   - date: timestamp (transaction date, can be updated)
   - original_date: timestamp (initial transaction date, set on creation, immutable)
   - is_active: boolean (default true, false to exclude from calculations)
   - created_at: timestamp
   - updated_at: timestamp
   ```
   - ✅ `TransactionType` enum added (`income`, `expense`, `transfer`)
   - ✅ `Transaction` model with all fields, proper column mapping
   - ✅ Indexes on `(user_id)`, `(user_id, date)`, `(user_id, is_active)`
   - ✅ Foreign key to `users` table
   - ✅ `category_id` / `account_id` as nullable UUIDs (relations added in Phases 5/6)
   - ✅ Migration `20260226054612_add_transactions_table` created and applied
   - ✅ User model updated with `transactions` relation

2. **Create Transaction DTOs** (`src/transactions/dto/`) ✅
   - ✅ `create-transaction.dto.ts` - amount, description, notes, category, account, type, date
   - ✅ `update-transaction.dto.ts` - partial updates (amount, description, notes, category, account, date, is_active)
   - ✅ `transaction-response.dto.ts` - with category/account details, includes date, original_date, is_active
   - ✅ `transaction-filter.dto.ts` - date ranges, categories, amounts, type, is_active filter
   - ✅ `transaction-totals-response.dto.ts` - total income, total expense, net total, date range

3. **Implement Transactions Service** (`src/transactions/transactions.service.ts`) ✅
   - ✅ All methods require `userId` parameter
   - ✅ `create(userId, createDto)` - create transaction for user (is_active defaults to true, original_date set from date)
   - ✅ `findAll(userId, filters)` - get user's transactions with filters (default: active only)
   - ✅ `findOne(userId, transactionId)` - get specific transaction
   - ✅ `update(userId, transactionId, updateDto)` - update transaction (including notes and is_active, can update date but original_date remains unchanged)
   - ✅ `toggleActive(userId, transactionId)` - toggle is_active status
   - ✅ `remove(userId, transactionId)` - delete transaction (permanent)
   - ✅ `getTotals(userId, startDate, endDate)` - aggregation query for date range (active transactions only)
   - ✅ `getMonthlyTotals(userId, year, month)` - convenience method, calls getTotals with month boundaries

4. **Implement Transactions Controller** (`src/transactions/transactions.controller.ts`) ✅
   - ✅ Protect all routes with `@UseGuards(JwtAuthGuard)`
   - ✅ Use `@CurrentUser()` to get authenticated user
   - ✅ POST `/transactions` - create transaction
   - ✅ GET `/transactions` - list with filters (supports ?is_active=true/false/all)
   - ✅ GET `/transactions/:id` - get specific transaction
   - ✅ GET `/transactions/totals` - get totals by date range (?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD)
   - ✅ GET `/transactions/totals/:year/:month` - monthly totals (convenience endpoint)
   - ✅ PATCH `/transactions/:id` - update transaction (including notes and is_active)
   - ✅ PATCH `/transactions/:id/toggle-active` - toggle is_active status
   - ✅ DELETE `/transactions/:id` - delete transaction permanently

5. **~~Add Ownership Validation~~** ✅
   - ✅ Verify transaction belongs to current user — `findFirst({where: {id, userId}})` in service
   - ✅ Return 404 if transaction doesn't exist or belongs to another user — `NotFoundException` thrown when `findFirst` returns null
   - ✅ Never expose other users' data — all queries and aggregations scoped by `userId`
   - ✅ `update`, `toggleActive`, and `remove` all call `findOne(userId, id)` before mutating

**Phase 4 Checklist:** ✅ **COMPLETE**
- [x] **Core:** Transaction service, controller, DTOs implemented with user scoping
- [x] **Documentation:** Swagger decorators on all endpoints, test in Swagger UI with auth token
- [x] **Testing:** Unit tests for CRUD, filtering, ownership validation, aggregation queries (52 service + 19 controller)
- [x] **Security:** All endpoints protected with JwtAuthGuard, userId scoping enforced at service layer
- [x] **Database:** Prisma schema updated, migration created with user_id foreign key

**Validation:**
- Create transaction as authenticated user with notes
- List only own transactions (active by default)
- Filter by is_active status (true/false/all)
- Cannot access other users' transactions
- Filters work correctly (date range, category, amount, status)
- Update/delete only own transactions
- Toggle transaction active status
- Update transaction date - original_date remains unchanged
- Response includes both date and original_date fields
- Inactive transactions excluded from monthly totals
- Get totals for custom date range (active only)
- Monthly totals endpoint works as convenience method
- Totals calculate correctly (income, expense, net)

**Estimated Time:** 2-3 days

---

### Phase 5: Categories Module

**Priority:** MEDIUM - Needed for transaction organization

**Tasks:**
1. **Define Categories Model in Prisma Schema** (`prisma/schema.prisma`)
   ```typescript
   - id: UUID
   - user_id: UUID (foreign key)
   - name: string
   - type: enum ('income', 'expense')
   - color: string (hex color for UI)
   - icon: string (icon identifier)
   - parent_category_id: UUID (for subcategories)
   - created_at: timestamp
   - updated_at: timestamp
   ```

2. **Implement Categories CRUD**
   - User-scoped categories
   - Optional: System default categories + user custom
   - Support for nested categories

3. **Update Transactions**
   - Add category relationship
   - Validate category belongs to same user

**Phase 5 Checklist:** Apply Standard Checklist (Core, Documentation, Testing, Security, Database)

**Estimated Time:** 1-2 days

---

### Phase 6: Accounts Module

**Priority:** LOW - Track multiple accounts

**Tasks:**
1. **Define Accounts Model in Prisma Schema** (`prisma/schema.prisma`)
   ```typescript
   - id: UUID
   - user_id: UUID
   - name: string (e.g., "Chase Checking")
   - type: enum ('checking', 'savings', 'credit', 'investment', 'cash')
   - balance: decimal(10,2)
   - currency: string (default 'USD')
   - institution: string (optional)
   - account_number: string (encrypted, optional)
   - created_at: timestamp
   - updated_at: timestamp
   ```

2. **Implement Accounts CRUD**
   - User-scoped accounts
   - Track current balance
   - Update balance on transaction create/update/delete

3. **Update Transactions**
   - Add account relationship
   - Support transfers between accounts

**Phase 6 Checklist:** Apply Standard Checklist (Core, Documentation, Testing, Security, Database)

**Estimated Time:** 1-2 days

---

### Phase 7: Transaction Import & Automated Sync

**Priority:** MEDIUM - Load real transaction data from file uploads or fully automated scheduled sync

**Tasks:**
1. **Define Import + Sync Schedule Models in Prisma Schema** (`prisma/schema.prisma`)
   ```typescript
   // TransactionImport — tracks each import run
   - id: UUID
   - user_id: UUID (foreign key)
   - source: enum ('csv', 'ofx', 'scraper', 'api')
   - filename: string (original filename, file imports only)
   - account_id: UUID (optional — which account this import is for)
   - row_count: int
   - imported_count: int
   - skipped_count: int (duplicates / validation failures)
   - status: enum ('pending', 'processing', 'complete', 'failed')
   - error: string (optional)
   - created_at: timestamp

   // SyncSchedule — per-user, per-account automation config
   - id: UUID
   - user_id: UUID (foreign key)
   - account_id: UUID (foreign key)
   - bank_id: string (e.g. 'cibc', 'td', 'rbc' — matches BankScraper.bankId, no enum so new banks need no migration)
   - cron: string (e.g. '0 8 * * *' = daily at 8am)
   - enabled: boolean (default true)
   - last_run_at: timestamp (optional)
   - last_run_status: enum ('success', 'failed', 'mfa_required') (optional)
   - created_at: timestamp
   - updated_at: timestamp
   ```
   - Add `fitid` field to `Transaction` model — bank-assigned unique ID from OFX (preferred dedup key over date+amount+description)

2. **Implement File Import (manual upload)**
   - Accept CSV upload (`multipart/form-data`)
   - Accept OFX/QFX upload — single parser handles both CIBC and TD
   - Map CSV columns → `CreateTransactionDto` (CIBC and TD formats, see `tools/export/`)
   - Map OFX fields → `CreateTransactionDto` (TRNTYPE, DTPOSTED, TRNAMT, FITID, NAME, MEMO)
   - Dedup: prefer `fitid` match when present; fall back to date + amount + description
   - Return import summary (imported, skipped, errors)
   - `npm install ofx` for OFX parsing

3. **Implement Pluggable Bank Scraper Architecture** (`src/scraper/`)
   - `npm install playwright playwright-extra playwright-extra-plugin-stealth`

   **Scraper interface** — every bank scraper implements this contract:
   ```typescript
   // src/scraper/interfaces/bank-scraper.interface.ts
   export interface BankScraper {
     readonly bankId: string;                   // e.g. 'cibc', 'td', 'rbc'
     readonly displayName: string;              // e.g. 'CIBC', 'TD Bank'
     readonly supportedFormats: ('ofx' | 'csv')[];
     readonly requiresMfaOnEveryRun: boolean;   // true = no session persistence (e.g. CIBC); false = save storageState and skip MFA on subsequent runs
     login(page: Page, credentials: BankCredentials): Promise<void>;
     downloadTransactions(page: Page, options: DownloadOptions): Promise<Buffer>;
   }
   ```

   **Scraper registry** — scrapers self-register; `ScraperService` discovers them at startup:
   ```typescript
   // src/scraper/scraper.registry.ts
   export const BANK_SCRAPER = 'BANK_SCRAPER';  // injection token

   // Decorator to mark a class as a scraper
   export const RegisterScraper = (): ClassDecorator => SetMetadata(BANK_SCRAPER, true);
   ```

   **Adding a new bank = one file, no other changes needed:**
   ```typescript
   // src/scraper/banks/rbc.scraper.ts
   @RegisterScraper()
   @Injectable()
   export class RbcScraper implements BankScraper {
     readonly bankId = 'rbc';
     readonly displayName = 'RBC Royal Bank';
     readonly supportedFormats = ['ofx'] as const;
     // implement login() and downloadTransactions()
   }
   // Then add RbcScraper to ScraperModule providers — that's it
   ```

   **Module structure:**
   ```
   src/scraper/
   ├── scraper.module.ts              # imports all bank scrapers, exports ScraperService
   ├── scraper.service.ts             # looks up scraper by bankId, spawns worker per run
   ├── scraper.worker.ts              # worker_thread entry point — runs plugin code in isolation
   ├── scraper.scheduler.ts           # cron job runner
   ├── interfaces/
   │   └── bank-scraper.interface.ts  # BankScraper, BankCredentials, DownloadOptions, ScraperWorkerInput
   ├── scraper.registry.ts            # BANK_SCRAPER token + @RegisterScraper decorator
   └── banks/
       ├── cibc.scraper.ts            # @RegisterScraper() CibcScraper
       └── td.scraper.ts              # @RegisterScraper() TdScraper
   ```

   **`ScraperService.sync()`** resolves the correct scraper at runtime:
   ```typescript
   async sync(bankId: string, credentials: BankCredentials, options: DownloadOptions) {
     const scraper = this.registry.get(bankId);  // throws if unknown bankId
     if (!scraper) throw new BadRequestException(`No scraper registered for bank: ${bankId}`);
     // launch browser, call scraper.login() + scraper.downloadTransactions()
     // pipe result to import service
   }
   ```

   - `SyncSchedule.bank` column changes from `enum ('cibc', 'td')` to `bank_id: string` — no migration needed when adding a new bank
   - `GET /scrapers` endpoint returns list of registered banks (bankId + displayName + supportedFormats) — frontend uses this to populate the "Add account sync" dropdown dynamically
   - Session persistence: if `requiresMfaOnEveryRun === false`, save Playwright `storageState` per `bankId` to encrypted file and restore on next run to skip MFA — sessions can last weeks
   - **CIBC sets `requiresMfaOnEveryRun = true`** — sessions expire within minutes of inactivity; every sync run requires a full login + MFA completion; session persistence is not effective
   - MFA handling: when scraper detects an MFA challenge page, it signals `mfa_required` to the parent process; the sync job pauses and waits for the user to submit the code (see Task 7)
   - Credentials stored in user-scoped encrypted DB fields or env vars — never plaintext

4. **Implement Scheduler** (`src/scraper/scraper.scheduler.ts`)
   - `npm install @nestjs/schedule` + register `ScheduleModule.forRoot()` in `AppModule`
   - On startup: load all enabled `SyncSchedule` records and register dynamic cron jobs with `@Scheduler` / `schedulerRegistry`
   - Each cron job: calls `ScraperService.syncAccount(userId, accountId, bank)` → downloads OFX → calls import service
   - When user creates/updates/deletes a `SyncSchedule`, add/replace/remove the corresponding cron job at runtime (no restart needed)
   - Persist `last_run_at` and `last_run_status` after each run

5. **Plugin Loader — Install Scrapers Without Rebuilding** (`src/scraper/scraper.plugin-loader.ts`)

   Built-in scrapers (CIBC, TD) are compiled into the app. Additional scrapers can be dropped in at runtime via a mounted `plugins/` directory — same model as Suwayomi/Overseerr extensions.

   **Each external scraper is a standalone npm package** that exports a default class implementing `BankScraper`. Plugins are installed via `npm install --prefix`, which creates a standard npm layout under the `plugins/` volume:
   ```
   plugins/
   ├── package.json          ← tracks installed plugins as dependencies
   ├── package-lock.json
   └── node_modules/
       ├── @finance-tracker/
       │   └── scraper-rbc/
       │       ├── package.json
       │       └── index.js  ← export default class RbcScraper implements BankScraper
       └── scraper-bmo/      ← unscoped packages also supported
           ├── package.json
           └── index.js
   ```

   **Peer dependencies** — heavy shared packages like `playwright` (~100 MB) should not be bundled per plugin. Plugins declare them as `peerDependencies` and use the app's already-installed copy:
   ```json
   // plugin's package.json
   {
     "peerDependencies": { "playwright": ">=1.40.0" },
     "dependencies": { "some-bank-specific-lib": "^2.1.0" }
   }
   ```
   The plugin loader warns at load time if a declared peer dep is missing rather than crashing silently.

   **Plugin loader** reads `plugins/package.json` to enumerate installed plugins — only explicitly installed packages load, not leftover junk folders:
   ```typescript
   // src/scraper/scraper.plugin-loader.ts
   async loadPlugins(): Promise<void> {
     const dir = process.env.SCRAPER_PLUGIN_DIR ?? './plugins';
     const pkgPath = join(dir, 'package.json');
     if (!fs.existsSync(pkgPath)) return;  // no plugins installed yet

     const { dependencies = {} } = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
     for (const pkgName of Object.keys(dependencies)) {
       // require.resolve with paths: [dir] finds plugins/node_modules/ correctly
       // including scoped packages like @finance-tracker/scraper-rbc
       const entryPath = require.resolve(`${pkgName}/index.js`, { paths: [dir] });
       const mod = await import(entryPath);
       const scraper: BankScraper = new mod.default();
       this.registry.register(scraper);
     }
   }
   ```

   - `SCRAPER_PLUGIN_DIR` env var — defaults to `./plugins`; set to mounted volume path in production
   - Built-in scrapers always load first; plugins can override by `bankId` if needed
   - `docker-compose.yml`: mount `./plugins:/app/plugins` volume so plugins survive redeployments

   **Process Isolation — Scrapers Run in a Worker Thread** (`src/scraper/scraper.worker.ts`)

   Plugin code runs in the same Node.js process by default, which means a malicious or buggy plugin has full access to `process.env` (including `DATABASE_URL`, `JWT_SECRET`), the module cache, and all open handles. To prevent this, each scraper execution runs inside a `worker_thread` with a controlled environment:

   ```typescript
   // src/scraper/scraper.worker.ts  — entry point loaded by Worker
   import { workerData, parentPort } from 'node:worker_threads';
   import { join } from 'node:path';

   const { pluginPath, credentials, options } = workerData as ScraperWorkerInput;
   const mod = await import(join(pluginPath, 'index.js'));
   const scraper: BankScraper = new mod.default();

   // Helper passed into the plugin so it can signal MFA and await the code
   // without ever knowing about HTTP, SSE, or the database
   async function requestMfaCode(prompt: string): Promise<string> {
     parentPort!.postMessage({ type: 'mfa_required', prompt });
     return new Promise((resolve) => {
       parentPort!.once('message', (msg) => {
         if (msg.type === 'mfa_code') resolve(msg.code);
       });
     });
   }

   const result: Buffer = await scraper.downloadTransactions(credentials, options, { requestMfaCode });
   parentPort!.postMessage({ type: 'complete', data: result });
   ```

   ```typescript
   // src/scraper/scraper.service.ts — spawns worker, bridges MFA to SSE + notifications
   import { Worker } from 'node:worker_threads';

   async runInWorker(
     sessionId: string,
     pluginPath: string,
     credentials: BankCredentials,
     options: DownloadOptions,
   ): Promise<Buffer> {
     return new Promise((resolve, reject) => {
       const worker = new Worker('./dist/scraper/scraper.worker.js', {
         workerData: { pluginPath, credentials, options },
         env: {
           // Only pass what the scraper actually needs — no DB or JWT secrets
           PLAYWRIGHT_HEADLESS: process.env.PLAYWRIGHT_HEADLESS ?? 'true',
           SCRAPER_SESSION_DIR: process.env.SCRAPER_SESSION_DIR ?? './.scraper-session',
         },
       });

       worker.on('message', (msg) => {
         if (msg.type === 'complete') return resolve(msg.data);
         if (msg.type === 'mfa_required') {
           // 1. Push mfa_required event to the SSE stream for this session
           this.syncSessionStore.emit(sessionId, { event: 'mfa_required', prompt: msg.prompt });
           // 2. Send push notification + email (if user not watching SSE)
           this.notificationService.sendMfaAlert(sessionId);
           // 3. Register a one-time callback; POST /mfa-response calls this with the code
           this.syncSessionStore.setPendingMfa(sessionId, (code: string) => {
             worker.postMessage({ type: 'mfa_code', code });
           });
         }
       });

       worker.on('error', reject);
     });
   }
   ```

   **What the worker can and cannot access:**

   | | Main process | Worker (plugin code) |
   |---|---|---|
   | `DATABASE_URL` | ✅ | ❌ not inherited |
   | `JWT_SECRET` | ✅ | ❌ not inherited |
   | Prisma client | ✅ | ❌ separate module scope |
   | Playwright browser | spawns subprocess | ✅ runs here |
   | MFA challenge → main | — | `parentPort.postMessage({ type: 'mfa_required' })` |
   | MFA code ← main | `worker.postMessage({ type: 'mfa_code', code })` | `parentPort.once('message')` |
   | Result → main | via `resolve(buffer)` | `parentPort.postMessage({ type: 'complete', data })` |

   - Worker receives only `pluginPath`, `credentials`, and `options` via `workerData` — nothing else
   - Credentials are decrypted in the main process just before being passed to the worker, so the decryption key never leaves the main process
   - Worker output is only a `Buffer` (OFX/CSV bytes) — the main process calls the import service with that buffer; the plugin never touches the database directly
   - The `requestMfaCode` helper is the **only** communication channel the plugin uses for MFA — the plugin has no knowledge of SSE, HTTP, push notifications, or the database
   - Worker has a configurable timeout; if it exceeds (e.g. 10 minutes), the worker is `worker.terminate()`d and the sync run is marked `failed`
   - Add `src/scraper/scraper.worker.ts` and `src/scraper/sync-session.store.ts` to the module structure above

   **Deploying a new scraper to a live server (no restart needed):**
   ```bash
   # Install plugin into the mounted plugins/ volume (preferred)
   docker exec finance-tracker-backend npm install @finance-tracker/scraper-rbc \
     --prefix /app/plugins

   # Or use POST /admin/scrapers/install which runs npm install as a child process
   # (ADMIN role only — see Task 6)

   # Then trigger hot reload:
   curl -X POST https://your-server/admin/scrapers/reload \
     -H "Authorization: Bearer <admin-jwt>"
   ```

6. **Schedule Management & Admin API**
   - `GET /scrapers` — list all registered banks (built-in + plugins); used by frontend to populate bank picker dynamically
   - `GET /sync-schedules` — list user's schedules
   - `POST /sync-schedules` — create schedule (validate cron string; validate bankId exists in registry)
   - `PATCH /sync-schedules/:id` — update cron or enable/disable
   - `DELETE /sync-schedules/:id` — remove schedule + unregister cron job
   - `POST /sync-schedules/:id/run-now` — trigger immediate sync outside schedule; returns `{ sessionId }` immediately, sync runs async
   - `GET /sync-schedules/:id/stream` — SSE stream for live sync status (`logging_in` → `mfa_required` → `importing` → `complete`/`failed`); frontend subscribes when "Sync Now" is clicked
   - `POST /sync-schedules/:id/mfa-response` — submit MFA code to a paused worker (`{ sessionId, code }`); single-use, expires after worker timeout
   - `POST /push/subscribe` — store user's Web Push subscription (`PushSubscription` object) in DB
   - `DELETE /push/subscribe` — unregister push subscription
   - `POST /admin/scrapers/reload` — re-scan plugin directory and register any new scrapers (admin only, no restart needed)
   - `POST /admin/scrapers/install` *(optional)* — run `npm install <package>` into plugin dir then reload (admin only)

7. **MFA Notification & Callback**

   When a sync run reaches an MFA challenge (always for CIBC; occasionally for others on session expiry), the worker signals the parent process and the user is notified via **Web Push** and/or **email**. Two UX paths exist:

   **Full communication chain:**
   ```
   Plugin (worker_thread)
      ↓  parentPort.postMessage({ type: 'mfa_required', prompt })
   ScraperService (main process)
      ↓  syncSessionStore.emit(sessionId, { event: 'mfa_required' })
      ↓  notificationService.sendMfaAlert()  →  Web Push + Email fire simultaneously
   SyncSessionStore (RxJS Subject, keyed by sessionId)
      ↓  SSE controller subscribes to Subject as Observable
   Browser (frontend) ← SSE event fires → code input modal appears
      OR
   Push notification → tap → /mfa?session=<token>  (user not in app)
      OR
   Email link → click → /mfa?session=<token>  (universal fallback)

   User submits code
      ↓  POST /sync-schedules/:id/mfa-response  { code }
   syncSessionStore.getPendingMfa(sessionId)(code)
      ↓  worker.postMessage({ type: 'mfa_code', code })
   Plugin (worker_thread) — parentPort.once('message') resolves
      ↓  types code into browser → continues download
   parentPort.postMessage({ type: 'complete', data: buffer })
      ↓  main process → ImportService → DB write
   syncSessionStore.emit(sessionId, { event: 'complete', imported: N })
      ↓  SSE → frontend shows success banner
   ```

   **`SyncSessionStore`** (`src/scraper/sync-session.store.ts`) — bridges worker events to SSE and MFA callbacks:
   ```typescript
   // In-memory store; keyed by sessionId (UUID generated at run-now time)
   private streams = new Map<string, Subject<MessageEvent>>();
   private pendingMfa = new Map<string, (code: string) => void>();

   getStream(sessionId: string): Observable<MessageEvent> { ... }
   emit(sessionId: string, event: SyncEvent): void { ... }
   setPendingMfa(sessionId: string, resolve: (code: string) => void): void { ... }
   getPendingMfa(sessionId: string): (code: string) => void { ... }
   ```

   **Path A — User has the frontend open (SSE modal)**
   The `GET /sync-schedules/:id/stream` SSE connection is already subscribed. When the `mfa_required` event fires, the frontend automatically shows a code input modal. User enters the code → `POST .../mfa-response` → worker unpauses. Push and email still fire (idempotent — harmless if ignored).

   **Path B — User is not in the frontend (out-of-band notification)**
   Push notification and/or email reaches the user. They tap/click → opens `/mfa?session=<token>` — a minimal standalone page (just a code input and Submit). No navigation through the full app needed. On submission, same `POST .../mfa-response` endpoint — identical handler regardless of which path delivered the code.

   **Web Push implementation** (`npm install web-push`):
   - Generate VAPID key pair once (`web-push generate-vapid-keys`) — store in env vars
   - Frontend: register service worker (`/sw.js`), call `Notification.requestPermission()` on login, subscribe via `pushManager.subscribe({ applicationServerKey: VAPID_PUBLIC })` → POST subscription to `/push/subscribe`
   - Service worker handles `push` event → `self.registration.showNotification('Finance Tracker', { body: 'CIBC sync needs your MFA code', data: { url: '/mfa?session=xyz' } })`
   - `notificationclick` event → `clients.openWindow(event.notification.data.url)`
   - Backend: on MFA challenge, look up user's stored `PushSubscription`, call `webPush.sendNotification(subscription, payload)`

   **iOS requirement:** Web Push only works if the PWA is added to the Home Screen (iOS 16.4+). Add a first-login prompt: *"Add this app to your Home Screen to receive sync notifications."*

   | Platform | Web Push | Notes |
   |---|---|---|
   | Chrome / Android | ✅ | Works in browser tab or background |
   | Firefox / Android | ✅ | Works in browser tab or background |
   | Safari / iOS 16.4+ | ✅ | **Must be added to Home Screen first** |
   | Safari / iOS < 16.4 | ❌ | Fall back to email only |

   **Email notification** (`npm install nodemailer`):
   - On MFA challenge, send email to the user's registered address: *"Your CIBC sync is waiting for MFA. [Enter Code →](https://your-server/mfa?session=xyz)"*
   - The link opens the same minimal `/mfa?session=<token>` page as the push notification
   - `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` in env vars — supports any SMTP provider (Gmail, Resend, Mailgun, etc.)
   - Email is the universal fallback — works on any device regardless of browser or OS version

   **MFA session token:**
   - Short-lived, single-use token tied to `sessionId` from `run-now` response
   - Worker holds a `Promise` that resolves when the token is redeemed via `POST .../mfa-response`
   - Token and pending promise stored in-memory (Map) — no DB write needed
   - Expires after worker timeout (default 10 minutes); if not redeemed → sync marked `failed`, token deleted

   **Notification preferences** (stored per user in DB):
   ```typescript
   - notify_push: boolean  (default true if subscription exists)
   - notify_email: boolean (default true)
   ```
   Both can be enabled simultaneously — push for speed, email as fallback.

**Phase 7 Checklist:** Apply Standard Checklist (Core, Documentation, Testing, Security, Database)

**Notes:**
- Playwright runs headless in production; use `PLAYWRIGHT_HEADLESS=false` locally for debugging login flows
- Session storage files (`.scraper-session/`) must be in `.gitignore` — they contain auth cookies
- Adding a bank at build time: create `src/scraper/banks/<bank>.scraper.ts`, implement `BankScraper`, add `@RegisterScraper()`, add to `ScraperModule` providers
- Adding a bank at runtime: drop a built npm package into `plugins/`, call `POST /admin/scrapers/reload` — no rebuild, no restart
- `POST /admin/scrapers/install` executes `npm install` as a child process — restrict to ADMIN role only to prevent arbitrary code execution by regular users
- **Process isolation:** all scraper executions (built-in and plugin) run in a `worker_thread` via `scraper.worker.ts`. The worker receives `workerData` only — `DATABASE_URL`, `JWT_SECRET`, and all other env vars are explicitly excluded from the worker's env. Plugin code can never access the database or decrypt credentials; it only returns a raw file buffer back to the main process.
- Worker timeout: terminate the worker and mark the sync run `failed` if it exceeds a configurable limit (default 5 minutes) — prevents a stuck browser from hanging the app
- **CIBC requires MFA on every run** — `requiresMfaOnEveryRun = true`; scheduling still fires the browser and fills credentials automatically, but MFA completion always requires user interaction via push/email → `/mfa` page
- **TD and other banks** with durable sessions: `requiresMfaOnEveryRun = false`; session persistence means MFA is only needed when the session expires (weeks to months)
- Push notifications require the PWA to be added to the iOS Home Screen on iOS 16.4+; email is the universal fallback for all devices
- MFA response tokens are in-memory only — they do not persist across server restarts; a restart during a pending MFA challenge will fail that sync run
- Scraper is personal-use only; bank ToS prohibit automated access. Not suitable for multi-tenant SaaS.

**Estimated Time:** 6-9 days

---

### Phase 8: Budgets Module *(Optional)*

**Priority:** LOW - Premium feature, skip if not needed

**Tasks:**
1. **Define Budgets Model in Prisma Schema** (`prisma/schema.prisma`)
   ```typescript
   - id: UUID
   - user_id: UUID
   - category_id: UUID (optional)
   - amount: decimal(10,2)
   - period: enum ('monthly', 'quarterly', 'yearly')
   - start_date: timestamp
   - end_date: timestamp (optional)
   - created_at: timestamp
   - updated_at: timestamp
   ```

2. **Implement Budget Tracking**
   - Compare actual spending vs budget
   - Alert when approaching/exceeding limits
   - Historical budget performance

**Phase 7 Checklist:** Apply Standard Checklist (Core, Documentation, Testing, Security, Database)

**Estimated Time:** 2-3 days

---

### Phase 9: Reports Module *(Optional)*

**Priority:** LOW - Analytics and insights, skip if not needed

**Tasks:**
1. **Implement Report Endpoints**
   - Monthly spending by category
   - Income vs expenses trends
   - Account balances over time
   - Net worth calculation
   - Budget performance

2. **Create Visualization Data**
   - Format data for charts
   - Aggregate by time periods
   - Calculate percentages and trends

**Phase 8 Checklist:** Apply Standard Checklist (Core, Documentation, Testing, Security, Database)

**Estimated Time:** 2-3 days

---

## Development Best Practices

### Database Migrations
- Create migration for each schema change
- Never modify existing migrations
- Test migrations on fresh database
- Document breaking changes

### Testing Strategy
- Unit tests for services (business logic)
- Integration tests for controllers (API endpoints)
- E2E tests for critical user flows
- Test with multiple users to ensure isolation

### Security Checklist
- [ ] All endpoints protected with authentication
- [ ] User data properly scoped by user_id
- [ ] Passwords hashed with bcrypt (cost factor 10-12)
- [ ] JWT secrets in environment variables
- [ ] Input validation on all DTOs
- [ ] SQL injection prevention (ORM parameterized queries)
- [ ] Rate limiting on auth endpoints
- [ ] CORS configured properly

### Code Standards
- Use path aliases (`@users/`, `@transactions/`, etc.)
- Return type annotations on all functions
- Explicit `.js` extensions on imports (ESM)
- Follow NestJS module pattern
- Use dependency injection
- Write comprehensive error messages

---

## Quick Start Commands

```bash
# Install ORM (choose one)
npm install @nestjs/typeorm typeorm pg           # TypeORM
npm install @prisma/client && npm install -D prisma  # Prisma

# Install authentication packages
npm install @nestjs/passport @nestjs/jwt passport passport-jwt bcrypt
npm install -D @types/passport-jwt @types/bcrypt

# Start development database
docker-compose up -d postgres

# Run migrations (TypeORM)
npm run migration:run

# Start development server
npm run start:dev

# Run tests
npm test
npm run test:watch
```

---

## Milestones

- **Milestone 1:** Users + Auth working (can register/login)
- **Milestone 2:** Transactions CRUD with user association
- **Milestone 3:** Categories + Accounts + Budgets
- **Milestone 4:** Reports and analytics
- **Milestone 5:** Production deployment

**Total Estimated Time:** 2-3 weeks for Phases 1-4 (MVP)

---

## Phase 10: MCP Server

**Goal:** Expose finance-tracker data and actions to AI assistants (Claude Desktop, Cursor, VS Code Copilot, claude.ai web, Claude iOS) via the Model Context Protocol.

### Core Implementation
- [ ] Install `@modelcontextprotocol/sdk` and `zod`
- [ ] Add `#mcp/*` path alias to `tsconfig.json` and `package.json`
- [ ] Create `src/mcp/mcp.module.ts` — feature module importing all domain modules
- [ ] Create `src/mcp/mcp.service.ts` — `McpServer` bootstrap, tool/resource registration
- [ ] Create `src/mcp/mcp.controller.ts` — `POST /mcp`, `GET /mcp`, `DELETE /mcp` endpoints with `JwtAuthGuard`
- [ ] Create `src/mcp/tools/transactions.tools.ts` — list, create, update, delete
- [ ] Create `src/mcp/tools/accounts.tools.ts` — list, balances
- [ ] Create `src/mcp/tools/budgets.tools.ts` — list, progress, remaining
- [ ] Create `src/mcp/tools/reports.tools.ts` — spending by category, monthly summary
- [ ] Add `--mcp-stdio` flag handling in `main.ts` for local client support
- [ ] Register `McpModule` in `app.module.ts`

### MCP App Resources
- [ ] Create `src/mcp/apps/` directory (receives Vite build output from frontend)
- [ ] Load app HTML files from disk on module init (`fs.readFileSync`)
- [ ] Register `ui://spending-chart` resource (paired with `get-spending-by-category` tool)
- [ ] Register `ui://transaction-list` resource (paired with transaction listing tool)
- [ ] Register `ui://budget-overview` resource (paired with budget tools)
- [ ] Graceful fallback when app HTML files are not present

### Documentation
- [ ] [Setting Up MCP Server](./mcp-setup.md) *(created)*
- [ ] [Setting Up MCP Apps](./mcp-apps-setup.md) *(created)*
- [ ] Add `.vscode/mcp.json` to workspace root for VS Code Copilot integration
- [ ] Add Claude Desktop config example to README

### Testing
- [ ] `src/mcp/__TEST__/mcp.service.spec.ts` — tool registration, tool call delegation to services
- [ ] `src/mcp/__TEST__/mcp.controller.spec.ts` — HTTP endpoints, guard behavior
- [ ] `src/mcp/__TEST__/mcp.resources.spec.ts` — resource read, fallback when HTML missing
- [ ] Manual test with MCP Inspector (`npx @modelcontextprotocol/inspector`)
- [ ] Manual test in Claude Desktop (stdio)
- [ ] Manual test via HTTP transport with curl

### Security & Validation
- [ ] All HTTP MCP endpoints behind `JwtAuthGuard`
- [ ] All tool handlers scope queries to authenticated user ID
- [ ] `stdio` mode: confirm process is spawned locally before enabling

### Future (post-MVP)
- [ ] OAuth 2.0 with dynamic client registration for official claude.ai Connectors
- [ ] Per-tool rate limiting
- [ ] MCP App for AI-powered transaction categorization suggestions
- [ ] Subscription-based notifications via MCP streaming

---

## Future Enhancements

- [ ] Forgot password / password reset flow (`POST /auth/forgot-password` — send reset email with time-limited token; `POST /auth/reset-password` — validate token and set new password)
- [ ] Recurring transactions
- [ ] Multi-currency support
- [ ] Shared accounts (household mode)
- [ ] Mobile app support
- [ ] Email notifications
- [ ] Two-factor authentication
- [ ] Email change workflow with verification (send confirmation to old and new email, require password)
- [ ] OAuth providers (Google, Apple)
- [ ] Receipt image upload
- [ ] AI-powered categorization
- [ ] Financial goals tracking
- [ ] Investment portfolio tracking
