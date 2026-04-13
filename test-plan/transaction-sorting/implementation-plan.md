# Transaction Table Column Sorting — Implementation Plan

**Feature:** Server-side column sorting for the Transactions page table
**Date:** 2026-03-27
**Status:** Planning

---

## 1. Current Architecture Summary

### Backend

- **Controller:** `packages/backend/src/transactions/transactions.controller.ts`
  `GET /transactions` accepts a `TransactionFilterDto` query object. The service currently applies a **hard-coded** `orderBy: {date: 'desc'}` (line 89 of `transactions.service.ts`). No sort parameters exist in the DTO or in Swagger.

- **Service:** `packages/backend/src/transactions/transactions.service.ts`
  `findAll()` calls `prisma.transaction.findMany` with `orderBy: {date: 'desc'}` unconditionally. The `buildWhereClause` private helper handles all filter logic but touch nothing about ordering.

- **DTO:** `packages/backend/src/transactions/dto/transaction-filter.dto.ts`
  Contains: `startDate`, `endDate`, `categoryId`, `accountId`, `transactionType`, `isActive`, `search`, `page`, `limit`. No `sortField` or `sortDirection` properties.

- **Prisma schema sortable fields on `Transaction`:**
  `date`, `amount`, `description`, `createdAt`, `updatedAt` — all standard scalar fields that Prisma's `orderBy` accepts without joins.
  `categoryId` and `accountId` are foreign keys — sorting by the resolved category or account name would require a relation `orderBy`, which Prisma supports but adds complexity. These are excluded from the initial scope.

### Frontend

- **Page:** `packages/frontend/src/pages/TransactionsPage.tsx`
  Composes `TransactionFilters`, `TransactionList`, `TransactionSummary`, and `Pagination`. Delegates all filter/sort state to `useTransactionFilters`.

- **Hook:** `packages/frontend/src/features/transactions/hooks/useTransactionFilters.ts`
  Mirrors filter state to URL search params. Calls the Orval-generated `useTransactionsControllerFindAll` hook. Exports `updateFilter`, `setDateRange`, `clearFilters`, `setPage`. The `apiParams` object it builds is typed by `TransactionsControllerFindAllParams` (Orval-generated from Swagger).

- **TransactionList:** `packages/frontend/src/features/transactions/components/TransactionList.tsx`
  A plain `<table>` with static `<th>` elements — no click handlers, no sort indicators. At `max-width: 767px`, the `<thead>` is hidden (`display: none`) and rows switch to block/card layout. The columns visible on desktop are: Date, Description, Amount, Type, Category, Account, Status, Actions.

- **API types:** `packages/frontend/src/api/model/transactionsControllerFindAllParams.ts`
  Orval-generated. Does not include sort params — they will appear after `npm run generate:api` once the backend Swagger is updated.

- **Filter state:** `packages/frontend/src/features/transactions/types/transaction.types.ts`
  `TransactionFilterState` interface holds all URL-mirrored state. Sort fields must be added here.

---

## 2. Design Recommendation

### Where should sort controls live?

**Recommendation: clickable table header cells (click-to-sort pattern), desktop only.**

Rationale:

1. **Industry convention for financial tables.** Mint, YNAB, and Copilot Money all use click-to-sort column headers. Users of financial apps already expect this interaction at the column level, not in a toolbar dropdown.

2. **The table is already sorted by a column (Date).** Date is the current implicit sort. Making it explicit — with a visible direction indicator on the Date header — costs nothing and makes the default state discoverable without any UI changes to the filter bar.

3. **Mobile layout hides the thead.** The CSS at `max-width: 767px` sets `.tx-list__table thead { display: none }`. The table collapses to card-style rows on mobile. Adding sort to the filter bar's existing dropdown interface on mobile is a reasonable secondary affordance, but the sort controls in table headers will simply not appear on mobile (as intended).

4. **Column eligibility.** Not all columns are sensible sort targets:
   - **Date** — primary sort, most important, already the default. Sortable.
   - **Amount** — high value for "find largest expenses". Sortable.
   - **Description** — alphabetical sort, useful for grouping by merchant. Sortable.
   - **Type** — enum with only 3 values; sorting by type is low value when a type filter already exists. Not sortable in v1.
   - **Category** — resolving to category name requires a Prisma relation orderBy. Deferred.
   - **Account** — same issue as Category. Deferred.
   - **Status** — boolean; low value as a sort axis. Not sortable in v1.
   - **Actions** — never sortable.

