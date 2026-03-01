# Frontend Test Plan: Transactions (Phase 3)

**Feature**: Transactions page — list, filter, CRUD, summary, pagination  
**Route**: `/transactions`  
**Coverage level**: Full regression  
**Agent**: frontend-tester

---

## Preconditions

- [ ] Vite dev server running at `http://localhost:5173`
- [ ] NestJS backend running at `http://localhost:3001`
- [ ] A registered test user exists: `test@example.com` / `password123`
- [ ] At least one existing transaction in the database (for edit/delete/toggle cases)
- [ ] At least 51 transactions exist (for pagination case TC-17)

---

## Test Cases

### Authentication & Access

#### TC-01: Unauthenticated access redirects to login
- **Type**: Smoke
- **Steps**:
  1. Clear all cookies and localStorage (start logged out)
  2. Navigate to `http://localhost:5173/transactions`
- **Expected result**: Redirected to `/login`; Transactions page is not rendered

---

### Page Load

#### TC-02: Page renders for authenticated user
- **Type**: Smoke
- **Steps**:
  1. Log in as `test@example.com`
  2. Navigate to `http://localhost:5173/transactions`
  3. Wait for data to load; take screenshot — verify sections appear in this order: page header (`.tx-page__header`) → summary bar (`.tx-summary`) → filter bar (`.tx-filters`) → transaction table (`.tx-list`) → pagination; table has visible column headers (Date, Description, Amount, Category, Actions); filter bar is not overlapping the table; summary values are not clipped or overflowing their container
  4. Call `browser_console_messages(level: 'error')` — confirm no JS errors
- **Expected result**: Page heading "Transactions" is visible; "+ Add Transaction" button is present; filter bar is visible; structural layout is intact; no JS errors in console

#### TC-03: Loading state shown while fetching
- **Type**: Regression
- **Steps**:
  1. Log in and navigate to `/transactions`
  2. Observe the moment the page first loads (before data arrives)
- **Expected result**: A loading spinner or skeleton is shown while the API call is in flight

#### TC-04: Empty state shown when user has no transactions
- **Type**: Regression
- **Steps**:
  1. Log in as a user with zero transactions
  2. Navigate to `/transactions`
- **Expected result**: An empty-state message is displayed; the list area does not show a broken layout

#### TC-05: Error state shown when API is unreachable
- **Type**: Edge Case
- **Steps**:
  1. Stop the backend server
  2. Navigate to `/transactions` (token already in localStorage)
- **Expected result**: An error message is displayed; no blank screen or unhandled exception

---

### Summary Bar

#### TC-06: Summary displays income, expenses, and net totals
- **Type**: Regression
- **Steps**:
  1. Log in and navigate to `/transactions`
  2. Observe the summary bar
- **Expected result**: Three values shown — Income (positive), Expenses (negative), Net; values are non-zero when transactions exist for the current date range

#### TC-07: Summary updates when date range filter changes
- **Type**: Regression
- **Steps**:
  1. Navigate to `/transactions`
  2. Change the date range filter to "This Year"
  3. Compare totals to the "This Month" totals
- **Expected result**: Summary totals change to reflect the new date range

---

### Filters

#### TC-08: Date range preset "This Month" filters list
- **Type**: Smoke
- **Steps**:
  1. Navigate to `/transactions`
  2. In the DateRangePicker, select the "This Month" preset
- **Expected result**: List updates to show only transactions within the current calendar month; pagination resets to page 1

#### TC-09: Custom date range filters list
- **Type**: Regression
- **Steps**:
  1. Navigate to `/transactions`
  2. Select "Custom" in the DateRangePicker
  3. Enter start date `2026-01-01` and end date `2026-01-31`
- **Expected result**: List shows only transactions within that date range

#### TC-10: Type filter — "Expense" shows only expenses
- **Type**: Regression
- **Steps**:
  1. Navigate to `/transactions`
  2. Change the Type dropdown to "Expense"
- **Expected result**: All visible transactions are type "expense"; page resets to 1

#### TC-11: Type filter — "Income" shows only income
- **Type**: Regression
- **Steps**:
  1. Change the Type dropdown to "Income"
- **Expected result**: All visible transactions are type "income"

#### TC-12: Status filter — "Inactive" shows only inactive transactions
- **Type**: Regression
- **Steps**:
  1. Change the Status dropdown to "Inactive"
