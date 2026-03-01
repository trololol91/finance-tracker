# Implementation Plan — Transactions Frontend Bug Fixes

**Source**: `test-plan/transactions/frontend-report.md`  
**Date**: 2026-03-01  
**Prepared by**: Planner agent  
**Target agent**: `frontend-dev`

---

## Overview

Eight bugs are to be fixed in priority order. They span four files and one backend service method. No new routes, no schema changes, no migrations, no new API endpoints.

| # | Bug | Priority | Status | File(s) |
|---|-----|----------|--------|---------|
| BUG-07 | Tab order skips all interactive controls | High | ✅ Done | `TransactionModal.tsx` |
| BUG-01 | Date timezone exclusion | High | ✅ Done | `DateRangePicker.tsx`, `useTransactionFilters.ts`, `transactions.service.ts` |
| BUG-08 | Modal renders at top-left (all viewports) | Medium | ✅ Done | `TransactionModal.css` |
| BUG-06 | Modal missing `aria-modal` / `aria-labelledby` | Medium | ✅ Done | `TransactionModal.tsx` |
| BUG-03 | Summary totals stale after mutations | Medium | ✅ Done | `useTransactionForm.ts`, `TransactionsPage.tsx` |
| BUG-02 | "This Year" does not reset `startDate` | Medium | ✅ Done | `useTransactionFilters.ts`, `TransactionFilters.tsx`, `TransactionsPage.tsx` |
| BUG-05 | Modal initial focus on Close button | Low | ✅ Done | `TransactionModal.tsx`, `TransactionForm.tsx`, `Input.tsx` |
| BUG-04 | Silent auth failure redirect | Medium | ✅ Done | `AuthContext.tsx`, `auth.types.ts` |

---

## Prerequisites / Context

- The **Orval-generated** file [packages/frontend/src/api/transactions/transactions.ts](packages/frontend/src/api/transactions/transactions.ts) must not be hand-edited. Invalidation helpers (`getTransactionsControllerGetTotalsQueryKey`, `getTransactionsControllerFindAllQueryKey`) are imported from there.
- All imports must use `@` path aliases; no relative imports.
- ESM `.js` extensions required on all local imports.
- TypeScript strict mode — every function needs an explicit return type.

---

## BUG-07 — Tab order skips all interactive controls

### Root-cause hypothesis

The test tester observed that Tab from the page body cycles **only** through the per-row "Actions ⋮" trigger buttons; nav links, the "+ Add Transaction" button, filter controls, summary bar, and pagination are all skipped. The most likely candidates, in order of probability:

1. **CSS stacking-context occlusion** — The `.tx-list__scroll` div (or the sticky `z-index: var(--z-sticky)` header) may create a painting order where other interactive regions are visually "behind" the table. Some browsers skip focus on elements that fail the hit-test at their centre point (the `pointer-events` model). Verify by running `document.querySelectorAll(':is(button, a, input, select, [tabindex])').length` and comparing to the count of focusable elements actually reachable.

2. **`overflow: hidden` clipping on a scroll ancestor** — `TransactionList.css` applies `overflow: hidden` to `.tx-list` (line 5). If this container happens to fill the viewport and the surrounding page controls are painted outside its bounding box (e.g. due to a `position: relative` ancestor with incorrect height), browsers may treat the out-of-bounds elements as not hit-testable and skip them for sequential focus.

3. **Stale `<dialog>` top-layer state** — Native `<dialog>` opened with `showModal()` places the dialog in the browser's "top layer" and marks everything else as `inert` via the blocking stack. If a page reload or React StrictMode double-invoke leaves the `<dialog>` element in the DOM having been `showModal()`-ed once and never `close()`-ed, all non-dialog content is inert for that document lifetime. The `TransactionModal.tsx` `useEffect` guards against calling `showModal()` when already open, but does not guard against double-mount (StrictMode) calling `close()` on an already-closed dialog, potentially leaving an inconsistent top-layer state.

### Investigation steps (for implementer)