5. **State management location.** Sort field and direction should live in the URL search params alongside filters, using the same `updateFilter` pattern already established in `useTransactionFilters`. This means sort state survives page refresh and can be bookmarked — consistent with how the existing filters work.

### Mobile consideration

On mobile (< 768px), the thead is hidden. The sort controls in headers will simply be invisible. For v1, this is acceptable — mobile users see only Date and Amount in the card layout anyway, and the API will still apply the active sort. A future improvement could add a compact sort control to the filters bar for mobile, but that is out of scope here.

---

## 3. Copy-First Assessment

- **Backend layer:** This is a straightforward extension of the existing CRUD pattern — add two new fields to an existing DTO, thread them through the service's `findAll`, and update Swagger decorators. Copy-first applies.
- **Frontend layer:** The changes fit the existing pattern — extend `TransactionFilterState`, extend `useTransactionFilters`, modify `TransactionList` headers, add CSS. Copy-first applies. No new page, no wizard, no SSE.

---

## 4. Step-by-Step Implementation Plan

### Phase A — Backend (no Prisma migration required)

#### Step A1: Add sort params to `TransactionFilterDto`

**File:** `packages/backend/src/transactions/dto/transaction-filter.dto.ts`

Add two new optional fields:

```
sortField?: 'date' | 'amount' | 'description' | 'createdAt'
sortDirection?: 'asc' | 'desc'
```

Validation rules:
- `sortField`: `@IsIn(['date', 'amount', 'description', 'createdAt'])`, `@IsString()`, `@IsOptional()`. Default: `'date'`.
- `sortDirection`: `@IsIn(['asc', 'desc'])`, `@IsString()`, `@IsOptional()`. Default: `'desc'`.

Both need `@ApiProperty` decorators so Orval picks them up.

#### Step A2: Update `TransactionsService.findAll`

**File:** `packages/backend/src/transactions/transactions.service.ts`

Replace the hard-coded `orderBy: {date: 'desc'}` with a dynamic `orderBy` derived from `filters.sortField` and `filters.sortDirection`. Apply defaults in the service (not relying on DTO defaults alone, since DTO defaults only apply to query-string coercion).

The allowed sort fields map cleanly to Prisma scalar fields on the `Transaction` model — no join needed. The implementation should construct `orderBy` as `{[field]: direction}`.

#### Step A3: Add `@ApiQuery` decorators to the controller

**File:** `packages/backend/src/transactions/transactions.controller.ts`

Add two `@ApiQuery` decorators to the `findAll` endpoint:
- `sortField`: optional, enum `['date', 'amount', 'description', 'createdAt']`, default `'date'`
- `sortDirection`: optional, enum `['asc', 'desc']`, default `'desc'`

This makes the params appear in the Swagger spec and gets picked up by `npm run generate:api`.

#### Step A4: Update backend unit tests

**File:** `packages/backend/src/transactions/__TEST__/transactions.service.spec.ts`

Add test cases for:
- Default sort (`date desc`) is applied when no sort params provided
- `sortField: 'amount'` passes `orderBy: {amount: 'asc'}` (or `desc`) to Prisma
- `sortField: 'description'` passes `orderBy: {description: ...}`
- Invalid `sortField` is rejected by validation (controller spec)

---

### Phase B — API Regeneration (before frontend begins)

**Command:** In `packages/frontend`, run `npm run generate:api`.

Before running, delete `packages/frontend/src/api/` to avoid stale exports (per project convention in `feedback_orval_regeneration.md`).

This regenerates `transactionsControllerFindAllParams.ts` to include `sortField` and `sortDirection` with the correct enum types.

**Gate:** Frontend implementation must not begin until this regeneration is complete and the new types are committed.

---

### Phase C — Frontend

#### Step C1: Extend `TransactionFilterState`

**File:** `packages/frontend/src/features/transactions/types/transaction.types.ts`

Add to the `TransactionFilterState` interface:

```typescript
sortField: 'date' | 'amount' | 'description' | 'createdAt';
sortDirection: 'asc' | 'desc';
```

