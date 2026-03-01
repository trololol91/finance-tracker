# Phase 6 — Accounts Module: Implementation Plan

**Date**: 2026-03-01  
**Planner**: planner agent  
**Status**: ⬜ Not Started

---

## 1. Overview

Add an **Accounts** module that lets users organise transactions by bank account (or credit card, investment account, etc.). Each transaction already has an optional `accountId` FK column in the schema and the transactions controller already accepts `accountId` as a filter param — this phase wires those dormant fields up end-to-end.

### Key design decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Balance strategy | `openingBalance` stored + `currentBalance` computed server-side | Avoids maintaining a running counter; `openingBalance` captures the state when the account is added to the app; `currentBalance = openingBalance + Σincome − Σexpense` (active transactions only; transfers excluded from balance) |
| Delete strategy | Hard-delete if no transactions; soft-delete (`isActive=false`) if transactions exist — same as categories | Prevents orphan FK references while preserving history |
| `isActive` toggle | Via `PATCH /accounts/:id` (not a separate toggle endpoint) | Consistent with categories pattern |
| Account types | `AccountType` enum (checking, savings, credit, investment, loan, other) | Covers common Canadian/US account types |

---

## 2. Prisma Schema Changes

### 2a. New `AccountType` enum

```prisma
enum AccountType {
  checking
  savings
  credit
  investment
  loan
  other
}
```

### 2b. New `Account` model

```prisma
model Account {
  id             String      @id @default(uuid()) @db.Uuid
  userId         String      @map("user_id") @db.Uuid

  name           String
  type           AccountType @default(other)
  institution    String?
  currency       String      @default("CAD")
  openingBalance Decimal     @default(0) @map("opening_balance") @db.Decimal(12, 2)
  color          String?
  notes          String?

  isActive       Boolean     @default(true) @map("is_active")

  createdAt      DateTime    @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime    @updatedAt      @map("updated_at") @db.Timestamptz

  // Relations
  user           User        @relation(fields: [userId], references: [id])
  transactions   Transaction[]

  @@unique([userId, name])
  @@index([userId])
  @@index([userId, isActive])
  @@map("accounts")
}
```

### 2c. Changes to existing models

**`User`** — add relation field:
```prisma
accounts       Account[]
```

**`Transaction`** — add relation (field `accountId` already exists):
```prisma
account        Account?    @relation(fields: [accountId], references: [id])
```

> **Note**: `accountId` and the `@db.Uuid` annotation are already in the schema. The migration will only need to add the FK constraint and create the `accounts` table.

### 2d. Migration

```
20260301_add_accounts_module
```

One migration covers: create `AccountType` enum, create `accounts` table, add FK constraint on `transactions.account_id` → `accounts.id`.

---

## 3. Backend Module Structure

```
packages/backend/src/accounts/
├── accounts.module.ts
├── accounts.controller.ts
├── accounts.service.ts
└── dto/
    ├── create-account.dto.ts
    ├── update-account.dto.ts
    └── account-response.dto.ts
```

Path alias to add to `tsconfig.json` and `nest-cli.json`:
```json
"#accounts/*": ["src/accounts/*"]
```

Register in `app.module.ts`:
```typescript
import {AccountsModule} from '#accounts/accounts.module.js';
// add AccountsModule to imports array
```

---

## 4. API Contract

All endpoints require `Authorization: Bearer <token>` (JWT). All 401 responses are returned when the token is missing or invalid.

### 4a. Endpoints

| Method | Route | Status | Description |
|--------|-------|--------|-------------|
| `GET` | `/accounts` | 200 | List all accounts for the authenticated user (with computed `currentBalance` and `transactionCount`) |
| `GET` | `/accounts/:id` | 200 / 404 | Get a single account |
| `POST` | `/accounts` | 201 | Create an account |
| `PATCH` | `/accounts/:id` | 200 / 404 / 409 | Partially update an account |
| `DELETE` | `/accounts/:id` | 204 (hard) / 200 (soft) / 400 (has transactions, cannot unlink) | Delete an account |

### 4b. DTOs

#### `CreateAccountDto`

