## API Test Report: Dashboard and UX Redesign - Phase 9 Backend

**Date:** 2026-03-14
**Environment:** http://localhost:3001
**Test Users:** admin@example.com (ADMIN), user@example.com (USER)

---

### Summary

| Total | Passed | Partial | Failed | Skipped |
|-------|--------|---------|--------|---------|
| 20    | 17     | 0       | 3      | 0       |

> **Passed** = status code and assertions correct.  **Failed** = wrong status code, missing guard, or wrong data.

---

### Bugs Found

| # | Severity | Status | Description |
|---|----------|--------|-------------|
| BUG-01 | Critical | NEW | PATCH /admin/users/:id/role has no self-role-change guard. Admin can demote themselves to USER. Expected 400; got 200. Role was actually changed. Fix: inject CurrentUser into AdminUsersController.updateRole() and throw BadRequestException when caller id === target id. |
| BUG-02 | Medium | NEW | GET /dashboard/spending-by-category silently excludes uncategorised expenses. Prisma query uses categoryId:{not:null}. Plan BT-08 requires a null bucket. Fix: remove the not-null filter and add an Uncategorised fallback in the mapping. |
| BUG-03 | Low | NEW | DashboardSummaryDto field names differ from plan. Plan: totalIncome, totalExpenses, netBalance, transactionCount, recentTransactions. Actual: monthlyIncome, monthlyExpenses, netWorth, savingsRate, month. netWorth is all-time balance, not month-scoped. |
| BUG-04 | Low | NEW | SpendingByCategoryDto wrapper key is categories, not items as plan BT-07 specifies. Frontend code referencing response.items will get undefined. |

---

### Precondition Caveat

DB contained 13 pre-existing users from prior test phases. Inflates GET /admin/users count to 14. test-admin@example.com (44328e8e...) registered before seed was run; cannot be deleted via current API.

---

### Results
#### BT-01: Dashboard summary - authenticated, current month
- **Status**: 200 PASS
- **Evidence**: {netWorth:17404.3,monthlyIncome:5000,monthlyExpenses:595.7,savingsRate:88.09,month:2026-03}
- **Note**: DTO field names differ from plan (BUG-03)

#### BT-02: Dashboard summary - transfers excluded from totals
- **Status**: 200 PASS
- **Evidence**: Created transfer 500 in 2024-06 (no other txns). Response: monthlyIncome:0, monthlyExpenses:0, savingsRate:0, month:2024-06. Cleanup: tx deleted (204).

#### BT-03: Dashboard summary - month with no transactions
- **Status**: 200 PASS
- **Evidence**: {monthlyIncome:0,monthlyExpenses:0,savingsRate:0,month:2000-01}. netWorth:17404.3 (all-time).

#### BT-04: Dashboard summary - past month scoping
- **Status**: 200 PASS
- **Evidence**: {monthlyIncome:0,monthlyExpenses:0,month:2025-01}. Scoped to Jan 2025 (no seeded data).

#### BT-05: Dashboard summary - invalid month format
- **Status**: 400 PASS
- **Evidence**: {message:[month must be in YYYY-MM format],error:Bad Request,statusCode:400}

#### BT-06: Dashboard summary - no auth token
- **Status**: 401 PASS
- **Evidence**: {message:Unauthorized,statusCode:401}. No stack trace.

#### BT-07: Spending by category - authenticated, current month
- **Status**: 200 PASS
- **Evidence**: categories:[{categoryName:Groceries,total:415.7,percentage:69.78},{categoryName:Utilities,total:180,percentage:30.22}],month:2026-03. Sums to 100%.
- **Note**: Response key is categories not items (BUG-04)

#### BT-08: Spending by category - uncategorised transactions
- **Status**: FAIL
- **Expected**: categories includes item with categoryId:null, categoryName:Uncategorised
- **Got**: Only Groceries+Utilities; uncategorised expense (50.00) absent. 595.70 of 645.70 actual expenses counted.
- **Evidence**: Created tx 3f5af8c8... (expense 50.00, null categoryId). Response unchanged.
- **Root cause**: DashboardService Prisma query categoryId:{not:null} — see BUG-02
- **Cleanup**: tx deleted (204)