Define a new union type for reuse:
```typescript
export type TransactionSortField = 'date' | 'amount' | 'description' | 'createdAt';
export type SortDirection = 'asc' | 'desc';
```

#### Step C2: Extend `useTransactionFilters`

**File:** `packages/frontend/src/features/transactions/hooks/useTransactionFilters.ts`

Changes:
1. Read `sortField` and `sortDirection` from `searchParams` with defaults `'date'` and `'desc'`.
2. Include them in the `filters` object returned by the hook.
3. Include them in `apiParams` (after Orval regeneration, these will be typed as valid params on `TransactionsControllerFindAllParams`).
4. Add a new exported function `setSort(field: TransactionSortField, direction: SortDirection): void` that:
   - Updates `sortField` and `sortDirection` in URL search params.
   - Resets `page` to `1` (same as other filter changes).
   - If the user clicks the currently-active sort column, toggles the direction; if they click a new column, sets direction to `'desc'` (most relevant default for financial data).
5. Update `clearFilters` to reset sort to `('date', 'desc')`.

Return signature changes:
```typescript
export interface UseTransactionFiltersReturn {
    // ...existing fields...
    sortField: TransactionSortField;
    sortDirection: SortDirection;
    setSort: (field: TransactionSortField, direction: SortDirection) => void;
}
```

#### Step C3: Update `TransactionList` component

**File:** `packages/frontend/src/features/transactions/components/TransactionList.tsx`

Changes to the `TransactionListProps` interface:
```typescript
interface TransactionListProps {
    // ...existing...
    sortField: TransactionSortField;
    sortDirection: SortDirection;
    onSort: (field: TransactionSortField) => void;
}
```

For each sortable column header (`Date`, `Description`, `Amount`):
- Replace the static `<th>` with a `<button>` inside the `<th>` (or make the entire `<th>` a button via `role="button"` on the th — use a `<button>` inside the `<th>` for best accessibility).
- Display a sort direction indicator icon when that column is the active sort field. Use `aria-sort` on the `<th>` element (`'ascending'` | `'descending'` | `'none'`) for accessibility.
- The button's `onClick` calls `onSort(field)`. Direction toggling lives in `useTransactionFilters.setSort`, not in the component.

Non-sortable columns (`Type`, `Category`, `Account`, `Status`, `Actions`) remain as static `<th>` elements.

#### Step C4: Wire sort into `TransactionsPage`

**File:** `packages/frontend/src/pages/TransactionsPage.tsx`

Destructure `sortField`, `sortDirection`, and `setSort` from `useTransactionFilters()`.

Pass to `TransactionList`:
```tsx
<TransactionList
    ...
    sortField={sortField}
    sortDirection={sortDirection}
    onSort={(field) => { setSort(field, field === sortField ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'desc'); }}
/>
```

Note: the toggle logic can live either in the page handler (as above) or inside `setSort` in the hook. Keeping it in the hook is cleaner — the hook can inspect the current `sortField` from URL params internally. Either location is acceptable; prefer the hook so `TransactionsPage` stays thin.

#### Step C5: Add sort indicator CSS

**File:** `packages/frontend/src/features/transactions/components/TransactionList.css`

Add styles for:
- `.tx-list__th--sortable` — cursor pointer, hover state
- `.tx-list__th--sort-active` — accent color or subtle emphasis for the active column
- `.tx-list__sort-btn` — the button inside the `<th>`, styled to look like the header text (no button chrome)
- `.tx-list__sort-icon` — the chevron/arrow icon; rotates or swaps based on direction
- Transition for the icon so the direction change feels smooth

The sort icon should come from the existing `lucide-react` package (already a dependency — `ChevronUp` / `ChevronDown` or `ArrowUpDown` for inactive columns).

---

## 5. API Contract

### Updated endpoint

```
GET /transactions
```

**New query parameters (added to existing set):**

| Parameter | Type | Allowed values | Default | Description |
|---|---|---|---|---|
| `sortField` | string (optional) | `date`, `amount`, `description`, `createdAt` | `date` | Field to sort by |
| `sortDirection` | string (optional) | `asc`, `desc` | `desc` | Sort direction |

**No change to response shape.** The `PaginatedTransactionsResponseDto` is unchanged. Only the ordering of results within `data[]` changes.

