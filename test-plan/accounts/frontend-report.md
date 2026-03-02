# Phase 6 Accounts — Frontend Test Report

**Date:** 2026-03-01  
**Commit:** `55043c0`  
**Total frontend tests:** 698 passing across 39 test files  
**Coverage:** statements 95.05% | branches 90.04% | functions 95.14% | lines 97.57%  
**Threshold:** all ≥ 90% ✅

---

## Test Files — Accounts Feature

### `AccountForm.test.tsx` — 28 tests ✅

| # | Test | Result |
|---|------|--------|
| 1 | create mode: renders the account form | ✅ |
| 2 | create mode: renders name input | ✅ |
| 3 | create mode: renders type select | ✅ |
| 4 | create mode: renders currency input | ✅ |
| 5 | create mode: renders opening balance input | ✅ |
| 6 | create mode: type select is not disabled in create mode | ✅ |
| 7 | create mode: does not show isActive checkbox in create mode | ✅ |
| 8 | create mode: shows "Create Account" on submit button | ✅ |
| 9 | create mode: does not show type-locked hint | ✅ |
| 10 | edit mode: renders the form with edit label | ✅ |
| 11 | edit mode: type select is disabled | ✅ |
| 12 | edit mode: shows type-locked hint | ✅ |
| 13 | edit mode: shows isActive checkbox | ✅ |
| 14 | edit mode: shows "Save Changes" on submit button | ✅ |
| 15 | field interactions: calls onChange with name field | ✅ |
| 16 | field interactions: calls onChange with institution field | ✅ |
| 17 | field interactions: submit button disabled when isSubmitting | ✅ |
| 18 | validation errors: shows name error | ✅ |
| 19 | validation errors: name input aria-invalid when error present | ✅ |
| 20 | validation errors: shows currency error | ✅ |
| 21 | validation errors: shows institution error | ✅ |
| 22 | validation errors: shows type error | ✅ |
| 23 | validation errors: shows openingBalance error | ✅ |
| 24 | validation errors: shows color error | ✅ |
| 25 | validation errors: shows notes error | ✅ |
| 26 | field interactions (cont): calls onChange with color text input | ✅ |
| 27 | field interactions (cont): calls onChange with notes textarea | ✅ |
| 28 | field interactions (cont): calls onChange with isActive checkbox in edit mode | ✅ |

---

### `AccountList.test.tsx` — 24 tests ✅

| # | Test | Result |
|---|------|--------|
| 1 | loading: shows loading message | ✅ |
| 2 | loading: region has aria-busy | ✅ |
| 3 | error: shows error message | ✅ |
| 4 | empty: shows "no active accounts" message | ✅ |
| 5 | empty: shows "create one" for inactive-filtered empty | ✅ |
| 6 | table: renders table with aria-label | ✅ |
| 7 | table: renders account name | ✅ |
| 8 | table: renders institution column | ✅ |
| 9 | table: renders formatted current balance | ✅ |
| 10 | table: renders transaction count | ✅ |
| 11 | table: renders color swatch when account has a color | ✅ |
| 12 | table: does not render color swatch when color is null | ✅ |
| 13 | table: shows notes icon when account has notes | ✅ |
| 14 | table: shows dash for null institution | ✅ |
| 15 | showInactive: hides inactive when showInactive=false | ✅ |
| 16 | showInactive: shows inactive when showInactive=true | ✅ |
| 17 | showInactive: marks inactive row visually | ✅ |
| 18 | actions: calls onEdit when Edit button clicked | ✅ |
| 19 | actions: calls onDelete when Delete button clicked (no transactions) | ✅ |
| 20 | actions: shows "Deactivate" label when account has transactions | ✅ |
| 21 | actions: shows "Delete" label when account has zero transactions | ✅ |
| 22 | negative balance: renders with negative class | ✅ |
| 23 | accessibility: table has accessible column headers | ✅ |
| 24 | empty showInactive=true: shows "No accounts found" message | ✅ |

---

### `AccountModal.test.tsx` — 20 tests ✅

