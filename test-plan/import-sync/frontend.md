## Test Plan: Scraper — Import & Sync (Section 10)

**Feature scope**: `/scraper` page — CSV/OFX file import, sync schedule CRUD, run-now trigger, SSE status panel, MFA page guard.

**Coverage level**: Full regression

---

### Preconditions
- [ ] Dev server running at http://localhost:5173
- [ ] Backend running at http://localhost:3001
- [ ] Test user credentials: `test@example.com` / `password123`
- [ ] At least one bank account exists for the test user (TD, "Main Chequing")
- [ ] Test files available:
  - `test-files/sample-transactions.csv` (3-row valid CSV: date, description, amount, type)
  - `test-files/test.txt` (invalid file type test)
  - `test-files/large-file.csv` (~15 MB, exceeds 10 MB client limit)

---

### UI Inventory

All interactive elements on the `/scraper` page; each must be the *subject* of at least one TC.

| # | Element | Type |
|---|---------|------|
| 1 | "Import" tab button | Tab trigger |
| 2 | "Sync" tab button | Tab trigger |
| 3 | File `<input>` (accepts `.csv,.ofx`) | File input |
| 4 | "Invalid file type" inline error | Validation output |
| 5 | "File too large" inline error | Validation output |
| 6 | Import History table (job rows) | Table |
| 7 | "+ New Schedule" button | Action button |
| 8 | Sync Schedules table (schedule rows) | Table |
| 9 | Row-level "Edit" button (✎) | Row action |
| 10 | Row-level "Run" button (▶) | Row action |
| 11 | Row-level "Delete" button (✕) | Row action |
| 12 | New Schedule dialog — Bank dropdown | Select |
| 13 | New Schedule dialog — Account dropdown | Select |
| 14 | New Schedule dialog — Cron expression input | Text input |
| 15 | New Schedule dialog — Username input | Text input |
| 16 | New Schedule dialog — Password input | Password input |
| 17 | New Schedule dialog — "Create Schedule" button | Submit |
| 18 | New Schedule dialog — "×" close button | Modal close |
| 19 | New Schedule dialog — Escape key | Keyboard dismiss |
| 20 | Edit Schedule dialog — Bank field (read-only hint) | Disabled display |
| 21 | Edit Schedule dialog — Account field (read-only hint) | Disabled display |
| 22 | Edit Schedule dialog — Cron expression input | Text input |
| 23 | Edit Schedule dialog — Username input (optional) | Text input |
| 24 | Edit Schedule dialog — Password input (optional) | Password input |
| 25 | Edit Schedule dialog — "Save Changes" button | Submit |
| 26 | SyncStatusPanel — status text | Status display |
| 27 | SyncStatusPanel — "×" close button | Panel dismiss |

---

### Test Cases

#### TC-01: Scraper page loads — structural layout
- **Type**: Smoke
- **Steps**:
  1. Navigate to `http://localhost:5173/scraper`
  2. Wait for page to settle
  3. Take screenshot — verify "Bank Scraper" h1 visible, Import and Sync tab buttons present, Import panel active by default with "Upload File" and "Import History" sections
- **Expected result**: Page renders without JS errors; heading, tabs, and Import panel content all visible; Sync panel hidden.

---

#### TC-02: Import tab active by default; Sync panel hidden
- **Type**: Regression
- **Steps**:
  1. Navigate to `http://localhost:5173/scraper`
  2. Assert Import tabpanel is visible
  3. Assert Sync tabpanel has the `hidden` attribute or is not visible
- **Expected result**: Only the Import panel rendered/visible on initial load.

---

#### TC-03: Tab switching — Import ↔ Sync
- **Type**: Smoke
- **Steps**:
  1. Navigate to `http://localhost:5173/scraper`
  2. Click "Sync" tab
  3. Assert Sync panel visible; Import panel not visible
  4. Click "Import" tab
  5. Assert Import panel visible; Sync panel not visible
- **Expected result**: Each tab click shows the correct panel and hides the other; both panels never simultaneously visible.

---

#### TC-04: Invalid file type rejected client-side
- **Type**: Regression
- **Steps**:
  1. Navigate to `/scraper` (Import tab active)
  2. Set file input to `test-files/test.txt`
  3. Assert inline error "Only .csv and .ofx files are supported" appears below the upload zone
- **Expected result**: Error displays immediately; no upload network request fired.

---

#### TC-05: Oversized file rejected client-side
- **Type**: Regression
- **Steps**:
  1. Navigate to `/scraper` (Import tab active)
  2. Set file input to `test-files/large-file.csv` (~15 MB)
  3. Assert inline error "File must be smaller than 10 MB" appears
- **Expected result**: Error displays immediately; no upload network request fired.

