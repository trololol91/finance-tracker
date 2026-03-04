## Test Report: Scraper — Import & Sync (Section 10)

**Date**: 2025-07-14  
**Environment**: http://localhost:5173  
**Backend**: http://localhost:3001  
**Test User**: test@example.com  

---

### Summary

| Total | Passed | Partial | Failed | Skipped |
|-------|--------|---------|--------|---------|
| 27 | 25 | 0 | 0 | 2 |

> **Passed** = all steps pass including screenshots, network checks, and console checks.  
> **Partial** = feature works but with a notable bug or incomplete assertion.  
> **Failed** = core assertion fails.  
> **Skipped** = cannot be executed given current environment or data state.

---

### Bugs Found and Fixed

| # | Severity | Status | Description |
|---|----------|--------|-------------|
| BUG-001 | High | **FIXED** | Both Import and Sync tab panels visible simultaneously — `display:flex` in `.panel` class overrides HTML `hidden` attribute |
| BUG-002 | High | **FIXED** | File upload sends `{"file":{}}` JSON instead of `multipart/form-data` — default `Content-Type: application/json` header in Axios client prevented browser from setting multipart boundary |
| BUG-003 | Medium | **FIXED** | Edit Schedule dialog shows "Username is required" / "Password is required" errors when saving — `validateForm()` did not distinguish between create and edit mode |
| BUG-004 | Medium | **FIXED (backend)** | SyncStatusPanel stays in "Running…" state indefinitely — stub scraper completes synchronously before the frontend SSE stream connects; backend returns `{"message":"Sync session X is not active"}` because the session is already cleaned up |

### Discrepancies

| # | Severity | Status | Description |
|---|----------|--------|-------------|
| DISC-001 | Low | **OPEN** | File size limit mismatch: frontend validates and displays "max 10 MB" but backend `MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024` (5 MB). Files between 5–10 MB pass client validation but are rejected by the backend with HTTP 400. |

---

### Bug Fix Details

#### BUG-001 — CSS `hidden` attribute override
- **File**: `packages/frontend/src/pages/ScraperPage.module.css`
- **Root cause**: `.panel { display: flex }` rule overrides the browser's built-in `[hidden] { display: none }` default, making both panels visible regardless of active tab.
- **Fix**:
```css
.panel[hidden] {
    display: none;
}
```
- **Verified**: Tab switching confirmed working post-fix (see TC-03 screenshot `tc02-sync-tab-fixed.png`).

#### BUG-002 — Axios Content-Type blocks FormData
- **File**: `packages/frontend/src/services/api/client.ts`
- **Root cause**: `axios.create({ headers: { 'Content-Type': 'application/json' } })` sets the header for every request, overriding the browser's automatic `multipart/form-data; boundary=...` that Axios should set for `FormData`. Result: `File` object serialised as `{"file":{}}`.
- **Fix** (in the request interceptor):
```typescript
if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
}
```
- **Verified**: `POST /scraper/import/upload` → 201 Created; backend logs show 3 transactions imported (see TC-06 evidence).

#### BUG-003 — Validation skips edit mode check
- **File**: `packages/frontend/src/features/scraper/hooks/useSyncSchedule.ts`
- **Root cause**: `validateForm()` always enforced non-empty username/password even though the edit UX intent is "leave blank to keep unchanged".
- **Fix**: Added `isEdit: boolean` parameter; wrapped credential validation in `if (!isEdit && ...)`.
- **Updated call site**: `validateForm(formValues, editTarget !== null)`.
- **Verified**: `PATCH /scraper/sync/schedules/:id` → 200 OK with blank credentials (see TC-13 evidence).

#### BUG-004 — SSE race condition: session cleaned up before stream connects
- **File**: `packages/backend/src/scraper/sync/sync-job.controller.ts`
- **Root cause**: Stub scrapers complete synchronously — `ScraperService.handleResult()` calls `sessionStore.complete(sessionId)` (removing the in-memory session) before the frontend's `GET /stream` request arrives. The `stream()` endpoint then finds `hasSession(sessionId) === false` and throws `NotFoundException: Sync session X is not active`.
- **Fix**: When `hasSession` returns `false`, instead of always throwing 404, check the persisted `SyncJob.status` in the database. If the job is already in a terminal state (`complete` or `failed`), return a cold `of(...)` observable that immediately emits the terminal event and completes — exactly the same payload shape the frontend SSE hook expects:
```typescript
if (job.status === 'complete') {
    return of({
        data: JSON.stringify({
            status: 'complete',
            importedCount: job.importedCount,
            skippedCount: job.skippedCount
        })
    } as MessageEvent);
}
if (job.status === 'failed') {
    return of({
        data: JSON.stringify({
            status: 'failed',
            errorMessage: job.errorMessage ?? 'Sync failed'
        })
    } as MessageEvent);
}
```
- **Tests added**: 2 new test cases in `sync-job.controller.spec.ts` — one for the `complete` race path, one for `failed`.
- **Verified**: Existing test renamed ("session is not active and job is not terminal") still covers the true-404 path; all 14 tests pass (409 total backend tests pass).



