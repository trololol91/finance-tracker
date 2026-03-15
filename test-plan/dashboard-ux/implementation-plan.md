# Phase 9 — Dashboard & UX Redesign: Implementation Plan

**Status:** In Progress
**Last updated:** 2026-03-13
**Authored by:** planner agent

---

## 0. Overview

Phase 9 introduces a cohesive app shell: a persistent sidebar replacing the `Header` component for all private routes, a real Dashboard page (replacing the stub), a Settings page (Profile + Notifications), and an Admin panel (ADMIN-role-gated). Two new backend modules add aggregated dashboard data and admin user management, plus a Prisma seed script. **No schema migrations are required** — `UserRole`, `TransactionType.transfer`, and `notifyPush`/`notifyEmail` are all already in the schema.

---

## 1. Information Architecture

### Final IA Map

```
Public (no sidebar)
  /                   → LoginPage       (existing — HOME already redirects to login)
  /login              → LoginPage       (existing)
  /register           → RegisterPage    (existing)
  /mfa                → MfaPage         (existing — full-screen, no sidebar)

Private (wrapped in AppShell with Sidebar)
  /dashboard          → DashboardPage   (NEW — replaces stub)
  /transactions       → TransactionsPage (existing — unchanged)
  /accounts           → AccountsPage    (existing — unchanged)
  /categories         → CategoriesPage  (existing — unchanged)
  /scraper            → ScraperPage     (existing — unchanged)
  /settings           → SettingsPage    (NEW — Profile + Notifications tabs)
  /admin              → AdminPage       (NEW — ADMIN role guard)
  /profile            → Navigate to /settings  (legacy URL redirect)
  /budgets            → BudgetsPage     (existing stub — keep)
  /reports            → ReportsPage     (existing stub — keep)
```

### Sidebar Navigation Structure

```
MAIN MENU
  Dashboard         → /dashboard
  Transactions      → /transactions
  Accounts          → /accounts

──────────────────────────────────
SETTINGS SECTION
  Settings          → /settings
    Categories      → /categories        (indented)
    Sync            → /scraper           (indented)
    Notifications   → /settings#notifications (indented)
    Admin           → /admin             (indented, ADMIN only)
```

---

## 2. Backend Changes
  
### 2a. DashboardModule (NEW)

**Copy-first:** No. This module is aggregation-only with no CRUD mutations. It diverges completely from the standard CRUD pattern (categories, accounts, transactions). Build from scratch; use `TransactionsService.getMonthlyTotals()` and `TransactionsService.prisma` call patterns for reference.

**No Prisma migration needed** — reads from existing `transactions`, `accounts`, and `categories` tables.

#### Files to create

```
packages/backend/src/dashboard/
  dashboard.module.ts
  dashboard.controller.ts
  dashboard.service.ts
  dto/
    dashboard-summary.dto.ts
    spending-by-category.dto.ts
```

#### TypeScript interfaces / DTOs

**`dashboard-summary.dto.ts`**

```typescript
import {ApiProperty} from '@nestjs/swagger';

export class TransactionSummaryItemDto {
    @ApiProperty() id!: string;
    @ApiProperty() date!: string;
    @ApiProperty() description!: string;
    @ApiProperty() amount!: number;
    @ApiProperty({enum: ['income', 'expense', 'transfer']}) transactionType!: string;
    @ApiProperty({nullable: true, type: String}) categoryName!: string | null;
    @ApiProperty({nullable: true, type: String}) accountName!: string | null;
}

export class AccountBalanceSummaryItemDto {
    @ApiProperty() id!: string;
    @ApiProperty() name!: string;
    @ApiProperty() currency!: string;
    @ApiProperty() balance!: number;
}

export class DashboardSummaryDto {
    @ApiProperty({description: 'Period in YYYY-MM format', example: '2026-03'})
    month!: string;

    @ApiProperty() totalIncome!: number;
    @ApiProperty() totalExpenses!: number;
    @ApiProperty({description: 'totalIncome - totalExpenses'}) netBalance!: number;
    @ApiProperty({description: 'Count of non-transfer transactions in the period'}) transactionCount!: number;
    @ApiProperty({
        description: '(income - expenses) / income * 100; null when income = 0',
        nullable: true, type: Number
    }) savingsRate!: number | null;

    @ApiProperty({type: [AccountBalanceSummaryItemDto]})
    accounts!: AccountBalanceSummaryItemDto[];

    @ApiProperty({type: [TransactionSummaryItemDto], description: 'Last 5 transactions desc by date'})
    recentTransactions!: TransactionSummaryItemDto[];
}
```

**`spending-by-category.dto.ts`**

```typescript
import {ApiProperty} from '@nestjs/swagger';

export class SpendingByCategoryItemDto {
    @ApiProperty({nullable: true, type: String}) categoryId!: string | null;
    @ApiProperty({description: '"Uncategorised" when categoryId is null'}) categoryName!: string;
    @ApiProperty() total!: number;
    @ApiProperty({description: 'Percentage of total monthly expenses, 0–100'}) percentage!: number;
}

export class SpendingByCategoryDto {
    @ApiProperty({description: 'Period in YYYY-MM format'}) month!: string;
    @ApiProperty({type: [SpendingByCategoryItemDto]}) items!: SpendingByCategoryItemDto[];
}
```

#### Query param DTO

Add a shared `MonthQueryDto` in `dashboard/dto/month-query.dto.ts`:

```typescript
import {IsOptional, Matches} from 'class-validator';
import {ApiPropertyOptional} from '@nestjs/swagger';

export class MonthQueryDto {
    @ApiPropertyOptional({description: 'Period as YYYY-MM; defaults to current month', example: '2026-03'})
    @IsOptional()
    @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {message: 'month must be in YYYY-MM format'})
    month?: string;
}
```

#### `DashboardService` — Prisma aggregation query patterns