1. Open DevTools → Elements, select the `<dialog>` element, check whether the `open` attribute is present when the modal is visually closed.
2. In the console run: `document.querySelector('dialog').matches(':modal')` — if `true` while the modal appears closed, the dialog is stuck in the top layer → this is the root cause.
3. Check the computed `z-index` and stacking context of `.tx-list`.
4. Verify `document.body.contains(document.activeElement)` is `true` after Tab press.

### Fix A — Guard against `showModal()` / `close()` mismatch (most likely needed regardless)

**File**: [packages/frontend/src/features/transactions/components/TransactionModal.tsx](packages/frontend/src/features/transactions/components/TransactionModal.tsx)

Replace the open/close `useEffect` with one that also handles React StrictMode double-invoke by checking `dialog.isConnected` and introduces a safe close wrapper:

```tsx
useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
        if (!dialog.open) {
            try { dialog.showModal(); } catch { /* already in top layer */ }
        }
    } else {
        if (dialog.open) dialog.close();
    }
}, [isOpen]);
```

The `try/catch` prevents the `InvalidStateError` that can occur under StrictMode double-invoke and ensures `close()` is always paired with every successful `showModal()`.

### Fix B — Remove `overflow: hidden` from the outer `.tx-list` container if it is causing layout clipping

**File**: [packages/frontend/src/features/transactions/components/TransactionList.css](packages/frontend/src/features/transactions/components/TransactionList.css)

After the investigation, if `.tx-list { overflow: hidden }` is identified as the culprit (it is present on line 5), replace it with `overflow: visible` (keeping `overflow: hidden` only on `.tx-list__scroll` for the horizontal scroll rail).

---

## BUG-01 — Date timezone exclusion

### Root cause (confirmed in code)

**Frontend** — `DateRangePicker.tsx` `getPresetRange()` uses `new Date(year, month, day)` (local-time constructor) for all five presets. `useTransactionFilters.ts` `getThisMonthRange()` duplicates the same pattern. For a UTC+ user, local midnight is earlier than UTC midnight; a transaction stored at `2026-02-01T00:00:00.000Z` is treated as falling before the filter start.

**Backend** — `transactions.service.ts` `getMonthlyTotals()` (lines 196–197) uses `new Date(year, month - 1, 1)` and `new Date(year, month, 0, 23, 59, 59, 999)` (local-time). On the server the timezone is usually UTC, so this is safe there, but if the server ever runs in a non-UTC timezone the same exclusion occurs.

### Fix — Frontend `DateRangePicker.tsx`

**File**: [packages/frontend/src/components/common/DateRangePicker/DateRangePicker.tsx](packages/frontend/src/components/common/DateRangePicker/DateRangePicker.tsx)

Replace every `new Date(year, ...)` call inside `getPresetRange()` with `Date.UTC(...)` equivalents:

```ts
case 'today': {
    const y = now.getUTCFullYear(), m = now.getUTCMonth(), d = now.getUTCDate();
    return {
        startDate: new Date(Date.UTC(y, m, d, 0, 0, 0, 0)).toISOString(),
        endDate:   new Date(Date.UTC(y, m, d, 23, 59, 59, 999)).toISOString()
    };
}
case 'this-week': {
    const day = now.getUTCDay();
    const monday = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(),
        now.getUTCDate() - ((day + 6) % 7), 0, 0, 0, 0
    ));
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    sunday.setUTCHours(23, 59, 59, 999);
    return { startDate: monday.toISOString(), endDate: sunday.toISOString() };
}
case 'this-month': {
    const y = now.getUTCFullYear(), m = now.getUTCMonth();
    return {
        startDate: new Date(Date.UTC(y, m, 1, 0, 0, 0, 0)).toISOString(),
        endDate:   new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999)).toISOString()
    };
}
case 'this-year': {
    const y = now.getUTCFullYear();
    return {
        startDate: new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0)).toISOString(),
        endDate:   new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999)).toISOString()
    };
}
```

Also fix `handleCustomStart` and `handleCustomEnd` which use `new Date(`${value}T00:00:00`)` (local-time interpretation):