| Field | Type | Validation | Required |
|-------|------|-----------|----------|
| `name` | `string` | `@IsString @IsNotEmpty @MaxLength(100)` | ✅ |
| `type` | `AccountType` | `@IsEnum(AccountType)` | ✅ |
| `institution` | `string \| null` | `@IsString @MaxLength(100) @IsOptional` | ❌ |
| `currency` | `string` | `@IsString @Length(3,3) @IsOptional` — default `"CAD"` | ❌ |
| `openingBalance` | `number` | `@IsNumber @Min(-999999999.99) @IsOptional` — default `0` | ❌ |
| `color` | `string \| null` | `@Matches(/^#[0-9A-Fa-f]{6}$/) @IsOptional` | ❌ |
| `notes` | `string \| null` | `@IsString @MaxLength(500) @IsOptional` | ❌ |

#### `UpdateAccountDto`

All fields optional, same validations as Create. `@ValidateIf` on nullable string fields (same pattern as `UpdateCategoryDto`).

Additional field:
| `isActive` | `boolean` | `@IsBoolean @IsOptional` | ❌ |

#### `AccountResponseDto`

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | UUID |
| `userId` | `string` | UUID |
| `name` | `string` | |
| `type` | `AccountType` | enum string |
| `institution` | `string \| null` | |
| `currency` | `string` | |
| `openingBalance` | `number` | stored initial balance |
| `currentBalance` | `number` | computed: `openingBalance + Σincome − Σexpense` (active transactions only) |
| `transactionCount` | `number` | total transaction count (all states) |
| `color` | `string \| null` | hex |
| `notes` | `string \| null` | |
| `isActive` | `boolean` | |
| `createdAt` | `string` | ISO 8601 |
| `updatedAt` | `string` | ISO 8601 |

`currentBalance` computation (Prisma `groupBy` or `aggregate` with `_sum`):

```typescript
const agg = await this.prisma.transaction.aggregate({
    where: { accountId: account.id, isActive: true },
    _sum: { amount: true },
    // group by transactionType inside the service
});
// then: openingBalance + incomeSum - expenseSum
```

In practice, use two separate `aggregate` calls filtered by `transactionType` to separate income from expense, or one `findMany` with `groupBy`. A single `groupBy` query is cleanest:

```typescript
const sums = await this.prisma.transaction.groupBy({
    by: ['transactionType'],
    where: { accountId: id, isActive: true, transactionType: { in: ['income', 'expense'] } },
    _sum: { amount: true }
});
```

### 4c. Delete behaviour

Mirrors categories:
- If the account has **zero linked transactions**: hard-delete (204 No Content)
- If the account has **linked transactions**: soft-delete (`isActive = false`, return 200 with DTO)
- The FK is nullable (`accountId` is optional on Transaction), so soft-deletion does not orphan transactions — transactions retain their `accountId` reference, but the account is marked inactive.

---

## 5. Service Methods

```typescript
public async findAll(userId: string): Promise<AccountResponseDto[]>
public async findOne(userId: string, id: string): Promise<AccountResponseDto>
public async create(userId: string, dto: CreateAccountDto): Promise<AccountResponseDto>
public async update(userId: string, id: string, dto: UpdateAccountDto): Promise<AccountResponseDto>
public async remove(userId: string, id: string): Promise<AccountResponseDto | null>
  // null → hard-deleted (204); DTO → soft-deleted (200)
```

`checkNameUnique` private helper: guard `@@unique([userId, name])` at the application layer to provide a clear `ConflictException` (same pattern as categories).

---

## 6. Frontend Integration Points

### 6a. New feature directory

```
packages/frontend/src/features/accounts/
├── components/
│   ├── AccountList.tsx
│   ├── AccountList.module.css
│   ├── AccountListItem.tsx
│   ├── AccountListItem.module.css
│   ├── AccountForm.tsx
│   ├── AccountForm.module.css
│   ├── AccountModal.tsx
│   ├── AccountModal.module.css
│   └── __TEST__/
│       ├── AccountList.test.tsx
│       ├── AccountListItem.test.tsx
│       ├── AccountForm.test.tsx
│       └── AccountModal.test.tsx
├── hooks/
│   ├── useAccountForm.ts
│   └── __TEST__/
│       └── useAccountForm.test.ts
└── types/
    └── account.types.ts
```