- **Expected result**: Only inactive transactions are shown

#### TC-13: Search by description filters list
- **Type**: Regression
- **Steps**:
  1. Navigate to `/transactions`
  2. Type a known description substring into the Search field (e.g. `Coffee`)
- **Expected result**: List updates to show only matching transactions

#### TC-14: "Clear Filters" resets all filters to defaults
- **Type**: Regression
- **Steps**:
  1. Set Type to "Expense", Status to "Inactive", type something in Search
  2. Click the "Clear Filters" button
- **Expected result**: Type → "All Types", Status → "Active", Search → empty, date range → default; list refreshes

---

### Pagination

#### TC-15: Pagination is hidden when total ≤ limit
- **Type**: Regression
- **Steps**:
  1. Log in as a user with ≤ 50 transactions
  2. Navigate to `/transactions`
- **Expected result**: Pagination controls are not rendered

#### TC-16: Pagination is visible when total > limit
- **Type**: Regression
- **Steps**:
  1. Log in as a user with > 50 transactions
  2. Navigate to `/transactions`
- **Expected result**: Pagination controls are rendered; "Showing X–Y of Z" text is accurate

#### TC-17: Navigating to page 2 loads the next set of records
- **Type**: Regression
- **Steps**:
  1. With > 50 transactions, navigate to `/transactions`
  2. Click page 2 in the pagination control
- **Expected result**: List updates to the next 50 transactions; page 2 is highlighted; page 1 records are gone

---

### Add Transaction

#### TC-18: "+ Add Transaction" opens the create modal
- **Type**: Smoke
- **Steps**:
  1. Navigate to `/transactions`
  2. Click the "+ Add Transaction" button
  3. Take screenshot — verify modal is centred in the viewport, not clipped by the edge, and the dimmed backdrop is visible behind it
- **Expected result**: A modal opens with a blank transaction form; modal is centred; backdrop is present; focus moves into the modal

#### TC-19: Create transaction — happy path (expense)
- **Type**: Smoke
- **Steps**:
  1. Open the create modal
  2. Take screenshot — verify modal is centred, not clipped, backdrop visible
  3. Enter Amount: `25.50`, Type: "Expense", Date: today, Description: `Playwright test expense`
  4. Click "Save"
  5. Call `browser_network_requests` — verify `POST /transactions` was called with status 201
  6. Call `browser_console_messages(level: 'error')` — confirm no JS errors
- **Expected result**: Modal closes; "Playwright test expense" appears in the list; expense total in summary updates

#### TC-20: Create transaction — happy path (income)
- **Type**: Regression
- **Steps**:
  1. Open the create modal
  2. Take screenshot — verify modal is centred, not clipped, backdrop visible
  3. Enter Amount: `1000.00`, Type: "Income", Date: today, Description: `Playwright test income`
  4. Click "Save"
  5. Call `browser_network_requests` — verify `POST /transactions` was called with status 201
  6. Call `browser_console_messages(level: 'error')` — confirm no JS errors
- **Expected result**: Modal closes; new income transaction appears; income total increases

#### TC-21: Form validation — empty amount shows error
- **Type**: Regression
- **Steps**:
  1. Open the create modal
  2. Take screenshot — verify modal is centred, not clipped, backdrop visible
  3. Leave Amount blank; fill all other required fields
  4. Click "Save"
- **Expected result**: Error on Amount field (e.g. "Amount is required"); modal stays open; no API call made

#### TC-22: Form validation — zero or negative amount shows error
- **Type**: Edge Case
- **Steps**:
  1. Open the create modal
  2. Take screenshot — verify modal is centred, not clipped, backdrop visible
  3. Enter Amount: `0`; fill all other fields
  4. Click "Save"
- **Expected result**: Error on Amount field; modal stays open

#### TC-23: Form validation — empty date shows error
- **Type**: Regression
- **Steps**:
  1. Open the create modal
  2. Take screenshot — verify modal is centred, not clipped, backdrop visible
  3. Clear the Date field; fill all other required fields
  4. Click "Save"
- **Expected result**: Error on Date field; modal stays open

#### TC-24: Cancel closes modal without saving
- **Type**: Regression
- **Steps**:
  1. Open the create modal
  2. Take screenshot — verify modal is centred, not clipped, backdrop visible
  3. Enter Amount: `99.99`, Description: `do not save`
  4. Click "Cancel"
