# Test Report: Transactions Feature (Frontend)

**Date**: 2026-02-28 (re-run)
**Environment**: http://localhost:5173
**Backend**: http://localhost:3001
**Test User**: test@example.com

---

## Summary

| Total | Passed | Partial / Fail | Failed | Skipped |
|-------|--------|----------------|--------|---------|
| 38    | 27     | 7              | 1      | 3       |

> **Passed** = all steps pass including screenshots, network checks, and console checks.  
> **Partial** = feature works but with a notable bug or incomplete behaviour.  
> **Failed** = core assertion fails.  
> **Skipped** = cannot be executed given current data / environment state.  
> TC count: TC-01–TC-34 (functional) + RL-01–RL-04 (responsive layout).

---

## Console Errors Observed

| Step | Message | Severity |
|------|---------|----------|
| — | None | — |

*No console errors were recorded at level `error` during any TC in this run.*

---

## Network Verification (Mutation TCs)

| TC | Endpoint | Method | Status | Result |
|----|----------|--------|--------|--------|
| TC-19 | `/transactions` | POST | 201 | ✅ |
| TC-20 | `/transactions` | POST | 201 | ✅ |
| TC-26 | `/transactions/:id` | PATCH | 200 | ✅ |
| TC-28 | `/transactions/:id/toggle-active` | PATCH | 200 | ✅ |
| TC-29 | `/transactions/:id/toggle-active` | PATCH | 200 | ✅ |
| TC-30 | `/transactions/:id` | DELETE | 204 | ✅ |

*All mutations reached the correct endpoint with the correct HTTP method and received expected 2xx status codes. No unexpected 4xx/5xx responses, no missing requests.*

---

## Bugs Found

| # | Severity | Status | Description |
|---|----------|--------|-------------|
| BUG-01 | High | **PERSISTS** | **Date timezone exclusion**: Transactions stored at midnight UTC (`00:00Z`) are excluded when "This Month" filter uses local-time midnight as `startDate`. Income transactions created on the 1st of the month by UTC+ users do not appear. Income total always shows $0.00 in this environment. **Has a potential backend component** — the `/transactions/totals/:year/:month` endpoint accepts `year`/`month` path params and likely computes its own UTC boundaries server-side; if it uses `new Date(year, month - 1, 1)` (local time) instead of `new Date(Date.UTC(year, month - 1, 1))`, it will reproduce the same exclusion independently of the frontend fix. Both sides must be fixed and verified. |
| BUG-02 | Medium | **PERSISTS** | **"This Year" startDate not reset**: Clicking "This Year" preset sends only a new `endDate`; `startDate` from the previous preset is not recalculated to Jan 01. URL after click: `?endDate=2027-01-01T07%3A59%3A59.999Z&page=1` — no `startDate` param. |
| BUG-03 | Medium | **PERSISTS** | **Summary totals not invalidated on mutation**: After create / edit / delete, no `GET /transactions/totals` request is made. Income / Expenses / Net values remain stale until page refresh. Confirmed via `browser_network_requests` after TC-19, TC-20, TC-26, TC-28, TC-30. |
| BUG-04 | Medium | **NOT RE-TESTED** | **Silent auth failure redirects to /login**: When backend is unreachable, auth token re-validation fails → AuthContext clears → PrivateRoute silently redirects, no user-facing message. Not retested — stopping the backend was out of scope for this run. |
| BUG-05 | Low | **PERSISTS** | **Modal initial focus on Close button**: When either "Add Transaction" or Edit modal opens, focus lands on the "Close modal ✕" button rather than the first form field (Amount). Confirmed in TC-18 and TC-25. |
| BUG-06 | Low–Medium | **PARTIALLY RESOLVED** | **Modal ARIA attributes incomplete**: The modal now uses a native `<dialog>` element, which provides `role="dialog"` implicitly — screen readers will announce it as a dialog (improvement from prior run where no role was present at all). However: `aria-modal` is `null` (not set), `aria-labelledby` is `null` (not set), and focus can escape the dialog for one Tab step (Cancel → Add Transaction → page content → Close cycle). Severity for the `role` aspect downgraded to Low; missing `aria-modal` remains Medium. |
| BUG-07 | High | **PERSISTS** | **Tab key skips all interactive controls**: Eight consecutive Tabs from the page body cycle only through per-row "Actions ⋮" buttons. Navigation links, "+ Add Transaction" button, filter controls, summary bar, and pagination are all unreachable via Tab. |
| BUG-08 | Medium | **PERSISTS** | **Modal renders at top-left instead of centred (all viewports)**: Confirmed at desktop (1280×720), tablet (768×1024), and mobile (390×844). The `<dialog>` element anchors to the top-left corner of the viewport at all three breakpoints. At 390px mobile, the modal happens to fill the full width so content is accessible, but the designed "bottom-sheet" layout (expected at ≤480px breakpoint) is **not** being applied — the modal sits at the top instead of the bottom. Screenshots: `tc18-add-modal.png`, `tc25-edit-modal.png`, `rl02-tablet-768x1024-modal.png`, `rl04-mobile-390x844-modal.png`. |
| BUG-09 | Medium | **RESOLVED** | **Context menu (⋮) clipped by table overflow container**: When the transaction table has 1–3 rows, opening the per-row ⋮ actions menu causes the table container to display a scrollbar and the menu items are partially or fully clipped. Root cause: `.tx-list { overflow: hidden }` established a clipping context that trapped the `position: absolute` dropdown. Fix: menu switched to `position: fixed` with coordinates computed from `getBoundingClientRect()` on the trigger button, escaping all overflow ancestors. Scroll and resize listeners sync the menu position while open. Confirmed via screenshot `context-menu-bug.png` (before) and `context-menu-fixed.png` (after). Discovered during exploratory post-fix session — not covered by the original test plan. |

