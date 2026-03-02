# Development Roadmap - Finance Tracker Frontend

This document outlines the implementation order for building the Finance Tracker frontend with authentication, user management, and transaction features.

## Design Decisions

**Architecture:** Feature-based organization with path aliases
**State Management:** React Context API (considering Zustand for complex state)
**Styling:** CSS Modules with shared design system
**Testing:** Vitest + React Testing Library + accessibility-first queries

## Current State

- ✅ React + TypeScript + Vite setup complete
- ✅ Path aliases configured (@/, @components/, @features/)
- ✅ Component library with Button, Card, Input, Loading
- ✅ Testing infrastructure (Vitest + React Testing Library)
- ✅ ESLint configuration with strict rules
- ⚠️ Pages exist but are stubs
- ⚠️ No API integration
- ❌ No authentication flow
- ❌ No state management

## Implementation Order

### Standard Checklist for Each Phase

**Every phase should complete these tasks to maintain quality and consistency:**

#### ✅ **Core Implementation**
- [ ] Components built with TypeScript and proper typing
- [ ] All imports use path aliases (no relative imports)
- [ ] CSS Modules for component styles
- [ ] Proper error boundaries and fallback UI
- [ ] Loading states for async operations

#### ✅ **API Integration**
- [ ] Use Orval-generated hooks from `src/api/[feature]/` — do **not** create manual service files
- [ ] Run `npm run generate:api` if backend endpoints have changed
- [ ] Import generated DTO types from `src/api/model/` — do **not** redefine them in feature `types/` files
- [ ] Error handling with user-friendly messages
- [ ] Loading and error states from React Query (`isPending`, `isError`, `error`)

#### ✅ **State Management**
- [ ] Local state with useState for UI-only state
- [ ] Context API for shared auth/user state
- [ ] Custom hooks for reusable logic
- [ ] Proper cleanup in useEffect hooks

#### ✅ **Testing**
- [ ] Component tests with React Testing Library
- [ ] Accessibility-first queries (getByRole, getByLabelText)
- [ ] Test user interactions (click, type, submit)
- [ ] Test loading and error states
- [ ] All tests passing (`npm test`)

#### ✅ **Accessibility**
- [ ] Semantic HTML elements
- [ ] ARIA labels where needed
- [ ] Keyboard navigation support
- [ ] Focus management
- [ ] Screen reader tested

#### ✅ **Documentation**
- [ ] JSDoc comments for complex functions
- [ ] README updated if needed
- [ ] Component props documented with TypeScript

---

## Phase 1: Authentication UI ✅ **Complete**

**Priority:** CRITICAL - Required before all protected features
**Backend Dependency:** Backend Phase 2 (Authentication Module) ✅ Complete
**Timeline:** 2-3 days

### Goals
- Implement login and registration flows
- Set up authentication context and token management
- Create protected route wrapper
- Handle authentication errors gracefully

### Tasks

#### 1.1 Setup Authentication Context & Types ✅ Complete

**Files Created:**
- ✅ `src/features/auth/types/auth.types.ts`
- ✅ `src/features/auth/context/AuthContext.tsx`
- ✅ `src/features/auth/hooks/useAuth.ts`
- ✅ `src/services/storage/authStorage.ts`

**Implementation Details:**

**`auth.types.ts`:** ✅ Created & cleaned up

Contains `User` and `AuthContextType`. `LoginRequest`, `RegisterRequest`, and `AuthResponse` have been removed:
- `RegisterRequest` → replaced by `CreateUserDto` from `src/api/model/`
- `LoginRequest` / `AuthResponse` → were unused, deleted

> 📝 **Note:** `User` is kept as a local type rather than using `UserResponseDto`. Both now generate correctly (backend `@ApiProperty` decorators were fixed with `type: String` for nullable fields — `auth-response.dto.ts` and `user-response.dto.ts`). `UserResponseDto` has all needed fields but `firstName`/`lastName` are `string | null` (nullable) vs the local `User` which has them as `string`. Replacing requires null-handling updates across `AuthContext.tsx`, `authStorage.ts`, and test files — defer to a future cleanup.

**`AuthContext.tsx`:**
- Create context with AuthContextType
- Implement AuthProvider component
- Load token from localStorage on mount
- Validate token and load user on mount
- Provide login, register, logout methods
- Handle token refresh (if implementing)

**`authStorage.ts`:**
- `saveToken(token: string)` - store JWT in localStorage
- `getToken()` - retrieve JWT
- `removeToken()` - clear JWT on logout
- `saveUser(user: User)` - store user data
- `getUser()` - retrieve user data
- `clearAuth()` - clear all auth data

#### 1.2 Implement Auth API Service ✅ Complete

> The Orval-generated functions are wired directly into `AuthContext.tsx`. No separate `authService.ts` is needed.

**Files Updated:**
- ✅ `src/features/auth/context/AuthContext.tsx` — `login`, `register`, and mount-time token validation implemented

**Implementation summary:**

**`AuthContext.tsx` — `login(email, password)`:**
- Calls `authControllerLogin({email, password})` from `@/api/auth/auth.js`
- Saves token to localStorage first (so the Bearer header is included in follow-up request)
- Calls `authControllerGetProfile()` to fetch full `UserResponseDto`
- Maps DTO to local `User` via `mapToUser()`, saves to storage, updates state

**`AuthContext.tsx` — `register(data: CreateUserDto)`:**
- Calls `authControllerRegister(data)` from `@/api/auth/auth.js`
- Same token-save → getProfile → mapToUser flow as `login`

**`AuthContext.tsx` — mount-time token validation (`initializeAuth`):**
- Reads stored token via `authStorage.getToken()`
- If token present, calls `authControllerGetProfile()` to validate and get fresh user data
- On success: saves fresh user to storage, hydrates context state
- On failure (token expired/invalid): calls `authStorage.clearAuth()`, state stays null

**`mapToUser(dto: UserResponseDto): User`:**
- Maps `UserResponseDto` (nullable `firstName`/`lastName`) to local `User` (non-nullable)
- Provides `''` as default for null name fields

