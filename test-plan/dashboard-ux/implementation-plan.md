# Phase 9 — Dashboard & UX Redesign: Implementation Plan

## 0. Overview

Phase 9 introduces a cohesive app shell: a persistent sidebar, a real Dashboard page, a Settings page, and an Admin panel. It also adds two new backend modules (`dashboard/` for aggregated summary data and `admin/` user-role management) plus a Prisma seed script.

---

## 1. Information Architecture Decision

### Final IA Map

```
Public (no sidebar)
  /                   → HomePage        (existing marketing landing)
  /login              → LoginPage       (existing)
  /register           → RegisterPage    (existing)
  /mfa                → MfaPage         (existing — full-screen, no sidebar)

Private (wrapped in AppShell with Sidebar)
  /dashboard          → DashboardPage   (NEW — real implementation replacing stub)
  /transactions       → TransactionsPage (existing — unchanged)
  /accounts           → AccountsPage    (existing — unchanged)
  /categories         → CategoriesPage  (existing — linked from Sidebar > Settings)
  /scraper            → ScraperPage     (existing — linked from Sidebar > Settings)
  /settings           → SettingsPage    (NEW — Profile + Notifications tabs)
  /admin              → AdminPage       (NEW — ADMIN role guard only)
  /profile            → redirect → /settings  (legacy URL, soft redirect)
  /budgets            → BudgetsPage     (existing stub — keep, not in sidebar)
  /reports            → ReportsPage     (existing stub — keep, not in sidebar)
```

### Sidebar Navigation Structure

```
MAIN MENU
  ⊞  Dashboard          → /dashboard
  ↕  Transactions       → /transactions
  ◈  Accounts           → /accounts

──────────────────────
SETTINGS
  ⚙  Settings           → /settings
     ⊟  Categories      → /categories
     ⊙  Sync & Connections → /scraper
     ◎  Notifications   → /settings (Notifications tab)
     ⊕  Admin           → /admin    (only rendered when role === 'ADMIN')
```

---

## 2. Backend Changes

### 2a. Dashboard Summary Module (NEW)

**No Prisma migration needed** — reads from existing tables.

**File**: `packages/backend/src/dashboard/`

```
dashboard/
  dashboard.module.ts
  dashboard.controller.ts
  dashboard.service.ts
  dto/
    dashboard-summary.dto.ts
    category-spending.dto.ts
```

**Endpoints:**

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/dashboard/summary` | JWT | Monthly summary: income, expenses, net worth, savings rate |
| `GET` | `/dashboard/spending-by-category` | JWT | Top categories by spend for a given month |

**`GET /dashboard/summary` query params:** `?month=2026-03` (default: current month)

**Response — `DashboardSummaryDto`:**
```typescript
{
  month: string;            // "2026-03"
  totalIncome: number;      // sum of income transactions
  totalExpenses: number;    // sum of expense transactions (excludes transfers)
  netWorth: number;         // sum of all account opening_balance + net transactions
  savingsRate: number;      // (income - expenses) / income * 100
  recentTransactions: TransactionSummaryDto[];  // last 5, desc by date
}
```

**Response — `CategorySpendingDto[]`:**
```typescript
{
  categoryId: string | null;
  categoryName: string;     // "Uncategorised" when null
  total: number;
  percentage: number;       // % of total expenses
}
```

**Service logic notes:**
- Filter `transactionType != 'transfer'` for all income/expense aggregations
- Net worth = `SUM(account.openingBalance)` + net of all non-transfer transactions per account
- `recentTransactions` joins category and account names for display

**Copy-first**: ❌ Diverges from CRUD pattern — aggregation-only, no mutations. Build from scratch. Query pattern can reference `TransactionsService` for Prisma client usage.

---

### 2b. Admin User Management Endpoints (ADD to UsersModule)

**No new module.** Add two methods to `UsersService` + `UsersController`.

**Endpoints:**

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/admin/users` | JWT + AdminGuard | List all users with id, email, firstName, lastName, role, createdAt |
| `PATCH` | `/admin/users/:id/role` | JWT + AdminGuard | Set a user's role to USER or ADMIN |

**DTOs:**
- `AdminUserListItemDto` — id, email, firstName, lastName, role, createdAt
- `UpdateUserRoleDto` — `{ role: UserRole }` with `@IsEnum(UserRole)` validation

**Notes:**
- `AdminGuard` already exists in `common/guards/` from Phase 8 — reuse it
- Cannot demote yourself (service must check `requestUser.id !== targetId`)
- Returns 404 if target user not found, 400 if attempting self-demotion