---

#### TC-06: Valid CSV upload — end to end
- **Type**: Smoke
- **Steps**:
  1. Navigate to `/scraper` (Import tab active)
  2. Set file input to `test-files/sample-transactions.csv`
  3. Wait for `POST /scraper/import/upload` response
  4. Assert response status 201
  5. Assert Import History table contains a row with status `COMPLETED` and imported count 3
- **Expected result**: File sent as `multipart/form-data`; backend accepts it; job row shows COMPLETED with correct imported count.

---

#### TC-07: "+ New Schedule" button opens modal
- **Type**: Smoke
- **Steps**:
  1. Navigate to `/scraper`, click "Sync" tab
  2. Click "+ New Schedule" button
  3. Take screenshot immediately — assert dialog centred, backdrop visible, not clipped by viewport
- **Expected result**: "New Sync Schedule" dialog opens and is fully visible; contains Bank, Account, Cron, Username, Password fields and "Create Schedule" submit button.

---

#### TC-08: New Schedule — empty form validation
- **Type**: Regression
- **Steps**:
  1. Open "New Sync Schedule" dialog
  2. Click "Create Schedule" without filling any fields
  3. Assert validation errors for all five required fields: Bank, Account, Cron, Username, Password
- **Expected result**: Five inline errors visible; no POST request fired; dialog remains open.

---

#### TC-09: New Schedule — successful creation
- **Type**: Smoke
- **Steps**:
  1. Open "New Sync Schedule" dialog
  2. Select "TD Canada Trust" from Bank dropdown
  3. Select "Main Chequing" from Account dropdown
  4. Enter cron `0 8 * * *`
  5. Enter test username and password
  6. Click "Create Schedule"
  7. Wait for `POST /scraper/sync/schedules` response
  8. Assert response status 201
  9. Assert Sync Schedules table shows a row for TD / Main Chequing / `0 8 * * *`
- **Expected result**: Schedule created; row appears; dialog closes.

---

#### TC-10: Bank dropdown — all registered scrapers listed
- **Type**: Regression
- **Steps**:
  1. Open "New Sync Schedule" dialog
  2. Open the Bank dropdown
  3. Assert both "CIBC" and "TD Canada Trust" options present
- **Expected result**: Dropdown lists all registered scrapers.

---