- **Expected result**: Modal closes; "do not save" transaction does not appear in the list

---

### Edit Transaction

#### TC-25: Edit opens modal pre-populated with transaction data
- **Type**: Smoke
- **Steps**:
  1. Click the actions menu (⋮) on an existing transaction
  2. Take screenshot — verify the dropdown menu is anchored to the ⋮ button, fully visible, not clipped by the viewport
  3. Click "Edit"
  4. Take screenshot — verify the edit modal is centred in the viewport, not clipped, backdrop visible
- **Expected result**: Modal opens with all fields pre-filled with the transaction's current values; modal is centred

#### TC-26: Editing saves updated values
- **Type**: Smoke
- **Steps**:
  1. Open the edit modal for any transaction
  2. Take screenshot — verify modal is centred, not clipped, backdrop visible
  3. Change Description to `Updated by Playwright`
  4. Click "Save"
  5. Call `browser_network_requests` — verify `PATCH /transactions/:id` was called with status 200
  6. Call `browser_console_messages(level: 'error')` — confirm no JS errors
- **Expected result**: Modal closes; that transaction row now shows "Updated by Playwright"

#### TC-27: Transaction type is disabled in edit mode
- **Type**: Regression
- **Steps**:
  1. Open the edit modal for any transaction
  2. Take screenshot — verify modal is centred, not clipped, backdrop visible
  3. Inspect the Type dropdown
- **Expected result**: Type select is `disabled`; hint text "Transaction type cannot be changed after creation." is visible

---

### Toggle Active

#### TC-28: Active transaction can be marked inactive
- **Type**: Regression
- **Steps**:
  1. Set Status filter to "All"
  2. Click ⋮ on an active transaction
  3. Take screenshot — verify the dropdown menu is anchored to the ⋮ button, fully visible, not clipped by the viewport
  4. Click "Mark Inactive" (or "Toggle Active")
  5. Call `browser_network_requests` — verify `PATCH /transactions/:id/toggle-active` was called with status 200
  6. Call `browser_console_messages(level: 'error')` — confirm no JS errors
- **Expected result**: Transaction visually updates to inactive state (e.g. greyed out); no page reload needed

#### TC-29: Inactive transaction can be reactivated
- **Type**: Regression
- **Steps**:
  1. Set Status to "Inactive"; find an inactive transaction
  2. Click ⋮ on the transaction
  3. Take screenshot — verify the dropdown menu is anchored to the ⋮ button, fully visible, not clipped by the viewport
  4. Click "Mark Active"
  5. Call `browser_network_requests` — verify `PATCH /transactions/:id/toggle-active` was called with status 200
  6. Call `browser_console_messages(level: 'error')` — confirm no JS errors
- **Expected result**: Transaction is reactivated; setting Status back to "Active" now shows it

---

### Delete Transaction

#### TC-30: Delete removes a transaction from the list
- **Type**: Smoke
- **Steps**:
  1. Note the description of an existing transaction (e.g. `Playwright test expense` from TC-19)
  2. Click ⋮ on the transaction
  3. Take screenshot — verify the dropdown menu is anchored to the ⋮ button, fully visible, not clipped by the viewport
  4. Click "Delete"
  5. Take screenshot — verify the confirmation prompt is visible and correctly positioned within or adjacent to the row
  6. Confirm the deletion
  7. Call `browser_network_requests` — verify `DELETE /transactions/:id` was called with status 200 or 204
  8. Call `browser_console_messages(level: 'error')` — confirm no JS errors
- **Expected result**: Transaction disappears from the list; summary totals update; no error message

#### TC-31: Cancelling delete confirmation does not remove the transaction
- **Type**: Regression
- **Steps**:
  1. Click ⋮ on any transaction
  2. Take screenshot — verify the dropdown menu is anchored to the ⋮ button, fully visible, not clipped by the viewport
  3. Click "Delete"
  4. Take screenshot — verify the confirmation prompt is visible and correctly positioned
  5. Cancel / dismiss the confirmation prompt
- **Expected result**: Transaction remains in the list; no API call made

---

### Accessibility

#### TC-32: Keyboard navigation reaches all interactive elements
- **Type**: Regression
- **Steps**:
  1. Navigate to `/transactions`
  2. Starting from the page heading, press Tab repeatedly through the page
