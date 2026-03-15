## Test Plan: Dashboard UX -- AppShell, Dashboard, Settings, Admin (Phase 9)

**Date**: 2026-03-14
**Environment**: http://localhost:5173
**Backend**: http://localhost:3001

### Preconditions
- [x] Dev server running at http://localhost:5173
- [x] Backend running at http://localhost:3001
- [x] Seed users: USER=user@example.com/User123!  ADMIN=admin@example.com/Admin123!

### UI Inventory (source-derived)

**Sidebar (Sidebar.tsx)**
- App logo link (navigates to /dashboard)
- Dashboard nav link
- Transactions nav link
- Accounts nav link
- Categories nav link
- Scraper/Sync nav link
- Settings section label
- Settings nav link
- Admin nav link (adminOnly flag, ADMIN role only)
- User display name text
- User email text
- Log out button

**Settings Page (SettingsPage.tsx)**
- h1 Settings
- Profile tab button (id=tab-profile, role=tab)
- Notifications tab button (id=tab-notifications, role=tab)
- Profile panel (id=panel-profile, role=tabpanel):
  - First Name input (id=profile-first-name)
  - Last Name input (id=profile-last-name)
  - Email readonly field
  - Timezone select (id=profile-timezone)
  - Currency select (id=profile-currency)
  - Save button (form=profile-form)
  - Cancel button
- Notifications panel (id=panel-notifications, role=tabpanel):
  - Push notifications checkbox (id=notify-push)
  - Email notifications checkbox (id=notify-email)
  - Save preferences button

**Admin Page (AdminPage.tsx)**
- h1 Admin
- User Management section heading
- User table: Name, Email, Role, Status, Actions columns
- Role select per row (disabled when isSelf=true)
- Row inline feedback spans (success/error)
- Plugin Management section heading
- Reload Plugins button
- Install Plugin file input (id=plugin-file-input)
- Install Plugin button

---

### Test Cases

#### TC-01: Sidebar visible with primary nav items (USER)
- **Type**: Smoke
- **Steps**:
  1. Navigate to http://localhost:5173/login
  2. Fill email user@example.com, password User123!
  3. Click login button; wait for /dashboard
  4. Take screenshot
  5. Assert: Dashboard, Transactions, Accounts, Categories, Scraper/Sync links all visible
- **Expected result**: Sidebar renders with all 5 primary nav items

#### TC-02: Sidebar Settings section shows Settings link
- **Type**: Smoke
- **Steps**:
  1. (USER logged in at /dashboard)
  2. Assert: Settings link visible in sidebar settings section
- **Expected result**: Settings link present

#### TC-03: Admin link NOT visible for USER role
- **Type**: Smoke
- **Steps**:
  1. (USER logged in)
  2. Assert: No Admin link anywhere in sidebar
- **Expected result**: Admin link absent for USER role

#### TC-04: Admin link IS visible for ADMIN role
- **Type**: Smoke
- **Steps**:
  1. Log out; navigate to /login
  2. Fill email admin@example.com, password Admin123!
  3. Click login; wait for /dashboard
  4. Take screenshot of sidebar
  5. Assert: Admin link visible in sidebar
- **Expected result**: Admin link present for ADMIN role

#### TC-05: Each sidebar nav link navigates correctly and becomes active
- **Type**: Regression
- **Steps**:
  1. Click Transactions -- assert URL /transactions, link active
  2. Click Accounts -- assert URL /accounts, link active
  3. Click Categories -- assert URL /categories, link active
  4. Click Scraper/Sync -- assert URL /scraper, link active
  5. Click Dashboard -- assert URL /dashboard, link active
  6. Click Settings -- assert URL /settings, link active
- **Expected result**: All links navigate and highlight correctly

#### TC-06: Logout button redirects to login, clears session
- **Type**: Smoke
- **Steps**:
  1. Click Log out button in sidebar footer
  2. Assert: URL is /login
  3. Navigate to /dashboard -- assert redirected to /login
- **Expected result**: Session cleared