#### TC-11: Account dropdown — lists user's accounts
- **Type**: Regression
- **Steps**:
  1. Open "New Sync Schedule" dialog
  2. Select any Bank
  3. Open the Account dropdown
  4. Assert "Main Chequing" (the test user's account) is listed
- **Expected result**: Account options populated from the authenticated user's accounts.

---

#### TC-12: Edit modal opens with pre-filled values
- **Type**: Smoke
- **Steps**:
  1. Ensure at least one schedule exists
  2. Click the Edit (✎) button on that row
  3. Take screenshot immediately — assert dialog centred, not clipped
  4. Assert Bank and Account fields display the existing values (read-only with hint text)
  5. Assert Cron field shows the saved cron expression
  6. Assert Username and Password inputs are empty with placeholder "Leave blank to keep unchanged"
- **Expected result**: Edit dialog pre-fills non-credential fields; credentials blank with hint.

---

#### TC-13: Edit modal — save without re-entering credentials succeeds
- **Type**: Regression (BUG-003 fix verification)
- **Steps**:
  1. Open Edit modal for an existing schedule
  2. Change Cron field to `0 * * * *`
  3. Leave Username and Password blank
  4. Click "Save Changes"
  5. Assert `PATCH /scraper/sync/schedules/:id` returns 200
  6. Assert the schedule row reflects the updated cron expression
- **Expected result**: Save succeeds; no "Username is required" validation error; cron updated in table.

---

#### TC-14: New Schedule dialog — close via × button
- **Type**: Regression
- **Steps**:
  1. Open "New Sync Schedule" dialog
  2. Click the "×" (Close dialog) button
  3. Assert dialog is no longer in the DOM
- **Expected result**: Dialog dismissed; no data submitted.

---

#### TC-15: New Schedule dialog — close via Escape key
- **Type**: Regression
- **Steps**:
  1. Open "New Sync Schedule" dialog
  2. Press the Escape key
  3. Assert dialog is no longer in the DOM
- **Expected result**: Dialog dismissed via keyboard; no data submitted.

---

#### TC-16: "▶ Run" button triggers sync and shows SyncStatusPanel
- **Type**: Smoke
- **Steps**:
  1. Ensure a schedule exists; click "▶ Run" on its row
  2. Assert `POST /scraper/sync/schedules/:id/run-now` returns 201
  3. Assert SyncStatusPanel appears with status text (e.g. "Running…")
  4. Take screenshot — assert panel fully visible, not clipped
- **Expected result**: Trigger fires; panel appears.

---

#### TC-17: SyncStatusPanel — close via × button
- **Type**: Smoke
- **Steps**:
  1. SyncStatusPanel visible (from TC-16 or similar)
  2. Click the panel's "×" close button
  3. Assert SyncStatusPanel no longer in DOM
- **Expected result**: Panel dismissed cleanly.

---

#### TC-18: Delete schedule — confirm accepted, row removed
- **Type**: Smoke
- **Steps**:
  1. Ensure a schedule exists; click the delete (✕) row button
  2. Accept the `window.confirm` dialog
  3. Assert `DELETE /scraper/sync/schedules/:id` returns 204
  4. Assert row removed from table; empty-state message visible if no rows remain
- **Expected result**: Schedule deleted; table reflects change.

---

#### TC-19: Delete schedule — confirm cancelled, row retained
- **Type**: Edge Case
- **Steps**:
  1. Ensure a schedule exists; click the delete button
  2. Dismiss the `window.confirm` dialog
  3. Assert the row is still present
  4. Assert no DELETE request was fired
- **Expected result**: Cancelling the confirm dialog aborts deletion.

---

#### TC-20: Auth guard — `/scraper` without auth redirects to `/login`
- **Type**: Smoke
- **Steps**:
  1. Clear auth tokens from localStorage
  2. Navigate to `http://localhost:5173/scraper`
  3. Assert URL is now `/login`
- **Expected result**: Unauthenticated access redirected to login.

---

#### TC-21: Auth guard — `/mfa` without auth redirects to `/login`
- **Type**: Smoke
- **Steps**:
  1. Clear auth tokens from localStorage
  2. Navigate to `http://localhost:5173/mfa`
  3. Assert URL is now `/login`
- **Expected result**: Unauthenticated access redirected to login.

---

#### TC-22: MFA page renders; invalid sessionId shows graceful error
- **Type**: Smoke
- **Steps**:
  1. Log in as test user
  2. Navigate to `http://localhost:5173/mfa?sessionId=invalid-id`
  3. Assert "Multi-Factor Authentication" h1 visible
  4. Assert an error message about invalid or expired session is shown (not a blank screen)
- **Expected result**: MFA page renders correctly; invalid session handled gracefully.

---

#### TC-23: Row action buttons visible on short (1-row) table
- **Type**: Edge Case
- **Steps**:
  1. Ensure exactly 1 schedule exists (delete others if needed)
  2. Take screenshot of the Sync Schedules table
  3. Assert all three row action buttons (✎ Edit, ▶ Run, ✕ Delete) are fully visible in the viewport, not clipped by container overflow
- **Expected result**: Row actions visible even when the table has minimum height (no `overflow:hidden` clip at the table container's lower boundary).

---

### Responsive Layout

**Viewports to test** (use `browser_resize` before navigating):

| Label   | Width | Height |
|---------|-------|--------|
| Desktop | 1280  | 720    |
| Tablet  | 768   | 1024   |
| Mobile  | 390   | 844    |

---

#### RL-01: Scraper page at desktop (1280×720)
- **Steps**:
  1. Resize viewport to 1280×720
  2. Navigate to `http://localhost:5173/scraper`
  3. Take screenshot — verify heading, tabs, file upload zone, Import History table all visible; no horizontal overflow
- **Expected result**: Full desktop layout; all sections visible; no overflow.

---

#### RL-02: Scraper page at tablet (768×1024)
- **Steps**:
  1. Resize viewport to 768×1024
  2. Navigate to `http://localhost:5173/scraper`
  3. Take screenshot
  4. Evaluate `document.body.scrollWidth > document.body.clientWidth` — assert `false`
- **Expected result**: Layout reflows for tablet width; no horizontal overflow.

---

#### RL-03: Scraper page at mobile (390×844)
- **Steps**:
  1. Resize viewport to 390×844
  2. Navigate to `http://localhost:5173/scraper`
  3. Take screenshot — verify table columns collapse or scroll; toolbar not clipped
  4. Evaluate `document.body.scrollWidth > document.body.clientWidth` — assert `false`
- **Expected result**: Layout usable on mobile; no inaccessible content.

---

#### RL-04: New Schedule modal at mobile (390×844)
- **Steps**:
  1. Remain at 390×844; open "New Sync Schedule" modal
  2. Take screenshot immediately — assert modal fits viewport, not clipped at bottom or sides; backdrop visible
  3. Tab through all fields — confirm all reachable; no field obscured by viewport edge
  4. Press Escape — assert modal closes
- **Expected result**: Modal fully usable on mobile; no fields or buttons cut off.