**API Client (already complete in `services/api/client.ts`):**
- ✅ Authorization header interceptor
- ✅ 401 response handling (token expired)
- ✅ Redirect to login on auth failure

#### 1.3 Create Login Page ✅ Complete

**Files Created/Updated:**
- ✅ `src/features/auth/components/LoginForm.tsx` — form component
- ✅ `src/features/auth/components/LoginForm.css` — styles
- ✅ `src/features/auth/components/__TEST__/LoginForm.test.tsx` — 18 tests
- ✅ `src/pages/LoginPage.tsx` — page wrapper with branding
- ✅ `src/pages/LoginPage.css` — centered card layout

**Implementation summary:**

**`LoginForm.tsx`:**
- Email field (using shared `Input` component) with `type="email"` and autocomplete
- Password field with inline visibility toggle (👁/🙈) — custom layout for precise control
- "Remember me" checkbox (UI-only; persistent session is future work)
- Submit via `login(email, password)` from `useAuth()`, navigates to `/dashboard` on success
- "Forgot password?" button (placeholder — future work)
- "Sign up" link to `/register`

**Validation:**
- Email: required + valid format (`validators.email`)
- Password: required + min 8 characters (`validators.minLength`)
- Errors shown per-field; cleared as user types

**Error handling (`getApiErrorMessage`):**
- 401 / "Unauthorized" → "Email or password is incorrect."
- "Network Error" / "ECONNREFUSED" / "ERR_NETWORK" → "Unable to connect. Please check your connection."
- Generic → "Something went wrong. Please try again."
- Error banner shown with `role="alert"` above the form

**Loading state:**
- `isSubmitting` state disables all inputs and toggles Button to `isLoading` during API call
- Form re-enables after success or failure

**`LoginPage.tsx`:**
- Centred card (`max-width: 26rem`) on a grey background
- Displays `APP_NAME` as heading and "Sign in to your account" subtitle
- Wraps `LoginForm`

#### 1.4 Create Registration Page ✅ Complete

**Files Created:**
- ✅ `src/features/auth/components/RegisterForm.tsx` — form component
- ✅ `src/features/auth/components/RegisterForm.css` — styles
- ✅ `src/features/auth/components/__TEST__/RegisterForm.test.tsx` — 29 tests
- ✅ `src/pages/RegisterPage.tsx` — page wrapper with branding
- ✅ `src/pages/RegisterPage.css` — centered card layout (max-width 30rem)

**Implementation summary:**

**`RegisterForm.tsx`:**
- First Name + Last Name fields (optional, side by side via `grid-template-columns: 1fr 1fr`)
- Email field (required)
- Password field with inline visibility toggle — uses `validators.password()` for strength check (min 8, uppercase, lowercase, number)
- Confirm Password field with independent visibility toggle
- Terms & Conditions checkbox (required)
- Submit via `register(CreateUserDto)` from `useAuth()`, navigates to `/dashboard` on success
- Optional `firstName`/`lastName` only included in DTO when non-empty

**Validation:**
- Email: required + valid format
- Password: required + full strength check (min 8, uppercase, lowercase, number)
- Confirm Password: required + must match password
- Terms: must be checked
- Per-field errors cleared as user types

**Error handling (`getApiErrorMessage`):**
- 409 / "Conflict" → "An account with this email already exists."
- "Network Error" / "ECONNREFUSED" / "ERR_NETWORK" → "Unable to connect..."
- Generic → "Something went wrong. Please try again."

**`RegisterPage.tsx`:**
- Centred card (`max-width: 30rem`) matching LoginPage layout
- Displays `APP_NAME` as heading and "Create your account" subtitle

> _(Timezone and currency selectors deferred — optional fields, defaulting server-side)_

**Form Layout:**
```
┌─────────────────────────────────────────┐
│                                          │
│       Create Your Account                │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  First Name                        │ │
│  │  [________________________]        │ │
│  │                                    │ │
│  │  Last Name                         │ │
│  │  [________________________]        │ │
│  │                                    │ │
│  │  Email                             │ │
│  │  [________________________]        │ │
│  │                                    │ │
│  │  Password                          │ │
│  │  [________________________]  👁    │ │
│  │                                    │ │
│  │  Confirm Password                  │ │
│  │  [________________________]  👁    │ │
│  │                                    │ │
│  │  [ ] I agree to Terms & Conditions │ │
│  │                                    │ │
│  │  [    Create Account    ]          │ │
│  │                                    │ │
│  │  Already have an account? Sign in  │ │
│  └────────────────────────────────────┘ │
│                                          │
└─────────────────────────────────────────┘
```

**Validation Rules:**
- All fields required except timezone/currency
- Email: valid format, not already registered
- Password: min 8 chars, 1 uppercase, 1 lowercase, 1 number
- Confirm password: must match password
- Terms: must be checked

#### 1.5 Update Route Protection ✅ Complete

**Files Updated:**
- ✅ `src/routes/PrivateRoute.tsx` — uses `useAuth()` with `isLoading` + `isAuthenticated`
- ✅ `src/routes/PublicRoute.tsx` — uses `useAuth()` with `isLoading` + `isAuthenticated`
- ✅ `src/routes/index.tsx` — added `RegisterPage` lazy import and `/register` route
- ✅ `src/main.tsx` — wrapped `RouterProvider` with `AuthProvider`

**Implementation summary:**

**`PrivateRoute.tsx`:** Reads `{isAuthenticated, isLoading}` from `useAuth()`. Shows `<Loading size="large" />` spinner during auth initialization; redirects to `/login` when unauthenticated; renders children when authenticated.

**`PublicRoute.tsx`:** Same `isLoading` spinner pattern. Redirects to `/dashboard` if already authenticated; renders children (login/register) when not.

**`main.tsx`:** Added `<AuthProvider>` wrapping `<RouterProvider>` so `useAuth()` is accessible in all route guards and page components.

**`routes/index.tsx`:** Added `/register` route pointing to `RegisterPage` inside `PublicRoute`.

### Phase 1 Checklist