---

## Results

### Section 1 — Auth & Access

#### ✅ TC-01: Unauthenticated redirect to /login
Cleared localStorage, navigated to `/transactions`. Immediately redirected to `/login`. No flash of private content. No console errors.

---

### Section 2 — Page Load

#### ✅ TC-02: Page renders without console errors
Screenshot `tc02-page-load.png` taken after data loaded. Layout order confirmed: header (Transactions + "+ Add Transaction") → summary bar (Income / Expenses / Net) → filter bar (date presets, type, status, search, clear) → table (columns: DATE / DESCRIPTION / AMOUNT / TYPE / STATUS / ACTIONS) → pagination. No zero-height sections, no overlapping toolbar, all table column headers visible. `browser_console_messages(level: 'error')` returned zero errors.

#### ✅ TC-03: Loading state shown during data fetch
"Loading..." text observed in tbody before data arrived. `wait_for(textGone: "Loading...")` completed successfully.

#### ⏭️ TC-04: Empty state when no transactions exist
**SKIPPED** — current user has 52 transactions. Empty state cannot be tested without a clean user account.

#### ⏭️ TC-05: Backend unreachable — graceful error
**SKIPPED** — stopping the backend was out of scope. Prior report finding stands: BUG-04 persists.

---

### Section 3 — Summary Bar

#### ⚠️ TC-06: Summary bar renders three values (PARTIAL — BUG-01)
"Income", "Expenses", and "Net" values all render. Income shows **$0.00** (incorrect — BUG-01: timezone exclusion causes income transactions to be excluded from the "This Month" range). Expenses shows **$1,320.50**. Net shows **-$1,320.50**. Structure ✅; values ⚠️.

*Note: Expenses total changed from $1,420.49 (prior report) to $1,320.50 because the Netflix / "Updated by Playwright" transaction ($99.99) was permanently deleted during TC-30 in this run.*

#### ✅ TC-07: "This Month" preset active by default
"This Month" button has `aria-pressed="true"` on initial load. Correct date range parameters sent to API.

---

### Section 4 — Date Range Presets

> ⚠️ **Coverage gap**: The "Today" and "This Week" presets have **no test coverage** in this plan. "This Year" was only exercised to confirm BUG-02 — its positive-path behaviour (correct row filtering, correct URL params) was not verified. See Testing Gaps item 6.

#### ⚠️ TC-08: "This Year" preset sends correct date range (PARTIAL — BUG-02)
Clicked "This Year". URL: `?endDate=2027-01-01T07%3A59%3A59.999Z&page=1`. No `startDate` parameter present. Only `endDate` was updated; `startDate` from the previous "This Month" preset was not reset to Jan 01. **BUG-02 persists.**

#### ✅ TC-09: Custom date range filters correctly
Set Jan 1–31 custom date range. 0 results returned (correct — no January transactions in DB). All summary values show $0.00. URL updated to `?startDate=...&endDate=...&page=1`.

---

### Section 5 — Type / Status / Search Filters

#### ✅ TC-10: Type filter — Expense only
Selected "Expense" from Type dropdown. All visible rows show "Expense" badge in TYPE column. No income rows present.

#### ⚠️ TC-11: Type filter — Income only (PARTIAL — BUG-01)
Selected "Income". "No transactions found." message rendered. Income filter mechanism works correctly, but the known income transaction (Playwright test income, Feb 28) is inactive and not in the Active+February view. BUG-01 means any UTC+offset income transactions created at midnight would also be excluded. Income total $0.00 persists.

#### ✅ TC-12: Status filter — Inactive
Switched Status to "Inactive". Shows inactive transactions. "Playwright test income" row visible (inactive, Feb 28, $1,000, Income). Correct.

#### ✅ TC-13: Search filter by description
Typed "Coffee" in search field. Only "Coffee Shop, -$45.50" row returned. Case-insensitive match. All other rows gone.

#### ✅ TC-14: Clear Filters resets all fields
Clicked "Clear" button. Date range reverted to "This Month" (aria-pressed), Type to "All Types", Status to "Active", search field empty. Full transaction list reloaded.

