## API Test Plan: Dashboard and UX Redesign - Phase 9 Backend

**Coverage level:** Full regression
**Date:** 2026-03-14
**Source:** test-plan/dashboard-ux/implementation-plan.md Section 11

---

### Preconditions

- Backend running at http://localhost:3001
- Seed via npm run seed: admin@example.com/Admin123! (ADMIN), user@example.com/User123! (USER)
- ADMIN_ID = 50592e01-1af0-4ca9-910e-9a477984a19c
- USER_ID = a157bcf3-19c3-49ca-ad20-106d3ece8d3f

---

### Endpoint Inventory

| Method | Route | Subject Of |
|--------|-------|------------|
| GET | /dashboard/summary | BT-01 to BT-06 |
| GET | /dashboard/spending-by-category | BT-07 to BT-10 |
| GET | /admin/users | BT-11 to BT-13 |
| PATCH | /admin/users/:id/role | BT-14 to BT-20 |

---

### Implementation vs Plan Field Name Discrepancies

| Plan field | Actual DTO field | Notes |
|------------|-----------------|-------|
| totalIncome | monthlyIncome | Renamed |
| totalExpenses | monthlyExpenses | Renamed |
| netBalance | netWorth | Different meaning: all-time, not month delta |
| transactionCount | (absent) | Not implemented |
| recentTransactions | (absent) | Not implemented |
| items (spending response) | categories | Key renamed |
---

### Test Cases

#### BT-01: Dashboard summary - authenticated, current month with data
- **Type**: Smoke
- **Method + Route**: GET /dashboard/summary
- **Headers**: Authorization: Bearer USER_TOKEN
- **Expected status**: 200
- **Expected response**: netWorth > 0, monthlyIncome = 5000, monthlyExpenses = 595.70, savingsRate = 88.09, month = current YYYY-MM

#### BT-02: Dashboard summary - transfers excluded from income/expense totals
- **Type**: Regression
- **Method + Route**: GET /dashboard/summary?month=2024-06
- **Precondition (stimulus)**: Create transfer in 2024-06 with no other transactions that month
- **Expected status**: 200
- **Expected response**: monthlyIncome: 0, monthlyExpenses: 0, savingsRate: 0

#### BT-03: Dashboard summary - month with no transactions
- **Type**: Edge Case
- **Method + Route**: GET /dashboard/summary?month=2000-01
- **Expected status**: 200
- **Expected response**: monthlyIncome: 0, monthlyExpenses: 0, savingsRate: 0, month: 2000-01
- **Notes**: netWorth non-zero (all-time, not month-scoped)

#### BT-04: Dashboard summary - past month scoping
- **Type**: Regression
- **Method + Route**: GET /dashboard/summary?month=2025-01
- **Expected status**: 200
- **Expected response**: month: 2025-01; monthly totals reflect January 2025 only

#### BT-05: Dashboard summary - invalid month format
- **Type**: Edge Case
- **Method + Route**: GET /dashboard/summary?month=abc
- **Expected status**: 400
- **Expected response**: message array: month must be in YYYY-MM format

#### BT-06: Dashboard summary - no auth token
- **Type**: Security
- **Method + Route**: GET /dashboard/summary (no header)
- **Expected status**: 401
#### BT-07: Spending by category - authenticated, current month with categorised expenses
- **Type**: Smoke
- **Method + Route**: GET /dashboard/spending-by-category
- **Expected status**: 200
- **Expected response**: categories:[{categoryName:Groceries,total:415.7,percentage:69.78},{categoryName:Utilities,total:180,percentage:30.22}], month:2026-03. Sums to 100%.
- **Notes**: Response key is categories not items per plan (BUG-04)

#### BT-08: Spending by category - uncategorised transactions
- **Type**: Edge Case
- **Precondition**: Create expense with null categoryId in current month
- **Method + Route**: GET /dashboard/spending-by-category
- **Expected status**: 200
- **Expected response (per plan)**: categories includes item with categoryId: null, categoryName: Uncategorised
- **Known bug (BUG-02)**: Service filters categoryId NOT NULL - uncategorised expenses silently excluded

#### BT-09: Spending by category - no expense transactions in month
- **Type**: Edge Case
- **Method + Route**: GET /dashboard/spending-by-category?month=2000-01
- **Expected status**: 200
- **Expected response**: categories: [], month: 2000-01

#### BT-10: Spending by category - no auth token
- **Type**: Security
- **Method + Route**: GET /dashboard/spending-by-category (no header)
- **Expected status**: 401

#### BT-11: List all users - called as ADMIN
- **Type**: Smoke
- **Method + Route**: GET /admin/users
- **Headers**: Authorization: Bearer ADMIN_TOKEN
- **Expected status**: 200
- **Expected response**: array of objects each with id, email, firstName, lastName, role, isActive, createdAt

#### BT-12: List all users - called as regular USER
- **Type**: Security
- **Method + Route**: GET /admin/users
- **Headers**: Authorization: Bearer USER_TOKEN
- **Expected status**: 403

#### BT-13: List all users - no auth token
- **Type**: Security
- **Method + Route**: GET /admin/users (no header)
- **Expected status**: 401
#### BT-14: Update role - ADMIN promotes USER to ADMIN
- **Type**: Smoke
- **Method + Route**: PATCH /admin/users/USER_ID/role
- **Headers**: Authorization: Bearer ADMIN_TOKEN, Content-Type: application/json
- **Request body**: {role:ADMIN}
- **Expected status**: 200
- **Expected response**: AdminUserListItemDto with role: ADMIN

#### BT-15: Update role - ADMIN demotes back to USER
- **Type**: Regression
- **Method + Route**: PATCH /admin/users/USER_ID/role
- **Headers**: Authorization: Bearer ADMIN_TOKEN
- **Request body**: {role:USER}
- **Expected status**: 200
- **Expected response**: AdminUserListItemDto with role: USER

#### BT-16: Update role - ADMIN tries to change own role
- **Type**: Security / Edge Case
- **Method + Route**: PATCH /admin/users/ADMIN_ID/role
- **Headers**: Authorization: Bearer ADMIN_TOKEN
- **Request body**: {role:USER}
- **Expected status**: 400
- **Expected response**: message: You cannot change your own role
- **CAUTION**: If BUG-01 is not fixed, this call WILL change the admin role and the token will become invalid

#### BT-17: Update role - target user does not exist
- **Type**: Edge Case
- **Method + Route**: PATCH /admin/users/00000000-0000-0000-0000-000000000000/role
- **Request body**: {role:USER}
- **Expected status**: 404
- **Expected response**: message: User with ID ... not found

#### BT-18: Update role - invalid role value
- **Type**: Edge Case
- **Method + Route**: PATCH /admin/users/USER_ID/role
- **Request body**: {role:SUPERUSER}
- **Expected status**: 400
- **Expected response**: validation error listing valid enum values: USER, ADMIN

#### BT-19: Update role - called as regular USER
- **Type**: Security
- **Method + Route**: PATCH /admin/users/USER_ID/role
- **Headers**: Authorization: Bearer USER_TOKEN
- **Request body**: {role:ADMIN}
- **Expected status**: 403

#### BT-20: Update role - no auth token
- **Type**: Security
- **Method + Route**: PATCH /admin/users/USER_ID/role (no header)
- **Request body**: {role:ADMIN}
- **Expected status**: 401