- [x] **Core:** AuthContext, login/register pages, form validation
- [x] **API Integration:** Auth service methods, token storage, API client interceptor
- [x] **State Management:** Auth context provider, useAuth hook
- [x] **Testing:** Login form, registration form, auth context, route protection
- [x] **Accessibility:** Keyboard navigation, ARIA labels, focus management
- [x] **Documentation:** Auth flow documented, types defined

### Validation Criteria

- User can register new account
- User can login with credentials
- JWT token stored in localStorage
- Token sent with protected API requests
- User automatically logged in on page refresh (if token valid)
- User redirected to login when token expires
- Protected routes require authentication
- Login/register pages not accessible when authenticated
- Form validation works correctly
- Error messages display appropriately

**Estimated Time:** 2-3 days

---

## Phase 2: User Profile Management ✅ **Complete**

**Priority:** HIGH - Core user functionality
**Backend Dependency:** Backend Phase 3 (Secure Users Module) ✅ Complete
**Timeline:** 2-3 days

### Goals
- Display user profile information
- Allow users to update their profile
- Implement account settings
- Handle account deletion

### Tasks

#### 2.1 Create User Profile Types & Services ✅ Complete

> ⚠️ **Orval note:** `userService.ts` is **not needed**. Orval generates `src/api/users/users.ts` with:
> - `usersControllerFindOne(id)` / `useUsersControllerFindOne(id)` — GET /users/:id
> - `usersControllerUpdate(id, updateUserDto)` / `useUsersControllerUpdate()` — PATCH /users/:id
> - `usersControllerRemove(id)` / `useUsersControllerRemove()` — DELETE /users/:id
>
> `UpdateUserRequest` is already generated as `UpdateUserDto` in `src/api/model/`. Import it directly.

**Files Created:**
- ✅ `src/features/users/types/user.types.ts`

**`user.types.ts`:**
```typescript
// Import generated DTO types from Orval directly where needed — do not redefine them:
// import type { UserResponseDto } from '@/api/model/userResponseDto.js';
// import type { UpdateUserDto } from '@/api/model/updateUserDto.js';

// Only define types that have no backend equivalent:
export type ProfileMode = 'view' | 'edit';
```

**API hooks available (from `src/api/users/users.ts`):**
- ✅ `useUsersControllerFindOne(id)` — GET /users/:id (self)
- ✅ `useUsersControllerUpdate()` — PATCH /users/:id
- ✅ `useUsersControllerRemove()` — DELETE /users/:id

#### 2.2 Create Profile Page ✅ Complete

**Files Created:**
- ✅ `src/pages/ProfilePage.tsx`
- ✅ `src/pages/ProfilePage.css`

**Also Updated:**
- ✅ `src/config/constants.ts` — added `PROFILE: '/profile'` to `APP_ROUTES`
- ✅ `src/routes/index.tsx` — added lazy-loaded `ProfilePage` behind `PrivateRoute`

**File:** `src/pages/ProfilePage.tsx`

**Features:**
- Display user information (read-only view)
- "Edit Profile" button to enter edit mode
- Edit form with inline editing
- Save/Cancel buttons in edit mode
- Show loading state during updates
- Success/error messages
- Account deletion section (dangerous zone)

**Profile Layout (View Mode):**
```
┌─────────────────────────────────────────────────────────────┐
│  My Profile                                   [Edit Profile] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Personal Information                                        │
│  ────────────────────────────────────────────────────────   │
│  First Name:        Sarah                                   │
│  Last Name:         Johnson                                 │
│  Email:             sarah.johnson@example.com               │
│                                                              │
│  Preferences                                                 │
│  ────────────────────────────────────────────────────────   │
│  Timezone:          America/New_York (EST)                  │
│  Currency:          USD ($)                                 │
│                                                              │
│  Account Information                                         │
│  ────────────────────────────────────────────────────────   │
│  Account Status:    ● Active                                │
│  Member Since:      January 15, 2026                        │
│  Last Login:        February 19, 2026 at 9:32 AM            │
│                                                              │
│  ══════════════════════════════════════════════════════════ │
│                                                              │
│  Danger Zone                                                 │
│  ────────────────────────────────────────────────────────   │
│  Delete Account                                              │
│  This action cannot be undone. All your data will be        │
│  permanently deleted.                                        │
│                                                              │
│  [Delete My Account]                                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Profile Layout (Edit Mode):**
```
┌─────────────────────────────────────────────────────────────┐
│  Edit Profile                            [Cancel]  [Save]    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Personal Information                                        │
│  ────────────────────────────────────────────────────────   │
│  First Name *                                                │
│  [Sarah                     ]                                │
│                                                              │
│  Last Name *                                                 │
│  [Johnson                   ]                                │
│                                                              │
│  Email (cannot be changed)                                   │
│  sarah.johnson@example.com                                   │
│                                                              │
│  Preferences                                                 │
│  ────────────────────────────────────────────────────────   │
│  Timezone                                                    │
│  [America/New_York          ▼]                              │
│                                                              │
│  Currency                                                    │
│  [USD                       ▼]                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 2.3 Create Profile Components ✅ Complete

**Files Created:**
- ✅ `src/features/users/utils/profile.utils.ts` — `TIMEZONES`, `TimezoneOption`, `formatDate`
- ✅ `src/features/users/components/ProfileView.tsx` — read-only profile view
- ✅ `src/features/users/components/ProfileEdit.tsx` — edit form
- ✅ `src/features/users/components/DeleteAccountModal.tsx` — portal modal with password confirmation
- ✅ `src/features/users/components/DeleteAccountModal.css` — modal overlay styles

**Also Updated:**
- ✅ `src/features/users/types/user.types.ts` — added `ProfileFormState`, `ProfileDisplayData`
- ✅ `src/pages/ProfilePage.tsx` — refactored to use extracted components; TIMEZONES/formatDate moved to utils

#### 2.4 Create Settings Page (Optional Enhancement)

**File:** `src/pages/SettingsPage.tsx`

**Features:**
- Tabbed interface:
  - Profile tab (embed ProfilePage)
  - Security tab (change password - future)
  - Notifications tab (email preferences - future)
  - Privacy tab (data export/delete)

### Phase 2 Checklist

