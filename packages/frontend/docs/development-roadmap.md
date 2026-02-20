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
- [ ] API client methods in `services/api/endpoints.ts`
- [ ] Feature-specific service functions in `features/[feature]/services/`
- [ ] Error handling with user-friendly messages
- [ ] Request/response TypeScript types
- [ ] Loading and error states

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

## Phase 1: Authentication UI ✅ **READY TO START**

**Priority:** CRITICAL - Required before all protected features
**Backend Dependency:** Backend Phase 2 (Authentication Module) ✅ Complete
**Timeline:** 2-3 days

### Goals
- Implement login and registration flows
- Set up authentication context and token management
- Create protected route wrapper
- Handle authentication errors gracefully

### Tasks

#### 1.1 Setup Authentication Context & Types

**Files to Create:**
- `src/features/auth/types/auth.types.ts`
- `src/features/auth/context/AuthContext.tsx`
- `src/features/auth/hooks/useAuth.ts`
- `src/services/storage/authStorage.ts`

**Implementation Details:**

**`auth.types.ts`:**
```typescript
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  timezone: string;
  currency: string;
  isActive: boolean;
  createdAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  timezone?: string;
  currency?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
}
```

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

#### 1.2 Implement Auth API Service

**Files to Create/Update:**
- `src/features/auth/services/authService.ts`
- `src/services/api/endpoints.ts` (update)

**`authService.ts` Methods:**
- `login(email, password)` - POST /auth/login
- `register(data)` - POST /auth/register
- `getCurrentUser()` - GET /auth/me
- `logout()` - clear local state (no API call needed)

**API Client Updates:**
- Add Authorization header interceptor
- Handle 401 responses (token expired)
- Redirect to login on auth failure

#### 1.3 Create Login Page

**File:** `src/pages/LoginPage.tsx`

**Features:**
- Email and password input fields
- "Remember me" checkbox (optional)
- "Forgot password?" link (placeholder)
- "Sign up" link to registration
- Form validation (email format, required fields)
- Show loading state during login
- Display error messages from API
- Redirect to dashboard after successful login

**Form Layout:**
```
┌─────────────────────────────────────────┐
│                                          │
│          Finance Tracker                 │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  Email                             │ │
│  │  [________________________]        │ │
│  │                                    │ │
│  │  Password                          │ │
│  │  [________________________]  👁    │ │
│  │                                    │ │
│  │  [ ] Remember me                   │ │
│  │                                    │ │
│  │  [      Sign In      ]             │ │
│  │                                    │ │
│  │  Forgot password?                  │ │
│  │                                    │ │
│  │  Don't have an account? Sign up    │ │
│  └────────────────────────────────────┘ │
│                                          │
└─────────────────────────────────────────┘
```

**Validation Rules:**
- Email: required, valid email format
- Password: required, min 8 characters

**Error Handling:**
- Invalid credentials: "Email or password is incorrect"
- Network error: "Unable to connect. Please check your connection."
- Generic error: "Something went wrong. Please try again."

#### 1.4 Create Registration Page

**File:** `src/pages/RegisterPage.tsx`

**Features:**
- Email, password, confirm password fields
- First name, last name fields
- Timezone selector (optional, defaults to browser timezone)
- Currency selector (optional, defaults to USD)
- Terms and conditions checkbox
- Form validation
- Show loading state during registration
- Display error messages (email already exists, etc.)
- Redirect to dashboard after successful registration

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

#### 1.5 Update Route Protection

**Files to Update:**
- `src/routes/PrivateRoute.tsx`
- `src/routes/PublicRoute.tsx`
- `src/routes/index.tsx`

**PrivateRoute Component:**
- Check if user is authenticated
- Show loading spinner while checking auth
- Redirect to /login if not authenticated
- Render children if authenticated

**PublicRoute Component:**
- Redirect to /dashboard if already authenticated
- Render children (login/register) if not authenticated