| # | Test | Result |
|---|------|--------|
| 1 | title: shows "New Account" in create mode | ✅ |
| 2 | title: shows "Edit Account" in edit mode | ✅ |
| 3 | title: accessible dialog label from heading | ✅ |
| 4 | open/close: calls showModal when mode is non-null | ✅ |
| 5 | open/close: renders close button | ✅ |
| 6 | open/close: calls onClose on close button click | ✅ |
| 7 | open/close: calls onClose on native dialog close event | ✅ |
| 8 | aria: has aria-modal="true" | ✅ |
| 9 | aria: has aria-labelledby pointing to heading | ✅ |
| 10 | form: renders name input inside modal | ✅ |
| 11 | form: renders "Create Account" submit button | ✅ |
| 12 | form: renders "Save Changes" button in edit mode | ✅ |
| 13 | form: submit disabled when isSubmitting | ✅ |
| 14 | form: shows validation errors | ✅ |
| 15 | Escape: calls onClose when Escape keydown on dialog | ✅ |
| 16 | backdrop: calls onClose when clicking dialog backdrop | ✅ |
| 17 | backdrop: does not call onClose clicking inside content | ✅ |
| 18 | Tab focus trap: no throw on Tab press | ✅ |
| 19 | Tab focus trap: no throw on Shift+Tab press | ✅ |
| 20 | Tab focus trap: ignores non-Tab non-Escape keys | ✅ |

---

### `AccountsSummary.test.tsx` — 8 tests ✅

| # | Test | Result |
|---|------|--------|
| 1 | renders summary bar with correct aria-label | ✅ |
| 2 | shows 0 active accounts when list is empty | ✅ |
| 3 | shows correct active account count | ✅ |
| 4 | excludes inactive accounts from totals | ✅ |
| 5 | shows correct total transactions | ✅ |
| 6 | shows net balance formatted as CAD currency | ✅ |
| 7 | applies negative CSS class when balance is negative | ✅ |
| 8 | applies positive CSS class when balance is positive | ✅ |

---

### `AccountsErrorBoundary.test.tsx` — 8 tests ✅

| # | Test | Result |
|---|------|--------|
| 1 | normal: renders children when no error | ✅ |
| 2 | normal: does not show error UI when no error | ✅ |
| 3 | error: shows error alert when child throws | ✅ |
| 4 | error: shows "Something went wrong" heading | ✅ |
| 5 | error: shows the error message | ✅ |
| 6 | error: shows "Try again" button | ✅ |
| 7 | error: shows the Error message from thrown Error | ✅ |
| 8 | error: shows fallback message for non-Error throws | ✅ |

---

### `useAccountForm.test.ts` — 28 tests ✅

| # | Test | Result |
|---|------|--------|
| 1 | initial: modalMode is null | ✅ |
| 2 | initial: starts with empty form values | ✅ |
| 3 | initial: starts with no errors | ✅ |
| 4 | initial: editTarget is null | ✅ |
| 5 | initial: isSubmitting is false | ✅ |
| 6 | openCreate: sets modalMode to "create" | ✅ |
| 7 | openCreate: resets form values to defaults | ✅ |
| 8 | openCreate: clears errors | ✅ |
| 9 | openEdit: sets modalMode to "edit" | ✅ |
| 10 | openEdit: populates form values from account | ✅ |
| 11 | openEdit: sets editTarget to account | ✅ |
| 12 | openEdit: maps null institution to empty string | ✅ |
| 13 | closeModal: sets modalMode to null | ✅ |
| 14 | handleFieldChange: updates the specified field | ✅ |
| 15 | handleFieldChange: clears field error on value change | ✅ |
| 16 | handleFieldChange: handles boolean values for isActive | ✅ |
| 17 | handleSubmit validation: sets name error when empty | ✅ |
| 18 | handleSubmit validation: does not call create when invalid | ✅ |
| 19 | handleSubmit validation: sets currency error for invalid code | ✅ |
| 20 | handleSubmit validation: sets color error for invalid hex | ✅ |
| 21 | handleSubmit create: calls create.mutate with form data | ✅ |
| 22 | handleSubmit create: calls onSuccess callback when create succeeds | ✅ |
| 23 | handleSubmit create: sets modal mode null when create succeeds | ✅ |
| 24 | handleSubmit create: sets name error when create fails | ✅ |
| 25 | handleSubmit update: calls update.mutate when editTarget set | ✅ |
| 26 | handleSubmit update: passes account id to update call | ✅ |
| 27 | handleDelete: calls remove.mutate with account id | ✅ |
| 28 | handleDelete: isDeleting reflects remove pending state | ✅ |

---

## Cross-Feature Tests (Transactions)

The following test files were **updated** to include `accountId` in their mock state and `accounts` prop coverage:

- `TransactionForm.test.tsx` — 3 assertions updated for multiple matching elements
- `TransactionListItem.test.tsx` — 2 assertions updated for multiple "—" cells
- `TransactionFilters.test.tsx` — `accountId: ''` added to `defaultFilters` mock
- `TransactionsPage.test.tsx` — `accountId: ''` added to `defaultFilterState.filters`

See [test-plan/transactions/frontend.md](../transactions/frontend.md) — TC-45 through TC-51 for manual cross-feature verification cases.

---

## Coverage Summary

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Statements | 95.05% | 90% | ✅ |
| Branches | 90.04% | 90% | ✅ |
| Functions | 95.14% | 90% | ✅ |
| Lines | 97.57% | 90% | ✅ |

**Backend + Frontend combined:** 698 frontend tests + 274 backend tests = 972 total tests passing.

---

## Playwright Exploratory Test Report

**Date:** 2026-03-01  
**Environment:** http://localhost:5173  
**Backend:** http://localhost:3001  
**Test User:** session already authenticated  
**Commits under test:** `1548783` (test fixes), `233a88c` (Phase 6 tests), `f580cc3`, `bce51d9`, `61fd5c0`

### Summary

| Total | Passed | Partial | Failed | Skipped |
|-------|--------|---------|--------|---------|
| 18 | 18 | 0 | 0 | 0 |

### Console Errors Observed

None — zero console errors recorded across all 18 test cases.

### Network Verification (Mutation TCs)

| TC | Endpoint | Method | Status | Result |
|----|----------|--------|--------|--------|
| TC-06 | /accounts | POST | 201 Created | ✅ |
| TC-07 | /accounts/{id} | PATCH | 200 OK | ✅ |
| TC-09 (deactivate) | /accounts/{id} | PATCH | 200 OK | ✅ |
| TC-10 | /accounts/{id} | DELETE | 204 No Content | ✅ |
| TC-11 (cancelled) | — | — | no request | ✅ |
| cleanup (chequing) | /accounts/{id} | DELETE | 204 No Content | ✅ |

### Bugs Found

None.

### Results

#### ✅ TC-01: Page load — structural layout, empty state, dark theme
Dark background `rgb(15, 23, 42)` confirmed. "Accounts" h1, "+ New Account" button, "Show inactive" checkbox, "0 account(s)" count, and empty state paragraph all visible in correct order. No AccountsSummary bar (correct — 0 accounts). Zero console errors.

#### ✅ TC-02: New Account modal opens — layout and field presence
Modal centred, not clipped by viewport, backdrop visible. "New Account" heading. All 9 form controls present. Focus automatically moves to Account Name input. ✕ Close button in header. `dialog[open]` confirmed. Screenshot: `screenshots/tc02-new-account-modal.png`.

#### ✅ TC-03: Validation — submit with empty name
"Name is required" alert inline below the Account Name field. Red border on input. Modal stays open. No network request sent. Screenshot: `screenshots/tc03-validation-empty-name.png`.

#### ✅ TC-04: Close modal via Escape key
Escape closes modal. Focus restored to "+ New Account" button (confirmed `[active]` state in snapshot).

#### ✅ TC-05: Close modal via ✕ button
✕ button closes modal. Focus restored to "+ New Account" button. Form is reset to empty state when reopened.

#### ✅ TC-06: Create account — full valid form, POST → 201
Account "Playwright Test Chequing" created: POST /accounts → 201. Modal auto-closed. AccountsSummary appeared showing "1 / $1,500.00 / 0". Table row rendered with: blue color swatch, account name, ℹ notes hint, "Checking" badge, "TD Bank", "$1,500.00" (green positive), "0", "Active" badge, Edit/Delete action buttons. Screenshot: `screenshots/tc06-account-created.png`.

#### ✅ TC-07: Edit modal — fields populate, type locked, PATCH → 200
Edit modal title "Edit Account", form `aria-label="Edit account form"`. All fields pre-populated from existing account. Type select `[disabled]` with "Account type cannot be changed after creation." hint. isActive checkbox present and checked. "Save Changes" button (not "Create Account"). PATCH /accounts/{id} → 200. Table row name updated. Focus restored to Edit button. Screenshot: `screenshots/tc07-edit-modal.png`.

#### ✅ TC-08: "Show inactive" checkbox toggles visible count
With 1 active account, checking "Show inactive" still shows "1 account(s)" (correct — no inactive accounts). Unchecking reverts. No console errors.