```typescript
// Imports: PrismaService from '#database/prisma.service.js', TransactionType from '#generated/prisma/client.js'

/**
 * Parse a YYYY-MM string into UTC start/end DateTime boundaries.
 * Throws BadRequestException for invalid format.
 */
private parseMonthBounds(month: string): { start: Date; end: Date } {
    const [year, mon] = month.split('-').map(Number);
    const start = new Date(Date.UTC(year, mon - 1, 1));
    const end   = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999));
    return {start, end};
}

// income / expense aggregation — mirrors TransactionsService.getTotals()
const [incomeResult, expenseResult] = await Promise.all([
    this.prisma.transaction.aggregate({
        where: {userId, isActive: true, date: {gte: start, lte: end}, transactionType: TransactionType.income},
        _sum: {amount: true}
    }),
    this.prisma.transaction.aggregate({
        where: {userId, isActive: true, date: {gte: start, lte: end}, transactionType: TransactionType.expense},
        _sum: {amount: true}
    })
]);

// transaction count (excludes transfers)
const transactionCount = await this.prisma.transaction.count({
    where: {
        userId, isActive: true, date: {gte: start, lte: end},
        transactionType: {not: TransactionType.transfer}
    }
});

// account balances — openingBalance + net of all-time active non-transfer transactions per account
const accounts = await this.prisma.account.findMany({
    where: {userId, isActive: true},
    select: {
        id: true, name: true, currency: true, openingBalance: true,
        transactions: {
            where: {isActive: true, transactionType: {not: TransactionType.transfer}},
            select: {amount: true, transactionType: true}
        }
    }
});
// Balance computed in JS: openingBalance + sum(income amounts) - sum(expense amounts)

// recent transactions (last 5, with category and account names)
const recent = await this.prisma.transaction.findMany({
    where: {userId, isActive: true},
    orderBy: {date: 'desc'},
    take: 5,
    include: {
        category: {select: {name: true}},
        account:  {select: {name: true}}
    }
});

// spending by category — groupBy on expense transactions
const grouped = await this.prisma.transaction.groupBy({
    by: ['categoryId'],
    where: {userId, isActive: true, date: {gte: start, lte: end}, transactionType: TransactionType.expense},
    _sum: {amount: true}
});
// Then fetch category names in a second query or inline with findMany+where id in [...]
// Percentage = (item.total / totalExpenses) * 100
```

#### `DashboardController`

```typescript
@ApiTags('dashboard')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) {}

    @Get('summary')
    @ApiOperation({summary: 'Monthly dashboard summary'})
    @ApiQuery({name: 'month', required: false, description: 'YYYY-MM, defaults to current month'})
    @ApiResponse({status: 200, type: DashboardSummaryDto})
    @ApiResponse({status: 400, description: 'Invalid month format'})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    public async getSummary(
        @Query() query: MonthQueryDto,
        @CurrentUser() user: User
    ): Promise<DashboardSummaryDto> { ... }

    @Get('spending-by-category')
    @ApiOperation({summary: 'Monthly spending grouped by category'})
    @ApiQuery({name: 'month', required: false, description: 'YYYY-MM, defaults to current month'})
    @ApiResponse({status: 200, type: SpendingByCategoryDto})
    @ApiResponse({status: 400, description: 'Invalid month format'})
    @ApiResponse({status: 401, description: 'Unauthorized'})
    public async getSpendingByCategory(
        @Query() query: MonthQueryDto,
        @CurrentUser() user: User
    ): Promise<SpendingByCategoryDto> { ... }
}
```

#### `dashboard.module.ts`

```typescript
import {Module} from '@nestjs/common';
import {DatabaseModule} from '#database/database.module.js';
import {DashboardController} from './dashboard.controller.js';
import {DashboardService} from './dashboard.service.js';

@Module({
    imports: [DatabaseModule],
    controllers: [DashboardController],
    providers: [DashboardService]
})
export class DashboardModule {}
```

#### Register in `app.module.ts`

Modify `packages/backend/src/app.module.ts`:
- Import `DashboardModule` from `#dashboard/dashboard.module.js`
- Add `DashboardModule` to the `imports` array

The `#dashboard/*` alias is already declared in `packages/backend/tsconfig.json` paths.

---

### 2b. Admin User Endpoints (ADD to UsersModule)

**Copy-first:** Yes. Add two new methods to the existing `UsersService` and `UsersController`, following the same pattern as `findOne()` and `update()`. No new module.

**`AdminGuard`** already exists at `packages/backend/src/common/guards/admin.guard.ts`. Import as `#common/guards/admin.guard.js`.

#### New DTOs to create

**`packages/backend/src/users/dto/admin-user-list-item.dto.ts`**

```typescript
import {ApiProperty} from '@nestjs/swagger';

export class AdminUserListItemDto {
    @ApiProperty() id!: string;
    @ApiProperty() email!: string;
    @ApiProperty({nullable: true, type: String}) firstName!: string | null;
    @ApiProperty({nullable: true, type: String}) lastName!: string | null;
    @ApiProperty({enum: ['USER', 'ADMIN']}) role!: string;
    @ApiProperty() createdAt!: Date;
    @ApiProperty() isActive!: boolean;
}
```

**`packages/backend/src/users/dto/update-user-role.dto.ts`**

```typescript
import {IsEnum} from 'class-validator';
import {ApiProperty} from '@nestjs/swagger';
import {UserRole} from '#generated/prisma/client.js';

export class UpdateUserRoleDto {
    @ApiProperty({enum: UserRole, description: 'New role for the user'})
    @IsEnum(UserRole)
    role!: UserRole;
}
```

#### New methods to add to `UsersService`

```typescript
/**
 * List all non-deleted users. Admin-only.
 */
public async findAllForAdmin(): Promise<AdminUserListItemDto[]> {
    const users = await this.prisma.user.findMany({
        where: {deletedAt: null},
        select: {id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true, isActive: true},
        orderBy: {createdAt: 'asc'}
    });
    return users;  // shape matches AdminUserListItemDto directly
}

/**
 * Update a user's role. Admin-only.
 * Throws BadRequestException if requestingUserId === targetUserId (self-demotion).
 * Throws NotFoundException if target user not found.
 */
public async updateRole(
    requestingUserId: string,
    targetUserId: string,
    dto: UpdateUserRoleDto
): Promise<AdminUserListItemDto> {
    if (requestingUserId === targetUserId) {
        throw new BadRequestException('You cannot change your own role');
    }

    const target = await this.prisma.user.findFirst({
        where: {id: targetUserId, deletedAt: null}
    });

    if (!target) {
        throw new NotFoundException(`User with ID ${targetUserId} not found`);
    }

    const updated = await this.prisma.user.update({
        where: {id: targetUserId},
        data: {role: dto.role},
        select: {id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true, isActive: true}
    });

    return updated;
}
```

#### New routes to add to `UsersController`

```typescript
// Import additions:
import {AdminGuard} from '#common/guards/admin.guard.js';
import {AdminUserListItemDto} from './dto/admin-user-list-item.dto.js';
import {UpdateUserRoleDto} from './dto/update-user-role.dto.js';

@Get('admin/users')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth('JWT-auth')
@ApiOperation({summary: 'List all users (admin only)'})
@ApiResponse({status: 200, type: [AdminUserListItemDto]})
@ApiResponse({status: 401, description: 'Unauthorized'})
@ApiResponse({status: 403, description: 'Forbidden — ADMIN role required'})
public async findAllForAdmin(): Promise<AdminUserListItemDto[]> {
    return this.usersService.findAllForAdmin();
}

@Patch('admin/users/:id/role')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth('JWT-auth')
@ApiOperation({summary: 'Update a user role (admin only)'})
@ApiParam({name: 'id', description: 'Target user UUID'})
@ApiBody({type: UpdateUserRoleDto})
@ApiResponse({status: 200, type: AdminUserListItemDto})
@ApiResponse({status: 400, description: 'Cannot change own role / invalid role value'})
@ApiResponse({status: 401, description: 'Unauthorized'})
@ApiResponse({status: 403, description: 'Forbidden — ADMIN role required'})
@ApiResponse({status: 404, description: 'User not found'})
public async updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() currentUser: User
): Promise<AdminUserListItemDto> {
    return this.usersService.updateRole(currentUser.id, id, dto);
}
```

