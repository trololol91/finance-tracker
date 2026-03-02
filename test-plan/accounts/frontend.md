## Test Plan: Accounts Feature (Phase 6)

### Feature Summary
The Accounts page (`/accounts`) lets authenticated users create, view, edit, and delete financial accounts. Key sub-components:
- **AccountsPage** — page shell, "Show inactive" toggle, account count
- **AccountsSummary** — summary bar (active accounts / net balance / total transactions)
- **AccountList** — table with responsive column visibility
- **AccountModal** — `<dialog>` with focus-trap, open/close, heading changes by mode
- **AccountForm** — 9 form controls (Name, Type, Institution, Currency, Opening Balance, Color picker, Color hex, Notes, isActive); Type locked in edit mode

### Preconditions
- [ ] Frontend dev server running at http://localhost:5173
- [ ] Backend API running at http://localhost:3001
- [ ] Authenticated user session (valid JWT in localStorage)
- [ ] `/accounts` endpoint functional (GET, POST, PATCH, DELETE)

### UI Inventory (all interactive elements)
| # | Element | Location |
|---|---------|----------|
| 1 | `+ New Account` button | Page header |
| 2 | `Show inactive` checkbox | Toolbar |
| 3 | Account count live-region | Toolbar |
| 4 | AccountsSummary bar (Accounts / Net Balance / Total Transactions) | Between header and toolbar |
| 5 | Per-row `Edit {name}` button | Table column: Actions |
| 6 | Per-row `Delete {name}` button | Table column: Actions |
| 7 | `✕ Close dialog` button | Modal header |
| 8 | `acc-name` text input | Modal form |
| 9 | `acc-type` select (6 options; disabled in edit) | Modal form |
| 10 | `acc-institution` text input | Modal form |
| 11 | `acc-currency` select (7 options) | Modal form |
| 12 | `acc-balance` number input | Modal form |
| 13 | Color picker (`acc-color-picker`) | Modal form |
| 14 | Color hex text input (`acc-color`) | Modal form |
| 15 | Notes textarea (`acc-notes`) | Modal form |
| 16 | `isActive` checkbox (edit mode only) | Modal form |
| 17 | `Create Account` / `Save Changes` submit button | Modal footer |

---

### Test Cases

#### TC-01: Page load — structural layout, empty state, dark theme
- **Type**: Smoke
- **Preconditions**: No accounts in DB
- **Steps**:
  1. Resize viewport to 1280×720
  2. Navigate to `http://localhost:5173/accounts`
  3. Wait for page to settle (2 s)
  4. Take screenshot — verify: `Accounts` h1 top-left, `+ New Account` button top-right, "Show inactive" checkbox, account count "0 account(s)", empty state paragraph, NO AccountsSummary bar
  5. Evaluate `getComputedStyle(document.body).backgroundColor` — assert `rgb(15, 23, 42)`
  6. Call `browser_console_messages(error)` — assert no errors
- **Expected result**: Dark theme, correct sections in order (header → toolbar → empty state), no JS errors

#### TC-02: New Account modal opens — layout and field presence
- **Type**: Smoke
- **Steps**:
  1. Click "+ New Account" button
  2. Take screenshot immediately — verify: modal centred, backdrop visible, "New Account" heading, all 9 form controls visible, "Create Account" button visible, focus on Account Name input, ✕ button top-right
  3. Assert `dialog[open]` exists in DOM
- **Expected result**: Modal centred and not clipped; focus moves to Account Name; all form fields present

#### TC-03: Validation — submit with empty name
- **Type**: Regression
- **Steps**:
  1. With modal open (empty form), click "Create Account"
  2. Take screenshot — verify red border on Account Name, "Name is required" alert below the field
  3. Assert `dialog[open]` still exists (modal did not close)
  4. Assert no network request was made
- **Expected result**: Inline error displayed; modal remains open; no API call

#### TC-04: Close modal via Escape key
- **Type**: Smoke
- **Steps**:
  1. With modal open, press Escape
  2. Snapshot — assert dialog absent
  3. Assert focus returned to "+ New Account" button (`[active]`)
- **Expected result**: Modal closes; focus restored to trigger element