#### ✅ TC-09: Deactivate account → Show inactive toggle
Deactivated "Playwright Test Savings" via isActive checkbox uncheck → PATCH → 200. Row disappeared from default view (showInactive=false). AccountsSummary: 1 account, Net Balance $1,500.00 (savings excluded from aggregate). Checked "Show inactive" → savings row reappeared at 55% opacity with "Inactive" badge. Count showed "2 account(s)". Screenshot: `screenshots/tc09-show-inactive.png`.

**Note:** AccountsSummary correctly counts only `isActive=true` accounts for all 3 stats. Tested and confirmed with 2 accounts (1 active, 1 inactive) — summary shows "1 / $1,500.00 / 0" even when "Show inactive" is checked.

#### ✅ TC-10: Delete account (0 transactions) — DELETE → 204
Confirm dialog: `Delete account "Playwright Test Savings"? This cannot be undone.`. Accept → DELETE /accounts/{id} → 204. Row removed. Count decremented. Summary updated.

#### ✅ TC-11: Delete cancelled — no API call
Dismiss confirm dialog → row intact → no DELETE request in network log.

#### ✅ TC-12: Per-row actions on 1-row list (boundary)
At 1-row list minimum, Edit and Delete buttons fully visible in viewport, not clipped by table `overflow: hidden`. No table scrollbar. Screenshot: `screenshots/tc12-row-actions-short-list.png`.

#### ✅ TC-13: Tablet (768×1024) layout
"Transactions" column correctly hidden (`hideOnTablet`). Remaining columns — Name, Type, Institution, Balance, Status, Actions — all visible. AccountsSummary horizontal (3 stats side by side). No horizontal overflow. Screenshot: `screenshots/tc13-tablet-768.png`.

#### ✅ TC-14: Mobile (390×844) layout
Type, Institution, Transactions, Status columns hidden (`hideOnMobile`). Name, Balance, Actions visible. AccountsSummary stacks vertically (`flex-direction: column`). `body.scrollWidth > body.clientWidth === false`. Screenshot: `screenshots/tc14-mobile-390.png`.

#### ✅ TC-15: Modal at mobile (390×844)
Modal fits within 390px width via `width: min(92vw, 42rem)`. No body horizontal overflow with modal open. Type + Institution row collapses to single column (`@media (max-width: 480px)`). Modal is internally scrollable (overflow-y: auto) — form taller than 92vh at this viewport; all fields reachable by scrolling within the dialog. "Create Account" button visible. Escape closes modal. Screenshot: `screenshots/tc15-modal-mobile.png`.

#### ✅ TC-16: Focus trap in modal
10 focusable elements confirmed in order: ✕ Close → acc-name → acc-type → acc-institution → acc-currency → acc-balance → color-picker → acc-color → acc-notes → Create Account. Tab from last wraps to first (✕ Close). Shift+Tab from first wraps to last (Create Account). Both directions work.

#### ✅ TC-17: Type and Currency select options (boundary)
Type: 6 options — Checking, Savings, Credit, Investment, Loan, Other. Currency: 7 options — CAD, USD, EUR, GBP, AUD, JPY, CHF.

#### ✅ TC-18: Empty state messages (both variants)
`showInactive=false`, 0 accounts → "No active accounts. Create one or show inactive."  
`showInactive=true`, 0 accounts → "No accounts found. Create your first account."  
Both branch conditions verified.

### Test Data Created and Cleaned Up

| Description | Type | Amount | Status | Cleaned Up |
|-------------|------|--------|--------|------------|
| Playwright Test Chequing | Checking | $1,500.00 CAD | Deleted via UI | ✅ Yes |
| Playwright Test Savings | Savings | -$250.00 CAD | Deleted via UI (0 transactions) | ✅ Yes |

### Testing Gaps — Retrospective

1. **Unauthenticated redirect** — TC for `/accounts` without auth not tested (would require a separate browser context or logout flow); redirect logic confirmed functional from previous auth tests.
2. **Delete with transactions > 0** — the confirm message differs (deactivate path). Not testable without live transactions linked to an account in this run.
3. **Color picker interaction** — the native `<input type="color">` is not inspectable via Playwright accessibility snapshot. Color was verified visually via color swatch rendered in the table row.
4. **Opening balance hint text** — "Balance at the time you added this account" is present in snapshots but the hint's `aria-describedby` wiring was verified by Vitest unit tests, not Playwright.
5. **Backend error handling** — no test for what happens when POST/PATCH/DELETE returns 4xx/5xx (error boundary not exercisable without network interception).