**Validation:** Invalid enum values for `sortField` or `sortDirection` return `400 Bad Request` via NestJS class-validator, consistent with existing filter validation.

---

## 6. Data Model Changes

**No Prisma schema changes.** No migration required.

All sort fields (`date`, `amount`, `description`, `createdAt`) are existing scalar columns on the `Transaction` model. The `@@index([userId, date])` index already covers the default sort case efficiently. Sorting by `amount` or `description` without an index will result in a sequential scan across the user's transactions — acceptable for personal finance volumes (typically < 10,000 rows per user). Index additions can be deferred to a performance phase.

---

## 7. Frontend Integration Points

| Integration point | File | Nature of change |
|---|---|---|
| Filter state type | `@features/transactions/types/transaction.types.ts` | Add `sortField`, `sortDirection` fields and union types |
| Filter hook | `@features/transactions/hooks/useTransactionFilters.ts` | Read/write sort state from URL params; add `setSort`; thread into `apiParams` |
| Transaction list | `@features/transactions/components/TransactionList.tsx` | New props `sortField`, `sortDirection`, `onSort`; clickable headers |
| Transaction list CSS | `@features/transactions/components/TransactionList.css` | Sort button styles, active indicator, icon |
| Transactions page | `@pages/TransactionsPage.tsx` | Destructure and pass new sort props; wire `onSort` handler |
| Generated API types | `@/api/model/transactionsControllerFindAllParams.ts` | Auto-updated by `npm run generate:api` — do not edit manually |

---

## 8. Test Strategy

### Backend unit tests (Vitest, co-located in `__TEST__/`)

**`transactions.service.spec.ts`:**
- Default call (no sort params): `prisma.transaction.findMany` called with `orderBy: {date: 'desc'}`
- `sortField: 'amount', sortDirection: 'asc'`: `orderBy: {amount: 'asc'}`
- `sortField: 'description', sortDirection: 'desc'`: `orderBy: {description: 'desc'}`
- `sortField: 'createdAt'`: `orderBy: {createdAt: 'desc'}` (default direction)
- Sort state is independent of filter state — existing filter tests should continue to pass

**`transactions.controller.spec.ts`:**
- Invalid `sortField` value returns 400
- Invalid `sortDirection` value returns 400

### Frontend unit tests (Vitest + RTL)

**`useTransactionFilters.test.ts`:**
- `sortField` defaults to `'date'`
- `sortDirection` defaults to `'desc'`
- `setSort('amount', 'asc')` updates URL params correctly
- `setSort` resets page to 1
- `clearFilters` resets sort to `('date', 'desc')`
- `apiParams` includes `sortField` and `sortDirection` after state change

**`TransactionList.test.tsx`:**
- Date column header renders with `aria-sort="descending"` when `sortField='date'` and `sortDirection='desc'`
- Clicking the Date header calls `onSort('date')`
- Clicking Amount header calls `onSort('amount')`
- Non-sortable headers (Type, Category, Status) do not have click handlers
- When `sortField='amount'`, Amount header has `aria-sort` set; Date header has `aria-sort="none"`

---

## 9. Figma Design Brief

This feature has UI changes. The figma-designer agent should produce mockups before React implementation begins.

### Screens affected

**Transactions Page (existing) — table header update only.** No new screen or route.

### Components to design

#### Sortable Table Header Cell (3 states)

The `<th>` for Date, Description, and Amount columns will become clickable. Design needed for:

1. **Inactive (not sorted):** A neutral sort indicator — e.g., a double-headed arrow icon or up-down chevron, subdued color — signals the column is sortable but not currently active.
2. **Active ascending:** Column label + upward arrow/chevron in accent color. `aria-sort="ascending"` is set on the element.
3. **Active descending:** Column label + downward arrow/chevron in accent color. `aria-sort="descending"` is set on the element.

**Key content slots:**
- Column label text (e.g., "Date", "Amount")
- Sort direction icon (inline, right of label)
- Hover state (cursor pointer, subtle background shift)

**Constraints:**
- The existing `<th>` padding and background (`var(--color-gray-50)`, `var(--color-gray-500)` text, `var(--font-size-xs)`, `font-weight-semibold`, uppercase) must be preserved — the sort control fits within these existing styles.
- The button inside the `<th>` must look like header text, not a browser default button.
- Do not change column widths.