---

### Section 6 — Pagination

#### ⏭️ TC-15: Pagination hidden with ≤ 50 results
**SKIPPED** — 52 transactions exist. Pagination is always visible. Testing hidden-pagination state requires deleting enough data to drop below 50 rows, which is out of scope.

#### ✅ TC-16: Pagination visible with > 50 results
"Showing 1–50 of 52" label visible. Page 1 indicator active. Forward/Next pagination controls rendered.

#### ✅ TC-17: Page 2 shows remaining rows
Clicked Next Page. Page 2 loaded: "Showing 51–52 of 52". URL: `?page=2`. Two rows visible.

---

### Section 7 — Add Transaction

#### ⚠️ TC-18: Add modal opens correctly (PARTIAL — BUG-05, BUG-08)
Clicked "+ Add Transaction". `dialog "Add Transaction"` snapshot element present (native `<dialog>` provides implicit `role="dialog"` ✅). Backdrop visible behind modal ✅. Screenshot `tc18-add-modal.png`: **modal anchored to top-left corner** (BUG-08). Focus on "Close modal ✕" button (BUG-05). Modal content not clipped ✅.

#### ✅ TC-19: Create expense transaction
Filled Amount=25.50, Type=Expense, Date=2026-03-01 (outside Feb filter), Description="Playwright test expense". Clicked "Add Transaction". `POST /transactions` → **201** ✅. `browser_console_messages(level:'error')` → 0 errors ✅. Note: row does not appear in current "This Month" (February) view because date is March 1 — correct filter behaviour.

#### ⚠️ TC-20: Create income transaction — summary update (PARTIAL — BUG-03)
Filled Amount=1000, Type=Income, Date=2026-02-28, Description="Playwright test income". `POST /transactions` → **201** ✅. No `GET /transactions/totals` request fired after POST (BUG-03 confirmed via `browser_network_requests`). Summary bar still shows $0.00 income until page reload.

#### ✅ TC-21: Validation — empty amount
Submitted form with empty Amount. Inline error: "Amount must be a positive number" ✅.

#### ✅ TC-22: Validation — zero amount
Submitted with Amount=0. Same inline error. No request sent ✅.

#### ✅ TC-23: Validation — empty date
Submitted with Date cleared. Inline error: "Date is required" ✅.

#### ✅ TC-24: Cancel closes modal without saving
Clicked "Cancel". Modal closed. No new row in transaction list. No network request made ✅.

---

### Section 8 — Edit Transaction

#### ⚠️ TC-25: Edit modal pre-populates correctly (PARTIAL — BUG-05, BUG-08)
Opened ⋮ menu on "Netflix" row → clicked "Edit". `dialog "Edit Transaction"` opened. Pre-populated: Amount=99.99, Type=Expense (disabled), Date=2026-02-20, Description=Netflix. All fields correct ✅. Screenshot `tc25-edit-modal.png`: **modal anchored to top-left** (BUG-08). Focus on Close button (BUG-05).

#### ✅ TC-26: Save edit updates row immediately
Changed Description to "Updated by Playwright". Clicked "Save". `PATCH /transactions/:id` → **200** ✅. Row in list updated to "Updated by Playwright" without page reload ✅. `browser_console_messages(level:'error')` → 0 errors ✅.

#### ✅ TC-27: Type field disabled in edit mode
Type `<select>` has `disabled` attribute. Helper text "Transaction type cannot be changed after creation." visible below the field ✅.

---

### Section 9 — Toggle Active / Delete

#### ✅ TC-28: Mark Inactive removes row from active view
Opened ⋮ menu on "Updated by Playwright" → "Mark Inactive". `PATCH /transactions/:id/toggle-active` → **200** ✅. Row removed from active view immediately. No console errors ✅.

#### ✅ TC-29: Mark Active restores row to active view
Switched Status filter to "Inactive". Opened ⋮ on "Updated by Playwright" → "Mark Active". `PATCH /transactions/:id/toggle-active` → **200** ✅. Row removed from inactive view. No console errors ✅.

#### ✅ TC-30: Delete with confirm removes row permanently
Opened ⋮ on "Updated by Playwright" → "Delete" → confirm dialog appeared → clicked danger "Delete". `DELETE /transactions/:id` → **204** ✅. Row gone from list. No console errors ✅. *Side effect: Expenses total changed from $1,420.49 to $1,320.50 (Netflix $99.99 removed), but this change only visible after page reload — BUG-03.*

#### ✅ TC-31: Cancel delete keeps row
Opened ⋮ on "Coffee Shop" → "Delete" → confirm dialog → clicked "Cancel". "Coffee Shop" row still present in list ✅.

---

### Section 10 — Accessibility

#### ❌ TC-32: Keyboard Tab navigation (FAIL — BUG-07)
Eight consecutive Tab presses from page body. Each Tab moved focus only to the next per-row "Actions ⋮" button. The following remain **unreachable via Tab**: navigation links, "+ Add Transaction" button, filter controls (date presets, type/status selects, search input), summary bar, pagination buttons. **BUG-07 persists unresolved.**