**Copy-first**: ✅ Copy method pattern from existing `UsersService.findOne()` and `UsersService.update()`.

---

### 2c. Prisma Seed Script

**File**: `packages/backend/prisma/seed.ts`

```typescript
// Reads ADMIN_EMAIL + ADMIN_PASSWORD from env
// Upserts user with role: ADMIN
// Idempotent — safe to run multiple times
```

Wire into `packages/backend/package.json`:
```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

**No migration needed** — `UserRole` enum and `role` column already exist on the `users` table.

---

## 3. Frontend Changes

### 3a. Add `role` to User type and AuthContext

**File to modify**: `packages/frontend/src/features/auth/types/auth.types.ts`

Add `role: 'USER' | 'ADMIN'` to the `User` interface. The backend already returns this field in `UserResponseDto`.

**Files that need null-handling review after this change:**
- `AuthContext` / `authStorage` — ensure `role` is persisted to and restored from localStorage
- `PrivateRoute.tsx` — no change needed (role guard is handled per-route)

---

### 3b. AppShell Layout Component (NEW)

**File**: `packages/frontend/src/components/layout/AppShell/AppShell.tsx`

Wraps all private routes (except `/mfa`) with:
- `Sidebar` on the left (240px fixed)
- `<main>` content area filling the rest

**Copy-first**: ❌ Build from scratch. No existing layout wrapper exists.

```
components/layout/AppShell/
  AppShell.tsx
  AppShell.module.css
  AppShell.test.tsx
```

---

### 3c. Sidebar Component (NEW)

**File**: `packages/frontend/src/components/layout/Sidebar/Sidebar.tsx`

- Renders nav items from a config array (makes testing easier)
- Uses `useLocation()` to highlight the active item
- Admin sub-item is conditionally rendered when `user.role === 'ADMIN'`
- Responsive: collapses to icon-only strip below 768px (hamburger toggle)
- Replaces the existing `Header` component for all private routes

**Copy-first**: ❌ No existing sidebar. Build from scratch.

```
components/layout/Sidebar/
  Sidebar.tsx
  Sidebar.module.css
  Sidebar.test.tsx
  navConfig.ts     ← array of { label, icon, path, adminOnly? }
```

**Nav config:**
```typescript
export const PRIMARY_NAV = [
  { label: 'Dashboard',     icon: '⊞', path: APP_ROUTES.DASHBOARD },
  { label: 'Transactions',  icon: '↕', path: APP_ROUTES.TRANSACTIONS },
  { label: 'Accounts',      icon: '◈', path: APP_ROUTES.ACCOUNTS },
];

export const SETTINGS_NAV = [
  { label: 'Settings',           icon: '⚙', path: APP_ROUTES.SETTINGS },
  { label: 'Categories',         icon: '⊟', path: APP_ROUTES.CATEGORIES,  indent: true },
  { label: 'Sync & Connections', icon: '⊙', path: APP_ROUTES.SCRAPER,     indent: true },
  { label: 'Notifications',      icon: '◎', path: APP_ROUTES.SETTINGS + '#notifications', indent: true },
  { label: 'Admin',              icon: '⊕', path: APP_ROUTES.ADMIN,       indent: true, adminOnly: true },
];
```

---

### 3d. Update Routes to Use AppShell

**File to modify**: `packages/frontend/src/routes/index.tsx`

All private routes (except `/mfa`) get wrapped in `<AppShell>` via a layout route:

```tsx
{
  element: <PrivateRoute><AppShell /></PrivateRoute>,
  children: [
    { path: APP_ROUTES.DASHBOARD,     element: <DashboardPage /> },
    { path: APP_ROUTES.TRANSACTIONS,  element: <TransactionsPage /> },
    { path: APP_ROUTES.ACCOUNTS,      element: <AccountsPage /> },
    { path: APP_ROUTES.CATEGORIES,    element: <CategoriesPage /> },
    { path: APP_ROUTES.SCRAPER,       element: <ScraperPage /> },
    { path: APP_ROUTES.SETTINGS,      element: <SettingsPage /> },
    { path: APP_ROUTES.ADMIN,         element: <AdminRoute><AdminPage /></AdminRoute> },
    { path: APP_ROUTES.PROFILE,       element: <Navigate to={APP_ROUTES.SETTINGS} replace /> },
    // keep stubs
    { path: APP_ROUTES.BUDGETS,       element: <BudgetsPage /> },
    { path: APP_ROUTES.REPORTS,       element: <ReportsPage /> },
  ]
}
```

Add `APP_ROUTES.SETTINGS = '/settings'` and `APP_ROUTES.ADMIN = '/admin'` to `constants.ts`.

Create `AdminRoute.tsx` — renders children if `user.role === 'ADMIN'`, otherwise redirects to `/dashboard`.

---

### 3e. Real DashboardPage (REPLACE stub)

**File**: `packages/frontend/src/pages/DashboardPage.tsx`

Consumes:
- `useGetDashboardSummary({ month })` (Orval-generated from `GET /dashboard/summary`)
- `useGetDashboardSpendingByCategory({ month })` (Orval-generated)
- `useGetAccounts()` (existing)

**Widgets:**
| Widget | Data source |
|--------|-------------|
| Net Worth card | `summary.netWorth` |
| Monthly Income card | `summary.totalIncome` |
| Monthly Expenses card | `summary.totalExpenses` |
| Savings Rate card | `summary.savingsRate` |
| Recent Transactions list | `summary.recentTransactions` (last 5) |
| Accounts panel | `GET /accounts` |
| Spending by Category | `GET /dashboard/spending-by-category` |

**Copy-first**: ❌ Diverges from list+form pattern — aggregation widgets. Build from scratch referencing the Figma design.

```
pages/DashboardPage.tsx
features/dashboard/
  components/
    SummaryCard/
      SummaryCard.tsx + .module.css + .test.tsx
    RecentTransactionsList/
      RecentTransactionsList.tsx + .module.css + .test.tsx
    AccountsPanel/
      AccountsPanel.tsx + .module.css + .test.tsx
    SpendingByCategoryPanel/
      SpendingByCategoryPanel.tsx + .module.css + .test.tsx
  hooks/
    useDashboardSummary.ts
  types/
    dashboard.types.ts