### 6b. Page

```
packages/frontend/src/pages/AccountsPage.tsx          ← replace stub
packages/frontend/src/pages/AccountsPage.module.css   ← new
```

Route `/accounts` is already registered in `src/routes/index.tsx` — no route change needed.

### 6c. Orval-generated hooks

After `npm run generate:api` in `packages/frontend`, the following hooks will be available:
- `useAccountsControllerFindAll()` — used on `AccountsPage`
- `useAccountsControllerCreate()` — used in `useAccountForm`
- `useAccountsControllerUpdate()` — used in `useAccountForm`
- `useAccountsControllerRemove()` — used in `AccountListItem`

Types from `@/api/model/`:
- `AccountResponseDto` — imported from `@/api/model/accountResponseDto.js`
- `CreateAccountDto` — imported from `@/api/model/createAccountDto.js`
- `UpdateAccountDto` — imported from `@/api/model/updateAccountDto.js`

### 6d. `account.types.ts` (frontend-only)

```typescript
export interface AccountFormValues {
    name: string;
    type: string;        // AccountType enum string
    institution: string;
    currency: string;
    openingBalance: string;  // string for controlled input, parsed on submit
    color: string;
    notes: string;
}

export type AccountFormErrors = Partial<Record<keyof AccountFormValues, string>>;
export type AccountModalMode = 'create' | 'edit' | null;
```

### 6e. Component responsibilities

| Component | Responsibility |
|-----------|---------------|
| `AccountsPage` | Fetches `useAccountsControllerFindAll()`, passes data to `AccountList`; owns modal open/close state |
| `AccountList` | Loading / error / empty states; renders list of `AccountListItem` |
| `AccountListItem` | Displays one account row: name, type badge, institution, currency, `currentBalance`, `transactionCount`; action menu (Edit, Toggle Active, Delete) |
| `AccountForm` | Controlled form: name (required), type (select enum), institution, currency (default CAD), openingBalance (number input), color (hex with swatch preview), notes |
| `AccountModal` | Dialog wrapper (same `<dialog>` pattern as `CategoryModal`); title "New Account" / "Edit Account"; houses `AccountForm`; manages focus trap |
| `useAccountForm` | Validation, `buildCreateDto`, `buildUpdateDto`, mutation hooks, cache invalidation |

### 6f. ⚠️ Cross-feature wiring steps (CRITICAL — must be explicit numbered steps)

These touch previously-completed Transactions feature files:

**Step A — `TransactionForm.tsx`**: Add `accountId` select (optional) using accounts from `useAccountsControllerFindAll()`. Position between Category and Description (or below Category). Default to "None" (empty string → `null`). Only show active accounts. Mirror the exact pattern used for `categoryId`.

**Step B — `TransactionList.tsx` / `TransactionListItem.tsx`**: Add Account column header (`th`) and cell (`td`) showing account name (with optional color swatch). Apply `tx-list__th--hide-mobile` / `tx-item__hide-mobile` at the same 767px breakpoint as the Category column.

**Step C — `TransactionFilters.tsx`**: Add "All Accounts" dropdown that populates from `useAccountsControllerFindAll()`, mirrors `categoryId` filter pattern, updates `accountId` URL param. The `accountId` query param already flows through `useTransactionFilters` and `TransactionFilterDto` — only the UI control is missing.

Each of steps A, B, and C must be a separately numbered step in the roadmap Current Focus and must have its own test cases in `test-plan/transactions/frontend.md`.

---

## 7. Implementation Steps

### Backend (Steps 1–6)

1. **Prisma schema + migration**
   - Add `AccountType` enum
   - Add `Account` model
   - Add `user.accounts` relation
   - Add `transaction.account` relation (FK now enforced)
   - Generate and run migration: `npx prisma migrate dev --name add_accounts_module`
   - Regenerate Prisma client: `npx prisma generate`