#### BT-09: Spending by category - empty month
- **Status**: 200 PASS
- **Evidence**: {categories:[],month:2000-01}

#### BT-10: Spending by category - no auth token
- **Status**: 401 PASS
- **Evidence**: {message:Unauthorized,statusCode:401}

#### BT-11: List all users - as ADMIN
- **Status**: 200 PASS
- **Evidence**: Array of 14 users; each with id, email, firstName, lastName, role, isActive, createdAt.

#### BT-12: List all users - as regular USER
- **Status**: 403 PASS
- **Evidence**: {message:Admin access required,error:Forbidden,statusCode:403}

#### BT-13: List all users - no auth token
- **Status**: 401 PASS
- **Evidence**: {message:Unauthorized,statusCode:401}

#### BT-14: ADMIN promotes USER to ADMIN
- **Status**: 200 PASS
- **Evidence**: {id:a157bcf3...,email:user@example.com,role:ADMIN,...}

#### BT-15: ADMIN demotes back to USER
- **Status**: 200 PASS
- **Evidence**: {id:a157bcf3...,email:user@example.com,role:USER,...}

#### BT-16: ADMIN tries to change own role
- **Status**: FAIL (200 returned, expected 400)
- **Expected**: 400 with message You cannot change your own role
- **Got**: 200 - role was ACTUALLY changed to USER in DB. Admin lost access. Re-seeding required.
- **Evidence**: {id:50592e01...,email:admin@example.com,role:USER,...}
- **Curl used**: PATCH /admin/users/50592e01-1af0-4ca9-910e-9a477984a19c/role body:{role:USER} with ADMIN_TOKEN
- **Root cause**: UsersService.updateRole() has no self-change guard. Controller does not inject CurrentUser. See BUG-01.

#### BT-17: Target user not found
- **Status**: 404 PASS
- **Evidence**: {message:User with ID 00000000... not found,error:Not Found,statusCode:404}

#### BT-18: Invalid role value
- **Status**: 400 PASS
- **Evidence**: {message:[role must be one of the following values: USER, ADMIN],error:Bad Request,statusCode:400}

#### BT-19: Role update as regular USER
- **Status**: 403 PASS
- **Evidence**: {message:Admin access required,error:Forbidden,statusCode:403}

#### BT-20: Role update - no auth token
- **Status**: 401 PASS
- **Evidence**: {message:Unauthorized,statusCode:401}

---

### Test Data Created

| Resource | ID | Description | Cleaned Up |
|----------|----|-------------|------------|
| Transaction | 3f5af8c8-57d6-412c-92d4-2c81d4d4749f | BT-08 Uncategorised Expense (50.00, 2026-03-14, null category) | Yes (204) |
| Transaction | a915a2d6-8b56-45ce-9b15-112b8e01fe79 | BT-02 Transfer Only Test (500.00, 2024-06-15) | Yes (204) |
| User | 44328e8e-03ff-441c-a7fb-5b61556752dd | test-admin@example.com (registered before seed) | No - no delete endpoint |
| Seed (5 txns) | multiple | Monthly Salary, 2x Groceries, Electricity Bill, Savings Transfer (all 2026-03) | No - expected to persist |

---

### Testing Gaps - Retrospective

1. **BT-02 transfer isolation**: Seeded month has income+expense+transfer together. Empty month 2024-06 used. Clean per-user DB would avoid this.
2. **netWorth correctness**: Cannot verify exact value - pre-existing transactions from prior phases affect totals.
3. **recentTransactions field**: Present in plan, absent in implementation. BUG-03. No assertion possible.
4. **Pagination on /admin/users**: Endpoint returns all users; no pagination. Noted as gap not a bug.
5. **BT-16 fix approach**: AdminUsersController.updateRole() needs @CurrentUser() injection and a BadRequestException when caller.id === target id.