**Note on routing:** The routes are `GET /users/admin/users` and `PATCH /users/admin/users/:id/role` because they are added to the `UsersController` which is prefixed with `users`. If the team prefers `/admin/users`, create a separate `AdminUsersController` with `@Controller('admin/users')` and register it in `UsersModule`. Either approach is valid; the separate controller is cleaner for Swagger grouping. The plan assumes a separate controller tagged `admin` to match the API contract table in Section 6.

**Recommended approach: Separate `AdminUsersController`**

```
packages/backend/src/users/
  admin-users.controller.ts    (NEW — @Controller('admin/users'), @ApiTags('admin'))
```

This controller receives `UsersService` via constructor injection (already exported from `UsersModule`), and uses `@UseGuards(JwtAuthGuard, AdminGuard)` on both routes. No changes to the existing `UsersController`.

---

### 2c. Prisma Seed Script

**File to create:** `packages/backend/prisma/seed.ts`

```typescript
// Pattern: upsert by email — idempotent, safe to re-run
import {PrismaClient, UserRole} from '../src/generated/prisma/client.js';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
    const email    = process.env['ADMIN_EMAIL']    ?? 'admin@example.com';
    const password = process.env['ADMIN_PASSWORD'] ?? 'Admin123!';
    const hash     = await bcrypt.hash(password, 10);

    await prisma.user.upsert({
        where:  {email},
        update: {role: UserRole.ADMIN, passwordHash: hash, isActive: true, deletedAt: null},
        create: {
            email,
            passwordHash: hash,
            firstName: 'Admin',
            lastName: 'User',
            role: UserRole.ADMIN,
            timezone: 'UTC',
            currency: 'USD'
        }
    });

    console.log(`Seed complete: admin user upserted (${email})`);
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => { void prisma.$disconnect(); });
```

**Wire into `packages/backend/package.json`:**

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

**Environment variables required (add to `.env.example`):**

```
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=Admin123!
```

---

## 3. Frontend Changes

### Cross-feature Step A — Add `role` to auth types, storage, and context

**File to modify:** `packages/frontend/src/features/auth/types/auth.types.ts`

Add `role: 'USER' | 'ADMIN'` to the `User` interface:

```typescript
export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    timezone: string;
    currency: string;
    isActive: boolean;
    createdAt: string;
    role: 'USER' | 'ADMIN';   // ADD THIS
}
```

**File to modify:** `packages/frontend/src/features/auth/context/AuthContext.tsx`

The `mapToUser` function must map `dto.role` to the `User.role` field:

```typescript
const mapToUser = (dto: UserResponseDto): User => ({
    id: dto.id,
    email: dto.email,
    firstName: dto.firstName ?? '',
    lastName: dto.lastName ?? '',
    timezone: dto.timezone,
    currency: dto.currency,
    isActive: dto.isActive,
    createdAt: dto.createdAt,
    role: dto.role as 'USER' | 'ADMIN'   // ADD THIS
});
```

`authStorage` needs no change — it serializes/deserializes the full `User` object via `JSON.stringify`/`JSON.parse`, so `role` is automatically included once added to the interface.

**Files that need null-handling review:**
- `packages/frontend/src/features/auth/context/__TEST__/AuthContext.test.tsx` — update mock user objects to include `role`
- `packages/frontend/src/features/auth/hooks/__TEST__/useAuth.test.tsx` — update mock user objects
- `packages/frontend/src/services/storage/__TEST__/authStorage.test.ts` — update test user fixture

---

### Cross-feature Step B — Add new route and API constants

**File to modify:** `packages/frontend/src/config/constants.ts`

```typescript
export const API_ROUTES = {
    AUTH: { ... },           // unchanged
    USERS: '/users',         // unchanged
    TRANSACTIONS: '/transactions',
    CATEGORIES: '/categories',
    ACCOUNTS: '/accounts',
    BUDGETS: '/budgets',
    REPORTS: '/reports',
    SCRAPER: '/scraper',
    DASHBOARD: '/dashboard', // ADD
    ADMIN: '/admin'          // ADD
} as const;

export const APP_ROUTES = {
    HOME: '/',
    LOGIN: '/login',
    REGISTER: '/register',
    DASHBOARD: '/dashboard',
    PROFILE: '/profile',
    TRANSACTIONS: '/transactions',
    CATEGORIES: '/categories',
    ACCOUNTS: '/accounts',
    BUDGETS: '/budgets',
    REPORTS: '/reports',
    SCRAPER: '/scraper',
    MFA: '/mfa',
    SETTINGS: '/settings',   // ADD
    ADMIN: '/admin'          // ADD
} as const;
```

---

### Cross-feature Step C — Update `routes/index.tsx` (AppShell + new routes)

**File to modify:** `packages/frontend/src/routes/index.tsx`

The current router uses flat `PrivateRoute` wrappers per-route. Replace the private route block with a React Router v6 layout route that renders `AppShell` as the outlet parent. `/mfa` stays flat (no sidebar).

```typescript
// New lazy imports to add:
const AppShell    = lazy(() => import('@components/layout/AppShell/AppShell.tsx'));
const SettingsPage = lazy(() => import('@pages/SettingsPage.tsx'));
const AdminPage    = lazy(() => import('@pages/AdminPage.tsx'));

// Replace all private route entries with a single layout route:
{
    element: <PrivateRoute><AppShell /></PrivateRoute>,
    children: [
        {path: APP_ROUTES.DASHBOARD,    element: <DashboardPage />},
        {path: APP_ROUTES.TRANSACTIONS, element: <TransactionsPage />},
        {path: APP_ROUTES.ACCOUNTS,     element: <AccountsPage />},
        {path: APP_ROUTES.CATEGORIES,   element: <CategoriesPage />},
        {path: APP_ROUTES.SCRAPER,      element: <ScraperPage />},
        {path: APP_ROUTES.SETTINGS,     element: <SettingsPage />},
        {path: APP_ROUTES.ADMIN,        element: <AdminRoute><AdminPage /></AdminRoute>},
        {path: APP_ROUTES.PROFILE,      element: <Navigate to={APP_ROUTES.SETTINGS} replace />},
        {path: APP_ROUTES.BUDGETS,      element: <BudgetsPage />},
        {path: APP_ROUTES.REPORTS,      element: <ReportsPage />},
    ]
}
```

`AppShell` must render `<Outlet />` from `react-router-dom` as its content area. `PrivateRoute` already handles auth redirection; `AdminRoute` handles role-gating below `/admin`.

**`AppShell.tsx`** renders `<Sidebar />` + `<main><Outlet /></main>` — it does NOT render the old `<Header />`.

---