2. **`AccountsModule` — service + DTOs**
   - `create-account.dto.ts`, `update-account.dto.ts`, `account-response.dto.ts`
   - `accounts.service.ts`: `findAll`, `findOne`, `create`, `update`, `remove`
   - `accounts.module.ts`: imports `DatabaseModule`, exports `AccountsService`

3. **`AccountsController`**
   - Register all 5 endpoints with full Swagger decorators
   - Register `AccountsModule` in `app.module.ts`

4. **Backend unit tests** (`@test-writer`)
   - Test all service methods (happy path + NotFoundException + ConflictException + soft/hard delete logic)
   - Test controller (delegate calls, response shapes)
   - Target: ≥ 25 new test cases

5. **Backend API test** (`@backend-tester`)
   - Run against live server
   - Save plan to `test-plan/accounts/backend.md`
   - Save report to `test-plan/accounts/backend-report.md`

6. **Backend code review + commit** (`@code-reviewer` → `@backend-dev`)
   - Commit sequence:
     1. `feat(backend): add accounts prisma schema and migration`
     2. `feat(backend): add accounts service and DTOs with unit tests`
     3. `feat(backend): add accounts controller and module registration`

### Frontend (Steps 7–15)

7. **Regenerate API client**
   ```bash
   cd packages/frontend && npm run generate:api
   ```

8. **`account.types.ts` + `useAccountForm.ts`**

9. **`AccountForm.tsx` + `AccountForm.module.css` + tests**

10. **`AccountModal.tsx` + `AccountModal.module.css` + tests**

11. **`AccountList.tsx` + `AccountListItem.tsx` + CSS + tests**

12. **`AccountsPage.tsx` + `AccountsPage.module.css`**
    - Replace stub; register page with `useAccountsControllerFindAll()`
    - Verify: dev server starts, `/accounts` route loads, no blank screen

13. **Cross-feature Step A: Wire `accountId` selector into `TransactionForm`**
    - Add account `<select>` to `TransactionForm.tsx`
    - Only active accounts; default "None"
    - Update `buildUpdateDto` to send `null` when "None" selected (same `buildUpdateDto` pattern as `categoryId`)
    - Add tests in `TransactionForm.test.tsx`

14. **Cross-feature Step B: Add Account column to `TransactionList` / `TransactionListItem`**
    - New `th`/`td` for Account (name + optional color swatch)
    - Apply `--hide-mobile` class at ≤767px
    - Add tests in `TransactionListItem.test.tsx`

15. **Cross-feature Step C: Wire `accountId` filter into `TransactionFilters`**
    - New "All Accounts" dropdown, mirrors Category filter
    - `accountId` already in `useTransactionFilters` and URL params — only the UI control needed
    - Add tests in `TransactionFilters.test.tsx`

16. **Frontend unit tests** (`@test-writer`) — for all new accounts components

17. **Frontend code review** (`@code-reviewer`)

18. **Frontend E2E testing** (`@frontend-tester`)
    - New `test-plan/accounts/frontend.md` plan + report
    - Cross-feature wiring TCs (account selector in TransactionForm, Account column, Account filter) added to `test-plan/transactions/frontend.md` in their natural sections (Filters, Add Transaction, Edit Transaction, Responsive Layout)

19. **Frontend commits** (`@frontend-dev`)
    - Commit sequence:
      1. `feat(frontend): add accounts types and regenerate Orval API client`
      2. `feat(frontend): add AccountForm and AccountModal with tests`
      3. `feat(frontend): add AccountList and AccountListItem with tests`
      4. `feat(frontend): add AccountsPage and /accounts route`
      5. `feat(frontend): wire accountId selector into TransactionForm`
      6. `feat(frontend): add Account column to TransactionList and filter to TransactionFilters`

---

## 8. Test Strategy

### Unit tests (Vitest)

**Backend** (`packages/backend/src/accounts/__TEST__/`):