```ts
const handleCustomStart = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const [y, mo, d] = e.target.value.split('-').map(Number);
    onChange({ startDate: new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0)).toISOString(), endDate });
};
const handleCustomEnd = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const [y, mo, d] = e.target.value.split('-').map(Number);
    onChange({ startDate, endDate: new Date(Date.UTC(y, mo - 1, d, 23, 59, 59, 999)).toISOString() });
};
```

### Fix — Frontend `useTransactionFilters.ts`

**File**: [packages/frontend/src/features/transactions/hooks/useTransactionFilters.ts](packages/frontend/src/features/transactions/hooks/useTransactionFilters.ts)

Replace `getThisMonthRange()`:

```ts
const getThisMonthRange = (): { startDate: string; endDate: string } => {
    const now = new Date();
    const y = now.getUTCFullYear(), m = now.getUTCMonth();
    return {
        startDate: new Date(Date.UTC(y, m, 1, 0, 0, 0, 0)).toISOString(),
        endDate:   new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999)).toISOString()
    };
};
```

Also update `clearFilters` to use the same UTC helper (it already calls `getThisMonthRange()`, so the helper fix covers it).

### Fix — Backend `transactions.service.ts`

**File**: [packages/backend/src/transactions/transactions.service.ts](packages/backend/src/transactions/transactions.service.ts)

Replace the local-time boundary construction in `getMonthlyTotals()` (lines 196–197):

```ts
// Before
const start = new Date(year, month - 1, 1);
const end = new Date(year, month, 0, 23, 59, 59, 999);

// After
const start = new Date(Date.UTC(year, month - 1, 1));
const end   = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
```

### Tests to update / add

- **Frontend unit**: `DateRangePicker` — assert that `getPresetRange('this-month')` returns `startDate` ending in `T00:00:00.000Z` (not an offset).
- **Backend unit**: add a test to `transactions.service.spec.ts` `getMonthlyTotals` describe block: create a transaction at exactly `new Date(Date.UTC(year, month-1, 1))` and assert it is included in the result.

---

## BUG-08 — Modal renders at top-left (all viewports)

### Root cause (confirmed in code)

Native `<dialog>` elements default to `position: absolute` with UA-sheet centering only **when the browser applies its default dialog centering styles** (current in Chrome/Firefox). However, when any explicit `position` declaration is present in the author stylesheet, the browser's UA centering is suppressed. The existing `@media (max-width: 480px)` rule sets `position: fixed; bottom: 0; left: 0` which overrides UA centering at mobile — but there is no explicit centering rule for larger breakpoints, and browser behaviour is inconsistent.

### Fix

**File**: [packages/frontend/src/features/transactions/components/TransactionModal.css](packages/frontend/src/features/transactions/components/TransactionModal.css)

Add explicit centering to `.tx-modal` (default / desktop) and fix the mobile bottom-sheet rule:

```css
.tx-modal {
    /* ... existing properties ... */
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    margin: 0; /* override UA default auto margins */
}

@media (max-width: 480px) {
    .tx-modal {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        top: auto;
        transform: none;
        width: 100%;
        max-width: 100%;
        border-radius: var(--radius-xl) var(--radius-xl) 0 0;
        margin: 0;
    }
}
```

---

## BUG-06 — Modal missing `aria-modal` and `aria-labelledby`

### Root cause

The `<dialog>` element in `TransactionModal.tsx` uses `aria-label={title}` but does not set `aria-modal="true"` or `aria-labelledby`. Screen readers without native `<dialog>` support fall back to ARIA, which requires both attributes. The focus-trap is also incomplete: focus can leave the dialog for one Tab step.

### Fix

**File**: [packages/frontend/src/features/transactions/components/TransactionModal.tsx](packages/frontend/src/features/transactions/components/TransactionModal.tsx)

1. Add `id="tx-modal-title"` to the `<h2>` element.
2. Replace `aria-label={title}` on `<dialog>` with `aria-modal="true"` and `aria-labelledby="tx-modal-title"`.
3. Add a focus-trap `keydown` handler that intercepts Tab/Shift+Tab and cycles focus within the dialog's focusable elements.