- **Expected result**: All controls (filters, "+ Add Transaction", action menus, pagination) are reachable; focused element always has a visible focus indicator

#### TC-33: Modal traps focus and closes on Escape
- **Type**: Regression
- **Steps**:
  1. Open the create modal
  2. Take screenshot — verify modal is centred in the viewport, not clipped, backdrop visible
  3. Tab through all fields — confirm focus stays inside the modal
  4. Press Escape
- **Expected result**: Focus cycles only within the modal (focus trap); Escape closes the modal

#### TC-34: Filter region has an accessible label
- **Type**: Regression
- **Steps**:
  1. Navigate to `/transactions`
  2. Take an accessibility snapshot
- **Expected result**: The filter bar has `role="search"` and/or `aria-label="Transaction filters"`

---

## Responsive Layout

**Breakpoints in source**:
- `480px` — `TransactionsPage.css` reduces padding; `TransactionSummary.css` stacks summary items vertically; `TransactionModal.css` switches to bottom-sheet style (`position: fixed; bottom: 0; width: 100vw; border-radius` top corners only)
- `560px` — `TransactionForm.css` collapses two-column form rows to single column

**Viewports to test** (use `browser_resize` before navigating):
| Label   | Width | Height |
|---------|-------|--------|
| Desktop | 1280  | 720    |
| Tablet  | 768   | 1024   |
| Mobile  | 390   | 844    |

---

#### RL-01: Transactions page at desktop (1280×720) — structural baseline
- **Type**: Smoke
- **Steps**:
  1. Resize viewport to 1280×720
  2. Log in and navigate to `/transactions`
  3. Take screenshot — verify: header row (`.tx-page__header`) with title and button are on one line; `.tx-summary` shows Income / Expenses / Net in a horizontal row with dividers; `.tx-filters` filter bar is fully visible in a single row; `.tx-list` table has all column headers visible (`Date`, `Description`, `Amount`, `Category`, `Actions`); pagination controls visible at bottom
  4. Observe no horizontal scrollbar on the page body
- **Expected result**: All page sections are visible and correctly arranged at the default viewport; no horizontal overflow; table columns are not collapsed

#### RL-02: Transactions page at tablet (768×1024)
- **Type**: Regression
- **Steps**:
  1. Resize viewport to 768×1024
  2. Navigate to `/transactions`
  3. Take screenshot — verify: no horizontal overflow on the page body; `.tx-summary` summary bar remains horizontal (480px breakpoint not triggered); `.tx-filters` filter row wraps naturally without clipping; table is fully visible with horizontal scroll within `.tx-list__scroll` if needed
  4. Open the "+ Add Transaction" modal
  5. Take screenshot — verify modal is centred (not bottom-sheet; 480px breakpoint not triggered at this viewport); backdrop visible
- **Expected result**: Layout reflows correctly for tablet width; no content is pushed off-screen; modal is centred

#### RL-03: Transactions page at mobile (390×844)
- **Type**: Regression
- **Steps**:
  1. Resize viewport to 390×844
  2. Navigate to `/transactions`
  3. Take screenshot — verify: `.tx-page` has reduced padding (`.tx-page` at 480px rule); `.tx-summary` stacks into a vertical column (`.tx-summary` flex-direction: column); `.tx-filters` filter controls wrap or stack without horizontal overflow; `.tx-list__scroll` table scrolls horizontally within its container; no horizontal scrollbar on the page body itself
- **Expected result**: Summary bar stacks vertically; page padding is reduced; filter bar wraps correctly; no full-page horizontal overflow

#### RL-04: Add Transaction modal at mobile (390×844) — bottom sheet
- **Type**: Regression
- **Steps**:
  1. Resize viewport to 390×844
  2. Navigate to `/transactions`
  3. Click "+ Add Transaction"
  4. Take screenshot — verify modal renders as a bottom sheet: anchored to the bottom of the viewport, full width (`width: 100vw`), top corners rounded, bottom corners flush; the form is fully visible and not clipped by the viewport bottom; backdrop is visible behind the modal
  5. Tab through all form fields — verify all fields are reachable and not obscured by the bottom of the screen
  6. Press Escape — verify modal closes
- **Expected result**: Modal uses the `@media (max-width: 480px)` bottom-sheet style; all form fields are accessible; modal does not overflow off the bottom of the screen
