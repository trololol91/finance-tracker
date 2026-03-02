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

#### TC-35: Category column visible in table on page load
- **Type**: Smoke
- **Steps**:
  1. Log in and navigate to `/transactions`
  2. Call `browser_network_requests` — verify `GET /categories` returned 200
  3. Take screenshot — verify CATEGORY column header is visible in the table; at least one row shows a colour swatch and category name in its CATEGORY cell
- **Expected result**: CATEGORY column header present; cells show swatch + name for transactions with a category assigned, "—" for unassigned; `GET /categories` fires once on page load

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
- **Subject control**: "This Month" preset button
- **Steps**:
  1. Navigate to `/transactions`
  2. In the DateRangePicker, select the "This Month" preset
- **Expected result**: List updates to show only transactions within the current calendar month; pagination resets to page 1

#### TC-08a: Date range preset "Today" — subject: Today button
- **Type**: Regression
- **Subject control**: "Today" preset button
- **Steps**:
  1. Navigate to `/transactions`
  2. Click the "Today" preset button
  3. Inspect the URL query string — note `startDate` and `endDate` values
  4. Call `browser_network_requests` — verify `GET /transactions` was called
- **Expected result**: `startDate` equals today's UTC midnight (`T00:00:00.000Z`); `endDate` equals today's UTC end-of-day (`T23:59:59.999Z`); "Today" button has `aria-pressed="true"`; list shows only today's transactions (or empty state if none exist for today); pagination resets to page 1
- **Note**: If no transactions exist for today, an empty-state message must be shown — a zero-row table without an empty-state message is also a failure

#### TC-08b: Date range preset "This Week" — subject: This Week button
- **Type**: Regression
- **Subject control**: "This Week" preset button
- **Steps**:
  1. Navigate to `/transactions`
  2. Click the "This Week" preset button
  3. Inspect the URL query string — note `startDate` and `endDate` values
  4. Call `browser_network_requests` — verify `GET /transactions` was called
- **Expected result**: `startDate` equals the UTC midnight of Monday for the current ISO week; `endDate` equals the UTC end-of-day of the following Sunday; "This Week" button has `aria-pressed="true"`; list shows only transactions in that ISO-week range; pagination resets to page 1

#### TC-08c: Date range preset "This Year" — positive path — subject: This Year button
- **Type**: Regression
- **Subject control**: "This Year" preset button
- **Known failing**: BUG-02 — `startDate` is not emitted; only `endDate` is set. This TC will PARTIAL/FAIL until BUG-02 is resolved
- **Steps**:
  1. Navigate to `/transactions` (default "This Month" preset active)
  2. Click the "This Year" preset button
  3. Inspect the URL query string — note both `startDate` and `endDate` values
  4. Call `browser_network_requests` — verify `GET /transactions` was called
- **Expected result**: `startDate` equals `YYYY-01-01T00:00:00.000Z` (Jan 1 of current year); `endDate` equals `YYYY-12-31T23:59:59.999Z` (Dec 31 of current year); "This Year" button has `aria-pressed="true"`; list includes transactions from earlier in the year (not just the current month); pagination resets to page 1
- **Current behaviour (BUG-02)**: URL contains only `endDate`; `startDate` from the previous "This Month" preset is not reset. TC will be marked ⚠️ PARTIAL until fixed

#### TC-09: Custom date range filters list
- **Type**: Regression
- **Subject control**: "Custom" preset / date range inputs
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

#### TC-36: Category filter — select existing category filters the list
- **Type**: Smoke
- **Steps**:
  1. Navigate to `/transactions`
  2. Select a known category (e.g. "Food") in the Category dropdown
  3. Inspect the URL query string — verify `categoryId=<uuid>` is present
  4. Call `browser_network_requests` — verify `GET /transactions?…&categoryId=<uuid>` was called
- **Expected result**: List updates to show only transactions assigned to that category; URL contains `categoryId` param; `page` resets to 1

#### TC-37: Category filter — no matching transactions shows empty state
- **Type**: Regression
- **Steps**:
  1. Select a category that has no transactions assigned (e.g. "Produce" if unused)
- **Expected result**: "No transactions found for the selected filters." message displayed; empty state occupies the correct region (not full viewport, not zero-height)

#### TC-38: Clear Filters resets Category dropdown to "All Categories"
- **Type**: Regression
- **Steps**:
  1. Select any category in the Category dropdown
  2. Click "Clear Filters"
- **Expected result**: Category dropdown resets to "All Categories"; `categoryId` param removed from URL; full transaction list restores

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

#### TC-39: Add modal — Category select present and defaults to "None"
- **Type**: Smoke
- **Steps**:
  1. Click "+ Add Transaction"
  2. Take screenshot — verify modal is centred, not clipped, backdrop visible
  3. Inspect the Category field — note its position (between the Amount/Type/Date row and the Description field) and default value
- **Expected result**: Category `<select>` is visible; default option is "None"; options include all active categories; inactive categories are absent

#### TC-40: Create transaction with a category — category appears in list
- **Type**: Smoke
- **Steps**:
  1. Open the Add modal
  2. Fill Amount, Type, Date, Description; select a category (e.g. "Produce")
  3. Click "Save"
  4. Call `browser_network_requests` — verify `POST /transactions` returned 201 and `GET /transactions/totals` fired after
  5. Call `browser_console_messages(level: 'error')` — confirm no JS errors