**Route Configuration:**
```typescript
<Route path="/" element={<PublicRoute><HomePage /></PublicRoute>} />
<Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
<Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
<Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
// ... other protected routes
```

### Phase 1 Checklist

- [ ] **Core:** AuthContext, login/register pages, form validation
- [ ] **API Integration:** Auth service methods, token storage, API client interceptor
- [ ] **State Management:** Auth context provider, useAuth hook
- [ ] **Testing:** Login form, registration form, auth context, route protection
- [ ] **Accessibility:** Keyboard navigation, ARIA labels, focus management
- [ ] **Documentation:** Auth flow documented, types defined

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

## Phase 2: User Profile Management

**Priority:** HIGH - Core user functionality
**Backend Dependency:** Backend Phase 3 (Secure Users Module) ✅ Complete
**Timeline:** 2-3 days

### Goals
- Display user profile information
- Allow users to update their profile
- Implement account settings
- Handle account deletion

### Tasks

#### 2.1 Create User Profile Types & Services

**Files to Create:**
- `src/features/users/types/user.types.ts`
- `src/features/users/services/userService.ts`

**`user.types.ts`:**
```typescript
export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  timezone?: string;
  currency?: string;
}

export interface UserProfile extends User {
  // Additional profile-specific fields if needed
}
```

**`userService.ts` Methods:**
- `getCurrentUser()` - GET /users/:id (self)
- `updateProfile(userId, data)` - PATCH /users/:id
- `deleteAccount(userId)` - DELETE /users/:id

#### 2.2 Create Profile Page

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

#### 2.3 Create Profile Components

**Files to Create:**
- `src/features/users/components/ProfileView.tsx`
- `src/features/users/components/ProfileEdit.tsx`
- `src/features/users/components/DeleteAccountModal.tsx`

**ProfileView Component:**
- Display user data in read-only format
- "Edit" button to switch to edit mode
- Clean, organized layout

**ProfileEdit Component:**
- Editable form fields
- Validation (same as registration)
- Save/Cancel buttons
- Disable email editing (not allowed)

**DeleteAccountModal Component:**
- Confirmation modal
- "Are you sure?" messaging
- Password confirmation field
- "Delete My Account" button (red/danger color)
- Cannot be undone warning

#### 2.4 Create Settings Page (Optional Enhancement)

**File:** `src/pages/SettingsPage.tsx`

**Features:**
- Tabbed interface:
  - Profile tab (embed ProfilePage)
  - Security tab (change password - future)
  - Notifications tab (email preferences - future)
  - Privacy tab (data export/delete)

### Phase 2 Checklist

- [ ] **Core:** Profile view/edit, delete account modal
- [ ] **API Integration:** User service methods, update profile, delete account
- [ ] **State Management:** Update user in auth context after profile update
- [ ] **Testing:** Profile components, edit form, delete confirmation
- [ ] **Accessibility:** Focus management in edit mode, modal accessibility
- [ ] **Documentation:** User profile flow documented

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

## Phase 3: Transactions UI (Aligns with Backend Phase 4)

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

**Files to Create:**
- `src/features/transactions/types/transaction.types.ts`
- `src/features/transactions/services/transactionService.ts`

**`transaction.types.ts`:**
```typescript
export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense',
  TRANSFER = 'transfer',
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  description: string;
  notes?: string;
  categoryId?: string;
  accountId?: string;
  transactionType: TransactionType;
  date: string;
  originalDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransactionRequest {
  amount: number;
  description: string;
  notes?: string;
  categoryId?: string;
  accountId?: string;
  transactionType: TransactionType;
  date: string;
}

export interface UpdateTransactionRequest {
  amount?: number;
  description?: string;
  notes?: string;
  categoryId?: string;
  accountId?: string;
  date?: string;
  isActive?: boolean;
}

export interface TransactionFilter {
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  accountId?: string;
  transactionType?: TransactionType;
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

export interface TransactionListResponse {
  transactions: Transaction[];
  total: number;
  page: number;
  limit: number;
}
```