```tsx
// Focus-trap helper (add above the component or in a shared util)
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Inside useEffect for focus-trap — runs while isOpen is true
useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleTab = (e: KeyboardEvent): void => {
        if (e.key !== 'Tab') return;
        const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
            if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
            if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
    };
    dialog.addEventListener('keydown', handleTab);
    return (): void => { dialog.removeEventListener('keydown', handleTab); };
}, [isOpen]);
```

Updated `<dialog>` JSX:

```tsx
<dialog
    ref={dialogRef}
    className="tx-modal"
    aria-modal="true"
    aria-labelledby="tx-modal-title"
    onClick={handleBackdropClick}
>
    ...
    <h2 id="tx-modal-title" className="tx-modal__title">{title}</h2>
```

---

## BUG-03 — Summary totals not invalidated after mutations

### Root cause

`useTransactionForm.ts` `afterSave()` and `TransactionsPage.tsx` `handleToggleActive()` / `handleDelete()` each call `queryClient.invalidateQueries` for the **list** query key only. The totals query key (`/transactions/totals`) is never invalidated; `TransactionSummary` continues to show stale values until a full page reload.

### Fix — `useTransactionForm.ts`

**File**: [packages/frontend/src/features/transactions/hooks/useTransactionForm.ts](packages/frontend/src/features/transactions/hooks/useTransactionForm.ts)

Add the totals invalidation to `afterSave`:

```ts
import {
    useTransactionsControllerCreate,
    useTransactionsControllerUpdate,
    getTransactionsControllerFindAllQueryKey,
    getTransactionsControllerGetTotalsQueryKey  // add this import
} from '@/api/transactions/transactions.js';

// Inside afterSave():
const afterSave = (): void => {
    void queryClient.invalidateQueries({
        queryKey: queryKey ?? getTransactionsControllerFindAllQueryKey(),
        exact: false
    });
    void queryClient.invalidateQueries({
        queryKey: getTransactionsControllerGetTotalsQueryKey(),
        exact: false
    });
    onSuccess();
};
```

### Fix — `TransactionsPage.tsx`

**File**: [packages/frontend/src/pages/TransactionsPage.tsx](packages/frontend/src/pages/TransactionsPage.tsx)

Add to both `handleToggleActive` and `handleDelete` `onSuccess` callbacks:

```ts
import {
    useTransactionsControllerRemove,
    useTransactionsControllerToggleActive,
    getTransactionsControllerFindAllQueryKey,
    getTransactionsControllerGetTotalsQueryKey  // add this import
} from '@/api/transactions/transactions.js';

// Inside both onSuccess callbacks:
onSuccess: (): void => {
    void queryClient.invalidateQueries({
        queryKey: getTransactionsControllerFindAllQueryKey(apiParams),
        exact: false
    });
    void queryClient.invalidateQueries({
        queryKey: getTransactionsControllerGetTotalsQueryKey(),
        exact: false
    });
}
```

---

## BUG-02 — "This Year" preset does not reset `startDate`

### Root cause (confirmed in code)

`TransactionFilters.tsx` calls `handleDateRange()` which fires two sequential `updateFilter()` calls — one for `startDate` and one for `endDate`. Inside `useTransactionFilters.ts`, `updateFilter` uses the functional form of `setSearchParams((prev) => ...)`. Because both calls are issued synchronously in the same event handler, React Router batches them but each `setSearchParams` receives the **same original `prev`** snapshot (before the first write applied). The second write (endDate) therefore starts from the original URL — which may have `startDate` absent (it was being served from the in-memory default) — and produces a final URL that contains only `endDate`.

### Fix — Add a `setDateRange` batch updater to `useTransactionFilters.ts`

**File**: [packages/frontend/src/features/transactions/hooks/useTransactionFilters.ts](packages/frontend/src/features/transactions/hooks/useTransactionFilters.ts)

Add a new exported function to the return type that sets both params atomically:

```ts
// Add to UseTransactionFiltersReturn interface
setDateRange: (startDate: string, endDate: string) => void;

// Implementation
const setDateRange = useCallback(
    (start: string, end: string): void => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('startDate', start);
            next.set('endDate', end);
            next.set('page', '1');
            return next;
        });
    },
    [setSearchParams]
);
```

### Fix — `TransactionFilters.tsx`

**File**: [packages/frontend/src/features/transactions/components/TransactionFilters.tsx](packages/frontend/src/features/transactions/components/TransactionFilters.tsx)

Update the component props interface and `handleDateRange` to accept a single-call `onDateRangeChange` prop:

```tsx
interface TransactionFiltersProps {
    filters: TransactionFilterState;
    onFilterChange: (key: keyof TransactionFilterState, value: string | number) => void;
    onDateRangeChange: (startDate: string, endDate: string) => void;  // NEW
    onClear: () => void;
}

// Replace handleDateRange:
const handleDateRange = (range: { startDate: string; endDate: string }): void => {
    onDateRangeChange(range.startDate, range.endDate);
};
```

### Fix — `TransactionsPage.tsx`

Pass `setDateRange` into `TransactionFilters`:

```tsx
const { ..., setDateRange } = useTransactionFilters();

<TransactionFilters
    filters={filters}
    onFilterChange={updateFilter}
    onDateRangeChange={setDateRange}
    onClear={clearFilters}
/>
```

---

## BUG-05 — Modal initial focus on Close button

### Root cause

When `dialog.showModal()` is called, the browser moves focus to the first focusable descendant in DOM order. In `TransactionModal.tsx`, the first focusable element is the "Close modal ✕" `<button>` (rendered before the `<TransactionForm />`). Assistive-technology best practice and the WAI-ARIA Authoring Practices Guide both call for initial focus on the first **field** in the form, not the dismiss control.

### Fix

**File**: [packages/frontend/src/features/transactions/components/TransactionModal.tsx](packages/frontend/src/features/transactions/components/TransactionModal.tsx)

After the dialog opens, use a `useEffect` (with `isOpen` as dependency) to focus the Amount input:

```tsx
const amountInputRef = useRef<HTMLInputElement>(null);

// Add a new effect that runs after the dialog opens:
useEffect(() => {
    if (!isOpen) return;
    // Defer one frame so showModal() has already moved focus to the dialog
    const id = requestAnimationFrame(() => {
        amountInputRef.current?.focus();
    });
    return (): void => { cancelAnimationFrame(id); };
}, [isOpen]);
```

Thread `amountInputRef` down to `TransactionForm` and attach it to the Amount `<Input>` element:

```tsx
// TransactionModal.tsx — pass ref down
<TransactionForm
    ...
    amountRef={amountInputRef}
/>
```

```tsx
// TransactionForm.tsx — accept and attach ref
interface TransactionFormProps {
    ...
    amountRef?: React.RefObject<HTMLInputElement>;
}

<Input
    ...
    ref={amountRef}          // Input must forward the ref
    label="Amount *"
    ...
/>
```

> **Note**: The shared `<Input>` component must use `React.forwardRef` if it doesn't already. Check [packages/frontend/src/components/common/Input/Input.tsx](packages/frontend/src/components/common/Input/Input.tsx) before implementing.

---

## BUG-04 — Silent auth failure redirect

### Root cause

In `AuthContext.tsx`, `fetchCurrentUser()` has a catch-all that returns `null` for **any** error (network errors and 401/403 alike). `initializeAuth()` treats a `null` return as "token invalid → clear auth" in all cases. When the backend is simply unreachable, users are silently redirected to `/login` with no explanation.

### Fix

**File**: [packages/frontend/src/features/auth/context/AuthContext.tsx](packages/frontend/src/features/auth/context/AuthContext.tsx)

1. Distinguish error types in `fetchCurrentUser`:

```ts
/** Thrown when the backend is reachable but returns 401/403. */
class AuthExpiredError extends Error {}
/** Thrown when the backend is unreachable or returns 5xx. */
class NetworkError extends Error {}

const fetchCurrentUser = async (): Promise<User> => {
    try {
        const profile = await authControllerGetProfile();
        return mapToUser(profile);
    } catch (err: unknown) {
        // Orval/axios errors include a `response` property
        const status = (err as { response?: { status?: number } }).response?.status;
        if (status === 401 || status === 403) throw new AuthExpiredError();
        throw new NetworkError(err instanceof Error ? err.message : 'Network error');
    }
};
```