#### ⚠️ TC-33: Modal focus trap and Escape (PARTIAL — BUG-05, BUG-06)
- ✅ Escape key closes the modal correctly
- ✅ Native `<dialog>` provides `role="dialog"` implicitly (improvement vs. prior run — previously had no role)
- ❌ `dialog.getAttribute('aria-modal')` → `null` (not set)
- ❌ `dialog.getAttribute('aria-labelledby')` → `null` (not set)
- ❌ Focus escapes dialog for one Tab step: Cancel → Add Transaction → **page content outside dialog** → Close (focus trap incomplete)
- ❌ Initial focus on Close button rather than Amount field (BUG-05)

#### ✅ TC-34: Filter region accessible label
`document.querySelector('[role="search"]')` → found. `aria-label` → "Transaction filters". Also confirmed: summary region `aria-label="Transaction totals"` ✅, table `aria-label="Transactions"` ✅, search input `aria-label="Search transactions by description"` ✅.

---

### Section 11 — Responsive Layout

#### ✅ RL-01: Desktop layout at 1280×720
Screenshot `rl01-desktop-1280x720.png`. Layout correct: header + "+ Add Transaction" button on one line, horizontal summary bar (3 columns side by side), single-row filter bar (date presets + Type dropdown on one line, Status + Search + Clear on second row), all table columns (DATE / DESCRIPTION / AMOUNT / TYPE / STATUS / ACTIONS) visible and not truncated. No horizontal overflow.

#### ⚠️ RL-02: Tablet layout at 768×1024 (PARTIAL — BUG-08)
Screenshot `rl02-tablet-768x1024.png`. Summary bar horizontal (3 columns) ✅. Filter bar wraps naturally to 2 rows (date presets + Type on row 1, Status + Search + Clear on row 2) ✅. All table columns (DATE / DESCRIPTION / AMOUNT / TYPE / STATUS / ACTIONS) visible ✅. No horizontal overflow ✅.

Modal screenshot `rl02-tablet-768x1024-modal.png`: **Modal anchored top-left at 768px** (BUG-08 confirmed). Contents not clipped, backdrop visible, all form fields accessible ✅.

#### ✅ RL-03: Mobile layout at 390×844
Screenshot `rl03-mobile-390x844.png`. Summary bar **stacks vertically** (3 rows: Income, Expenses, Net) — correct for mobile breakpoint ✅. Filter presets wrap to 2 rows ("Today / This Week / This Month" + "This Year / Custom") ✅. TYPE and STATUS table columns hidden at mobile — only DATE / DESCRIPTION / AMOUNT visible ✅. No body horizontal overflow (`document.body.scrollWidth > document.body.clientWidth` → `false`) ✅.

#### ⚠️ RL-04: Mobile modal at 390×844 (PARTIAL — BUG-08)
Screenshot `rl04-mobile-390x844-modal.png`. At 390px, the modal fills the full viewport width, so all form fields are readable and accessible ✅. However, the modal is positioned at the **top of the viewport** rather than the **bottom** — the designed bottom-sheet behaviour (expected at ≤480px breakpoint per CSS spec) is not applied. BUG-08 persists at mobile breakpoint. Escape closes modal ✅. Backdrop visible ✅. No content clipped ✅.

---

## Test Data Created

| Description | Type | Amount | Date | Status | Cleaned Up |
|-------------|------|--------|------|--------|-----------|
| Playwright test expense | Expense | $25.50 | 2026-03-01 | Active | No — still in DB |
| Playwright test income | Income | $1,000.00 | 2026-02-28 | Inactive | No — still in DB |
| Updated by Playwright (Netflix) | Expense | $99.99 | 2026-02-20 | — | **Yes — deleted in TC-30** |

*"Playwright test expense" (March 1) does not appear in the default "This Month" (February) filter. "Playwright test income" is inactive and only visible when Status=Inactive. These rows may cause count/total discrepancies in future runs if not cleaned up.*

---

## Testing Gaps — Retrospective

1. **TC-04 / TC-15 require data cleanup**: Empty-state and sub-50-row pagination tests cannot be run with the current dataset. Future runs should use a dedicated clean test account or implement a data-teardown step before these TCs.

2. **TC-05 (backend unreachable)**: Stopping the NestJS server mid-session disrupts the remaining test run. A dedicated exploratory pass focused on error states should be run separately.

3. **BUG-08 not caught in prior run**: The prior run used no screenshots during modal open. This run added mandatory screenshot steps to all modal TCs, catching BUG-08 across all viewports. The test plan has been updated to require this going forward.

4. **Summary totals stale state (BUG-03)**: The only automated evidence is the absence of a `GET /transactions/totals` network request. An explicit assertion (pause 200ms after mutation, snapshot summary values, confirm they differ from pre-mutation values or equal expected post-mutation values) would make BUG-03 fail more loudly and visibly.