| Test area | Cases |
|-----------|-------|
| `AccountsService.findAll` | Returns mapped DTOs; currentBalance computed correctly (income − expense); empty list |
| `AccountsService.findOne` | Found; NotFoundException for unknown id; NotFoundException for another user's id |
| `AccountsService.create` | Happy path; ConflictException on duplicate name; Prisma P2002 fallback |
| `AccountsService.update` | Happy path; NotFoundException; ConflictException on rename conflict |
| `AccountsService.remove` | Hard-delete (no transactions); soft-delete (has transactions) |
| `AccountsController` | Delegates to service; response types correct |

**Frontend** (`components/__TEST__/`):

| Test area | Cases |
|-----------|-------|
| `AccountForm` | Renders all fields; required field validation; hex color validation; currency default "CAD"; submit calls onSubmit |
| `AccountModal` | Opens with blank form (create mode); opens pre-populated (edit mode); Escape closes; focus trap |
| `AccountList` | Loading state; error state; empty state (no active accounts); renders items; showInactive toggle |
| `AccountListItem` | Displays name, type, institution, balance; action menu (Edit, Toggle, Delete); inactive row styling |
| `useAccountForm` | Create mutation called with correct DTO; update mutation called; `null` sent for empty openingBalance-like fields |

### Integration tests (Playwright — `@frontend-tester`)

Coverage: **Full regression**

**Accounts page flows:**
- Unauthenticated access → redirect to `/login`
- Page load: heading, "+ Add Account" button, account list
- Loading / error / empty states
- Create account (happy path, validation errors)
- Edit account (pre-populated, save, cancel)
- Toggle account active/inactive
- Delete account (hard-delete; soft-delete with confirmation)
- `currentBalance` shown and accurate
- Responsive layout at desktop / tablet / mobile

**Cross-feature (Transactions page) — add to `test-plan/transactions/frontend.md`:**
- TC-4x: Account filter — select account → list filtered + URL updated
- TC-4x: Account filter — "All Accounts" resets list
- TC-4x: Add modal — Account select present, defaults "None", shows active accounts only
- TC-4x: Create transaction with account → Account shown in list
- TC-4x: Edit transaction — Account pre-populated, change account → cell updates
- TC-4x: Edit — clear account to None → PATCH sends `null`
- TC-4x: Account column hidden at mobile 390×844

---

## 9. Backend API Test Plan

For `@backend-tester` to follow:

### Base URL: `http://localhost:3001`
### Auth: `POST /auth/login` with `{ email, password }` → get `access_token`