2. Update `initializeAuth` and the `AuthProvider` `useEffect` to handle these distinct error types:

```ts
// AuthProvider state — add:
const [authError, setAuthError] = useState<string | null>(null);

// In useEffect init():
try {
    await initializeAuth(setToken, setUser);
} catch (error) {
    if (error instanceof NetworkError) {
        setAuthError('Unable to reach the server. Please check your connection.');
        // Do NOT clear auth or redirect — user may be offline temporarily
    } else if (error instanceof AuthExpiredError) {
        authStorage.clearAuth();
        // PrivateRoute will redirect to /login naturally
    } else {
        console.error('Unexpected auth init error:', error);
    }
} finally {
    setIsLoading(false);
}
```

3. Expose `authError` from context and render a toast/banner in `App.tsx` or `AuthProvider` when it is set:

```tsx
// In AuthContext value:
authError: string | null;

// In App.tsx or a layout component:
const { authError } = useAuth();
{authError && (
    <div role="alert" className="auth-error-banner">{authError}</div>
)}
```

> **Note**: If a global `Toast` or `Snackbar` component exists in [packages/frontend/src/components/common/](packages/frontend/src/components/common/) use that instead of an inline banner. Check for an existing notification pattern before adding new styles.

---

## File change summary

| File | Change type | Bug(s) |
|------|------------|--------|
| [packages/frontend/src/components/common/DateRangePicker/DateRangePicker.tsx](packages/frontend/src/components/common/DateRangePicker/DateRangePicker.tsx) | Edit | BUG-01, BUG-02 (UTC dates; `onChange` already issues single call) |
| [packages/frontend/src/features/transactions/hooks/useTransactionFilters.ts](packages/frontend/src/features/transactions/hooks/useTransactionFilters.ts) | Edit | BUG-01 (`getThisMonthRange`), BUG-02 (add `setDateRange`) |
| [packages/frontend/src/features/transactions/hooks/useTransactionForm.ts](packages/frontend/src/features/transactions/hooks/useTransactionForm.ts) | Edit | BUG-03 (invalidate totals in `afterSave`) |
| [packages/frontend/src/pages/TransactionsPage.tsx](packages/frontend/src/pages/TransactionsPage.tsx) | Edit | BUG-02 (pass `setDateRange`), BUG-03 (invalidate totals in toggle/delete handlers) |
| [packages/frontend/src/features/transactions/components/TransactionFilters.tsx](packages/frontend/src/features/transactions/components/TransactionFilters.tsx) | Edit | BUG-02 (accept `onDateRangeChange` prop) |
| [packages/frontend/src/features/transactions/components/TransactionModal.tsx](packages/frontend/src/features/transactions/components/TransactionModal.tsx) | Edit | BUG-05 (initial focus), BUG-06 (ARIA attrs + focus trap), BUG-07 (safe `showModal`) |
| [packages/frontend/src/features/transactions/components/TransactionModal.css](packages/frontend/src/features/transactions/components/TransactionModal.css) | Edit | BUG-08 (centering + mobile bottom-sheet) |
| [packages/frontend/src/features/transactions/components/TransactionForm.tsx](packages/frontend/src/features/transactions/components/TransactionForm.tsx) | Edit | BUG-05 (accept `amountRef` and attach to Amount input) |
| [packages/frontend/src/components/common/Input/Input.tsx](packages/frontend/src/components/common/Input/Input.tsx) | Edit (if needed) | BUG-05 (add `React.forwardRef` if not already present) |
| [packages/frontend/src/features/auth/context/AuthContext.tsx](packages/frontend/src/features/auth/context/AuthContext.tsx) | Edit | BUG-04 (distinguish network vs. auth errors) |
| [packages/backend/src/transactions/transactions.service.ts](packages/backend/src/transactions/transactions.service.ts) | Edit | BUG-01 (UTC boundaries in `getMonthlyTotals`) |
| [packages/frontend/src/features/transactions/components/TransactionList.css](packages/frontend/src/features/transactions/components/TransactionList.css) | Investigate/edit | BUG-07 (remove `overflow: hidden` from outer container if culprit) |