5. **RL-04 bottom-sheet spec**: The test plan expected a bottom-sheet presentation at ≤480px. Screenshot evidence shows top-anchored modal instead. The CSS breakpoint at 480px either does not exist or is overridden by BUG-08's root cause (missing centering rules on `<dialog>`). A dedicated CSS audit is needed.

6. **Date preset buttons under-tested — root cause in plan authorship**: "Today" and "This Week" have zero coverage. "This Year" has no positive-path coverage. Three specific decisions in the test plan caused this:

   - **TC-07 used "This Year" as a stimulus, not a subject.** TC-07 is titled "Summary updates when date range filter changes" and uses "This Year" only to trigger a filter change so the summary bar can be observed. The preset's own correctness (URL params, row filtering) was never the assertion. When the tester reached TC-08, "This Year" felt already-touched even though it had never been verified.

   - **TC-08 treated "This Month" as the representative for the entire preset group.** The plan allocated one TC for the whole group and picked the default preset as the specimen, implicitly applying equivalence partitioning. But the five presets are not equivalent — each has distinct boundary-date logic (single day, ISO week start/end, calendar month, calendar year). They are separate boundary-value test cases, not members of one equivalence class.

   - **"Today" and "This Week" were never mentioned anywhere in the plan.** The plan section was titled "Filters" and listed only `TC-08: "This Month"` and `TC-09: Custom`. The other three buttons had no entries, no skipped stubs, no coverage notes — they were simply absent.

   **Would exploratory testing have caught this?** Yes. An explorer clicking through each preset and spot-checking the URL query string (`?startDate=...&endDate=...`) and row count would immediately exercise all five. The structured plan failed here because the plan author enumerated the *filter categories* (date, type, status, search) but not the *members within* the date preset group.

   **Fix for next plan revision**: Replace TC-08 with five separate TCs — one per preset button — each asserting the correct `startDate`/`endDate` values in the URL and a plausible result count. "This Month" remains the default-state assertion (TC-08 as-is); add TC-08a (Today), TC-08b (This Week), TC-08c (This Year positive path: correct `startDate` and `endDate` in URL, all-year transactions shown).

7. **Process: preventing missing coverage in future test plans**

   The date preset gap illustrates a systemic planning failure, not a one-off mistake. The following practices prevent it recurring across any feature:

   **a) Build a UI inventory before writing a single TC.**
   Before opening the test plan file, read the component source and produce a flat list of every interactive element on the page: every button, every input, every dropdown option, every link, every toggle. This session's mode instructions already require reading component source before authoring steps — the mistake was reading it for selector discovery but not for *completeness auditing*. A UI inventory forces the question "does every item on this list appear as the *subject* of at least one TC?" for each element before writing begins.

   **b) Distinguish "stimulus" from "subject" in every TC.**
   A control used to set up state for another assertion is a *stimulus*. A control whose own correctness is the assertion is a *subject*. TC-07 used "This Year" as a stimulus (to change the date so the summary bar could be observed). That does not count as coverage of the preset. When writing each TC, explicitly label which control is the subject. Any control that only ever appears as a stimulus in the plan is uncovered.

   **c) Apply boundary-value analysis to groups of related controls — not equivalence partitioning.**
   Equivalence partitioning is valid when members of a group share identical logic. The five date presets do not — each computes different boundary dates (single day, ISO week, calendar month, calendar year). Each is a separate boundary-value case requiring its own TC. The pattern to watch for: any time a plan allocates one TC to "the X filter" where X is actually a group of buttons/options (type dropdown options, status options, preset buttons), ask whether the members are truly equivalent before collapsing them into one TC. If each option has distinct backend logic, each needs its own TC.

   **d) Write skipped stubs rather than omitting controls entirely.**
   If a control cannot be tested in the current run (e.g. no data for "Today"), write the TC with a `**SKIPPED**` verdict and a reason. An explicit skipped stub in the plan is visible evidence of a known gap. A completely absent TC is invisible — reviewers cannot distinguish "we decided not to test this" from "we forgot it existed."

   **e) Do a coverage diff against the UI inventory before finalising the plan.**
   After drafting all TCs, return to the UI inventory from step (a) and check each element off against the plan. Any element with no TC marked as its subject is a gap. This takes 5–10 minutes and mechanically catches omissions before the plan is executed.