**`transactionService.ts` Methods:**
- `getTransactions(filters)` - GET /transactions with query params
- `getTransaction(id)` - GET /transactions/:id
- `createTransaction(data)` - POST /transactions
- `updateTransaction(id, data)` - PATCH /transactions/:id
- `toggleActive(id)` - PATCH /transactions/:id/toggle-active
- `deleteTransaction(id)` - DELETE /transactions/:id
- `getTotals(startDate, endDate)` - GET /transactions/totals
- `getMonthlyTotals(year, month)` - GET /transactions/totals/:year/:month

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

**Files to Create:**
- `src/features/transactions/hooks/useTransactions.ts`
- `src/features/transactions/hooks/useTransactionFilters.ts`
- `src/features/transactions/hooks/useTransactionForm.ts`

**useTransactions Hook:**
```typescript
export function useTransactions(filters?: TransactionFilter) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = async () => {
    // Implementation
  };

  const createTransaction = async (data: CreateTransactionRequest) => {
    // Implementation
  };

  const updateTransaction = async (id: string, data: UpdateTransactionRequest) => {
    // Implementation
  };

  const deleteTransaction = async (id: string) => {
    // Implementation
  };

  const toggleActive = async (id: string) => {
    // Implementation
  };

  return {
    transactions,
    total,
    loading,
    error,
    fetchTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    toggleActive,
  };
}
```

**useTransactionFilters Hook:**
- Manages filter state (date range, category, status, search)
- Provides filter change handlers
- Provides clear filters function
- Updates URL query params for shareable links

**useTransactionForm Hook:**
- Form state management
- Validation logic
- Submit handler
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

- [ ] **Core:** Transaction list, filters, CRUD modals, pagination
- [ ] **API Integration:** All transaction service methods implemented
- [ ] **State Management:** useTransactions hook, filter state management
- [ ] **Testing:** Components, hooks, filtering logic, CRUD operations
- [ ] **Accessibility:** Table accessibility, modal focus trap, keyboard shortcuts
- [ ] **Documentation:** Transaction flow documented, types defined

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

## Phase 6: Accounts Management (Future)

**Priority:** LOW
**Backend Dependency:** Backend Phase 6 (Accounts Module)
**Timeline:** 2-3 days

### Goals (High-Level)
- View account list
- Add/edit/delete accounts
- Account balance tracking
- Transfer between accounts
- Account transaction history

**Note:** Detailed requirements to be defined based on backend implementation.

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
- Centralized API client in `services/api/client.ts`
- Endpoint definitions in `services/api/endpoints.ts`
- Feature-specific services in `features/[feature]/services/`
- Proper error handling with user-friendly messages
- Loading states for all async operations
- Request cancellation for cleanup

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

## Milestones

- **Milestone 1:** Authentication UI complete (login, register, protected routes)
- **Milestone 2:** User profile management complete
- **Milestone 3:** Transaction CRUD and filtering complete (MVP)
- **Milestone 4:** Dashboard and analytics
- **Milestone 5:** Categories and accounts management

**Total Estimated Time (Phases 1-3):** 8-11 days

---

## Technical Debt & Future Enhancements

### Phase 1-3 Improvements
- [ ] Implement token refresh mechanism
- [ ] Add "Remember me" functionality
- [ ] Password strength indicator
- [ ] Email verification flow
- [ ] Forgot password flow
- [ ] Two-factor authentication
- [ ] OAuth providers (Google, GitHub)

### UX Enhancements
- [ ] Dark mode toggle
- [ ] Keyboard shortcuts guide
- [ ] Onboarding tour for new users
- [ ] Bulk operations (select multiple transactions)
- [ ] Export transactions to CSV
- [ ] Import transactions from CSV
- [ ] Drag-and-drop file upload
- [ ] Undo/redo functionality

### Performance
- [ ] Implement virtual scrolling for transaction list
- [ ] Add service worker for offline support
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
```

**Note:** Frontend phases can start 1-2 days after corresponding backend phase is complete and deployed to development environment.