- [x] **Core:** Profile view/edit, delete account modal
- [x] **API Integration:** User service methods, update profile, delete account
- [x] **State Management:** Update user in auth context after profile update
- [x] **Testing:** Profile components, edit form, delete confirmation
- [x] **Accessibility:** Focus management in edit mode, modal accessibility
- [x] **Documentation:** User profile flow documented

### Validation Criteria

- User can view their profile information
- User can edit first name, last name, timezone, currency
- Email cannot be changed (read-only)
- Changes save successfully and reflect immediately
- Success message shown after save
- Cancel button discards unsaved changes
- Delete account requires confirmation
- After deletion, user logged out and redirected
- Form validation works in edit mode
- Loading states during API calls

**Estimated Time:** 2-3 days

---

## Phase 3: Transactions UI ✅ **Complete** (Aligns with Backend Phase 4)

**Priority:** HIGH - Core business feature
**Backend Dependency:** Backend Phase 4 (Transactions Module) - In Development
**Timeline:** 4-5 days

### Goals
- Display transaction list with filtering
- Support pagination for large datasets
- Enable transaction CRUD operations
- Show transaction totals and summaries
- Implement date range filtering
- Support status filtering (active/inactive)

### Tasks

#### 3.1 Create Transaction Types & Services

> ⚠️ **Orval note:** `transactionService.ts` is **not needed**. Orval generates `src/api/transactions/transactions.ts` with typed React Query hooks for all transaction endpoints. Re-run `npm run generate:api` once the backend Transactions module exposes its Swagger docs to get fully typed hooks.
>
> Entity and DTO types (`Transaction`, `CreateTransactionDto`, `UpdateTransactionDto`) will also be generated in `src/api/model/`. Check there before defining them manually.

**Files to Create:**
- `src/features/transactions/types/transaction.types.ts` (frontend-specific types only)

**`transaction.types.ts`:**
```typescript
// Import generated DTO/entity types from Orval — do not redefine these:
// import type { CreateTransactionDto, UpdateTransactionDto } from '@/api/model';
// (Transaction entity type will be generated once backend exposes it)

// Frontend-specific types not covered by generated models:
export interface TransactionFilter {
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  accountId?: string;
  transactionType?: string;
  isActive?: boolean | 'all';
  page?: number;
  limit?: number;
}

export interface TransactionTotals {
  totalIncome: number;
  totalExpense: number;
  netTotal: number;
  startDate: string;
  endDate: string;
}
```

**API hooks to use (from `src/api/transactions/transactions.ts` once generated):**
- `useTransactionsControllerGetAll(params)` — GET /transactions
- `useTransactionsControllerFindOne(id)` — GET /transactions/:id
- `useTransactionsControllerCreate()` — POST /transactions
- `useTransactionsControllerUpdate()` — PATCH /transactions/:id
- `useTransactionsControllerToggleActive()` — PATCH /transactions/:id/toggle-active
- `useTransactionsControllerRemove()` — DELETE /transactions/:id

#### 3.2 Create Transactions Page

**File:** `src/pages/TransactionsPage.tsx`

**Features:**
- Transaction list table
- Filter controls (date range, category, status)
- Search by description
- Pagination controls
- "Add Transaction" button
- Summary card showing totals
- Responsive design (table → cards on mobile)