8. **Context menu overflow — why it was not caught by the original plan**

   The ⋮ actions menu was tested (TC-28 through TC-31 cover Mark Inactive, Mark Active, Delete, Cancel delete) and all four TCs passed in the original run. The clipping bug was not detected because **the test data always contained enough rows to prevent the table container from running out of height**. With 52 transactions across two pages, the table container was always tall enough that the `overflow: hidden` boundary of `.tx-list` sat below the last ⋮ menu, so the menu painted inside the clipping rect and appeared correct.

   The bug only manifests when the table has **1–3 visible rows** — specifically when the dropdown's painted area extends below the container's natural height. None of the existing TCs exercised this configuration:

   - TC-28 (Mark Inactive) was run against a 52-row dataset. The Netflix row was row 12 of 50 on page 1 — far from the bottom of the container.
   - No TC exercised the ⋮ menu on the **last row of a short list** (1–3 rows), which is the boundary condition that exposes the overflow.
   - TC-04 (empty-state) was skipped due to data. Had it been executed, a 0-row view would have been tested, but an empty state shows no ⋮ buttons at all — so the gap would still not have been hit.

   **Why did the plan miss this boundary?** The test plan treated the per-row ⋮ menu as *action coverage* (can you trigger Edit/Delete?) rather than *layout coverage* (does the menu paint correctly at the extreme positions of the table?). The layout perspective was simply absent from the TC design. Positional edge cases for dropdowns require a dedicated class of TC that most structured plans omit:

   - Bottom-edge row: open ⋮ on the last row when the list is short (1–3 items) — assert menu visible above or below without clipping.
   - Bottom-edge row on a full page: open ⋮ on row 50 of 50 — assert menu not clipped by the viewport or container bottom.
   - Scroll position: scroll the table halfway down, open ⋮ — assert the menu tracks the trigger (relevant for fixed-position menus with scroll listeners).

   **Fix for the test plan**: Add a TC (TC-35) titled "Actions menu not clipped when table has few rows". Precondition: apply a filter that returns 1–3 rows (e.g. search for a unique description). Steps: open ⋮ on the last visible row; assert all menu items are fully visible in the viewport; assert no scrollbar on the table container. This TC would have caught BUG-09 in the first run.

   **Broader lesson**: Dropdown / popover menus are almost always `position: absolute`, and almost always sit inside a container with `overflow: hidden` for layout reasons. This combination is a systemic source of clipping bugs that only appear at the boundary of the container — when content is too short to push the container past the drop-down's paint area. Every TC that exercises a dropdown should include one variant where the dropdown is opened at the **bottom of a short list**, not just in the middle of a full one.

---

## Recommended Handoff

**→ Hand off to `frontend-dev` to fix the following (priority order):**

### BUG-07 (High) — Tab order skips interactive controls
**File**: Page/component CSS or layout  
All interactive controls (nav, "+ Add Transaction", filter controls, pagination) must be focusable in natural document Tab order. Investigate for `tabIndex="-1"`, `pointer-events: none`, or CSS `visibility: hidden` inadvertently applied to focusable elements.

### BUG-01 (High) — Date timezone exclusion

**Frontend fix** · `packages/frontend/src/features/transactions/hooks/useTransactionFilters.ts`  
Compute preset `startDate` boundaries as UTC midnight (`new Date(Date.UTC(year, month, 1))`) rather than local-time midnight. Also recalculate `endDate` as `new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999))`.

**Backend audit required** · `packages/backend/src/transactions/transactions.service.ts` (or equivalent totals method)  
The `/transactions/totals/:year/:month` endpoint computes its own date range from `year`/`month` path params — it does not receive `startDate`/`endDate` from the frontend. If the service uses `new Date(year, month - 1, 1)` (local-time midnight), it will exclude midnight-UTC records independently of the frontend fix. The backend-tester must verify this endpoint using the UTC boundary check: create a transaction at exactly `T00:00:00.000Z`, call `GET /transactions/totals/:year/:month`, and assert the transaction is included in the total.

### BUG-08 (Medium) — Modal renders at top-left (all viewports)
**File**: `packages/frontend/src/features/transactions/components/TransactionModal.css`  
Add centering to `.tx-modal`: `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);`. At ≤480px, override to: `position: fixed; bottom: 0; left: 0; right: 0; top: auto; transform: none; border-radius: 1rem 1rem 0 0;` for bottom-sheet layout.

### BUG-06 (Medium) — Modal missing `aria-modal` and `aria-labelledby`
**File**: Modal component  
The native `<dialog>` now provides implicit `role="dialog"` (improvement ✅). Add `aria-modal="true"` and `aria-labelledby="[heading-id]"` to the `<dialog>` element. Fix focus-trap loop so Tab cannot escape to page content.

### BUG-03 (Medium) — Summary totals not invalidated after mutations
**File**: `packages/frontend/src/pages/TransactionsPage.tsx` (or form/action hooks)  
After every mutation (create, update, delete, toggle), `queryClient.invalidateQueries` must include the totals query key in addition to the list query key.

### BUG-02 (Medium) — "This Year" preset does not reset startDate
**File**: Same as BUG-01  
The "This Year" preset must reset `startDate` to `Jan 01` of the current year when clicked, not inherit `startDate` from the previous active preset.

### BUG-05 (Low) — Modal initial focus on Close button
**File**: Modal component / `TransactionForm.tsx`  
On modal open, call `.focus()` on the Amount `<input>` rather than the Close button.