---

## Implementation order

Complete in this sequence to avoid blocking dependencies:

1. **BUG-08** (CSS only, zero dependencies, instant visual verification)
2. **BUG-01 backend** (`transactions.service.ts` UTC fix — isolated, no frontend impact)
3. **BUG-01 frontend** (`DateRangePicker.tsx` + `useTransactionFilters.ts`)
4. **BUG-02** (`setDateRange` in hook → update `TransactionFilters.tsx` → `TransactionsPage.tsx`)
5. **BUG-03** (add totals invalidation in form hook and page)
6. **BUG-06 + BUG-05** (both are `TransactionModal.tsx` edits; do together)
7. **BUG-07** (investigate first; apply Fix A from Modal regardless, then audit CSS)
8. **BUG-04** (`AuthContext.tsx` — standalone, no other component dependencies)

---

## Test strategy

### Unit tests to add / update

| File | Test | Verifies |
|------|------|---------|
| `DateRangePicker.test.tsx` | `getPresetRange('this-month')` startDate ends in `T00:00:00.000Z` | BUG-01 UTC |
| `DateRangePicker.test.tsx` | `getPresetRange('today')` startDate equals today at UTC midnight | BUG-01 UTC |
| `DateRangePicker.test.tsx` | Clicking "This Year" fires `onChange` with both `startDate` (Jan 1 UTC) and `endDate` (Dec 31 UTC) | BUG-02 |
| `useTransactionFilters.test.ts` | `setDateRange('X', 'Y')` sets both params in a single URL update | BUG-02 |
| `useTransactionForm.test.ts` | `handleSubmit` calls `invalidateQueries` with the totals query key | BUG-03 |
| `TransactionsPage.test.tsx` | `handleDelete` and `handleToggleActive` call `invalidateQueries` with totals key | BUG-03 ✅ Done |
| `TransactionModal.test.tsx` | On open, first focused element is Amount input, not Close button | BUG-05 |
| `TransactionModal.test.tsx` | `dialog` has `aria-modal="true"` and `aria-labelledby` matching heading id | BUG-06 |
| `AuthContext.test.tsx` | Network error during init sets `authError` and does not clear auth storage | BUG-04 |
| `transactions.service.spec.ts` | Transaction at `Date.UTC(year, month-1, 1)` is included in `getMonthlyTotals` | BUG-01 backend ✅ Done |

### Manual / regression checks (for re-tester)

| Check | Confirms |
|-------|---------|
| Summary bar updates immediately after Create (no reload) | BUG-03 |
| "This Year" URL contains both `startDate=YYYY-01-01T00:00:00.000Z` and `endDate=YYYY-12-31T23:59:59.999Z` | BUG-02 |
| Income transactions created at midnight UTC appear in "This Month" | BUG-01 |
| Modal is horizontally and vertically centred at 1280px, 768px viewports | BUG-08 |
| Modal appears as bottom-sheet (anchored to bottom edge) at 390px | BUG-08 (mobile) |
| Tab from page header reaches all controls in DOM order | BUG-07 |
| First focused element on modal open is Amount field | BUG-05 |
| Tab cannot escape the open modal to page content | BUG-06 |
| Network error on `/auth/me` shows user-visible banner, does not redirect | BUG-04 |

---

## Backend API test plan (for `backend-tester`)

> Tests `GET /transactions/totals/:year/:month` UTC boundary correctness.