### 3a. `AdminRoute` Guard Component (NEW)

**File to create:** `packages/frontend/src/routes/AdminRoute.tsx`

```typescript
interface AdminRouteProps {
    children: React.ReactNode;
}

export const AdminRoute = ({children}: AdminRouteProps): React.JSX.Element => {
    const {user} = useAuth();
    if (user?.role !== 'ADMIN') {
        return <Navigate to={APP_ROUTES.DASHBOARD} replace />;
    }
    return <>{children}</>;
};
```

---

### 3b. AppShell Layout Component (NEW)

**Copy-first:** No existing layout wrapper. Build from scratch.

**Files to create:**

```
packages/frontend/src/components/layout/AppShell/
  AppShell.tsx
  AppShell.module.css
  __TEST__/AppShell.test.tsx
```

**`AppShell.tsx` structure:**

```typescript
import {Outlet} from 'react-router-dom';
import {Sidebar} from '@components/layout/Sidebar/Sidebar.js';
import styles from './AppShell.module.css';

export const AppShell = (): React.JSX.Element => (
    <div className={styles.shell}>
        <Sidebar />
        <main className={styles.content}>
            <Outlet />
        </main>
    </div>
);

export default AppShell;
```

**`AppShell.module.css` layout intent:**
- `.shell`: `display: flex; height: 100vh; overflow: hidden;`
- `.content`: `flex: 1; overflow-y: auto; padding: 1.5rem;`

**Props interface:** None — AppShell is a layout route element, it takes no props.

---

### 3c. Sidebar Component (NEW)

**Copy-first:** No existing sidebar. Build from scratch.

**Files to create:**

```
packages/frontend/src/components/layout/Sidebar/
  Sidebar.tsx
  Sidebar.module.css
  navConfig.ts
  __TEST__/Sidebar.test.tsx
```

**`navConfig.ts`:**

```typescript
import {APP_ROUTES} from '@config/constants.js';

export interface NavItem {
    label: string;
    path: string;
    indent?: boolean;
    adminOnly?: boolean;
}

export const PRIMARY_NAV: NavItem[] = [
    {label: 'Dashboard',    path: APP_ROUTES.DASHBOARD},
    {label: 'Transactions', path: APP_ROUTES.TRANSACTIONS},
    {label: 'Accounts',     path: APP_ROUTES.ACCOUNTS},
];

export const SETTINGS_NAV: NavItem[] = [
    {label: 'Settings',           path: APP_ROUTES.SETTINGS},
    {label: 'Categories',         path: APP_ROUTES.CATEGORIES,  indent: true},
    {label: 'Sync',               path: APP_ROUTES.SCRAPER,     indent: true},
    {label: 'Notifications',      path: `${APP_ROUTES.SETTINGS}#notifications`, indent: true},
    {label: 'Admin',              path: APP_ROUTES.ADMIN,       indent: true, adminOnly: true},
];
```

**`Sidebar.tsx` component interface:**

```typescript
// No external props — reads user from useAuth(), location from useLocation()
export const Sidebar = (): React.JSX.Element => {
    const {user} = useAuth();
    const location = useLocation();
    // Render PRIMARY_NAV items
    // Render SETTINGS_NAV items, filtering out adminOnly when user.role !== 'ADMIN'
    // Apply active class when location.pathname === item.path
    // Logout button at bottom calls useAuth().logout() then navigate(APP_ROUTES.LOGIN)
};
```

**`Sidebar.test.tsx` — what to unit-test:**
- Renders all PRIMARY_NAV items
- Renders SETTINGS_NAV items (non-admin)
- Admin item NOT rendered when `user.role === 'USER'`
- Admin item IS rendered when `user.role === 'ADMIN'`
- Active class applied to the item whose path matches `location.pathname`
- Clicking a nav item triggers navigation
- Logout button calls `logout()` and navigates to `/login`

---

### 3d. Real DashboardPage (REPLACE stub)

**Copy-first:** No. The current stub is trivial. Build the real page from scratch; it is widget-based, not list+form.

**Files to create/modify:**

```
packages/frontend/src/pages/DashboardPage.tsx       (REPLACE stub)

packages/frontend/src/features/dashboard/
  components/
    SummaryCard/
      SummaryCard.tsx
      SummaryCard.module.css
      __TEST__/SummaryCard.test.tsx
    RecentTransactionsList/
      RecentTransactionsList.tsx
      RecentTransactionsList.module.css
      __TEST__/RecentTransactionsList.test.tsx
    AccountsPanel/
      AccountsPanel.tsx
      AccountsPanel.module.css
      __TEST__/AccountsPanel.test.tsx
    SpendingByCategoryPanel/
      SpendingByCategoryPanel.tsx
      SpendingByCategoryPanel.module.css
      __TEST__/SpendingByCategoryPanel.test.tsx
  hooks/
    useDashboardSummary.ts
    useSpendingByCategory.ts
  types/
    dashboard.types.ts
```

**`dashboard.types.ts`:**

```typescript
export interface DashboardSummary {
    month: string;
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    transactionCount: number;
    savingsRate: number | null;
    accounts: AccountBalanceSummaryItem[];
    recentTransactions: TransactionSummaryItem[];
}

export interface AccountBalanceSummaryItem {
    id: string;
    name: string;
    currency: string;
    balance: number;
}

export interface TransactionSummaryItem {
    id: string;
    date: string;
    description: string;
    amount: number;
    transactionType: 'income' | 'expense' | 'transfer';
    categoryName: string | null;
    accountName: string | null;
}

export interface SpendingByCategoryItem {
    categoryId: string | null;
    categoryName: string;
    total: number;
    percentage: number;
}

export interface SpendingByCategory {
    month: string;
    items: SpendingByCategoryItem[];
}
```

**Hook shapes:**

```typescript
// useDashboardSummary.ts
// Wraps Orval-generated useGetDashboardSummary hook
export interface UseDashboardSummaryResult {
    summary: DashboardSummary | null;
    isLoading: boolean;
    isError: boolean;
    refetch: () => void;
}
export function useDashboardSummary(month?: string): UseDashboardSummaryResult

// useSpendingByCategory.ts
export interface UseSpendingByCategoryResult {
    data: SpendingByCategory | null;
    isLoading: boolean;
    isError: boolean;
}
export function useSpendingByCategory(month?: string): UseSpendingByCategoryResult
```

**Component prop interfaces:**

```typescript
// SummaryCard.tsx
interface SummaryCardProps {
    label: string;
    value: string;         // pre-formatted: "$1,234.56" or "N/A"
    subLabel?: string;
    variant?: 'default' | 'positive' | 'negative';
    isLoading?: boolean;
}

// RecentTransactionsList.tsx
interface RecentTransactionsListProps {
    transactions: TransactionSummaryItem[];
    isLoading: boolean;
    isError: boolean;
}

// AccountsPanel.tsx
interface AccountsPanelProps {
    accounts: AccountBalanceSummaryItem[];
    isLoading: boolean;
    isError: boolean;
}