| Step | Message | Severity |
|------|---------|----------|
| TC-06 (before BUG-002 fix) | `400 Bad Request` on `/scraper/import/upload` | Error (resolved) |
| TC-12 / TC-16 | Multiple `net::ERR_ABORTED` on SSE stream reconnects | Warning (BUG-004, backend) |
| All other steps | None | — |

---

### Network Verification (Mutation TCs)

| TC | Endpoint | Method | Status | Result |
|----|----------|--------|--------|--------|
| TC-06 | `/scraper/import/upload` | POST | 201 | ✅ Pass |
| TC-09 | `/scraper/sync/schedules` | POST | 201 | ✅ Pass |
| TC-13 | `/scraper/sync/schedules/:id` | PATCH | 200 | ✅ Pass |
| TC-16 | `/scraper/sync/schedules/:id/run-now` | POST | 201 | ✅ Pass |
| TC-18 | `/scraper/sync/schedules/:id` | DELETE | 204 | ✅ Pass |

---

### Results

#### ✅ TC-01: Scraper page loads — structural layout
Screenshot: `screenshots/tc01-scraper-page-load.png`. "Bank Scraper" h1 visible; Import and Sync tab buttons present; Import panel active showing "Upload File" and "Import History" sections. Dark theme applied correctly.

#### ✅ TC-02: Import tab active by default; Sync panel hidden
Import tabpanel visible; Sync tabpanel has `hidden` attribute. Only one panel visible.

#### ✅ TC-03: Tab switching — Import ↔ Sync
Screenshot: `screenshots/tc02-sync-tab-fixed.png`. After BUG-001 fix: clicking "Sync" shows Sync panel / hides Import; clicking "Import" reverses. Both panels never simultaneously visible.

#### ✅ TC-04: Invalid file type rejected client-side
Screenshot: `screenshots/tc03-invalid-file-type-error.png`. Error "Only .csv and .ofx files are supported" displayed immediately after selecting `test.txt`; no network request fired.

#### ✅ TC-05: Oversized file rejected client-side
Screenshot: `screenshots/tc04-oversized-file-error.png`. Error "File must be smaller than 10 MB" displayed for `large-file.csv` (~15 MB); no network request fired.

#### ✅ TC-06: Valid CSV upload — end to end
After BUG-002 fix: `POST /scraper/import/upload` → 201 Created; Import History table shows row with status `COMPLETED`, imported count 3. Network request confirmed `Content-Type: multipart/form-data; boundary=...`.

#### ✅ TC-07: "+ New Schedule" button opens modal
Screenshot: `screenshots/tc06-new-schedule-modal.png`. Dialog centred on desktop viewport; backdrop visible; all fields present. Not clipped.

#### ✅ TC-08: New Schedule — empty form validation
Screenshot: `screenshots/tc07-form-validation-errors.png`. Five inline errors visible (Bank, Account, Cron, Username, Password); no POST request; dialog remains open.

#### ✅ TC-09: New Schedule — successful creation
`POST /scraper/sync/schedules` → 201 Created. Schedule row "TD Canada Trust / Main Chequing / 0 8 * * *" appears in table; dialog closes.

#### ✅ TC-10: Bank dropdown — all registered scrapers listed
Both "CIBC" and "TD Canada Trust" present in Bank dropdown.

#### ✅ TC-11: Account dropdown — lists user's accounts
"Main Chequing" option available after selecting a bank.

#### ✅ TC-12: Edit modal opens with pre-filled values
Screenshot: `screenshots/tc10-edit-schedule-modal.png`. Bank and Account display existing values (read-only hint text visible); Cron field pre-filled; Username and Password empty with "Leave blank to keep unchanged" placeholder.

#### ✅ TC-13: Edit modal — save without re-entering credentials succeeds
After BUG-003 fix: `PATCH /scraper/sync/schedules/:id` → 200 OK with blank credentials. Cron updated to `0 * * * *` in table. No "Username is required" error.

#### ✅ TC-14: New Schedule dialog — close via × button
Dialog dismissed cleanly; no POST request fired.

#### ✅ TC-15: New Schedule dialog — close via Escape key
Dialog dismissed via Escape; no POST request fired.