### Layout notes

- No new panels, modals, sidebars, or route changes.
- Mobile layout (`< 768px`): thead is hidden — sort indicators will not appear. No mobile-specific design needed for v1.

### Design token guidance

- Active sort indicator: use `var(--color-primary)` or the existing accent/link color (do not introduce a new token).
- Inactive sort indicator: use `var(--color-gray-400)` or similar to appear subordinate.
- Hover state on sortable header: subtle background shift, matching the existing row hover pattern.

---

## 10. Frontend Test Scope

For the frontend-tester agent to expand into a concrete Playwright test plan.

### Coverage level: regression

### Preconditions

- User is authenticated (seeded test account with JWT).
- Backend is running and has at least 10 transactions across two or more dates and amounts.
- Default page state: sorted by date descending, current month filter active.

### User flows to cover

**Happy path — click to sort by column:**
1. Load the Transactions page. Confirm Date header shows descending sort indicator.
2. Click the Date header. Confirm sort direction flips to ascending. Confirm first row is now the oldest date.
3. Click Date again. Confirm direction returns to descending. Confirm first row is the most recent date.
4. Click the Amount header. Confirm Amount shows active descending sort. Confirm first row is the highest amount.
5. Click Description header. Confirm Description shows ascending sort. Confirm rows are alphabetically ordered.

**Sort survives page reload:**
6. Set sort to Amount ascending. Refresh the page. Confirm Amount column still shows ascending indicator and sort is preserved (URL param present).

**Sort resets on Clear Filters:**
7. Set sort to Amount descending. Click "Clear" in the filter bar. Confirm sort resets to Date descending.

**Sort + filter combination:**
8. Filter by type = Expense. Then click Amount to sort descending. Confirm only expense rows are shown and they are sorted by amount.

**Sort resets to page 1:**
9. Navigate to page 2. Click the Amount column header. Confirm page resets to 1.

**Edge cases:**
10. With 0 matching transactions (all filtered out), confirm no sort indicators are rendered in an errored or empty state (the table thead is hidden when empty/loading/error per current code).

**Non-sortable columns:**
11. Confirm Type, Category, Account, Status, and Actions column headers are not clickable (no pointer cursor, no `aria-sort` attribute).

**Accessibility:**
12. Confirm active sort column header has `aria-sort` attribute set to `"ascending"` or `"descending"`.
13. Confirm inactive sortable headers have `aria-sort="none"`.

---

## 11. Backend API Test Plan

For the backend-tester agent.

### Endpoint: `GET /transactions`

All cases require a valid `Authorization: Bearer <token>` header unless otherwise noted.

| # | Scenario | Params | Expected status | Expected behavior |
|---|---|---|---|---|
| B1 | Default sort (no params) | (none) | 200 | `data[0]` has the most recent date |
| B2 | Sort by date ascending | `sortField=date&sortDirection=asc` | 200 | `data[0]` has the oldest date |
| B3 | Sort by amount descending | `sortField=amount&sortDirection=desc` | 200 | `data[0]` has the highest amount |
| B4 | Sort by amount ascending | `sortField=amount&sortDirection=asc` | 200 | `data[0]` has the lowest amount |
| B5 | Sort by description ascending | `sortField=description&sortDirection=asc` | 200 | `data` alphabetically ordered A→Z |
| B6 | Sort by description descending | `sortField=description&sortDirection=desc` | 200 | `data` alphabetically ordered Z→A |
| B7 | Sort by createdAt desc | `sortField=createdAt&sortDirection=desc` | 200 | `data[0].createdAt >= data[1].createdAt` |
| B8 | Invalid sortField value | `sortField=foobar` | 400 | Validation error response |
| B9 | Invalid sortDirection value | `sortDirection=sideways` | 400 | Validation error response |
| B10 | Sort + filter combined | `sortField=amount&sortDirection=asc&transactionType=expense` | 200 | Only expense rows, ordered by amount asc |
| B11 | Sort + pagination | `sortField=date&sortDirection=asc&page=2&limit=5` | 200 | Page 2 of date-asc results, 5 items max |
| B12 | No auth | (no token) | 401 | Unauthorized |
| B13 | sortField only (no direction) | `sortField=amount` | 200 | Defaults to `desc`; highest amount first |
| B14 | sortDirection only (no field) | `sortDirection=asc` | 200 | Defaults to `date`; oldest date first |