// SpendingByCategoryPanel.tsx
interface SpendingByCategoryPanelProps {
    items: SpendingByCategoryItem[];
    isLoading: boolean;
    isError: boolean;
}
```

**`DashboardPage.tsx` layout:**

- Reads current month: `const month = format(new Date(), 'yyyy-MM')` (or manual `new Date().toISOString().slice(0, 7)`)
- Calls `useDashboardSummary(month)` and `useSpendingByCategory(month)`
- Renders four `SummaryCard` widgets (Net Balance, Total Income, Total Expenses, Savings Rate)
- Renders `RecentTransactionsList` from `summary.recentTransactions`
- Renders `AccountsPanel` from `summary.accounts`
- Renders `SpendingByCategoryPanel` from spending data
- Shows skeleton/loading state while data fetches
- Shows error message if either query fails (not a broken layout)

---

### 3e. SettingsPage (NEW)

**Copy-first:** Yes for the Profile tab — copy the structure and logic from `ProfilePage.tsx`. Build the Notifications tab from scratch.

**Files to create:**

```
packages/frontend/src/pages/SettingsPage.tsx

packages/frontend/src/features/settings/
  components/
    SettingsTabs/
      SettingsTabs.tsx
      SettingsTabs.module.css
      __TEST__/SettingsTabs.test.tsx
    ProfileSettingsForm/
      ProfileSettingsForm.tsx
      ProfileSettingsForm.module.css
      __TEST__/ProfileSettingsForm.test.tsx
    NotificationPreferencesForm/
      NotificationPreferencesForm.tsx
      NotificationPreferencesForm.module.css
      __TEST__/NotificationPreferencesForm.test.tsx
```

**`SettingsTabs.tsx` prop interface:**

```typescript
type SettingsTab = 'profile' | 'notifications';

interface SettingsTabsProps {
    activeTab: SettingsTab;
    onTabChange: (tab: SettingsTab) => void;
}
```

**`NotificationPreferencesForm.tsx` prop interface:**

```typescript
interface NotificationPreferencesFormProps {
    notifyPush: boolean;
    notifyEmail: boolean;
    isSaving: boolean;
    onTogglePush: () => void;
    onToggleEmail: () => void;
    onSave: () => void;
    successMessage?: string;
    errorMessage?: string;
}
```

Notifications tab calls `PATCH /users/:id` with `{notifyPush, notifyEmail}`. The `UpdateUserDto` already exists — check whether `notifyPush`/`notifyEmail` fields are included; if not, they must be added to the backend `UpdateUserDto`.

**`UpdateUserDto` check:** Verify `packages/backend/src/users/dto/update-user.dto.ts` includes `notifyPush?: boolean` and `notifyEmail?: boolean`. If missing, add them as optional fields with `@IsOptional()` and `@IsBoolean()` validation.

**`SettingsPage.tsx`:** Manages `activeTab` state. Hash-based routing: `#notifications` in the URL activates the notifications tab on mount.

**`ProfilePage.tsx`:** Add `<Navigate to={APP_ROUTES.SETTINGS} replace />` at the top of the component before the existing JSX. Keep all other code in place to avoid breaking the page before `SettingsPage` is complete.

---

### 3f. AdminPage (NEW)

**Copy-first:** User table section — copy `AccountsPage` list pattern (loading/error/empty states, table rows). Plugin management section — build from scratch.

**Files to create:**

```
packages/frontend/src/pages/AdminPage.tsx

packages/frontend/src/features/admin/
  components/
    UserRoleTable/
      UserRoleTable.tsx
      UserRoleTable.module.css
      UserRoleRow.tsx
      __TEST__/UserRoleTable.test.tsx
      __TEST__/UserRoleRow.test.tsx
    PluginManager/
      PluginManager.tsx
      PluginManager.module.css
      __TEST__/PluginManager.test.tsx
  hooks/
    useAdminUsers.ts
    usePluginManager.ts
  types/
    admin.types.ts
```

**`admin.types.ts`:**

```typescript
export interface AdminUser {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: 'USER' | 'ADMIN';
    createdAt: string;
    isActive: boolean;
}
```

**Hook shapes:**

```typescript
// useAdminUsers.ts
// Wraps Orval-generated GET /admin/users and PATCH /admin/users/:id/role
export interface UseAdminUsersResult {
    users: AdminUser[];
    isLoading: boolean;
    isError: boolean;
    updateRole: (userId: string, role: 'USER' | 'ADMIN') => void;
    isUpdating: boolean;
}
export function useAdminUsers(): UseAdminUsersResult

// usePluginManager.ts
// Wraps POST /admin/scrapers/reload and POST /admin/scrapers/install
export interface UsePluginManagerResult {
    reload: () => void;
    install: (file: File) => void;
    isReloading: boolean;
    isInstalling: boolean;
    lastResult: string | null;
    error: string | null;
}
export function usePluginManager(): UsePluginManagerResult
```

**Component prop interfaces:**

```typescript
// UserRoleTable.tsx
interface UserRoleTableProps {
    users: AdminUser[];
    currentUserId: string;
    isLoading: boolean;
    isError: boolean;
    onRoleChange: (userId: string, newRole: 'USER' | 'ADMIN') => void;
    isUpdating: boolean;
}

// UserRoleRow.tsx
interface UserRoleRowProps {
    user: AdminUser;
    isSelf: boolean;
    onRoleChange: (userId: string, newRole: 'USER' | 'ADMIN') => void;
    isUpdating: boolean;
}

// PluginManager.tsx
interface PluginManagerProps {
    onReload: () => void;
    onInstall: (file: File) => void;
    isReloading: boolean;
    isInstalling: boolean;
    lastResult: string | null;
    error: string | null;
}
```

**Admin row logic:** "Make Admin" button renders when `user.role === 'USER'`; "Remove Admin" when `user.role === 'ADMIN'`. Both are `disabled` when `isSelf === true` or `isUpdating === true`.

---

### 3g. Header Component — Treatment

The existing `Header` component (`packages/frontend/src/components/layout/Header/Header.tsx`) is NOT rendered inside `AppShell`. It is not deleted in Phase 9 — the file remains but is unused for private routes. Public routes (`/`, `/login`, `/register`) do not render `AppShell` and currently do not render `Header` either (the Header was never wired into the router). No action required on the Header file itself.

---

## 4. API Contract Summary

### New Endpoints

| Method | Route | Guard | Request | Response |
|--------|-------|-------|---------|----------|
| `GET` | `/dashboard/summary` | JWT | `?month=YYYY-MM` (optional) | `DashboardSummaryDto` |
| `GET` | `/dashboard/spending-by-category` | JWT | `?month=YYYY-MM` (optional) | `SpendingByCategoryDto` |
| `GET` | `/admin/users` | JWT + AdminGuard | — | `AdminUserListItemDto[]` |
| `PATCH` | `/admin/users/:id/role` | JWT + AdminGuard | `{ role: 'USER' \| 'ADMIN' }` | `AdminUserListItemDto` |

