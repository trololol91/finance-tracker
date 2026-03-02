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