#### TC-07: Navigate to /admin as USER -> redirected to /dashboard
- **Type**: Security
- **Steps**:
  1. Log in as USER (user@example.com)
  2. Navigate to http://localhost:5173/admin
  3. Assert: URL becomes /dashboard
- **Expected result**: AdminRoute guard redirects non-ADMIN users to /dashboard

#### TC-08: Navigate to /profile -> redirected to /settings
- **Type**: Regression
- **Steps**:
  1. While logged in, navigate to http://localhost:5173/profile
  2. Assert: URL becomes /settings; h1 Settings visible
- **Expected result**: /profile redirects to /settings

#### TC-09: Dashboard loads -- no blank screen, no console errors
- **Type**: Smoke
- **Steps**:
  1. Log in as USER; navigate to /dashboard
  2. Wait for page to settle
  3. Take screenshot -- verify layout: header, summary grid, panels row, accounts panel
  4. Check console errors
- **Expected result**: Dashboard renders with correct layout; no JS errors

#### TC-10: All 4 summary cards visible
- **Type**: Smoke
- **Steps**:
  1. At /dashboard
  2. Assert: Monthly Income card visible
  3. Assert: Monthly Expenses card visible
  4. Assert: Net Balance card visible
  5. Assert: Savings Rate card visible
- **Expected result**: 4 summary cards render with correct titles

#### TC-11: Spending by Category panel visible (or empty state)
- **Type**: Smoke
- **Steps**: At /dashboard, assert Spending by Category panel present
- **Expected result**: Panel renders without crashing

#### TC-12: Recent Transactions panel visible (or empty state)
- **Type**: Smoke
- **Steps**: At /dashboard, assert Recent Transactions panel present
- **Expected result**: Panel renders without crashing

#### TC-13: Accounts panel visible (or empty state)
- **Type**: Smoke
- **Steps**: At /dashboard, assert Accounts panel present
- **Expected result**: Panel renders without crashing

#### TC-14: Dashboard shows current month in subtitle
- **Type**: Regression
- **Steps**:
  1. At /dashboard, locate subtitle under h1 Dashboard
  2. Assert: subtitle contains current month (2026-03)
- **Expected result**: Correct month displayed in subtitle

#### TC-15: Error boundary renders gracefully if API fails
- **SKIPPED**: Cannot simulate backend failure without backend manipulation.
  DashboardErrorBoundary and isError branch present in DashboardPage.tsx lines 27-48.
  Known gap for future run with controllable API mocking.

#### TC-16: Settings page loads with Profile and Notifications tabs
- **Type**: Smoke
- **Steps**:
  1. Navigate to /settings
  2. Take screenshot -- verify h1 Settings and two tabs visible
  3. Assert: Profile tab (id=tab-profile, role=tab) visible
  4. Assert: Notifications tab (id=tab-notifications, role=tab) visible
  5. Check console errors
- **Expected result**: Settings page loads with both tabs

#### TC-17: Profile tab active by default
- **Type**: Smoke
- **Steps**:
  1. At /settings
  2. Assert: Profile tab has aria-selected=true
  3. Assert: Profile panel not hidden; First Name input visible
  4. Assert: Notifications panel has hidden attribute
- **Expected result**: Profile tab is the default active tab

#### TC-18: Keyboard navigation ArrowRight/ArrowLeft switches tabs
- **Type**: Accessibility
- **Steps**:
  1. At /settings, focus Profile tab (id=tab-profile)
  2. Press ArrowRight
  3. Assert: Notifications tab has aria-selected=true, panel content visible
  4. Press ArrowLeft
  5. Assert: Profile tab has aria-selected=true
- **Expected result**: Arrow keys cycle tabs per ARIA tablist pattern

#### TC-19: Profile form pre-populated with current user data
- **Type**: Regression
- **Steps**:
  1. At /settings, Profile tab active
  2. Assert: First Name input (id=profile-first-name) has non-empty value
  3. Assert: Email readonly field shows logged-in user email
- **Expected result**: Form fields pre-filled with user data