### Existing Endpoints Used by New Frontend Pages

| Endpoint | Used by |
|----------|---------|
| `GET /accounts` | `AccountsPanel` on DashboardPage |
| `PATCH /users/:id` | `NotificationPreferencesForm` on SettingsPage |
| `GET /users/:id` | `ProfileSettingsForm` on SettingsPage |
| `POST /admin/scrapers/reload` | `PluginManager` on AdminPage (existing from Phase 8) |
| `POST /admin/scrapers/install` | `PluginManager` on AdminPage (existing from Phase 8) |

---

## 5. Prisma / Schema Changes

**No new migrations required for Phase 9.**

| Field | Status |
|-------|--------|
| `UserRole` enum (USER/ADMIN) | Already in schema |
| `User.role` column | Already in schema (default USER) |
| `TransactionType.transfer` | Already in schema |
| `User.notifyPush` | Already in schema |
| `User.notifyEmail` | Already in schema |
| Seed script | Uses existing columns only |

---

## 6. Copy-First Guidance Summary

| Layer | Component | Copy-first? | Notes |
|-------|-----------|-------------|-------|
| Backend | DashboardModule | No | Aggregation-only, no CRUD. Build from scratch using TransactionsService query patterns as reference. |
| Backend | Admin user endpoints | Yes | New methods added to existing UsersService + new AdminUsersController. |
| Backend | Prisma seed | Yes | Upsert pattern identical to any service create method. |
| Frontend | AppShell | No | No existing layout wrapper. Build from scratch. |
| Frontend | Sidebar + navConfig | No | No existing sidebar. Build from scratch. |
| Frontend | AdminRoute | Yes | Mirror PrivateRoute pattern with role check. |
| Frontend | DashboardPage + feature components | No | Widget layout, not list+form. Build from scratch. |
| Frontend | SettingsPage Profile tab | Yes | Lift logic directly from ProfilePage. |
| Frontend | SettingsPage Notifications tab | No | New form pattern for boolean toggles. |
| Frontend | AdminPage UserRoleTable | Yes | Copy AccountsPage list pattern (loading/error/empty states). |
| Frontend | AdminPage PluginManager | No | File upload + action buttons. Build from scratch. |

---

## 7. Step-by-Step Implementation Order

### Backend Steps (invoke `@backend-dev`)

1. Create `packages/backend/src/dashboard/dashboard.module.ts`, `dashboard.controller.ts`, `dashboard.service.ts`, and the four DTOs under `dto/`.
2. Register `DashboardModule` in `packages/backend/src/app.module.ts`.
3. Create `packages/backend/src/users/admin-users.controller.ts` with `GET /admin/users` and `PATCH /admin/users/:id/role`.
4. Add `findAllForAdmin()` and `updateRole()` methods to `packages/backend/src/users/users.service.ts`.
5. Create `packages/backend/src/users/dto/admin-user-list-item.dto.ts` and `update-user-role.dto.ts`.
6. Verify `UpdateUserDto` includes `notifyPush?: boolean` and `notifyEmail?: boolean`; add if missing.
7. Create `packages/backend/prisma/seed.ts` and wire into `packages/backend/package.json`.
8. Manually run `npx prisma db seed` to verify the seed works.
9. Confirm all four new endpoints appear in Swagger UI at `http://localhost:3000/api`.

### Generate API Client (after backend is stable)

10. Run `npm run generate:api` in `packages/frontend`. This generates:
    - `src/api/dashboard/` — typed hooks for both dashboard endpoints
    - Updated `src/api/users/` — includes the two new admin endpoints

### Frontend Steps (invoke `@frontend-dev`)

11. **Cross-feature Step A** — Modify `packages/frontend/src/features/auth/types/auth.types.ts`: add `role: 'USER' | 'ADMIN'` to `User`.
12. **Cross-feature Step A (cont.)** — Modify `packages/frontend/src/features/auth/context/AuthContext.tsx`: update `mapToUser` to map `dto.role`.
13. **Cross-feature Step B** — Modify `packages/frontend/src/config/constants.ts`: add `APP_ROUTES.SETTINGS`, `APP_ROUTES.ADMIN`, `API_ROUTES.DASHBOARD`, `API_ROUTES.ADMIN`.
14. Create `packages/frontend/src/routes/AdminRoute.tsx`.
15. Create `packages/frontend/src/components/layout/Sidebar/navConfig.ts`.
16. Create `packages/frontend/src/components/layout/Sidebar/Sidebar.tsx` and `Sidebar.module.css`.
17. Create `packages/frontend/src/components/layout/AppShell/AppShell.tsx` and `AppShell.module.css`.
18. **Cross-feature Step C** — Modify `packages/frontend/src/routes/index.tsx`: replace flat private routes with the AppShell layout route; add `/settings`, `/admin`, `/profile` redirect.
19. Create all files under `packages/frontend/src/features/dashboard/` (types, hooks, components).
20. Replace stub `packages/frontend/src/pages/DashboardPage.tsx` with real implementation.
21. Create all files under `packages/frontend/src/features/settings/`.
22. Create `packages/frontend/src/pages/SettingsPage.tsx`.
23. Add redirect to top of `packages/frontend/src/pages/ProfilePage.tsx` (`<Navigate to="/settings" replace />`).
24. Create all files under `packages/frontend/src/features/admin/`.
25. Create `packages/frontend/src/pages/AdminPage.tsx`.

---

## 8. Cross-Feature Integration Points (Explicit Steps)

These touch files from previously completed phases and must each be executed as separate, explicit steps. They are not covered by a generic "implement per the plan" instruction.

| Step | File modified | Change | Risk if skipped |
|------|--------------|--------|-----------------|
| A1 | `features/auth/types/auth.types.ts` | Add `role: 'USER' \| 'ADMIN'` to `User` interface | AdminRoute and Sidebar admin-visibility checks break at type level |
| A2 | `features/auth/context/AuthContext.tsx` | Add `role: dto.role` to `mapToUser` | `user.role` is always `undefined` at runtime; AdminRoute redirects all users |
| A3 | `features/auth/context/__TEST__/AuthContext.test.tsx` | Add `role: 'USER'` to all mock user objects | Tests fail to compile |
| A4 | `features/auth/hooks/__TEST__/useAuth.test.tsx` | Add `role: 'USER'` to all mock user objects | Tests fail to compile |
| A5 | `services/storage/__TEST__/authStorage.test.ts` | Add `role: 'USER'` to user fixture | Tests fail to compile |
| B | `config/constants.ts` | Add `SETTINGS` and `ADMIN` to `APP_ROUTES`; add `DASHBOARD` and `ADMIN` to `API_ROUTES` | navConfig imports and AdminRoute imports fail |
| C | `routes/index.tsx` | Wrap all private routes in AppShell layout route; add `/settings`, `/admin`, `/profile` redirect | Sidebar does not render on existing pages |
| D | `pages/ProfilePage.tsx` | Add `<Navigate to={APP_ROUTES.SETTINGS} replace />` at render-time | `/profile` URL silently renders old ProfilePage content instead of redirecting |