**Page Layout:**
```
┌───────────────────────────────────────────────────────────────┐
│  Transactions                                [+ Add Transaction]
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─────────────────────  Summary  ──────────────────────────┐│
│  │  Income: +$3,500.00    Expenses: -$1,234.56   Net: +$2,265│
│  └──────────────────────────────────────────────────────────┘│
│                                                                │
│  Filters: [📅 This Month ▼] [🏷️ All Categories ▼]           │
│           [Status: Active ▼] [🔍 Search...]   [Clear Filters] │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Date     Description          Amount    Category  Actions ││
│  ├──────────────────────────────────────────────────────────┤│
│  │ Feb 15   Starbucks Coffee     -$8.45    Food      ⋮       ││
│  │ Feb 14   Shell Gas Station   -$52.30    Transport ⋮       ││
│  │ Feb 14   Netflix             -$15.99    Entertain ⋮       ││
│  │ Feb 12   Salary Deposit    +$3,500.00   Income    ⋮       ││
│  │ ...                                                        ││
│  └──────────────────────────────────────────────────────────┘│
│                                                                │
│  Showing 1-50 of 245 transactions          [1] 2 3 4 5 >     │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

#### 3.3 Create Transaction Components

**Files to Create:**
- `src/features/transactions/components/TransactionList.tsx`
- `src/features/transactions/components/TransactionListItem.tsx`
- `src/features/transactions/components/TransactionFilters.tsx`
- `src/features/transactions/components/TransactionSummary.tsx`
- `src/features/transactions/components/TransactionModal.tsx`
- `src/features/transactions/components/TransactionForm.tsx`
- `src/features/transactions/components/TransactionActions.tsx`

**TransactionList Component:**
- Renders table/list of transactions
- Handles loading and empty states
- Responsive design (table → cards on mobile)
- Props: transactions, loading, onSelect

**TransactionListItem Component:**
- Single row/card for a transaction
- Color coding (red for expense, green for income)
- Shows: date, description, amount, category
- Click to view details
- Actions dropdown (edit, delete, toggle active)

**TransactionFilters Component:**
- Date range picker (preset + custom)
- Category dropdown (multi-select)
- Status filter (active/inactive/all)
- Search input for description
- "Apply" and "Clear" buttons
- Collapsible on mobile

**TransactionSummary Component:**
- Shows total income, expenses, net
- Color coded (green/red)
- Updates based on current filters
- Animated numbers (optional)

**TransactionModal Component:**
- Modal wrapper for add/edit/view
- Full-screen on mobile
- Includes TransactionForm when editing

**TransactionForm Component:**
- All transaction fields
- Validation (amount required, positive number, etc.)
- Date picker (defaults to today)
- Category/account dropdowns
- Notes textarea
- Type selector (income/expense/transfer)
- Save/Cancel buttons

**TransactionActions Component:**
- Dropdown menu (⋮) with actions:
  - Edit
  - Toggle Active/Inactive
  - Delete
- Confirmation for destructive actions

#### 3.4 Create Transaction Hooks

> ⚠️ **Orval note:** `useTransactions.ts` is **not needed**. Orval generates React Query hooks in `src/api/transactions/transactions.ts` that handle fetching, loading state, error state, and caching automatically. Use those directly in components or compose them within `useTransactionFilters`.

**Files to Create:**
- `src/features/transactions/hooks/useTransactionFilters.ts`
- `src/features/transactions/hooks/useTransactionForm.ts`

**useTransactionFilters Hook:**
- Manages filter UI state (date range, category, status, search)
- Provides filter change handlers
- Provides clear filters function
- Updates URL query params for shareable links
- Calls `useTransactionsControllerGetAll(filters)` from `src/api/transactions/transactions.ts`

**useTransactionForm Hook:**
- Form state management
- Validation logic
- Submit handler calling Orval mutation hooks (`useTransactionsControllerCreate`, `useTransactionsControllerUpdate`)
- Reset function

#### 3.5 Implement Pagination

**Files to Create:**
- `src/components/common/Pagination/Pagination.tsx`
- `src/components/common/Pagination/Pagination.test.tsx`

**Pagination Component:**
- Page numbers with ellipsis (1 ... 4 5 6 ... 10)
- Previous/Next buttons
- Configurable page size
- Jump to page input
- "Showing X-Y of Z" text

#### 3.6 Add Date Range Picker

**Files to Create:**
- `src/components/common/DateRangePicker/DateRangePicker.tsx`
- `src/components/common/DateRangePicker/DateRangePicker.test.tsx`

**DateRangePicker Component:**
- Preset ranges: Today, This Week, This Month, This Year
- Custom range with start/end dates
- Calendar popup
- Quick select buttons
- Clear button

### Phase 3 Checklist

- [x] **Core:** Transaction list, filters, CRUD modals, pagination
- [x] **API Integration:** All transaction service methods implemented
- [x] **State Management:** useTransactions hook, filter state management
- [x] **Testing:** Components, hooks, filtering logic, CRUD operations
- [x] **Accessibility:** Table accessibility, modal focus trap, keyboard shortcuts
- [x] **Documentation:** Transaction flow documented, types defined

### Validation Criteria

- User can view list of their transactions
- Pagination works with 50 items per page
- Date range filter updates list correctly
- Category filter works (multi-select)
- Status filter shows active/inactive/all
- Search filters by description (client-side)
- User can add new transaction
- User can edit existing transaction
- User can toggle transaction active/inactive
- User can delete transaction (with confirmation)
- Summary totals update based on filters
- Only active transactions counted in totals
- Original date preserved when updating date
- Loading states show during API calls
- Error messages display appropriately
- Mobile responsive design works
- Keyboard navigation functional

**Estimated Time:** 4-5 days

---

## Phase 4: Dashboard & Analytics (Future)

**Priority:** MEDIUM
**Backend Dependency:** Backend Phase 8 (Reports Module)
**Timeline:** 3-4 days

### Goals (High-Level)
- Overview of financial health
- Charts and visualizations
- Spending by category (pie/bar chart)
- Income vs expenses trends (line chart)
- Budget progress bars
- Quick stats cards

**Note:** Detailed requirements to be defined after Phase 3 completion.

---

## Phase 5: Categories Management (Future)

**Priority:** MEDIUM
**Backend Dependency:** Backend Phase 5 (Categories Module)
**Timeline:** 2-3 days

### Goals (High-Level)
- View category list
- Add/edit/delete categories
- Nested categories (subcategories)
- Color picker for categories
- Icon selector
- Category usage statistics

**Note:** Detailed requirements to be defined based on backend implementation.

---

## Phase 6: Accounts Management ✅ **Complete**

**Priority:** LOW
**Backend Dependency:** Backend Phase 6 (Accounts Module) ✅ Complete
**Timeline:** 2-3 days (actual: ~3 days)

### Goals
- ✅ View account list with balances, type, currency, institution
- ✅ Add/edit accounts via modal form (`AccountModal` + `AccountForm`)
- ✅ Soft-deactivate accounts (edit → toggle `isActive`); show/hide inactive toggle
- ✅ Delete account with confirmation dialog
- ✅ Account selector wired into `TransactionForm`, `TransactionFilters`, `TransactionList`, `TransactionListItem`
- ✅ Empty state and error boundary handled

### Implemented Files

```
src/features/accounts/
├── components/
│   ├── AccountForm.tsx           # create/edit form (name, type, currency, balance, institution)
│   ├── AccountForm.module.css
│   ├── AccountList.tsx           # table with show/hide inactive toggle
│   ├── AccountList.module.css
│   ├── AccountModal.tsx          # wraps AccountForm in a modal
│   ├── AccountModal.module.css
│   ├── AccountsErrorBoundary.tsx
│   ├── AccountsSummary.tsx       # total assets / liabilities chips
│   ├── AccountsSummary.module.css
│   └── __TEST__/                 # 115 tests across 6 files
├── hooks/
│   └── useAccountForm.ts
├── types/
│   └── account.types.ts
└── index.ts
src/pages/AccountsPage.tsx        # route: /accounts
```

### Cross-Feature Integration
- ✅ `TransactionForm` — `accountId` select wired in (uses `useGetAccounts`)
- ✅ `TransactionList` / `TransactionListItem` — Account column added, account name resolved
- ✅ `TransactionFilters` — `accountId` filter dropdown added
- ✅ Cross-feature TCs TC-45–TC-51 added to `test-plan/transactions/frontend.md`

### Phase 6 Checklist ✅ **COMPLETE**
- [x] Page component + route registered (`/accounts`)
- [x] Feature components / hooks / types created
- [x] Uses Orval-generated hooks (no manual fetch calls)
- [x] DTO types imported from `src/api/model/` (not redefined)
- [x] Dev server starts without errors
- [x] Page opens without blank screen
- [x] Zero TypeScript errors
- [x] Zero ESLint warnings
- [x] Unit tests: 115 accounts component tests + 43 cross-feature tests = **741 total** (39 files)
- [x] Code review complete; all critical fixes applied
- [x] Playwright E2E: 18 TCs, 18 pass, 0 fail, 0 console errors — `test-plan/accounts/frontend.md` + `frontend-report.md`

**Final commits:** `55043c0` (35 files, 698 tests), `1548783` (test quality fixes — typed factory functions, stale fixture, misleading comment; 741 tests)

---

## Phase 7: Transaction Import & Automated Sync UI

**Priority:** MEDIUM
**Backend Dependency:** Backend Phase 7 (Transaction Import & Automated Sync)
**Timeline:** 3-5 days

### Goals
- File upload UI for manual CSV/OFX imports
- Sync schedule management (create, enable/disable, run now)
- Live sync status via SSE stream
- MFA challenge modal (Path A — user is in the app)
- Standalone `/mfa` page (Path B — user arrives from push notification or email link)
- Web Push subscription + iOS Home Screen prompt
- Service worker for background push notifications

---

### Task 1: File Import UI

**Files:**
```
src/features/import/
├── components/
│   ├── FileImportDropzone.tsx    # drag-and-drop + click-to-browse; CSV and OFX/QFX only
│   ├── ImportSummary.tsx         # imported N, skipped N, errors list
│   └── index.ts
├── hooks/
│   └── useFileImport.ts          # wraps Orval mutation, handles multipart upload
└── types/
    └── (none — use Orval-generated types from src/api/model/)