#### TC-05: Close modal via ✕ button
- **Type**: Smoke
- **Steps**:
  1. Open modal via "+ New Account"
  2. Click "✕ Close dialog"
  3. Snapshot — assert dialog absent
  4. Assert focus on "+ New Account" (`[active]`)
- **Expected result**: Modal closes; focus restored

#### TC-06: Create account — full valid form, POST → 201
- **Type**: Regression
- **Steps**:
  1. Open "+ New Account" modal
  2. Fill: Name="Playwright Test Chequing", Institution="TD Bank", Opening Balance=1500.00, Color="#3b82f6", Notes="Created by Playwright test"
  3. Click "Create Account"
  4. Call `browser_network_requests` — assert POST /accounts → 201
  5. Snapshot — assert: modal absent, table row with "Playwright Test Chequing", "Checking", "TD Bank", "$1,500.00", "Active" badge
  6. Assert AccountsSummary shows "1", "$1,500.00"
  7. Assert account count = "1 account(s)"
  8. Take screenshot
- **Expected result**: Account created; table row visible with all data; summary bar reactive

#### TC-07: Edit modal — fields populate, type locked, PATCH → 200
- **Type**: Regression
- **Preconditions**: At least 1 account exists
- **Steps**:
  1. Click "Edit {account}" button on the first row
  2. Take screenshot immediately — verify: "Edit Account" heading, all fields populated, Type select `[disabled]`, "Account type cannot be changed after creation." hint, isActive checkbox present and checked
  3. Assert form `aria-label="Edit account form"`
  4. Change Account Name text
  5. Click "Save Changes"
  6. Call `browser_network_requests` — assert PATCH /accounts/{id} → 200
  7. Assert updated name appears in table
  8. Assert focus restored to Edit button
- **Expected result**: Edit modal pre-populated; type locked; PATCH updates row

#### TC-08: "Show inactive" checkbox toggles visible count
- **Type**: Regression
- **Steps**:
  1. With only active accounts, note count (N)
  2. Click "Show inactive" — assert count may increase (or stay same if no inactive)
  3. Click again to uncheck — assert count returns to N
  4. Call `browser_console_messages(error)` — assert no errors
- **Expected result**: Checkbox controls filter; count updates reactively

#### TC-09: Deactivate account + Show inactive toggle
- **Type**: Regression
- **Steps**:
  1. Open Edit modal for an account
  2. Uncheck "Active account" checkbox
  3. Click "Save Changes"
  4. Assert PATCH /accounts/{id} → 200
  5. Assert deactivated account disappears from view (showInactive=false)
  6. Assert AccountsSummary count drops by 1, Net Balance excludes deactivated account
  7. Check "Show inactive" checkbox
  8. Assert deactivated account reappears with "Inactive" badge (dimmed row)
  9. Assert count updates to include it
- **Expected result**: Inactive accounts hidden by default; revealed by toggle; summary excludes them

#### TC-10: Delete account (0 transactions) — confirm → DELETE → 204
- **Type**: Regression
- **Steps**:
  1. Click "Delete {name}" on an account with 0 transactions
  2. Assert `confirm` dialog appears with text `Delete account "{name}"? This cannot be undone.`
  3. Accept dialog
  4. Call `browser_network_requests` — assert DELETE /accounts/{id} → 204
  5. Assert row removed from table
  6. Assert count decrements
  7. Assert AccountsSummary updates or disappears if 0 active accounts
- **Expected result**: Confirm dialog shown; DELETE called; row removed; UI reflects deletion

#### TC-11: Delete account — cancelled (no API call)
- **Type**: Regression
- **Steps**:
  1. Click "Delete {name}"
  2. Dismiss confirm dialog (Cancel)
  3. Assert row still present in table
  4. Assert no DELETE request was sent since last check
- **Expected result**: Cancel aborts delete; row intact; no API call

#### TC-12: Per-row action buttons on 1-row list (boundary)
- **Type**: Edge Case
- **Steps**:
  1. Ensure exactly 1 active account is visible (short list)
  2. Take screenshot of the table with that 1 row
  3. Assert Edit and Delete buttons are fully visible in viewport (not clipped at bottom of table container)
  4. Assert no horizontal scrollbar on the table container