---

## 9. Backend Unit Test Strategy

**Framework:** Vitest, files co-located in `__TEST__/` next to source.

### `DashboardService` (new file: `src/dashboard/__TEST__/dashboard.service.spec.ts`)

Mock `PrismaService` with `vi.fn()` for: `transaction.aggregate`, `transaction.groupBy`, `transaction.findMany`, `transaction.count`, `account.findMany`.

| TC-ID | Description |
|-------|-------------|
| DSV-01 | `getSummary()` with income and expense transactions returns correct totals |
| DSV-02 | `getSummary()` excludes transfer transactions from income/expense totals |
| DSV-03 | `getSummary()` with no transactions returns all zeros and empty arrays |
| DSV-04 | `getSummary()` with invalid month string throws `BadRequestException` |
| DSV-05 | `getSummary()` computes `savingsRate` correctly when income > 0 |
| DSV-06 | `getSummary()` returns `savingsRate = null` when totalIncome = 0 |
| DSV-07 | `getSummary()` returns last 5 transactions with category and account names |
| DSV-08 | `getSpendingByCategory()` groups expense transactions by categoryId |
| DSV-09 | `getSpendingByCategory()` groups null categoryId as "Uncategorised" |
| DSV-10 | `getSpendingByCategory()` computes percentages summing to ~100 |
| DSV-11 | `getSpendingByCategory()` with no expenses returns empty items array |
| DSV-12 | `parseMonthBounds()` defaults to current month when month is undefined |

### `UsersService` — new admin methods (extend existing `src/users/__TEST__/users.service.spec.ts`)

| TC-ID | Description |
|-------|-------------|
| USV-01 | `findAllForAdmin()` returns all non-deleted users |
| USV-02 | `findAllForAdmin()` excludes soft-deleted users |
| USV-03 | `updateRole()` updates role to ADMIN successfully |
| USV-04 | `updateRole()` updates role to USER successfully |
| USV-05 | `updateRole()` throws `BadRequestException` when requestingUserId === targetUserId |
| USV-06 | `updateRole()` throws `NotFoundException` when target user not found |

### `AdminUsersController` (new file: `src/users/__TEST__/admin-users.controller.spec.ts`)

| TC-ID | Description |
|-------|-------------|
| ACT-01 | `GET /admin/users` calls `usersService.findAllForAdmin()` and returns result |
| ACT-02 | `PATCH /admin/users/:id/role` calls `usersService.updateRole()` with correct args |

---

## 10. Frontend Unit Test Strategy

**Framework:** Vitest + React Testing Library, tests co-located in `__TEST__/` next to source.

### `Sidebar` (`__TEST__/Sidebar.test.tsx`)

| TC-ID | Description |
|-------|-------------|
| SB-01 | Renders all PRIMARY_NAV items |
| SB-02 | Renders SETTINGS_NAV items (excluding admin) for USER role |
| SB-03 | Renders Admin item in SETTINGS_NAV for ADMIN role |
| SB-04 | Does NOT render Admin item for USER role |
| SB-05 | Active class applied to current route's nav item |
| SB-06 | Clicking nav item triggers navigation |
| SB-07 | Logout button calls `logout()` and navigates to `/login` |

### `AdminRoute` (`routes/__TEST__/AdminRoute.test.tsx`)

| TC-ID | Description |
|-------|-------------|
| AR-01 | Renders children when `user.role === 'ADMIN'` |
| AR-02 | Redirects to `/dashboard` when `user.role === 'USER'` |
| AR-03 | Redirects to `/dashboard` when user is null |

### `SummaryCard` (`__TEST__/SummaryCard.test.tsx`)

| TC-ID | Description |
|-------|-------------|
| SC-01 | Renders label and value |
| SC-02 | Shows loading skeleton when `isLoading = true` |
| SC-03 | Applies positive/negative variant class |

### `RecentTransactionsList` (`__TEST__/RecentTransactionsList.test.tsx`)

| TC-ID | Description |
|-------|-------------|
| RTL-01 | Renders list of transactions |
| RTL-02 | Shows loading state |
| RTL-03 | Shows error state |
| RTL-04 | Shows empty state when transactions = [] |

### `AccountsPanel` (`__TEST__/AccountsPanel.test.tsx`)

| TC-ID | Description |
|-------|-------------|
| AP-01 | Renders account names and balances |
| AP-02 | Shows loading state |
| AP-03 | Shows empty state when accounts = [] |

### `SpendingByCategoryPanel` (`__TEST__/SpendingByCategoryPanel.test.tsx`)

| TC-ID | Description |
|-------|-------------|
| SCP-01 | Renders category names and percentages |
| SCP-02 | Shows "Uncategorised" for null category |
| SCP-03 | Shows loading state |
| SCP-04 | Shows empty state when items = [] |

### `UserRoleTable` / `UserRoleRow`

| TC-ID | Description |
|-------|-------------|
| URT-01 | Renders a row per user |
| URT-02 | Shows "Make Admin" for USER role |
| URT-03 | Shows "Remove Admin" for ADMIN role |
| URT-04 | Role change button disabled on own row (isSelf=true) |
| URT-05 | Role change button disabled when isUpdating=true |
| URT-06 | Clicking role button calls onRoleChange with correct args |

### `NotificationPreferencesForm`

| TC-ID | Description |
|-------|-------------|
| NPF-01 | Renders push and email toggles with current values |
| NPF-02 | Toggle calls onTogglePush / onToggleEmail |
| NPF-03 | Save button calls onSave |
| NPF-04 | Shows success message |
| NPF-05 | Shows error message |

---

## 11. Backend API Test Plan (for `@backend-tester`)

**Preconditions:** Backend running with at least 1 ADMIN user and 1 regular USER user seeded. PostgreSQL test database accessible.

### `GET /dashboard/summary`

| TC-ID | Scenario | Method + Route | Expected Status | Expected Response |
|-------|----------|---------------|-----------------|-------------------|
| BT-01 | Authenticated, current month has income + expense transactions | `GET /dashboard/summary` | 200 | `totalIncome > 0`, `totalExpenses > 0`, `netBalance` = income - expenses, `transactionCount >= 2` |
| BT-02 | Transfers excluded from income/expense totals | `GET /dashboard/summary` (month with only transfer txns) | 200 | `totalIncome = 0`, `totalExpenses = 0`, `transactionCount = 0` |
| BT-03 | No transactions this month | `GET /dashboard/summary?month=2000-01` | 200 | `totalIncome: 0`, `totalExpenses: 0`, `netBalance: 0`, `recentTransactions: []` |
| BT-04 | Past month with known data | `GET /dashboard/summary?month=2025-01` | 200 | Response scoped to Jan 2025 only |
| BT-05 | Invalid month format | `GET /dashboard/summary?month=abc` | 400 | Error message mentioning YYYY-MM format |
| BT-06 | No auth token | `GET /dashboard/summary` | 401 | Unauthorized |