src/pages/ImportPage.tsx          # route: /import
```

**Behaviour:**
- Accept `.csv`, `.ofx`, `.qfx` via drag-and-drop or file picker
- Show file name + size preview before upload; allow cancel
- On submit → `POST /transactions/import` (multipart/form-data)
- Display `ImportSummary` when complete: imported count, skipped count, error list
- Link "View transactions" to `/transactions` on success

**Phase 7 Task 1 Checklist:**
- [ ] `FileImportDropzone` with drag-over highlight and file type validation
- [ ] Upload progress indicator
- [ ] `ImportSummary` component displays all three counts
- [ ] Error rows listed with line number + reason
- [ ] Accessible (keyboard triggerable, ARIA live region for summary)
- [ ] Unit tests for dropzone validation, summary rendering

---

### Task 2: Sync Schedule Management UI

**Files:**
```
src/features/sync/
├── components/
│   ├── SyncScheduleList.tsx      # table/card list of user's schedules
│   ├── SyncScheduleForm.tsx      # create/edit: bank picker (GET /scrapers), cron input, account picker
│   ├── CronInput.tsx             # human-readable cron builder (daily, weekly, custom)
│   └── index.ts
├── hooks/
│   └── useSyncSchedules.ts       # wraps Orval queries/mutations
└── types/
    └── (none — use Orval-generated types)
src/pages/SyncPage.tsx            # route: /sync
```

**Behaviour:**
- `GET /scrapers` populates bank picker — frontend never hardcodes bank names
- Cron builder shows presets (Daily 8am, Weekly Monday 8am) + "Custom" free-text
- Validate cron string client-side before submit (basic regex; server validates definitively)
- Enable/disable toggle calls `PATCH /sync-schedules/:id`
- "Run Now" button → `POST /sync-schedules/:id/run-now` → opens live sync status panel (Task 3)
- Delete with confirmation dialog

**Phase 7 Task 2 Checklist:**
- [ ] Bank picker populated dynamically from `GET /scrapers`
- [ ] Cron presets + custom input
- [ ] Enable/disable toggle with optimistic update
- [ ] Delete confirmation dialog
- [ ] "Run Now" triggers sync and opens status panel
- [ ] Unit tests for form validation, cron presets, bank picker

---

### Task 3: Live Sync Status & MFA Modal (SSE — Path A)

This covers the experience when the user is actively in the app when a sync runs.

**Files:**
```
src/features/sync/components/
├── SyncStatusPanel.tsx           # floating panel or inline; shows current sync state
├── SyncStatusStep.tsx            # individual step row (icon + label + spinner/check/error)
└── MfaModal.tsx                  # modal with code input; shown on mfa_required SSE event
src/hooks/
└── useSyncStream.ts              # opens EventSource to GET /sync-schedules/:id/stream,
                                  # maps SSE events → state machine