### BUG-04 (Medium) — Silent auth failure redirect
**File**: `packages/frontend/src/features/auth/context/AuthContext.tsx`  
When `/auth/me` fails due to network error (not 401), show a user-visible toast or banner before redirecting to `/login`.

---

## Re-test Report: Bug Fixes Verification

**Date**: 2026-03-01  
**Environment**: http://localhost:5173  
**Backend**: http://localhost:3001  
**Test User**: test@example.com (pre-authenticated)  
**Context**: Re-test of TCs affected by BUG-01 through BUG-08 after frontend-dev fix session.  
Scope: TC-06, TC-08, TC-18, TC-20, TC-25, TC-32, TC-33, RL-02, RL-04 + BUG-02/BUG-07/BUG-08 verification steps.

### Re-test Summary

| # | Bug | Previous Status | Re-test Verdict | Notes |
|---|-----|----------------|-----------------|-------|
| BUG-01 | Date timezone exclusion (frontend) | PERSISTS | ✅ **RESOLVED** | All preset URLs use `T00:00:00.000Z` UTC boundaries |
| BUG-02 | "This Year" startDate not reset | PERSISTS | ✅ **RESOLVED** | Both `startDate` and `endDate` set atomically; URL contains `?startDate=2026-01-01T00:00:00.000Z&endDate=2026-12-31T23:59:59.999Z` |
| BUG-03 | Summary totals stale after mutations | PERSISTS | ✅ **RESOLVED** | `GET /transactions/totals` fires after every create/delete; totals update without page reload |
| BUG-04 | Silent auth failure redirect | NOT RE-TESTED | ⏭️ **NOT RE-TESTED** | Stopping backend out of scope; unchanged from previous run |
| BUG-05 | Modal initial focus on Close button | PERSISTS | ✅ **RESOLVED** | Focus on Amount `<input type="number">` on open for both Add and Edit modals |
| BUG-06 | Modal missing `aria-modal` / `aria-labelledby` | PARTIALLY RESOLVED | ✅ **RESOLVED** | `aria-modal="true"`, `aria-labelledby="tx-modal-title"`, `h2#tx-modal-title` all present; focus trap holds — all 9+ Tabs stay inside dialog |
| BUG-07 | Tab skips all interactive controls | PERSISTS | ✅ **RESOLVED** | Full Tab sequence confirmed: "+ Add Transaction" → Today → This Week → This Month → This Year → Custom → Type → Status → Search → Clear → ⋮ actions |
| BUG-08 | Modal renders at top-left (all viewports) | PERSISTS | ✅ **RESOLVED** | Desktop: centred (`transform: translate(-50%,-50%)`); Tablet 768×1024: centred; Mobile 390×844: bottom-sheet (`position:fixed; bottom:0; transform:none; width:375px`) |
| BUG-09 | Context menu clipped by table overflow | NEW (found this session) | ✅ **RESOLVED** | Menu now renders via `position: fixed` + `getBoundingClientRect()`; no scrollbar, all items visible. Screenshots: `context-menu-bug.png`, `context-menu-fixed.png` |

### Re-test Console Errors

| Step | Message | Severity |
|------|---------|----------|
| — | None | — |

*Zero console errors recorded at level `error` across the entire re-test run.*

### Re-test Network Verification

| TC | Endpoint | Method | Status | Result |
|----|----------|--------|--------|--------|
| BUG-03 create | `POST /transactions` | POST | 201 | ✅ |
| BUG-03 totals after create | `GET /transactions/totals?startDate=...&endDate=...` | GET | 200 | ✅ fired immediately after POST |
| BUG-03 delete | `DELETE /transactions/:id` | DELETE | 204 | ✅ |
| BUG-03 totals after delete | `GET /transactions/totals?startDate=...&endDate=...` | GET | 200 | ✅ fired immediately after DELETE |

*BUG-01 UTC fix also confirmed via network: all `GET /transactions` and `GET /transactions/totals` requests use `startDate=YYYY-MM-DDT00:00:00.000Z` (UTC midnight) not a local-time offset.*

### Detailed Re-test Results

#### ✅ TC-06 Re-test: Summary bar shows correct Income value
Income shows **$1,000.00** (was $0.00 before fix). "This Month" filter (March 2026) correctly includes the Playwright test income transaction created on Mar 1 at UTC midnight. Structure: Income / Expenses / Net all render with correct values.

#### ✅ TC-08 Re-test: "This Year" sets both startDate and endDate
URL after clicking "This Year": `?startDate=2026-01-01T00:00:00.000Z&endDate=2026-12-31T23:59:59.999Z&page=1`. Both params present and UTC-correct. **BUG-02 resolved.**

#### ✅ TC-08b (new): "Today" preset sends correct UTC boundaries
URL after clicking "Today": `?startDate=2026-03-01T00:00:00.000Z&endDate=2026-03-01T23:59:59.999Z&page=1`. UTC midnight start (not local-time) confirmed. **BUG-01 frontend fully resolved.**