| # | Method | Route | Body | Expected status | Notes |
|---|--------|-------|------|----------------|-------|
| 1 | GET | `/accounts` | — | 200 | Empty array for new user |
| 2 | POST | `/accounts` | `{ name, type, institution, currency, openingBalance, color, notes }` | 201 | Full create |
| 3 | POST | `/accounts` | `{ name, type }` only | 201 | Minimal create; defaults applied |
| 4 | POST | `/accounts` | `{ name: "" }` | 400 | Name empty |
| 5 | POST | `/accounts` | `{ name: "...", type: "invalid" }` | 400 | Invalid enum |
| 6 | POST | `/accounts` | `{ name: "...", color: "notahex" }` | 400 | Invalid hex |
| 7 | POST | `/accounts` | duplicate name | 409 | ConflictException |
| 8 | GET | `/accounts` | — | 200 | Returns created account with `currentBalance` and `transactionCount` |
| 9 | GET | `/accounts/:id` | — | 200 | Found |
| 10 | GET | `/accounts/:id` | — (another user's id) | 404 | Scoped to user |
| 11 | GET | `/accounts/nonexistent-uuid` | — | 404 | Not found |
| 12 | PATCH | `/accounts/:id` | `{ name: "New Name" }` | 200 | Partial update |
| 13 | PATCH | `/accounts/:id` | `{ isActive: false }` | 200 | Soft toggle via PATCH |
| 14 | PATCH | `/accounts/:id` | `{ name: "" }` | 400 | Name cannot be blank |
| 15 | PATCH | `/accounts/:id` | duplicate name | 409 | |
| 16 | DELETE | `/accounts/:id` | — (no transactions) | 204 | Hard-delete |
| 17 | DELETE | `/accounts/:id` | — (has transactions) | 200 | Soft-delete; body has DTO with `isActive: false` |
| 18 | DELETE | `/accounts/:id` | — (already deleted/not found) | 404 | |
| 19 | GET | `/accounts` | — (no token) | 401 | |
| 20 | POST | `/accounts` | — (no token) | 401 | |
| 21 | PATCH | `/accounts/:id` | — (no token) | 401 | |
| 22 | DELETE | `/accounts/:id` | — (no token) | 401 | |
| 23 | GET | `/transactions?accountId=:id` | — | 200 | Transactions filtered by account |

---

## 10. Frontend Test Scope (for `@frontend-tester`)

**Coverage level**: Full regression

### User flows — Accounts page

| Flow | Happy path | Edge / error |
|------|-----------|-------------|
| Auth redirect | — | Unauthenticated → `/login` |
| Page load | Heading, list, "+ Add Account" button, summary totals | Loading spinner; API error state; empty state (no accounts) |
| Create account | Fill all fields, Save → 201, row appears, balance shows | Name empty; invalid hex color; duplicate name; cancel |
| Edit account | Open edit modal pre-populated, change name, Save → 200 | Cancel; duplicate name conflict |
| Toggle active | Mark inactive → row greyed; mark active again | |
| Delete (hard) | Account with no transactions → 204, row removed | Cancel confirmation |
| Delete (soft) | Account with transactions → 200, `isActive=false`, row greyed | |
| `currentBalance` | Matches expected `openingBalance + income − expense` | Zero-transaction account shows `openingBalance` |
| Responsive | Desktop 1280×720 structural baseline; tablet 768×1024; mobile 390×844 | Bottom-sheet modal at 390×844 |

### Preconditions

- [ ] Vite dev server running at `http://localhost:5173`
- [ ] NestJS backend running at `http://localhost:3001`
- [ ] Test user `test@example.com` / `password123`
- [ ] At least one transaction exists (for soft-delete test)

---

## 11. Migration Notes / Breaking Changes

- `Transaction.account` relation is new — existing transactions with `accountId = NULL` are unaffected (relation is optional).
- Transactions that already have a non-null `accountId` in the DB (unlikely in dev, impossible in prod since the column has been there without a FK) will fail the migration if the referenced account UUID doesn't exist. Clean dev environments are safe; run `SELECT * FROM transactions WHERE account_id IS NOT NULL` before migrating.
- No changes to existing Transactions API shape — `accountId` in request/response DTOs already exists.
- `GET /transactions` already accepts `accountId` filter query param — no breaking change.

---

## 12. Checklist

### Backend
- [ ] `AccountType` enum added to schema
- [ ] `Account` model added; `User.accounts` and `Transaction.account` relations wired
- [ ] Migration created and tested
- [ ] `accounts.module.ts`, `accounts.controller.ts`, `accounts.service.ts` implemented
- [ ] All 5 DTOs complete with Swagger decorators
- [ ] `AccountsModule` registered in `app.module.ts`
- [ ] `#accounts/*` path alias added to `tsconfig.json`
- [ ] ≥ 25 unit tests passing
- [ ] Zero TypeScript errors
- [ ] Zero ESLint warnings
- [ ] Live API tested (≥ 23 cases)

### Frontend
- [ ] `npm run generate:api` run — hooks available in `src/api/accounts/`
- [ ] `account.types.ts` created
- [ ] `AccountForm` + tests
- [ ] `AccountModal` + tests
- [ ] `AccountList` + `AccountListItem` + tests
- [ ] `AccountsPage` replaces stub; `/accounts` route loads
- [ ] `TransactionForm` — `accountId` select wired (Step A)
- [ ] `TransactionList` / `TransactionListItem` — Account column added (Step B)
- [ ] `TransactionFilters` — Account filter dropdown added (Step C)
- [ ] All component tests passing
- [ ] Zero TypeScript errors
- [ ] Zero ESLint warnings
- [ ] E2E tests passing (`test-plan/accounts/frontend.md`)
- [ ] Cross-feature TCs added to `test-plan/transactions/frontend.md`