```

**SSE event → UI state machine:**
```
logging_in  →  "Logging in to [Bank]…"           (spinner)
mfa_required → MfaModal opens automatically      (code input)
importing   →  "Importing transactions…"          (spinner)
complete    →  "Done — imported N transactions"   (✅, auto-close after 3s)
failed      →  "Sync failed: <reason>"            (❌, dismiss button)
```

**`useSyncStream` hook:**
```typescript
// Opens an EventSource; returns { status, mfaPrompt, submitMfa, error }
// On mfa_required: sets status='mfa_required', captures prompt string
// submitMfa(code) → POST /sync-schedules/:id/mfa-response { code }
// Closes EventSource on complete/failed
```

**`MfaModal` behaviour:**
- Opens automatically when `status === 'mfa_required'`
- Shows the `mfaPrompt` string from the SSE event (e.g. "Enter your card reader code")
- Code input (numeric, max 8 chars) + Submit button
- Disabled while submitting; shows spinner on submit
- Does **not** have a Cancel — closing it would stall the worker
- On submit → `POST .../mfa-response { code }` → modal closes, status returns to spinner

**Phase 7 Task 3 Checklist:**
- [ ] `useSyncStream` opens/closes EventSource correctly; handles reconnect on network drop
- [ ] All five SSE states render correctly in `SyncStatusPanel`
- [ ] `MfaModal` opens automatically on `mfa_required`; cannot be dismissed
- [ ] Code submission disables input + shows spinner
- [ ] `complete` state auto-closes panel and invalidates the transactions React Query cache
- [ ] Unit tests for state machine transitions
- [ ] Accessibility: focus moves into modal when it opens; focus trap; ARIA live region for status updates

---

### Task 4: Standalone MFA Page (Path B — push notification / email)

When the user is **not** in the app, the push notification or email link opens `/mfa?session=<token>` — a minimal page that does not require full app navigation.

**Files:**
```
src/pages/MfaPage.tsx             # route: /mfa  (public — no auth guard needed, token is the credential)
src/features/sync/components/
└── MfaCodeForm.tsx               # shared between MfaModal (Task 3) and MfaPage (Task 4)
```

**Behaviour:**
- Reads `?session=<token>` from the URL
- Shows bank name + prompt if available (can be embedded in the token or fetched via `GET /sync-session/:token`)
- Same `MfaCodeForm` component as the modal — code input + Submit
- On submit → `POST /sync-schedules/:id/mfa-response { sessionId: token, code }`
- Success state: "Code submitted — your sync will continue automatically. You can close this page."
- Expired/invalid token state: "This link has expired or already been used."
- No navigation links — this page is intentionally minimal

**Phase 7 Task 4 Checklist:**
- [ ] Reads `session` query param; shows error for missing/invalid token
- [ ] Submits to mfa-response endpoint; shows success/error result
- [ ] `MfaCodeForm` is the same component used in `MfaModal` (no duplication)
- [ ] Page is accessible without being logged in (no `ProtectedRoute` wrapper)
- [ ] Unit tests for token parsing, success state, expired state

---

### Task 5: Web Push Subscription & Service Worker

**Files:**
```
public/sw.js                      # service worker (plain JS — not bundled by Vite)
src/features/notifications/
├── components/
│   └── PushPermissionBanner.tsx  # "Enable notifications" prompt shown after first login
├── hooks/
│   └── usePushNotifications.ts   # permission request → subscribe → POST /push/subscribe
└── index.ts
```

**`public/sw.js`** — handles push events in the background:
```javascript
self.addEventListener('push', (event) => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification('Finance Tracker', {
      body: data.body,               // e.g. "CIBC sync needs your MFA code"
      icon: '/icons/icon-192.png',
      data: { url: data.url },       // e.g. "/mfa?session=xyz"
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

**`usePushNotifications` hook:**
```typescript
// 1. navigator.serviceWorker.register('/sw.js')
// 2. Notification.requestPermission()
// 3. pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY })
// 4. POST /push/subscribe with the PushSubscription object
// 5. On logout → DELETE /push/subscribe
```

**`PushPermissionBanner`:**
- Shown once after first login if `Notification.permission === 'default'`
- On iOS: also shows "Add to Home Screen" instruction (detected via `navigator.standalone === false && /iPhone|iPad/.test(navigator.userAgent)`)
- Dismissible; preference stored in localStorage so it doesn't reappear
- iOS < 16.4 (push not supported): banner text changes to "Add to Home Screen to receive sync notifications via push"

**Phase 7 Task 5 Checklist:**
- [ ] Service worker registered on app load
- [ ] `PushPermissionBanner` shown once after login (not on every page load)
- [ ] Permission granted → subscribe → `POST /push/subscribe`
- [ ] iOS Home Screen instruction shown on compatible Safari
- [ ] Banner correctly hidden on iOS < 16.4 when push is not supported
- [ ] On logout → `DELETE /push/subscribe` and unsubscribe from `pushManager`
- [ ] `VITE_VAPID_PUBLIC_KEY` env var consumed by the hook
- [ ] Unit tests for banner display conditions; mock `Notification` API

---

### Phase 7 Checklist

Apply Standard Checklist (Core Implementation, API Integration, State Management, Testing, Accessibility, Documentation) plus:

- [ ] **Service Worker:** `public/sw.js` handles push events and notification click
- [ ] **SSE:** `useSyncStream` opens `EventSource`, maps all 5 event types to UI state
- [ ] **MFA Modal:** auto-opens on `mfa_required`; focus trap; cannot dismiss mid-sync
- [ ] **Standalone MFA Page:** `/mfa?session=<token>` works without auth; handles expired token
- [ ] **Push Banner:** shown once after login; iOS detection correct
- [ ] **`MfaCodeForm`:** single component shared between modal and standalone page
- [ ] Route `/mfa` added to router (public, no auth guard)
- [ ] Route `/sync` added to router (protected)
- [ ] Route `/import` added to router (protected)
- [ ] `VITE_VAPID_PUBLIC_KEY` documented in `.env.example`

### Validation Criteria

- File import: can upload CSV and OFX; summary shows correct counts; errors listed
- Sync schedule: bank picker populated from API; can create/edit/delete/enable-disable
- Live sync: "Run Now" shows real-time steps; MFA modal opens automatically when required
- MFA modal: code submission unpauses sync; modal closes on success
- Standalone MFA page: opening `/mfa?session=<token>` from email/push works without logging in
- Push notification: permission banner appears after login; granting permission subscribes correctly
- Service worker: push notification received in background opens `/mfa` page on tap
- iOS 16.4+ PWA: push notification works when app is added to Home Screen
- iOS < 16.4: banner shows Home Screen instruction instead of push prompt

**Estimated Time:** 3-5 days

---

## Development Best Practices

### Component Architecture
- Small, focused components with single responsibility
- Shared components in `components/common/`
- Feature-specific components in `features/[feature]/components/`
- Composition over inheritance
- Props interface for all components

### State Management
- Local state (useState) for UI-only state
- Context API for auth and global user state
- Consider Zustand if state management gets complex
- Custom hooks for reusable stateful logic
- Avoid prop drilling (max 2-3 levels)

### API Integration
- Orval generates typed React Query hooks in `src/api/[feature]/` from the OpenAPI spec — use these instead of manual service files
- Orval generates all DTO/entity types in `src/api/model/` — import from there, do not duplicate in feature `types/` files
- Regenerate with `npm run generate:api` (live backend) or `npm run generate:api:file` (snapshot)
- Centralized API client in `services/api/client.ts` — all generated calls route through it automatically via `src/services/api/mutator.ts`
- `services/api/endpoints.ts` kept as URL reference constants only
- Proper error handling with user-friendly messages
- Loading states via React Query (`isPending`, `isError`)
- Request cancellation handled automatically by React Query + AbortSignal

### Testing Strategy
- Test user-facing behavior, not implementation
- Use accessibility-first queries
- Test loading and error states
- Mock API calls with MSW or vi.fn()
- Aim for >80% coverage on business logic
- E2E tests for critical flows (Playwright/Cypress - future)

### Styling Guidelines
- CSS Modules for component styles
- Shared variables in `styles/variables.css`
- Design tokens (colors, spacing, typography)
- Mobile-first responsive design
- Dark mode support (future consideration)

### Performance Optimization
- React.memo for expensive components
- useMemo/useCallback where appropriate
- Code splitting with React.lazy
- Virtual scrolling for large lists (future)
- Debounce search inputs
- Optimize bundle size

### Accessibility Checklist
- [ ] Semantic HTML (nav, main, aside, etc.)
- [ ] ARIA labels on interactive elements
- [ ] Keyboard navigation (Tab, Enter, Escape)
- [ ] Focus indicators visible
- [ ] Color contrast ratios (WCAG AA)
- [ ] Screen reader tested
- [ ] Form error announcements
- [ ] Skip navigation links

### Security Best Practices
- [ ] Never store sensitive data in localStorage (only JWT)
- [ ] Sanitize user inputs
- [ ] Implement CSRF protection
- [ ] Use HTTPS in production
- [ ] Content Security Policy headers
- [ ] XSS prevention (React handles most)

---

## Quick Start Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test
npm run test:watch
npm run test:ui
npm run test:coverage

# Type checking
npm run typecheck

# Linting
npm run lint

# Build for production
npm run build
npm run preview
```

---

## Phase N: MCP App UIs

**Goal:** Build interactive mini-application UIs that run inside AI chat interfaces (Claude, VS Code Copilot, ChatGPT) as sandboxed iframes, served over MCP by the backend.

**Depends on:** Backend Phase 9 (MCP Server)

### Core Implementation
- [ ] Install `@modelcontextprotocol/ext-apps` — official MCP Apps React SDK
- [ ] Create `vite.mcp-apps.config.ts` — dedicated Vite config that outputs self-contained HTML to `packages/backend/src/mcp/apps/`
- [ ] Add `build:mcp-apps` script to `package.json`
- [ ] Create `src/mcp-apps/spending-chart/` — spending breakdown by category (bar/pie chart)
- [ ] Create `src/mcp-apps/transaction-list/` — transaction list with inline filtering
- [ ] Create `src/mcp-apps/budget-overview/` — budget vs. actuals progress bars
- [ ] Integrate `useApp`, `useHostStyles`, `applyHostStyleVariables` in each app
- [ ] Ensure all assets (JS, CSS, fonts) are inlined — no external CDN references

### API Integration
- [ ] Each app receives data via MCP `tool-result` `postMessage` events (not HTTP)
- [ ] Use `registerAppTool` to bind tool call results to component state
- [ ] Handle loading / empty / error states for all tool-result shapes

### State Management
- [ ] Apps are stateless at startup — all data arrives via `postMessage` from host
- [ ] Local UI state only (React `useState`) — no Redux, no TanStack Query

### Testing
- [ ] Vitest unit tests for each app component (mock `useApp` hook)
- [ ] Test that `applyHostStyleVariables` is called with host styles
- [ ] Test all data display cases: loaded, empty, error
- [ ] Build test: confirm `npm run build:mcp-apps` produces valid HTML files
- [ ] Manual test in VS Code Copilot with MCP server running

### Accessibility
- [ ] Semantic HTML in charts (table fallback for screen readers)
- [ ] Aria labels on interactive controls
- [ ] Host colour variables used via CSS custom properties (no hardcoded colours)

### Documentation
- [ ] [MCP Apps Setup — full guide](../../backend/docs/mcp-apps-setup.md)
- [ ] Update component README with build instructions

---

## Milestones

- **Milestone 1:** Authentication UI complete (login, register, protected routes)
- **Milestone 2:** User profile management complete
- **Milestone 3:** Transaction CRUD and filtering complete (MVP)
- **Milestone 4:** Dashboard and analytics
- **Milestone 5:** Categories and accounts management
- **Milestone 6:** Import & sync UI complete (file upload, sync schedules, SSE live status, MFA modal + standalone page, Web Push)

**Total Estimated Time (Phases 1-3):** 8-11 days

---

## Technical Debt & Future Enhancements

### Phase 1-3 Improvements
- [ ] Implement token refresh mechanism
- [ ] Add "Remember me" functionality
- [ ] Password strength indicator
- [ ] Email verification flow
- [ ] Forgot password flow *(button is rendered but disabled in `LoginForm.tsx` pending this feature)*
- [ ] Two-factor authentication
- [ ] OAuth providers (Google, GitHub)

### UX Enhancements
- [ ] Dark mode toggle
- [ ] Keyboard shortcuts guide
- [ ] Onboarding tour for new users
- [ ] Bulk operations (select multiple transactions)
- [ ] Export transactions to CSV
- [ ] Drag-and-drop file upload (CSV/OFX — covered in Phase 7)
- [ ] Undo/redo functionality

### Performance
- [ ] Implement virtual scrolling for transaction list
- [ ] Extend service worker for offline support (service worker added in Phase 7)
- [ ] Optimize images and assets
- [ ] Lazy load routes
- [ ] Add request caching strategy

### Developer Experience
- [ ] Storybook for component documentation
- [ ] E2E tests with Playwright
- [ ] Visual regression testing
- [ ] CI/CD pipeline
- [ ] Automated accessibility testing

---

## Dependencies Between Phases

```
Backend Phase 2 (Auth) ────────► Frontend Phase 1 (Auth UI)
                                        │
Backend Phase 3 (Users) ───────► Frontend Phase 2 (Profile)
                                        │
Backend Phase 4 (Transactions) ─► Frontend Phase 3 (Transactions UI)
                                        │
Backend Phase 7 (Import/Sync) ──► Frontend Phase 7 (Import & Sync UI)
     (scraper, SSE, MFA,               ├─ File import dropzone
      web push, notifications)         ├─ Sync schedule management
                                       ├─ SSE live status + MFA modal
                                       ├─ Standalone /mfa page
                                       └─ Service worker + push subscription

Backend Phase 9 (MCP Server) ──► Frontend Phase N (MCP App UIs)
```

**Note:** Frontend phases can start 1-2 days after corresponding backend phase is complete and deployed to development environment.