### `GET /dashboard/spending-by-category`

| TC-ID | Scenario | Method + Route | Expected Status | Expected Response |
|-------|----------|---------------|-----------------|-------------------|
| BT-07 | Authenticated, current month has categorised expenses | `GET /dashboard/spending-by-category` | 200 | Array of items; percentages sum to ~100 |
| BT-08 | Uncategorised transactions | `GET /dashboard/spending-by-category` (has transactions with null categoryId) | 200 | Item with `categoryId: null`, `categoryName: "Uncategorised"` |
| BT-09 | No expense transactions | `GET /dashboard/spending-by-category?month=2000-01` | 200 | `items: []` |
| BT-10 | No auth token | `GET /dashboard/spending-by-category` | 401 | Unauthorized |

### `GET /admin/users`

| TC-ID | Scenario | Method + Route | Expected Status | Expected Response |
|-------|----------|---------------|-----------------|-------------------|
| BT-11 | Called as ADMIN user | `GET /admin/users` | 200 | Array of `AdminUserListItemDto`; each has `id`, `email`, `role`, `createdAt` |
| BT-12 | Called as regular USER | `GET /admin/users` | 403 | Forbidden |
| BT-13 | No auth token | `GET /admin/users` | 401 | Unauthorized |

### `PATCH /admin/users/:id/role`

**Request body:** `{ "role": "ADMIN" }` or `{ "role": "USER" }`

| TC-ID | Scenario | Method + Route | Expected Status | Expected Response |
|-------|----------|---------------|-----------------|-------------------|
| BT-14 | ADMIN promotes USER to ADMIN | `PATCH /admin/users/{userId}/role` `{"role":"ADMIN"}` | 200 | Returned user has `role: "ADMIN"` |
| BT-15 | ADMIN demotes ADMIN to USER | `PATCH /admin/users/{userId}/role` `{"role":"USER"}` | 200 | Returned user has `role: "USER"` |
| BT-16 | ADMIN tries to change own role | `PATCH /admin/users/{ownId}/role` | 400 | "You cannot change your own role" |
| BT-17 | Target user does not exist | `PATCH /admin/users/nonexistent-uuid/role` | 404 | Not found |
| BT-18 | Invalid role value | `PATCH /admin/users/{userId}/role` `{"role":"SUPERUSER"}` | 400 | Validation error |
| BT-19 | Called as regular USER | `PATCH /admin/users/{userId}/role` | 403 | Forbidden |
| BT-20 | No auth token | `PATCH /admin/users/{userId}/role` | 401 | Unauthorized |

---

## 12. Frontend E2E Test Scope (for `@frontend-tester`)

**Coverage level:** Full regression

**Preconditions:**
- Backend running and seeded with: 1 ADMIN user, at least 1 regular USER, 2+ accounts, 5+ transactions spread across 2+ categories, at least 1 uncategorised transaction
- Playwright base URL: `http://localhost:5173`
- Auth state: tested separately as USER and as ADMIN

### Flow 1: AppShell / Sidebar

- Sidebar renders on `/dashboard`, `/transactions`, `/accounts`, `/categories`, `/settings`, `/scraper`
- Sidebar does NOT render on `/login`, `/register`, `/mfa`
- Active nav item has visual distinction (aria-current or active CSS class) matching current route
- Navigating between routes via sidebar updates active item
- Admin nav entry visible when logged in as ADMIN, absent when logged in as USER

### Flow 2: Dashboard Page

- All four summary cards render (Net Balance, Total Income, Total Expenses, Savings Rate)
- Card values are non-zero when seeded data exists for the current month
- Recent Transactions list renders with up to 5 rows
- Accounts panel renders account names and balances
- Spending by Category panel renders category bars with percentages
- Loading spinners/skeletons appear momentarily before data loads
- Empty state displayed gracefully when navigating to a month with no transactions (e.g. `?month=2000-01` if supported via URL)
- Dashboard summary API failure: error message shown, layout does not break

### Flow 3: Settings Page — Profile Tab

- `/settings` loads Profile tab by default
- Current user data (name, timezone, currency) pre-fills the form
- Edit mode: change first name, save — success toast/message shown, form returns to view mode
- Edit mode: save with blank first name — accepted (optional field)
- Cancel edit: returns to view mode without persisting changes
- Password change success and error states (if password change is in scope for this tab)

### Flow 4: Settings Page — Notifications Tab

- Clicking Notifications tab shows push/email toggles
- Initial toggle state matches current user preferences
- Toggle push notification — save — success message shown — reload page — toggle reflects saved state
- Toggle email notification — same flow
- Navigating away and back: unsaved changes are discarded (no persistence warning expected, but verify behaviour)

### Flow 5: Admin Page — ADMIN user

- `/admin` accessible when logged in as ADMIN
- User list renders all seeded users with current roles
- "Make Admin" promotes a USER to ADMIN — row role label updates to ADMIN
- "Remove Admin" demotes an ADMIN to USER — row role label updates to USER
- Own row: promote/demote button is disabled (cannot self-modify)
- Reload Plugins button triggers API call — success toast shown
- Plugin install: valid `.js` file upload triggers API call — success/error state shown
- Plugin install: non-JS file rejected (client-side validation or 400 from backend)

### Flow 6: Admin Page — USER (access control)

- Navigating to `/admin` as USER redirects to `/dashboard`
- Admin nav item not rendered in sidebar when logged in as USER

### Flow 7: Legacy URL Redirect

- Navigating to `/profile` redirects to `/settings` (HTTP 302 or client-side `replace`)
- Back button after redirect does not return to `/profile`

### Flow 8: Error States

- Dashboard summary endpoint returns 500 → error message shown, not broken layout
- Admin user list endpoint returns 500 → error message shown
- Role update endpoint returns 500 → error toast shown, row role label reverts

---

## 13. Note on `npm run generate:api`

Run in `packages/frontend` **after** the backend `DashboardModule` and admin user endpoints are committed and Swagger output is stable (Step 10 in the implementation order above). Do not hand-write fetch calls for the new endpoints. The generated output will produce:

- `packages/frontend/src/api/dashboard/` — hooks for `GET /dashboard/summary` and `GET /dashboard/spending-by-category`
- Updated `packages/frontend/src/api/users/` — hooks for `GET /admin/users` and `PATCH /admin/users/:id/role`
- Updated `packages/frontend/src/api/model/` — new DTO types (`DashboardSummaryDto`, `SpendingByCategoryDto`, `AdminUserListItemDto`, `UpdateUserRoleDto`)

The frontend feature hooks (`useDashboardSummary`, `useAdminUsers`, etc.) wrap these Orval-generated hooks and should not call axios/fetch directly.