**Example request body (B3):**
```
GET /transactions?sortField=amount&sortDirection=desc&startDate=2026-01-01T00:00:00.000Z&endDate=2026-12-31T23:59:59.999Z
Authorization: Bearer <token>
```

**Expected response shape (unchanged):**
```json
{
  "data": [ /* TransactionResponseDto[] */ ],
  "total": 142,
  "page": 1,
  "limit": 50
}
```

---

## 12. Breaking Changes and Migration Notes

- **No database migration.** No schema changes.
- **No breaking change to existing API consumers.** The new `sortField` and `sortDirection` params are optional with defaults that reproduce the current behaviour (`date desc`).
- **Orval regeneration required** before frontend implementation. Delete `packages/frontend/src/api/` first, then run `npm run generate:api` from `packages/frontend`. The regenerated `transactionsControllerFindAllParams.ts` will add `sortField` and `sortDirection` to the typed params object.
- **Existing tests that assert `orderBy: {date: 'desc'}`** in the service spec will continue to pass as long as the default is preserved correctly.
- **`TransactionList` props interface is extended** — `sortField`, `sortDirection`, and `onSort` are new required props. Any other call sites that render `TransactionList` must be updated. Search the codebase: `RecentTransactionsList` in `packages/frontend/src/features/dashboard/components/RecentTransactionsList.tsx` also renders transactions — check whether it uses `TransactionList` directly. If it does, it must receive the new props (with sensible defaults, e.g. `sortField='date'`, `sortDirection='desc'`, `onSort={() => {}}` as a no-op since the dashboard list is not user-sortable).

---

## 13. Files to Create or Modify

### Backend (no new files)

| File | Action | Change summary |
|---|---|---|
| `packages/backend/src/transactions/dto/transaction-filter.dto.ts` | Modify | Add `sortField` and `sortDirection` fields with validation and `@ApiProperty` |
| `packages/backend/src/transactions/transactions.service.ts` | Modify | Replace hard-coded `orderBy: {date: 'desc'}` with dynamic `orderBy` from filter params |
| `packages/backend/src/transactions/transactions.controller.ts` | Modify | Add `@ApiQuery` decorators for `sortField` and `sortDirection` |
| `packages/backend/src/transactions/__TEST__/transactions.service.spec.ts` | Modify | Add sort-related test cases |
| `packages/backend/src/transactions/__TEST__/transactions.controller.spec.ts` | Modify | Add validation rejection tests for invalid enum values |

### Frontend (no new files)

| File | Action | Change summary |
|---|---|---|
| `packages/frontend/src/api/` (entire directory) | Delete + regenerate | Run `npm run generate:api` after backend Swagger is stable |
| `packages/frontend/src/features/transactions/types/transaction.types.ts` | Modify | Add `TransactionSortField`, `SortDirection` types; extend `TransactionFilterState` |
| `packages/frontend/src/features/transactions/hooks/useTransactionFilters.ts` | Modify | Add `sortField`/`sortDirection` URL param handling; add `setSort`; extend `apiParams` |
| `packages/frontend/src/features/transactions/components/TransactionList.tsx` | Modify | Add `sortField`, `sortDirection`, `onSort` props; make Date/Amount/Description headers clickable with `aria-sort` |
| `packages/frontend/src/features/transactions/components/TransactionList.css` | Modify | Add `.tx-list__th--sortable`, `.tx-list__sort-btn`, `.tx-list__sort-icon`, active/hover states |
| `packages/frontend/src/pages/TransactionsPage.tsx` | Modify | Destructure `sortField`, `sortDirection`, `setSort`; pass to `TransactionList` |
| `packages/frontend/src/features/dashboard/components/RecentTransactionsList.tsx` | Possibly modify | Inspect — if it renders `TransactionList`, pass no-op sort props |
| `packages/frontend/src/features/transactions/hooks/__TEST__/useTransactionFilters.test.ts` | Modify | Add sort state tests |
| `packages/frontend/src/features/transactions/components/__TEST__/TransactionList.test.tsx` | Modify | Add sort indicator and `onSort` call tests |
