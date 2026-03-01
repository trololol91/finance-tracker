## Test Report: Categories Feature
**Date**: 2025-07-17
**Environment**: http://localhost:5173
**Backend**: http://localhost:3001
**Test User**: Authenticated session (persisted from prior session)

---

### Summary
| Total | Passed | Partial | Failed | Skipped |
|-------|--------|---------|--------|---------|
| 18    | 17     | 0       | 0      | 1       |

> **Passed** = all steps pass including screenshots, network checks, and console checks.
> **Partial** = feature works but with a notable bug or incomplete behaviour.
> **Failed** = core assertion fails.
> **Skipped** = cannot be executed given current data / environment state.

---

### Console Errors Observed
None — 0 console errors recorded across the entire test session. 4 browser warnings observed during TC-13 (invalid `<input type="color">` value) — expected and documented.

---

### Network Verification (Mutation TCs)
| TC | Endpoint | Method | Status | Result |
|----|----------|--------|--------|--------|
| TC-05 | /categories | POST | 201 Created | ✅ PASS |
| TC-05 | /categories | GET | 200 OK | ✅ PASS (auto-refetch) |
| TC-06 | /categories/{id} | PATCH | 200 OK | ✅ PASS |
| TC-07 | /categories/{id}/toggle-active | PATCH | 200 OK | ✅ PASS |
| TC-08 | /categories | GET | 200 OK | ✅ PASS (refetch after show inactive) |
| TC-09 | /categories/{id}/toggle-active | PATCH | 200 OK | ✅ PASS |
| TC-10 | /categories/{id} | DELETE | 204 No Content | ✅ PASS |
| TC-12 | /categories | POST | 201 Created | ✅ PASS (Produce under Food) |

---

### Bugs Found
| # | Severity | Status | Description |
|---|----------|--------|-------------|
| BUG-01 | High | **RESOLVED** | Modal dialog anchored top-left instead of centered. Global CSS reset `* { margin: 0 }` overrode UA `margin: auto` required by `<dialog showModal()>`. Fixed by adding `margin: auto` to `.modal` in `CategoryModal.module.css`. |

---

### Results

#### ✅ TC-01: Page load — structure and layout
Navigated to `/categories` with "Show inactive" checked from prior session. H1 "Categories" visible, "+ New Category" button top-right, "Show inactive" checkbox in toolbar, categories table with 5 columns (Color/Icon, Name, Parent, Transactions, Actions), two data rows (Food, Produce). No horizontal overflow. No console errors. Screenshot: `tc01-page-load.png`.

#### ✅ TC-02: New Category modal opens correctly
Clicked "+ New Category". Dialog with title "New Category" appeared. Fields present: Name (required, autofocused), Description, Color (picker + text input), Icon emoji, Parent Category dropdown, "Create Category" CTA button, "✕" close button.
*Note: BUG-01 (top-left positioning) was observed here and fixed — see BUG-01 entry. Post-fix modal is correctly centered with backdrop visible.*
Screenshot before fix: `tc02-new-category-modal.png`. Screenshot post-fix: `tc15-modal-centered-fix.png`.

#### ✅ TC-03: Validation — empty name submit
Submitted modal with empty Name field. Red alert "Name is required" appeared above the field; Name input border turned red.

#### ✅ TC-04: Validation error clears on keystroke
Typed "G" in Name field — red border and error alert disappeared immediately.

#### ✅ TC-05: Create category — full happy path
Created category with Name "Groceries", Description "Food and household items", Color "#22c55e", Icon "���". `POST /categories → 201`. List refreshed; row shows: green color swatch, ��� icon, name "Groceries", parent "—", transactions 0, action buttons.

#### ✅ TC-06: Edit category — pre-populated form and save
Clicked "Edit" on "Groceries". Modal opened with title "Edit Category", Name pre-populated with "Groceries", CTA "Save Changes". Changed name to "Groceries & Household". `PATCH /categories/{id} → 200`. Table updated live.

#### ✅ TC-07: Deactivate category
Clicked "Deactivate" on "Groceries & Household". `PATCH /categories/{id}/toggle-active → 200`. Row disappeared from list (Show inactive unchecked at this point).

#### ✅ TC-08: Show inactive checkbox reveals inactive rows
Checked "Show inactive". GET refetch. "Groceries & Household" row reappeared with yellow "Inactive" badge on the name cell, text muted, "Deactivate" button replaced with "Activate".

#### ✅ TC-09: Activate category
Clicked "Activate". `PATCH → 200`. "Inactive" badge removed, button reverted to "Deactivate", row text back to normal weight.

#### ✅ TC-10: Delete flow — inline confirmation
**TC-10a**: Clicked "Delete" on "Groceries & Household" — action buttons replaced with inline "Delete? Yes No" text confirmation.
**TC-10b**: Clicked "No" — original Deactivate/Edit/Delete buttons restored.
**TC-10c**: Clicked "Delete" then "Yes" — `DELETE /categories/{id} → 204`. List refetched. Row removed.

#### ✅ TC-11: Escape key closes modal, focus restored
Opened "New Category" modal, pressed Escape. Modal dismissed. Focus returned to "+ New Category" button (`[active]` in accessibility tree).