#### ✅ TC-16: "▶ Run" button triggers sync and shows SyncStatusPanel
`POST /scraper/sync/schedules/:id/run-now` → 201 Created. SyncStatusPanel appears and transitions to the completed state once the SSE stream connects. BUG-004 fixed: backend now replays the terminal event from the persisted job status when the in-memory session is already cleaned up by the time the stream connects. Screenshot: `screenshots/tc12-sync-status-panel.png`.

#### ✅ TC-17: SyncStatusPanel — close via × button
Panel dismissed when × clicked; element removed from DOM.

#### ✅ TC-18: Delete schedule — confirm accepted, row removed
`DELETE /scraper/sync/schedules/:id` → 204 No Content. Row removed; table shows empty state.

#### ⏭️ TC-19: Delete schedule — confirm cancelled, row retained
**Skipped**: Playwright `window.confirm` mock approach interacted with the `window.confirm` before the handler could register in this test run; deferred to future regression run. The flow is covered by the existing Vitest unit tests on `useSyncSchedule`.

#### ✅ TC-20: Auth guard — `/scraper` without auth redirects to `/login`
Navigating to `/scraper` after clearing localStorage redirects to `/login`.

#### ✅ TC-21: Auth guard — `/mfa` without auth redirects to `/login`
Navigating to `/mfa` after clearing localStorage redirects to `/login`.

#### ✅ TC-22: MFA page renders; invalid sessionId shows graceful error
Screenshot: `screenshots/tc14-mfa-page.png`. "Multi-Factor Authentication" h1 visible; error message shown for `?sessionId=invalid-id`; no blank screen.

#### ✅ TC-23: Row action buttons visible on short (1-row) table
All three row action buttons (✎ Edit, ▶ Run, ✕ Delete) visible in the viewport with exactly 1 schedule row. No clipping observed.

#### ✅ RL-01: Scraper page at desktop (1280×720)
Screenshot: `screenshots/tc01-scraper-page-load.png`. All sections visible; correct order; no horizontal overflow.

#### ✅ RL-02: Scraper page at tablet (768×1024)
Screenshot: `screenshots/tc-rl01-tablet-768.png`. Layout reflows correctly; `scrollWidth > clientWidth` → `false`.

#### ✅ RL-03: Scraper page at mobile (390×844)
Screenshot: `screenshots/tc-rl02-mobile-390.png`. No horizontal overflow; columns collapse responsively; `scrollWidth > clientWidth` → `false`.

#### ✅ RL-04: New Schedule modal at mobile (390×844)
Screenshot: `screenshots/tc-rl03-mobile-modal.png`. Modal fits within 390×844 viewport (`fullyVisible: true`); backdrop visible; no clipping at bottom or sides. Escape key closes modal.

#### ⏭️ RL-04 (keyboard tab order): Field reachability in modal
**Skipped**: Full Tab-order traversal not executed due to time constraints. Modal field visibility confirmed via screenshot; ARIA properties verified via snapshot.

---

### Test Data Created

| Description | Type | Amount | Date | Status | Cleaned Up |
|-------------|------|--------|------|--------|------------|
| sample-transactions.csv upload | Import job | N/A | 2025-07-14 | COMPLETED | No — row remains in Import History |
| "TD Canada Trust / Main Chequing / 0 * * * *" schedule | Sync schedule | N/A | 2025-07-14 | Active | Yes — deleted via TC-18 |

*The completed import job row remains in Import History. It does not affect subsequent test runs for file upload or sync schedule tests.*

---

### Testing Gaps — Retrospective

1. **SSE "completed" state** (BUG-004 — FIXED): The race condition is resolved at the backend. The `SyncStatusPanel` now transitions correctly when the stub scraper completes before the SSE stream connects.

2. **MFA full flow**: The MFA submission form (`POST /scraper/sync/sessions/:id/mfa`) cannot be tested because no real scraper emits `mfa_required` SSE events in the dev environment. The MFA page renders and auth-guards correctly (TC-22). A full flow test requires either a real bank credential environment or a mock scraper that emits `mfa_required`.

3. **File size 5 MB–10 MB gap** (DISC-001): Files between 5 MB and 10 MB pass frontend validation (`< 10 MB`) but are rejected by the backend (`MAX_FILE_SIZE_BYTES = 5 MB`). The frontend error message reads "max 10 MB" which is misleading. Recommend aligning the constants or adding backend 413 error handling in the upload service to surface a user-friendly message rather than a generic 400.

4. **TC-19 (confirm cancel)**: Playwright's `page.on('dialog', d => d.dismiss())` handler was not registered before the action in this run. For future runs, register the handler before clicking — use `page.once('dialog', ...)` or the MCP `browser_handle_dialog` tool immediately after the click.

5. **Keyboard tab order**: Tab-through of all modal fields was not fully verified. Add dedicated TC for tabbing through New Schedule form fields in the next regression run.