```

---

### 3f. SettingsPage (NEW)

**File**: `packages/frontend/src/pages/SettingsPage.tsx`

Two tabs:
1. **Profile** — absorbs existing `ProfilePage` content (name, email, password change, timezone, currency). ProfilePage stays but redirects here.
2. **Notifications** — toggle `notifyPush` and `notifyEmail` preferences. Calls `PATCH /users/me` (existing endpoint).

**Copy-first**: ✅ Copy `ProfilePage` structure for the Profile tab. Build Notifications tab from scratch.

```
pages/SettingsPage.tsx
features/settings/
  components/
    SettingsTabs/
      SettingsTabs.tsx + .module.css + .test.tsx
    ProfileSettingsForm/
      ProfileSettingsForm.tsx + .module.css + .test.tsx  (lifted from ProfilePage)
    NotificationPreferencesForm/
      NotificationPreferencesForm.tsx + .module.css + .test.tsx
```

---

### 3g. AdminPage (NEW)

**File**: `packages/frontend/src/pages/AdminPage.tsx`

Two sections (tabs or accordion):
1. **Plugin Management** — "Reload Plugins" button (`POST /admin/scrapers/reload`) + file upload for `.js` plugin (`POST /admin/scrapers/install`). Toast on success/error.
2. **User Role Management** — paginated table of all users. Each row has a "Make Admin" / "Remove Admin" toggle button. Calls `PATCH /admin/users/:id/role`. Cannot toggle own row.

**Copy-first**: ✅ User table copies `AccountsPage` list pattern. Plugin management builds from scratch.

```
pages/AdminPage.tsx
features/admin/
  components/
    PluginManager/
      PluginManager.tsx + .module.css + .test.tsx
    UserRoleTable/
      UserRoleTable.tsx + .module.css + .test.tsx
      UserRoleRow.tsx  + .test.tsx
  hooks/
    useAdminUsers.ts
    usePluginManager.ts
  types/
    admin.types.ts
```

---

### 3h. Remove / Retire Header Component

The existing `Header` component (`components/layout/Header/`) is replaced by `Sidebar` for private routes. It can be kept temporarily for public routes (HomePage) or removed entirely if HomePage is redesigned. For Phase 9, simply stop rendering it inside `AppShell` — the component file can remain until Phase 10 cleanup.

---

## 4. New Constants

Add to `packages/frontend/src/config/constants.ts`:

```typescript
APP_ROUTES.SETTINGS = '/settings'
APP_ROUTES.ADMIN    = '/admin'