| Endpoint | Scenario | Expected status | Expected result |
|----------|----------|-----------------|-----------------|
| `GET /transactions/totals/:year/:month` | Transaction date = `Date.UTC(year, month-1, 1, 0, 0, 0, 0)` (exact month start at UTC midnight) | 200 | `totalIncome` or `totalExpense` includes the transaction amount |
| `GET /transactions/totals/:year/:month` | Transaction date = `Date.UTC(year, month-1, 1)` minus 1 ms (one ms before month start) | 200 | Transaction is **not** included in totals |
| `GET /transactions/totals/:year/:month` | Transaction date = `Date.UTC(year, month, 0, 23, 59, 59, 999)` (exact month end UTC) | 200 | Transaction is included |
| `GET /transactions/totals/:year/:month` | Transaction date = `Date.UTC(year, month, 1, 0, 0, 0, 0)` (one ms into next month) | 200 | Transaction is **not** included |
| `GET /transactions/totals/:year/:month` | No auth header | 401 | `{ message: 'Unauthorized' }` |
| `GET /transactions/totals/:year/:month` | `year=abc` or `month=0` or `month=13` | 400 | Validation error |

---

## Handoff

Hand off to **`frontend-dev`** for implementation of all frontend fixes (BUG-01 frontend through BUG-07) and to **`backend-dev`** for the single-line UTC fix in `getMonthlyTotals`. After implementation, hand back to **`frontend-tester`** to re-run TC-06, TC-08, TC-18–TC-20, TC-25–TC-30, TC-32, TC-33, RL-02, RL-04, and the new TC-08b check for "This Year" positive path.

---

## Frontend-dev status — ✅ Complete (2026-03-01)

**Completed work:**

- ✅ BUG-07: `TransactionModal.tsx` — safe `showModal()` with `try/catch` + `dialog.open` guard (StrictMode safe)
- ✅ BUG-01 frontend: `DateRangePicker.tsx` + `useTransactionFilters.ts` — all date boundaries use `Date.UTC()`; custom start/end inputs also fixed
- ✅ BUG-08: `TransactionModal.css` — explicit `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%)` for desktop/tablet; bottom-sheet rule retained for ≤480px
- ✅ BUG-06: `TransactionModal.tsx` — added `aria-modal="true"`, `aria-labelledby="tx-modal-title"`, `id` on `<h2>`, and complete Tab/Shift+Tab focus trap
- ✅ BUG-03: `useTransactionForm.ts` + `TransactionsPage.tsx` — totals query key invalidated after every create/update/delete/toggle
- ✅ BUG-02: `useTransactionFilters.ts` — new `setDateRange` batch updater; `TransactionFilters.tsx` + `TransactionsPage.tsx` updated to use single atomic call
- ✅ BUG-05: `TransactionModal.tsx` — `amountInputRef` threaded through `TransactionForm.tsx` and `Input.tsx` (converted to `React.forwardRef`); focus moved to Amount field on open via `requestAnimationFrame`
- ✅ BUG-04: `AuthContext.tsx` + `auth.types.ts` — `AuthExpiredError` / `NetworkError` distinction; network errors set `authError` state without clearing auth or redirecting; `authError` exposed on context
- ✅ **420/420 frontend tests passing**, zero TypeScript errors, zero ESLint warnings
- ✅ Global branch coverage: **95.06%** (threshold: 90%) — all targeted files at or above threshold

---

## Backend-dev status — ✅ Complete (2026-03-01)

**Completed work beyond the original plan scope:**

- ✅ `getMonthlyTotals` UTC boundary fix (`Date.UTC` replaces `new Date(year, month-1, 1)`)
- ✅ `getTotals` input validation: `BadRequestException` on invalid `startDate`/`endDate` strings
- ✅ `getMonthlyTotals` range guards: `BadRequestException` for `month < 1 || month > 12` and `year < 1 || year > 9999`
- ✅ 11 UTC boundary tests (`getMonthlyTotals > UTC boundary (BUG-01)` describe block)
- ✅ 10 input validation tests (`getTotals > input validation` + `getMonthlyTotals > input validation`)
- ✅ 8 controller error-propagation tests (`NotFoundException`/`BadRequestException` bubble-up)
- ✅ Coverage: `transactions.service.ts` 100% branch, `transactions.controller.ts` 100% branch
- ✅ **186/186 backend tests passing**, zero lint warnings