- **Expected result**: Modal closes; new row visible in list with the selected category in the CATEGORY cell; summary totals update without page reload

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

#### TC-41: Edit modal — Category pre-populated from saved value
- **Type**: Smoke
- **Steps**:
  1. Click ⋮ on a transaction that has a category assigned
  2. Click "Edit"
  3. Take screenshot — verify modal is centred, not clipped, backdrop visible
  4. Inspect the Category select
- **Expected result**: Category `<select>` shows the transaction's current category pre-selected

#### TC-42: Edit — change category → list cell updates immediately
- **Type**: Regression
- **Steps**:
  1. Open the edit modal for a transaction with a category assigned
  2. Change the Category to a different active category
  3. Click "Save"
  4. Call `browser_network_requests` — verify `PATCH /transactions/:id` returned 200 with `categoryId` UUID in the request body
- **Expected result**: CATEGORY cell in the list immediately reflects the new category (swatch + name); no page reload required

#### TC-43: Edit — clear category to None sends `null` to API
- **Type**: Regression
- **Steps**:
  1. Open the edit modal for a transaction with a category assigned
  2. Change Category to "None"
  3. Click "Save"
  4. Call `browser_network_requests` — verify `PATCH /transactions/:id` returned 200; inspect request body — `categoryId` must be `null` (not `""` or omitted)
- **Expected result**: CATEGORY cell shows "—"; regression-tests the `buildUpdateDto` fix that converts empty string to `null`

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

#### TC-44: Category column hidden at mobile 390×844, no body overflow
- **Type**: Regression
- **Steps**:
  1. Resize viewport to 390×844
  2. Navigate to `/transactions`
  3. Take screenshot — verify CATEGORY column header and data cells are not visible
  4. Evaluate `document.body.scrollWidth > document.body.clientWidth` — assert `false`
  5. Resize back to 1280×720 — verify CATEGORY column reappears
- **Expected result**: At ≤767px, `.tx-list__th--hide-mobile` and `.tx-item__hide-mobile` hide the CATEGORY column; no body-level horizontal overflow; column is restored at desktop width

---

## Cross-Feature: Accounts Integration (Phase 6)

> These test cases cover the account selector in the transaction form, the account column in the transaction list, and the account filter in the filter bar. They were added when the Accounts feature (Phase 6) was wired into the Transactions page.

### TC-45: Account selector visible in Add Transaction modal
- **Type**: Smoke
- **Steps**:
  1. Ensure at least one account exists (e.g. "Main Chequing" via the Accounts page)
  2. Navigate to `/transactions`
  3. Click "+ Add Transaction"
  4. Take screenshot — verify the Account field is present in the modal (between Category and Description)
- **Expected result**: Account `<select>` is visible; default option is "None"; all active accounts appear as options; inactive accounts are absent

### TC-46: Create transaction with account — account column shows account name
- **Type**: Smoke
- **Steps**:
  1. Open Add Transaction modal; fill Amount, Type, Date, Description
  2. Select a known account (e.g. "Main Chequing")
  3. Click "Save"
  4. Call `browser_network_requests` — verify `POST /transactions` returned 201 with `accountId` UUID in the request body
  5. Call `browser_console_messages(level: 'error')` — confirm no JS errors
- **Expected result**: Modal closes; new row in the list shows "Main Chequing" (or the account short name) in the ACCOUNT column; summary totals update

### TC-47: Edit modal — Account field is disabled and shows hint
- **Type**: Regression
- **Steps**:
  1. Click ⋮ on a transaction that has an account assigned; click "Edit"
  2. Take screenshot — verify edit modal is centred; inspect the Account field
- **Expected result**: Account `<select>` is `disabled`; hint "Account cannot be changed after creation." is visible below the select

### TC-48: Account filter — select account filters the list
- **Type**: Smoke
- **Steps**:
  1. Navigate to `/transactions`
  2. Select a known account in the Account dropdown of the filter bar
  3. Inspect the URL query string — verify `accountId=<uuid>` is present
  4. Call `browser_network_requests` — verify `GET /transactions?…&accountId=<uuid>` was called
- **Expected result**: List updates to show only transactions assigned to that account; URL contains `accountId` param; `page` resets to 1

### TC-49: Account filter — no matching transactions shows empty state
- **Type**: Regression
- **Steps**:
  1. Select an account that has no transactions assigned
- **Expected result**: "No transactions found for the selected filters." message is displayed

### TC-50: Clear Filters resets Account dropdown to "All Accounts"
- **Type**: Regression
- **Steps**:
  1. Select any account in the Account dropdown
  2. Click "Clear Filters"
- **Expected result**: Account dropdown resets to "All Accounts"; `accountId` param removed from URL; full transaction list restores

### TC-51: Account column hidden at mobile 390×844, no body overflow
- **Type**: Regression
- **Steps**:
  1. Resize viewport to 390×844
  2. Navigate to `/transactions`
  3. Take screenshot — verify ACCOUNT column header and data cells are not visible
  4. Evaluate `document.body.scrollWidth > document.body.clientWidth` — assert `false`
  5. Resize back to 1280×720 — verify ACCOUNT column reappears
- **Expected result**: At ≤767px, the ACCOUNT column is hidden by the same `.tx-item__hide-mobile` class; no body-level horizontal overflow; column is restored at desktop width