API_ROUTES.DASHBOARD = '/dashboard'
API_ROUTES.ADMIN     = '/admin'
```

---

## 5. Prisma / Schema Changes

**No new migrations required for Phase 9.**

- `UserRole` enum (USER/ADMIN) — already in schema ✅
- `TransactionType.transfer` — already in schema ✅
- `notifyPush` / `notifyEmail` on User — already in schema ✅
- Seed script uses existing `role` column — no migration needed ✅

---

## 6. API Contract Summary

### New endpoints

| Method | Route | Guard | Request | Response |
|--------|-------|-------|---------|----------|
| `GET` | `/dashboard/summary` | JWT | `?month=YYYY-MM` | `DashboardSummaryDto` |
| `GET` | `/dashboard/spending-by-category` | JWT | `?month=YYYY-MM` | `CategorySpendingDto[]` |
| `GET` | `/admin/users` | JWT + Admin | — | `AdminUserListItemDto[]` |
| `PATCH` | `/admin/users/:id/role` | JWT + Admin | `{ role: 'USER' | 'ADMIN' }` | `AdminUserListItemDto` |

### Existing endpoints used by Dashboard

| Endpoint | Used for |
|----------|----------|
| `GET /accounts` | Accounts panel |
| `GET /transactions` | Recent transactions (until summary endpoint is done) |

---

## 7. Copy-First Guidance Summary

| Layer | Component | Copy-first? | Notes |
|-------|-----------|-------------|-------|
| Backend | DashboardModule | ❌ | Aggregation-only, no CRUD. Build from scratch. |
| Backend | Admin user endpoints | ✅ | Add to UsersModule, copy method pattern from existing service. |
| Backend | Prisma seed | ✅ | Copy upsert pattern from any existing service. |
| Frontend | AppShell | ❌ | No existing layout wrapper. Build from scratch. |
| Frontend | Sidebar | ❌ | No existing sidebar. Build from scratch. |
| Frontend | DashboardPage + feat | ❌ | Widget layout, not list+form. Build from scratch. |
| Frontend | SettingsPage | ✅ | Copy ProfilePage structure; add Notifications tab. |
| Frontend | AdminPage user table | ✅ | Copy AccountsPage list pattern for user table. |
| Frontend | AdminPage plugin mgr | ❌ | File upload + action buttons — build from scratch. |

---

## 8. Step-by-Step Implementation Order

### Backend Steps

1. **`DashboardModule`** — service + controller + 2 DTOs. Register in `app.module.ts`. Swagger decorators on all endpoints.
2. **Admin user endpoints** — add `findAllForAdmin()` + `updateRole()` to `UsersService`; add `GET /admin/users` + `PATCH /admin/users/:id/role` to `UsersController` behind `AdminGuard`. Add `AdminUserListItemDto` + `UpdateUserRoleDto`.
3. **Prisma seed script** — `prisma/seed.ts` + wire `package.json`.
4. **Unit tests** for DashboardService (mock Prisma) and the two new UsersService methods.
5. **`npm run generate:api`** in `packages/frontend` once Swagger is stable.

### Frontend Steps

6. **Add `role` to `User` interface** and ensure it is persisted/restored in `AuthContext` + `authStorage`.
7. **Add `APP_ROUTES.SETTINGS` + `APP_ROUTES.ADMIN`** to `constants.ts`.
8. **`AdminRoute`** — role-guard component.
9. **`AppShell`** — layout wrapper component + CSS.
10. **`Sidebar`** — nav component + `navConfig.ts` + CSS. Unit tests.
11. **Update `routes/index.tsx`** — layout route wrapping all private routes in AppShell. Add `/settings` and `/admin` routes. Add `/profile` redirect.
12. **`DashboardPage`** + feature components (`SummaryCard`, `RecentTransactionsList`, `AccountsPanel`, `SpendingByCategoryPanel`). Use Orval hooks. Unit tests.
13. **`SettingsPage`** — Profile tab (lift from ProfilePage) + Notifications tab. Unit tests.
14. **`AdminPage`** — UserRoleTable + PluginManager. Unit tests.
15. **Remove `Header` from AppShell** (keep file — do not delete until Phase 10).

---

## 9. Cross-Feature Integration Points

These touch files from previously completed phases and must each be called out as explicit steps:

| Step | File modified | Change |
|------|--------------|--------|
| A | `routes/index.tsx` | Wrap all existing private pages (Transactions, Accounts, Categories, Scraper) in `AppShell` layout route |
| B | `ProfilePage.tsx` | Add `<Navigate to="/settings" replace />` redirect (or keep content and lift to SettingsPage) |
| C | `features/auth/types/auth.types.ts` | Add `role: 'USER' \| 'ADMIN'` to `User` interface |
| D | `features/auth/hooks/useAuth.ts` + `authStorage` | Persist and restore `role` from localStorage |
| E | `config/constants.ts` | Add `SETTINGS` + `ADMIN` to `APP_ROUTES`; add `DASHBOARD` + `ADMIN` to `API_ROUTES` |

---

## 10. Frontend Test Scope (for `@frontend-tester`)

Coverage level: **Full regression**

### Preconditions
- Backend running with seed data: at least 1 regular user, 1 admin user, 2+ accounts, 5+ transactions across 2+ categories
- Auth state: tested logged-in as both USER and ADMIN

### Flows to cover

**Sidebar / AppShell**
- Sidebar renders on all private routes (Dashboard, Transactions, Accounts, Categories, Settings, Scraper)
- Sidebar does NOT render on `/login`, `/register`, `/mfa`
- Active nav item is highlighted for each route
- Admin nav item is visible when logged in as ADMIN, hidden when USER
- Clicking a nav item navigates correctly

**Dashboard page**
- Summary cards display (Net Worth, Income, Expenses, Savings Rate)
- Recent Transactions list shows last 5 transactions
- Accounts panel shows account list
- Spending by Category panel shows bars
- Loading states shown while data fetches
- Empty state when no transactions exist

**Settings page**
- Profile tab loads with current user data
- Can update name / timezone / currency — save succeeds, toast shown
- Can change password — success and error states
- Notifications tab shows push/email toggles
- Toggle saves and reflects updated preference
- Can navigate between tabs without losing unsaved state (or page warns)

**Admin page (ADMIN user)**
- `/admin` accessible when ADMIN
- User list renders all users with current roles
- "Make Admin" promotes a USER to ADMIN — row updates
- "Remove Admin" demotes an ADMIN to USER — row updates
- Own row: promote/demote button is disabled
- Reload Plugins button calls endpoint — success toast shown
- Install Plugin: uploading a `.js` file calls endpoint — success and error states

**Admin page (USER)**
- Navigating to `/admin` redirects to `/dashboard`
- Admin nav item is not rendered in sidebar

**Profile redirect**
- Navigating to `/profile` redirects to `/settings`

**Error states**
- Dashboard summary API failure shows error message, not broken layout
- Admin user list API failure shows error state

---

## 11. Backend API Test Plan (for `@backend-tester`)

### `GET /dashboard/summary`

| TC | Scenario | Expected |
|----|----------|---------|
| 1 | Authenticated, current month has transactions | 200, correct income/expense/netWorth/savingsRate totals |
| 2 | Transfers excluded from income/expense totals | 200, transfer amounts not in totalIncome or totalExpenses |
| 3 | No transactions this month | 200, all totals zero, recentTransactions = [] |
| 4 | `?month=2025-01` past month | 200, returns data scoped to that month |
| 5 | Invalid month format `?month=abc` | 400 |
| 6 | No auth token | 401 |

### `GET /dashboard/spending-by-category`

| TC | Scenario | Expected |
|----|----------|---------|
| 7 | Authenticated, current month | 200, array of category totals, percentages sum to ~100 |
| 8 | Uncategorised transactions grouped as "Uncategorised" | 200, entry with categoryId: null |
| 9 | No auth token | 401 |

### `GET /admin/users`

| TC | Scenario | Expected |
|----|----------|---------|
| 10 | Called as ADMIN | 200, array of AdminUserListItemDto |
| 11 | Called as USER (non-admin) | 403 |
| 12 | No auth token | 401 |

### `PATCH /admin/users/:id/role`

| TC | Scenario | Expected |
|----|----------|---------|
| 13 | ADMIN promotes USER → ADMIN | 200, returned user has role ADMIN |
| 14 | ADMIN demotes ADMIN → USER | 200, returned user has role USER |
| 15 | ADMIN tries to change their own role | 400 |
| 16 | Target user not found | 404 |
| 17 | Invalid role value in body | 400 |
| 18 | Called as non-admin USER | 403 |
| 19 | No auth token | 401 |

---

## 12. Notes for `npm run generate:api`

Run in `packages/frontend` after the backend `DashboardModule` and admin user endpoints are committed and Swagger is stable. This generates:
- `src/api/dashboard/` — typed hooks for `GET /dashboard/summary` and `GET /dashboard/spending-by-category`
- Updates `src/api/users/` — new admin user endpoints
- No frontend fetch calls should be hand-written; always use generated hooks.