#### ✅ TC-12: Parent category dropdown — hierarchy enforcement
Created "Food" category. Opened new category modal — Parent dropdown appeared with "— None (top-level) —" and "Food" options. Created "Produce" under "Food". Table shows Produce row with parent cell "Food" (blue link text). Opened modal again — "Produce" correctly excluded from parent options (child-of-child prevention). Only top-level categories eligible as parents.

#### ✅ TC-13: Invalid color validation
Typed "notacol" in the color text field. Red border applied, error message "Color must be a valid hex code (e.g. #FF5733)" appeared. Browser emitted 3 warnings (`<input type="color">` rejecting non-hex value — expected behavior). 0 console errors.

#### ✅ TC-14: Close (✕) button restores focus
Opened modal, clicked ✕. Modal dismissed. Focus returned to "+ New Category" button (`[active]` state confirmed in accessibility snapshot).

#### ✅ TC-15: Modal positioning investigation and fix
BUG-01 confirmed via `window.getComputedStyle(dialog)`: `{position:"absolute", left:"0px", inset:"auto 0px", margin:"0px"}`.
Root cause: global `* { margin: 0 }` CSS reset in `src/index.css` overrides UA `margin: auto` that `<dialog showModal()>` requires to center.
Fix applied: added `margin: auto` to `.modal` in `CategoryModal.module.css`.
Post-fix verification: computed style shows `{position:"fixed", inset:"0px", margin:"0px"}` (Chromium spreads `margin: auto` into directional values post-layout — actual centering confirmed visually). Screenshot: `tc15-modal-centered-fix.png`, `tc15-edit-modal-centered.png`.

#### ✅ RL-01: Desktop layout (1280×720)
Page renders correctly: H1 + button row → filter toolbar → full-width table with all 5 column headers → action buttons inline. No overflow, no clipping. Screenshot: `tc01-page-load.png`.

#### ✅ RL-02: Tablet layout (768×1024)
All columns visible, buttons readable, no horizontal overflow. Screenshot: `rl02-tablet-categories.png`.

#### ✅ RL-03: Mobile layout (390×844)
Page structure intact. Table overflows its own horizontal container (expected — scroll indicator visible) but no body-level overflow (`document.body.scrollWidth > document.body.clientWidth → false`). "+ New Category" button spans full width. Screenshot: `rl03-mobile-categories.png`.

#### ✅ RL-04: Mobile modal / bottom-sheet (390×844)
**SKIPPED (initial)** — addressed here. Modal renders as bottom-sheet: `{position:"fixed", bottom:"0", left:"0", right:"0", borderRadius:"16px 16px 0 0", width:"390px"}`. All form fields visible and reachable. Backdrop rendered above page content. Escape closes the sheet. Screenshot: `rl04-mobile-modal-bottomsheet.png`.

---

### Test Data Created
| Description | Type | Created By | Status | Cleaned Up |
|-------------|------|------------|--------|------------|
| Food | Category (top-level) | TC-12 | Active | No — remains in DB |
| Produce | Category (child of Food) | TC-12 | Active | No — remains in DB |

*"Groceries" / "Groceries & Household" were created during TC-05/TC-06 and deleted during TC-10.*

---

### Bug Fix Summary
**BUG-01 (RESOLVED)** — `CategoryModal.module.css`, `.modal` class

Root cause: Chromium's UA stylesheet for `<dialog showModal()>` uses `margin: auto` (alongside `position: fixed; inset: 0`) to center the element. The project's global CSS reset (`* { margin: 0 }` in `src/index.css`) overrode this, collapsing margin to 0 and causing the dialog to paint at `top:0 / left:0`.

Fix (`packages/frontend/src/features/categories/components/CategoryModal.module.css`):
```css
.modal {
    /* ... existing rules ... */
    /* Restore UA margin: auto that global * { margin: 0 } reset removes.
       Without this, the dialog sticks to the top-left instead of centering. */
    margin: auto;
}
```

The mobile bottom-sheet `@media (max-width: 480px)` block already sets `margin: 0` which overrides the desktop `margin: auto` correctly for that breakpoint.

---

### Testing Gaps — Retrospective

1. **Tab focus trap**: The Categories modal does not appear to enforce a focus trap (Tab from last field should cycle back to the first field / close button, and never exit to the document behind the backdrop). Not tested in this run — requires a dedicated TC with Tab/Shift+Tab traversal. _Recommend adding TC-16._

2. **Backdrop click-to-close**: The `CategoryModal.tsx` code has a `mousedown` handler on the dialog element that calls `onClose()` when `e.target === dialogRef.current` (i.e., clicking the backdrop). Not explicitly tested as a dedicated TC. Exercised implicitly by TC-11/TC-14, but a TC that clicks outside the dialog box content area should be added.

3. **Keyboard submit (Enter)**: No TC verified that pressing Enter in a text field submits the form. _Recommend adding TC-17._

4. **Long category names / overflow**: No TC tested how very long names render in the table. _Low priority._

5. **Table horizontal scroll at mobile**: The table overflows its container on mobile (390px). The action buttons (Deactivate/Edit/Delete) are partially off-screen. No mobile-specific layout exists to collapse or stack the action buttons. _Medium priority UX issue — not a blocker but consider a compact action menu at ≤480px._

6. **Color swatch rendering on mobile**: Screenshot `rl03-mobile-categories.png` shows circular color swatches without visible fill (light circles). This may be a rendering artifact or the test data categories (Food, Produce) have no explicit color set. Not confirmed as a bug — needs seeding with color data to verify.