- **Expected result**: Action buttons visible at list-bottom boundary; no clipping by `overflow: hidden`

#### TC-13: Responsive layout — tablet (768×1024)
- **Type**: Regression
- **Steps**:
  1. Resize to 768×1024
  2. Navigate to `/accounts`
  3. Take screenshot
  4. Assert: "Transactions" column absent from table headers (`.hideOnTablet`)
  5. Assert: Name, Type, Institution, Balance, Status, Actions columns all present
  6. Assert AccountsSummary bar 3 stats side by side (not stacked)
  7. Assert no horizontal overflow
- **Expected result**: Tablet layout: Transactions column hidden; all other columns visible; summary bar horizontal

#### TC-14: Responsive layout — mobile (390×844)
- **Type**: Regression
- **Steps**:
  1. Resize to 390×844
  2. Navigate to `/accounts`
  3. Take screenshot
  4. Assert: Type, Institution, Transactions, Status columns absent (`.hideOnMobile`)
  5. Assert: Name, Balance, Actions visible
  6. Assert AccountsSummary stacks vertically (`flex-direction: column`)
  7. Evaluate `document.body.scrollWidth > document.body.clientWidth` — assert `false`
- **Expected result**: Mobile layout: only Name/Balance/Actions; summary stacks; no horizontal overflow

#### TC-15: Modal at mobile (390×844)
- **Type**: Regression
- **Steps**:
  1. At 390×844, click "+ New Account"
  2. Take screenshot immediately — verify modal fits within 390px width, all form fields visible (scrollable), no content cut off horizontally, backdrop visible
  3. Assert `dialog.getBoundingClientRect().right ≤ 390` (no horizontal overflow)
  4. Assert `document.body.scrollWidth > document.body.clientWidth === false`
  5. Assert Type + Institution row stacked (single column — `@media (max-width: 480px)`)
  6. Press Escape — verify modal closes
- **Expected result**: Modal fits within mobile viewport; rows stack to single column; scrollable vertically; no horizontal overflow

#### TC-16: Focus trap in modal
- **Type**: Regression
- **Steps**:
  1. Open "+ New Account" modal
  2. Evaluate focusable elements list — assert 10 elements in expected order (✕, name, type, institution, currency, balance, color-picker, color, notes, submit)
  3. Focus "Create Account" (last), press Tab — assert focus moves to "Close dialog" (first)
  4. Focus "Close dialog" (first), press Shift+Tab — assert focus moves to "Create Account" (last)
- **Expected result**: Full focus trap in both directions

#### TC-17: Type and Currency select options (boundary)
- **Type**: Regression
- **Steps**:
  1. Open "+ New Account" modal
  2. Click Type select — assert 6 options: Checking, Savings, Credit, Investment, Loan, Other
  3. Click Currency select — assert 7 options: CAD, USD, EUR, GBP, AUD, JPY, CHF
- **Expected result**: All account type and currency options present

#### TC-18: Empty state messages (both variants)
- **Type**: Regression
- **Steps**:
  1. With 0 accounts, `showInactive=false` — assert paragraph = "No active accounts. Create one or show inactive."
  2. Check "Show inactive" — assert paragraph = "No accounts found. Create your first account."
- **Expected result**: Both empty state messages shown in correct conditions

---

### Responsive Layout

**Viewports tested** (see TC-13–15):
| Label | Width | Height |
|-------|-------|--------|
| Desktop | 1280 | 720 |
| Tablet | 768 | 1024 |
| Mobile | 390 | 844 |

Column visibility matrix:
| Column | Desktop | Tablet | Mobile |
|--------|---------|--------|--------|
| Name | ✓ | ✓ | ✓ |
| Type | ✓ | ✓ | ✗ |
| Institution | ✓ | ✓ | ✗ |
| Balance | ✓ | ✓ | ✓ |
| Transactions | ✓ | ✗ | ✗ |
| Status | ✓ | ✓ | ✗ |
| Actions | ✓ | ✓ | ✓ |

---

### Coverage Level: **Full Regression**
All 17 interactive elements covered as subjects. All 18 test cases authored.