#### ✅ TC-18 Re-test: Add modal centred and focused correctly
Screenshot `retest-tc18-add-modal.png`: modal centred both horizontally and vertically at 1280×720. Initial focus on Amount `spinbutton` (not Close button). `aria-modal="true"`, `aria-labelledby="tx-modal-title"`. Backdrop visible. **BUG-05, BUG-06, BUG-08 all resolved.**

#### ✅ TC-20 Re-test: Summary updates after create (no reload)
Created "BUG-03 retest expense" ($50.00, Expense). Expenses immediately updated $25.50 → $75.50; Net immediately updated $974.50 → $924.50. `GET /transactions/totals` confirmed in network log. **BUG-03 resolved.**

#### ✅ TC-25 Re-test: Edit modal centred, pre-populated, focused on Amount
Screenshot `retest-tc25-edit-modal.png`: "Edit Transaction" modal centred at 1280×720. Amount pre-filled with 1000, focused (`spinbutton [active]`). Type disabled with helper text. **BUG-05, BUG-08 resolved in edit mode.**

#### ✅ TC-32 Re-test: Full keyboard Tab navigation
Tab from page body traverses full sequence without skipping: "+ Add Transaction" (1) → Today (2) → This Week (3) → This Month (4) → This Year (5) → Custom (6) → Type select (7) → Status select (8) → Search input (9) → Clear (10) → per-row ⋮ buttons. **BUG-07 resolved.**

#### ✅ TC-33 Re-test: Modal ARIA attributes and focus trap
`dialog.getAttribute('aria-modal')` → `"true"` ✅  
`dialog.getAttribute('aria-labelledby')` → `"tx-modal-title"` ✅  
`document.querySelector('dialog h2').id` → `"tx-modal-title"` ✅  
9 consecutive Tab presses all remained `insideDialog: true` — focus trap holds completely. Escape closes modal ✅.  
Initial focus on Amount input (not Close button) ✅. **BUG-06 fully resolved.**

#### ✅ RL-02 Re-test: Modal centred at tablet 768×1024
Screenshot `retest-rl02-tablet-modal.png`: modal horizontally centred, fully visible, not clipped. Backdrop visible. All form fields accessible. **BUG-08 resolved at tablet viewport.**

#### ✅ RL-04 Re-test: Modal as bottom-sheet at mobile 390×844
Screenshot `retest-rl04-mobile-modal.png`: modal anchored to bottom of viewport (bottom-sheet layout). CSS verified: `position: fixed; bottom: 0px; transform: none; width: 375px`. All form fields and buttons visible. Escape closes modal. **BUG-08 resolved at mobile viewport.**

#### ✅ BUG-09 (new): Context menu no longer clipped when table has few rows
Reproduced the bug: navigated to a filtered view with only 1–3 visible rows, clicked ⋮ on the bottom-most row. **Before fix**: table displayed a horizontal/vertical scrollbar; menu items were clipped and the bottom items were unreachable. Screenshot `context-menu-bug.png` captured as evidence.

**Root cause**: `TransactionList.css` sets `overflow: hidden` on `.tx-list`. The `.tx-actions__menu` was `position: absolute`, which is still paint-clipped by an ancestor with `overflow: hidden` even though it escapes normal flow. When the menu extended beyond the container bounds, the container grew a scrollbar rather than allowing the menu to overflow visibly.

**Fix applied** (`TransactionActions.tsx` + `TransactionActions.css`):
- Added `triggerRef = useRef<HTMLButtonElement>()` to the ⋮ trigger button.
- On toggle, compute `getBoundingClientRect()` of the trigger and store `{top: rect.bottom + 4, right: window.innerWidth - rect.right}` in a `menuPos` state variable.
- Menu renders with `style={{position: 'fixed', top: menuPos.top, right: menuPos.right}}` — `fixed` is relative to the viewport and bypasses all overflow ancestors.
- Capture-phase `scroll` listener and `resize` listener recompute `menuPos` while the menu is open, keeping it anchored to the trigger even if the page scrolls.
- Removed `position: absolute; right: 0; top: calc(100% + 4px)` from `.tx-actions__menu` CSS; bumped `z-index` from 100 to 200.

**After fix**: screenshot `context-menu-fixed.png` shows all three menu items (Edit / Mark Inactive / Delete) fully visible outside and below the table container, no scrollbar present. Click-outside closes the menu (`{"wasOpen":true,"closedAfterClickOutside":true}` confirmed via Playwright). Escape key also closes the menu. All 420 unit tests still pass.

### Test Data Created During Re-test

| Description | Type | Amount | Date | Status | Cleaned Up |
|-------------|------|--------|------|--------|-----------|
| BUG-03 retest expense | Expense | $50.00 | 2026-03-01 | Active | **Yes — deleted via UI** |

*Remaining pre-existing test data from prior run: "Playwright test expense" ($25.50, Expense, Mar 1, Active) and "Playwright test income" ($1,000.00, Income, Mar 1, Active) — not cleaned up.*