#### TC-20: Update firstName -> save -> success message shown
- **Type**: Regression
- **Steps**:
  1. At /settings, Profile tab
  2. Clear First Name input; type TestUser
  3. Click Save button
  4. Assert: Profile updated successfully. appears (role=status)
  5. Verify PATCH /users/id returned 2xx
- **Expected result**: Profile saves with confirmation message

#### TC-21: Notifications tab -> toggle checkboxes -> save -> success
- **Type**: Regression
- **Steps**:
  1. Click Notifications tab
  2. Take screenshot -- verify checkboxes visible
  3. Toggle Push checkbox (id=notify-push)
  4. Toggle Email checkbox (id=notify-email)
  5. Click Save preferences button
  6. Assert: Notification preferences saved. (role=status)
  7. Verify PATCH /users/id returned 2xx
- **Expected result**: Notification preferences saved with confirmation

#### TC-22: /profile -> redirected to /settings
- **Type**: Regression
- **Steps**: Navigate to /profile -- assert URL /settings, h1 Settings visible
- **Expected result**: Redirect works

#### TC-23: ADMIN at /admin -> Admin page loads
- **Type**: Smoke
- **Steps**:
  1. Log in as admin@example.com; navigate to /admin
  2. Take screenshot -- verify h1 Admin, User Management and Plugin Management sections
  3. Check console errors
- **Expected result**: Admin page renders both sections

#### TC-24: User Management table shows correct columns and data
- **Type**: Smoke
- **Steps**:
  1. At /admin
  2. Assert: table visible with Name, Email, Role column headers
  3. Assert: at least one data row visible
- **Expected result**: Table renders with correct structure

#### TC-25: Current admin user role selector is disabled
- **Type**: Regression
- **Steps**:
  1. At /admin, find the row for the logged-in admin (identified by (you) label)
  2. Assert: role select for that row is disabled
- **Expected result**: Self-demotion prevented

#### TC-26: Change non-admin user role to ADMIN -> success feedback
- **Type**: Regression
- **Steps**:
  1. At /admin, find user@example.com row
  2. Change role select to Admin
  3. Assert: Role updated inline feedback visible in that row
  4. Verify PATCH /admin/users/id 2xx
- **Expected result**: Role change confirmed inline

#### TC-27: Change role back to USER -> success feedback
- **Type**: Regression
- **Steps**:
  1. Find user@example.com row (now showing Admin)
  2. Change role select to User
  3. Assert: Role updated feedback visible
  4. Verify PATCH /admin/users/id 2xx
- **Expected result**: Role revert confirmed

#### TC-28: Plugin Manager section with Reload Plugins button visible
- **Type**: Smoke
- **Steps**:
  1. At /admin
  2. Assert: Plugin Management section heading visible
  3. Assert: Reload Plugins button visible and enabled
  4. Assert: file input (id=plugin-file-input) visible
  5. Assert: Install Plugin button visible
- **Expected result**: Plugin Manager controls render correctly

#### TC-29: Transactions page still works
- **Type**: Regression
- **Steps**:
  1. Navigate to /transactions
  2. Assert: page loads; list or empty state visible; take screenshot
- **Expected result**: Transactions page functional

#### TC-30: Accounts page still works
- **Type**: Regression
- **Steps**: Navigate to /accounts; assert page loads; take screenshot
- **Expected result**: Accounts page functional

#### TC-31: Categories page still works
- **Type**: Regression
- **Steps**: Navigate to /categories; assert page loads; take screenshot
- **Expected result**: Categories page functional

#### TC-32: Unauthenticated /dashboard access -> redirected to /login
- **Type**: Security
- **Steps**:
  1. Log out
  2. Navigate to http://localhost:5173/dashboard
  3. Assert: URL becomes /login; login form visible
- **Expected result**: AuthGuard protects /dashboard

---

### Coverage Level
**Full Regression** -- covers AppShell, Dashboard, Settings, Admin features plus smoke regression on Transactions, Accounts, Categories, and security guards.
