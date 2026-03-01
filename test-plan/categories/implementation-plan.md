# Phase 5 — Categories Module: Implementation Plan

**Status:** 🔄 In Progress — Backend verified (58/58 API tests ✅); ready for frontend  
**Date:** 2026-03-01  
**Planner:** GitHub Copilot (Planner mode)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prisma Schema Changes](#2-prisma-schema-changes)
3. [Backend Implementation](#3-backend-implementation)
4. [API Contract](#4-api-contract)
5. [Frontend Integration](#5-frontend-integration)
6. [Test Strategy](#6-test-strategy)
7. [Frontend Test Scope](#7-frontend-test-scope)
8. [Backend API Test Plan](#8-backend-api-test-plan)
9. [Breaking Changes & Migration Notes](#9-breaking-changes--migration-notes)
10. [Implementation Checklist](#10-implementation-checklist)

---

## 1. Overview

Categories allow users to tag transactions for reporting and budgeting. Each category is user-scoped (one user cannot see another's categories). Categories support a single level of parent-child nesting (e.g. "Food" → "Groceries", "Restaurants"). Transactions already have a nullable `categoryId` FK column in the schema — this phase wires up the real `Category` model and Prisma relation.

**Key design decisions:**
- Soft-delete (`isActive = false`) when a category is referenced by transactions; hard-delete when it has no transactions.
- Self-referential parent/child relation capped at one level deep (parent itself has no parent).
- `name` + `parentId` + `userId` must be unique together (no two sibling categories with the same name per user).
- `color` (hex string) and `icon` (emoji or short string) are optional display hints for the frontend.

---

## 2. Prisma Schema Changes

### 2.1 New `Category` model

Add after the `Transaction` model in `packages/backend/prisma/schema.prisma`:

```prisma
model Category {
  id          String    @id @default(uuid()) @db.Uuid
  userId      String    @map("user_id") @db.Uuid

  name        String
  description String?
  color       String?           // hex colour, e.g. "#FF5733"
  icon        String?           // emoji or icon name, e.g. "🛒"

  parentId    String?   @map("parent_id") @db.Uuid

  isActive    Boolean   @default(true) @map("is_active")

  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime  @updatedAt      @map("updated_at") @db.Timestamptz

  // Relations
  user         User          @relation(fields: [userId], references: [id])
  parent       Category?     @relation("CategoryChildren", fields: [parentId], references: [id])
  children     Category[]    @relation("CategoryChildren")
  transactions Transaction[]

  @@unique([userId, name, parentId])
  @@index([userId])
  @@index([userId, isActive])
  @@map("categories")
}
```

### 2.2 Update `User` model

Add the relation field to `User`:

```prisma
categories   Category[]
```

### 2.3 Update `Transaction` model

Add the real Prisma relation (the FK column `categoryId` already exists):

```prisma
category     Category?   @relation(fields: [categoryId], references: [id])
```

### 2.4 Migration

```bash
cd packages/backend
npx prisma migrate dev --name add_categories_module
```

Verify on fresh database with `npx prisma migrate reset --force` before committing.

---

## 3. Backend Implementation

### 3.1 File tree

```
packages/backend/src/categories/
├── categories.module.ts
├── categories.controller.ts
├── categories.service.ts
├── dto/
│   ├── create-category.dto.ts
│   ├── update-category.dto.ts
│   └── category-response.dto.ts
└── __TEST__/
    ├── categories.service.spec.ts
    └── categories.controller.spec.ts
```

### 3.2 Path alias

`#categories/*` is **already registered** in `packages/backend/tsconfig.json`. No change needed.

### 3.3 Module registration

Add to `packages/backend/src/app.module.ts`:

```typescript
import {CategoriesModule} from '#categories/categories.module.js';
// ... add CategoriesModule to imports array
```

### 3.4 DTOs

#### `create-category.dto.ts`

| Field | Type | Constraints |
|---|---|---|
| `name` | `string` | required, non-empty, max 100 |
| `description` | `string?` | optional, max 255 |
| `color` | `string?` | optional, regex `/^#[0-9A-Fa-f]{6}$/` |
| `icon` | `string?` | optional, max 10 |
| `parentId` | `string (UUID)?` | optional, `@IsUUID()` |

#### `update-category.dto.ts`

Partial of `CreateCategoryDto` plus `isActive?: boolean`.

#### `category-response.dto.ts`

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | UUID |
| `userId` | `string` | UUID |
| `name` | `string` | |
| `description` | `string \| null` | |
| `color` | `string \| null` | |
| `icon` | `string \| null` | |
| `parentId` | `string \| null` | UUID or null |
| `isActive` | `boolean` | |
| `transactionCount` | `number` | count of linked transactions (active + inactive) |
| `children` | `CategoryResponseDto[]` | only populated on `findAll` tree response; empty array otherwise |
| `createdAt` | `string` | ISO 8601 |
| `updatedAt` | `string` | ISO 8601 |

### 3.5 Service methods

```typescript
// All methods require userId — no cross-user access possible

findAll(userId: string): Promise<CategoryResponseDto[]>
// Returns flat list ordered by (parentId nulls first, name).
// Includes transactionCount for each category.
// Does NOT filter by isActive — UI decides whether to show inactive.

findOne(userId: string, id: string): Promise<CategoryResponseDto>
// Throws NotFoundException if not found or belongs to another user.

create(userId: string, dto: CreateCategoryDto): Promise<CategoryResponseDto>
// Validates parentId exists and belongs to userId (if provided).
// Validates parent has no parent itself (depth limit = 1).
// Throws ConflictException on duplicate name within same parent.

update(userId: string, id: string, dto: UpdateCategoryDto): Promise<CategoryResponseDto>
// Calls findOne first; throws 404 if not found.
// Re-validates parentId if changed.
// Throws ConflictException on duplicate name.

remove(userId: string, id: string): Promise<void>
// Hard-deletes if transactionCount === 0 AND children.length === 0.
// Soft-deletes (isActive = false) if referenced by transactions.
// Throws BadRequestException if category has active children — user must
// reassign or delete children first.
```

### 3.6 Controller routes

All routes protected with `@UseGuards(JwtAuthGuard)` and scoped by `@CurrentUser()`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/categories` | List all categories for authenticated user |
| `GET` | `/categories/:id` | Get single category by ID |
| `POST` | `/categories` | Create new category |
| `PATCH` | `/categories/:id` | Update category (partial) |
| `DELETE` | `/categories/:id` | Delete category (hard or soft) |

---

## 4. API Contract

### `GET /categories`

**Auth:** Bearer token required

**Response 200:**
```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "name": "Food",
    "description": null,
    "color": "#FF5733",
    "icon": "🍔",
    "parentId": null,
    "isActive": true,
    "transactionCount": 12,
    "children": [],
    "createdAt": "2026-01-15T10:00:00Z",
    "updatedAt": "2026-01-15T10:00:00Z"
  },
  {
    "id": "uuid2",
    "name": "Groceries",
    "parentId": "uuid",
    ...
  }
]
```

### `GET /categories/:id`

**Auth:** Bearer token required

**Response 200:** Single `CategoryResponseDto`  
**Response 404:** `{ "statusCode": 404, "message": "Category not found" }`

### `POST /categories`

**Auth:** Bearer token required

**Request body:**
```json
{
  "name": "Groceries",
  "description": "Weekly grocery shopping",
  "color": "#4CAF50",
  "icon": "🛒",
  "parentId": "uuid-of-food-category"
}
```

**Response 201:** `CategoryResponseDto`  
**Response 400:** Validation error (missing name, invalid color, invalid UUID)  
**Response 409:** `{ "message": "A category with this name already exists at this level" }`

### `PATCH /categories/:id`

**Auth:** Bearer token required

**Request body:** Any subset of create fields + optional `isActive: boolean`

**Response 200:** `CategoryResponseDto`  
**Response 404:** Category not found  
**Response 409:** Duplicate name conflict

### `DELETE /categories/:id`

**Auth:** Bearer token required

**Response 204:** No content (hard-deleted — no transactions/children)  
**Response 200:** `CategoryResponseDto` with `isActive: false` (soft-deleted)  
**Response 400:** `{ "message": "Delete or reassign child categories before deleting this category" }`  
**Response 404:** Category not found

---

## 5. Frontend Integration

### 5.1 Prerequisite

Run `npm run generate:api` in `packages/frontend` **after** the backend Swagger is stable (all endpoints implemented and decorated). This generates:
- `src/api/categories/categories.ts` — React Query hooks
- `src/api/model/categoryResponseDto.ts`
- `src/api/model/createCategoryDto.ts`
- `src/api/model/updateCategoryDto.ts`

### 5.2 File tree

```
packages/frontend/src/features/categories/
├── types/
│   └── category.types.ts        ← frontend-only UI types (no DTO redefinition)
├── components/
│   ├── CategoryList.tsx
│   ├── CategoryList.css
│   ├── CategoryListItem.tsx
│   ├── CategoryListItem.css
│   ├── CategoryForm.tsx          ← used for both create and edit
│   ├── CategoryForm.css
│   ├── DeleteCategoryModal.tsx
│   ├── DeleteCategoryModal.css
│   └── __TEST__/
│       ├── CategoryList.test.tsx
│       ├── CategoryListItem.test.tsx
│       ├── CategoryForm.test.tsx
│       └── DeleteCategoryModal.test.tsx
packages/frontend/src/pages/
└── CategoriesPage.tsx            ← replace stub (CategoriesPage.css as needed)
```

### 5.3 Types (`category.types.ts`)

Only define frontend-only types. Do **not** redefine backend DTOs:

```typescript
// Import generated types where needed:
// import type { CategoryResponseDto } from '@/api/model/categoryResponseDto.js';
// import type { CreateCategoryDto } from '@/api/model/createCategoryDto.js';

export type CategoryFormMode = 'create' | 'edit';
export type CategoryView = 'flat' | 'tree';
```

### 5.4 `CategoriesPage` layout

```
┌───────────────────────────────────────────────────────────┐
│  Categories                          [+ New Category]     │
├───────────────────────────────────────────────────────────┤
│  [ ] Show inactive                                        │
│                                                           │
│  ▸ Food (12 transactions)                    [Edit] [✕]   │
│    ├── Groceries (8)                         [Edit] [✕]   │
│    └── Restaurants (4)                       [Edit] [✕]   │
│  ▸ Transport (5)                             [Edit] [✕]   │
│    └── Fuel (5)                              [Edit] [✕]   │
│  ▸ Entertainment (0)                         [Edit] [✕]   │
│                                                           │
│  (empty state: "No categories yet. Create your first...")  │
└───────────────────────────────────────────────────────────┘
```

### 5.5 Component responsibilities

| Component | Responsibility |
|---|---|
| `CategoriesPage` | Fetches all categories via `useCategoriesControllerFindAll()`, holds modal open/close state, passes data to `CategoryList` |
| `CategoryList` | Renders grouped list (parents first, children indented); toggles show/hide inactive |
| `CategoryListItem` | Single row: icon + colour swatch + name + count + Edit/Delete buttons |
| `CategoryForm` | Controlled form for create and edit; colour picker input, parent dropdown, icon emoji input; uses `useCategoriesControllerCreate()` / `useCategoriesControllerUpdate()` |
| `DeleteCategoryModal` | Confirmation dialog; shows warning if category is soft-deleted (has transactions) vs hard-deleted |

### 5.6 Route

`/categories` route is **already registered** in `src/routes/index.tsx` pointing to `CategoriesPage`. `APP_ROUTES.CATEGORIES` constant already exists. No route changes needed.

### 5.7 TransactionForm integration

After categories are implemented, update `TransactionForm.tsx` to replace the free-text `category` field with a `<select>` populated from `useCategoriesControllerFindAll()`. This is a follow-up task within Phase 5 — do it after the CategoriesPage is working.

> **Note**: The `CreateTransactionDto` `categoryId` field already exists. The `category` (string) field can be kept as a `description`-level field or removed — confirm with `transaction-response.dto.ts` and the current transaction form before changing.

---

## 6. Test Strategy

### Backend unit tests (Vitest)

| File | What to test |
|---|---|
| `categories.service.spec.ts` | `create` (happy path, conflict, invalid parentId, depth > 1), `findAll`, `findOne` (own vs other user), `update` (name conflict, parentId change), `remove` (hard delete, soft delete, has-children guard) |
| `categories.controller.spec.ts` | All five routes: correct status codes, guard applied, `@CurrentUser()` used, DTO mapping |

Target: `~40` unit tests across service + controller.

> **Actual (2026-03-01):** 239 backend unit tests total; categories module at **100% statements / branches / functions / lines**. Includes coverage for `checkNameUnique`, HTTP 204 hard-delete, soft-delete, depth guard, and `ValidateIf` null-clear paths.

### Frontend component tests (Vitest + RTL)

| File | Focus |
|---|---|
| `CategoryList.test.tsx` | Renders categories, shows empty state, show/hide inactive toggle |
| `CategoryListItem.test.tsx` | Displays name/icon/count, Edit/Delete button trigger correct callbacks |
| `CategoryForm.test.tsx` | Create mode validation, edit mode pre-population, submit success/error, colour input |
| `DeleteCategoryModal.test.tsx` | Shows soft-delete warning vs hard-delete warning, confirm/cancel |

Use `vi.mock('@/api/categories/categories.js')` to mock Orval hooks. All queries accessibility-first.

---

## 7. Frontend Test Scope

> For the **frontend-tester** agent to expand into a full Playwright test plan.

**Preconditions:**
- Backend running (`npm run start:dev` in `packages/backend`)
- At least one authenticated test user in the DB
- No pre-existing categories for that user (clean state)

**Coverage level:** Full regression

### User flows to cover

#### 7.1 Happy paths
1. **Create top-level category** — click "+ New Category", fill name, pick colour, submit → appears in list
2. **Create child category** — create with a parent → appears indented under parent
3. **Edit category** — click Edit on existing → form pre-fills → change name/colour → save → list updates
4. **Delete category (hard)** — category with 0 transactions → confirm → removed from list
5. **Delete category (soft)** — category with transactions → confirm → row marked inactive (hidden by default)
6. **Show/hide inactive** — toggle "Show inactive" checkbox → inactive categories appear/disappear
7. **Duplicate name prevented** — attempt to create two categories with same name at same level → inline error shown

#### 7.2 Edge cases
8. **Empty state** — fresh user sees "No categories yet" message
9. **Very long name** — 100-character name truncated gracefully in list
10. **Invalid hex colour** — free-text colour field rejects bad format
11. **Delete category that has children** — error message shown, category not deleted
12. **Modal cancel** — open create/delete modal, press Cancel → no changes

#### 7.3 Error states
13. **API unavailable** — network error during list fetch → error message shown, not blank screen
14. **Optimistic update failure** — create/update returns 500 → form re-enables, error banner shown

#### 7.4 Auth redirect
15. **Unauthenticated access** — visit `/categories` without token → redirected to `/login`

---

## 8. Backend API Test Plan

> **Executed 2026-03-01 — 58/58 PASS.** Full results: `test-plan/categories/backend-report.md` (commit `5dbfdf7`).

**Preconditions:** Backend running on `localhost:3001`, valid JWT for a test user, second JWT for isolation checks.

### Endpoints to validate

#### `GET /categories`

| Scenario | Expected status | Notes | Live result |
|---|---|---|---|
| Authenticated, no categories | 200 | Returns `[]` | ✅ TC-30 |
| Authenticated, has categories | 200 | Returns array with `transactionCount` populated | ✅ TC-30 |
| Data isolation — other user's categories not returned | 200 `[]` | | ✅ TC-31 |
| `children` always `[]` on list (flat) | 200 | By design | ✅ TC-32 |
| Inactive categories included (no isActive filter) | 200 | | ✅ TC-33 |
| No auth header | 401 | | ✅ TC-02 |

#### `POST /categories`

| Scenario | Request body | Expected status | Live result |
|---|---|---|---|
| Valid top-level | `{ name: "Food" }` | 201 | ✅ TC-16 |
| Valid with all fields | `{ name: "Groceries", color: "#4CAF50", icon: "🛒", parentId: "<uuid>" }` | 201 | ✅ TC-13 |
| Response has all 12 DTO fields | — | 201 | ✅ TC-14–15 |
| Missing name | `{}` | 400 | ✅ TC-07 |
| Empty name | `{ name: "" }` | 400 | ✅ TC-08 |
| Name > 100 chars | — | 400 | ✅ TC-09 |
| Invalid colour | `{ name: "X", color: "red" }` | 400 | ✅ TC-10 |
| Invalid parentId (not UUID) | `{ name: "X", parentId: "abc" }` | 400 | ✅ TC-11 |
| parentId non-existent | `{ name: "X", parentId: "<zero-uuid>" }` | 404 | ✅ TC-19 |
| parent has a parent (depth > 1) | `{ name: "X", parentId: "<child-uuid>" }` | 400 | ✅ TC-22 |
| Duplicate name at same level | create "Food" twice | 409 | ✅ TC-17 |
| Duplicate name under same parent | second "Groceries" under Food | 409 | ✅ TC-23 |
| Same name OK at different parent level | top-level vs under parent | 201 | ✅ TC-24 |
| Soft-deleted name can be reused | `isActive=false` then create same name | 201 | ✅ TC-45 |
| 409 body has no stack trace / Prisma internals | — | — | ✅ TC-18 |
| No auth | — | 401 | ✅ TC-03 |

#### `GET /categories/:id`

| Scenario | Expected status | Live result |
|---|---|---|
| Own category | 200 | ✅ TC-25 |
| Other user's category ID | 404 | ✅ TC-28 |
| Non-existent UUID | 404 | ✅ TC-26 |
| 404 body has no stack trace / Prisma internals | — | ✅ TC-27 |
| No auth | 401 | ✅ TC-06 |

#### `PATCH /categories/:id`

| Scenario | Expected status | Live result |
|---|---|---|
| Rename | 200 | ✅ TC-34 |
| Update color + icon | 200 | ✅ TC-35 |
| Clear nullable fields with `null` (description, color, icon) | 200 | ✅ TC-36–37 |
| Set `isActive: false` | 200 | ✅ TC-41 |
| Set `isActive: true` (reactivate) | 200 | ✅ TC-42 |
| Reparent to valid parent | 200 | — (covered in unit tests) |
| Reparent to non-existent parent | 404 | ✅ TC-43 |
| Reparent exceeds depth limit | 400 | ✅ TC-44 |
| Duplicate name conflict | 409 | ✅ TC-38 |
| Not found | 404 | ✅ TC-39 |
| Other user's category | 404 | ✅ TC-40 |
| No auth | 401 | ✅ TC-04 |

#### `DELETE /categories/:id`

| Scenario | Expected status | Notes | Live result |
|---|---|---|---|
| No transactions, no children | 204 | Hard delete | ✅ TC-51 |
| Response body empty on 204 | — | `raw=""` | ✅ TC-52 |
| GET after hard-delete → 404 | 404 | Fully removed | ✅ TC-53 |
| Has transactions | 200 | Soft delete: `isActive: false` returned | ⚠️ **Not tested live** — requires seeded transaction; covered in unit tests only |
| Has children | 400 | Error message returned | ✅ TC-49 |
| 400 body has no stack trace / Prisma internals | — | | ✅ TC-50 |
| Not found | 404 | | ✅ TC-46 |
| Other user's category | 404 | | ✅ TC-48 |
| No auth | 401 | | ✅ TC-05 |

---

## 9. Breaking Changes & Migration Notes

- **No breaking changes** to existing Transaction endpoints — `categoryId` was already nullable and already stored as a UUID FK column (without a real relation). After this migration the FK is enforced, so any orphaned `categoryId` values in existing transactions will cause the migration to fail. Verify the database is clean before migrating (new installs are fine; production data needs a check).
- **`TransactionResponseDto`** should be updated to include an optional `category` object (name + colour + icon) for display purposes. This is a **non-breaking additive change** — add after the categories backend is stable.
- **`TransactionForm`** free-text `category` string field: after this phase, the `categoryId` FK should be used instead. The old string field (`category` column) does not exist in the current schema — `categoryId` is the FK. The form currently passes `categoryId` as an optional UUID field — replacing the text input with a select populated from the categories API is the migration needed in the frontend.

---

## 10. Implementation Checklist

### Backend
- [x] Prisma schema: `Category` model added, `User.categories` and `Transaction.category` relations wired
- [x] Migration created and tested on fresh database
- [x] `CategoriesModule` created with `categories.module.ts`, `categories.service.ts`, `categories.controller.ts`
- [x] All 5 DTOs created with full `@ApiProperty` decorators and `class-validator` rules
- [x] `#categories/*` alias already in `tsconfig.json` — confirm it resolves correctly
- [x] `CategoriesModule` registered in `app.module.ts`
- [x] `TransactionsModule` exports `TransactionsService` (already does) — no change needed for FK validation
- [x] All 5 endpoints implemented with `JwtAuthGuard` and `@CurrentUser()`
- [x] Unit tests: 239 backend tests total; categories module 100% statements/branches/functions/lines
- [x] Post-review fixes: HTTP 204 hard-delete, `checkNameUnique` null-uniqueness guard, `isActive:true` filter on `checkNameUnique`, `@ValidateIf` on nullable DTO fields
- [x] Zero lint errors (`npm run lint`)
- [x] Swagger UI shows all 5 endpoints under `categories` tag
- [x] **Backend API tested live — 58/58 PASS** (see `test-plan/categories/backend-report.md`)

### Frontend (after `npm run generate:api`)
- [ ] Orval-generated hooks available in `src/api/categories/`
- [ ] `category.types.ts` created (frontend-only types only)
- [ ] `CategoryList`, `CategoryListItem`, `CategoryForm`, `DeleteCategoryModal` components built
- [ ] `CategoriesPage` stub replaced with full implementation
- [ ] `/categories` route already wired — verify page loads without blank screen
- [ ] `TransactionForm` updated to use `categoryId` select from categories API
- [ ] All component tests passing (≥ 30 tests)
- [ ] Zero TypeScript errors (`get_errors`)
- [ ] Zero ESLint warnings (`npx eslint src/features/categories/ src/pages/CategoriesPage.tsx --max-warnings 0`)

---

## Handoff Recommendations

1. ~~**`@backend-dev`** — implement the Prisma schema change + migration first, then the categories module (service → controller → DTOs → Swagger). Use `packages/backend/src/transactions/` as the reference pattern.~~ ✅ Done (commits `9938644`, `d64d0da`)
2. ~~**`@test-writer`** — write Vitest unit tests for `CategoriesService` and `CategoriesController` immediately after the module compiles.~~ ✅ Done (239 tests, 100% coverage)
3. ~~**`@code-reviewer`** — review backend before committing; pay attention to the self-referential relation, depth-limit guard, and soft-vs-hard delete logic.~~ ✅ Done (two rounds; fixes in commit `62008b0`)
4. ~~**`@backend-tester`** — validate all endpoints in section 8 against the running server; save results to `test-plan/categories/backend-report.md`.~~ ✅ Done — 58/58 PASS (commit `5dbfdf7`)
5. **→ NEXT: Run `npm run generate:api`** in `packages/frontend` to regenerate the Orval API client from the updated Swagger spec.
6. **`@frontend-dev`** — implement the CategoriesPage and feature components per section 5.
7. **`@frontend-tester`** — expand section 7 into a full Playwright plan; save to `test-plan/categories/frontend.md` and results to `test-plan/categories/frontend-report.md`.

> **Gap to revisit:** The soft-delete path on `DELETE /categories/:id` (returns 200 + `isActive=false`) was not confirmed live because no transactions are seeded. To close this gap, either: (a) run the scenario manually after creating a transaction with a `categoryId`, or (b) add a targeted integration test once the frontend can create transactions with categories.
