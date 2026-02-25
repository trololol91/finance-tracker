# Development Roadmap - Finance Tracker Backend

This document outlines the implementation order for building the Finance Tracker backend with multi-user support.

## Design Decision

**Architecture:** Multi-user from the start
**Reason:** Financial data requires strict user isolation. Retrofitting multi-user later is extremely difficult and error-prone.

## Current State

- ✅ Docker + PostgreSQL setup complete
- ✅ NestJS scaffolding in place
- ⚠️ Users module exists (stub with mock data)
- ⚠️ Transactions module exists (stub with mock data, no user association)
- ❌ No database integration
- ❌ No authentication
- ❌ No ORM configured

## Implementation Order

### Standard Checklist for Each Phase

**Every phase should complete these tasks to maintain quality and consistency:**

#### ✅ **Core Implementation**
- [ ] Business logic implemented in service layer
- [ ] Controller with proper HTTP methods and status codes
- [ ] DTOs with class-validator decorators
- [ ] All imports use path aliases (no relative imports)

#### ✅ **Documentation**
- [ ] Swagger decorators on all endpoints (`@ApiOperation`, `@ApiResponse`, `@ApiParam`, `@ApiBody`)
- [ ] Swagger decorators on all DTOs (`@ApiProperty` with descriptions and examples)
- [ ] Added to appropriate `@ApiTags` group
- [ ] Test endpoints in Swagger UI

#### ✅ **Testing**
- [ ] Unit tests for service (business logic)
- [ ] Unit tests for controller (endpoint behavior)
- [ ] Test error cases (404, 400, 409, etc.)
- [ ] All tests passing (`npm test`)
- [ ] No linting errors (`npm run lint`)

#### ✅ **Security & Validation**
- [ ] Input validation on all DTOs
- [ ] Response DTOs exclude sensitive fields
- [ ] Authentication guards applied (if needed)
- [ ] User data scoped by userId (if applicable)
- [ ] SQL injection prevention (parameterized queries)

#### ✅ **Database**
- [ ] Prisma schema updated (if needed)
- [ ] Migration created (`npx prisma migrate dev`)
- [ ] Migration tested on fresh database
- [ ] Foreign key relationships correct

---

### Phase 1: Database Setup & Users Module ✅ **COMPLETE**

**Priority:** CRITICAL - Foundation for everything else

**Tasks:**
1. **~~Choose and Configure ORM~~** ✅
   - ✅ Prisma installed and configured
   - ✅ Database connection configured
   - ✅ Connected to Docker PostgreSQL

2. **~~Define User Model in Prisma Schema~~** ✅ (`prisma/schema.prisma`)
   - ✅ User model created with all fields
   - ✅ UserRole enum (USER, ADMIN)
   - ✅ Migration created and applied
   - ✅ Prisma Client generated (types available in `@generated/prisma`)
   - **Note:** No entity files needed - Prisma generates types automatically

3. **~~Create User DTOs~~** ✅ (`src/users/dto/`)
   - ✅ `create-user.dto.ts` - email, password, firstName, lastName, timezone, currency
   - ✅ `update-user.dto.ts` - partial update fields (firstName, lastName, timezone, currency, isActive)
   - ✅ `user-response.dto.ts` - excludes passwordHash and deletedAt
   - ✅ All with proper class-validator decorators
   - ✅ All with Swagger `@ApiProperty` decorators

4. **~~Implement Users Service~~** ✅ (`src/users/users.service.ts`)
   - ✅ `create(createUserDto)` - hash password with bcrypt (saltRounds: 10), save to DB
   - ✅ `findOne(id)` - get user by ID (excludes soft-deleted users)
   - ✅ `findByEmail(email)` - for authentication (excludes soft-deleted users)
   - ✅ `update(id, updateUserDto)` - update user info
   - ✅ `remove(id)` - soft delete (sets deletedAt timestamp and isActive=false)

5. **~~Implement Users Controller~~** ✅ (`src/users/users.controller.ts`)
   - ✅ POST `/users` - register new user (public for now)
   - ✅ GET `/users/:id` - get user profile
   - ✅ PATCH `/users/:id` - update user
   - ✅ DELETE `/users/:id` - soft delete user
   - ✅ All endpoints return UserResponseDto (excludes sensitive fields)
   - ✅ Proper HTTP status codes (201 for create, 204 for delete)
   - ✅ Full Swagger documentation

**Testing & Documentation:** ✅
- ✅ 22 unit tests (15 service, 7 controller) - all passing
- ✅ Swagger UI configured with JWT auth support
- ✅ All endpoints documented and testable in Swagger

**Deployment & Security:** ✅
- ✅ Production-ready Dockerfile with Prisma support
- ✅ docker-compose.yml with auto-migrations
- ✅ Secure environment variable configuration (no defaults)
- ✅ DEPLOYMENT.md with security checklist

**Validation:**
- ✅ Test user creation via API
- ✅ Verify password is hashed in database
- ✅ Confirm email uniqueness constraint works

**Estimated Time:** 1-2 days

---

### Phase 2: Authentication Module ✅ **COMPLETE**

**Priority:** HIGH - Required before securing any endpoints

**Tasks:**
1. **~~Install Dependencies~~** ✅
   ```bash
   npm install @nestjs/passport @nestjs/jwt passport passport-jwt
   npm install -D @types/passport-jwt
   ```

2. **~~Create Auth Module~~** ✅ (`src/auth/`)
   - ✅ `auth.module.ts`
   - ✅ `auth.service.ts`
   - ✅ `auth.controller.ts`
   - ✅ `strategies/jwt.strategy.ts`
   - ✅ `guards/jwt-auth.guard.ts`
   - ✅ `decorators/current-user.decorator.ts`

3. **~~Implement Auth Service~~** ✅ (`src/auth/auth.service.ts`)
   - ✅ `register(createUserDto)` - create user + return JWT
   - ✅ `login(email, password)` - validate credentials + return JWT
   - ✅ `validateUser(email, password)` - check password hash
   - ✅ `generateToken(user)` - create JWT with user.id payload

4. **~~Create JWT Strategy~~** ✅ (`src/auth/strategies/jwt.strategy.ts`)
   - ✅ Extract JWT from Authorization header
   - ✅ Validate token signature
   - ✅ Load user from database
   - ✅ Attach user to request object

5. **~~Create Guards & Decorators~~** ✅
   - ✅ `jwt-auth.guard.ts` - protect routes requiring authentication
   - ✅ `current-user.decorator.ts` - extract user from request
   - Optional: `roles.guard.ts` - for future role-based access

6. **~~Implement Auth Controller~~** ✅ (`src/auth/auth.controller.ts`)
   - ✅ POST `/auth/register` - create new user account
   - ✅ POST `/auth/login` - authenticate and get JWT
   - ✅ GET `/auth/me` - get current user info (protected)

7. **~~Environment Configuration~~** ✅
   - ✅ JWT_SECRET already in .env
   - ✅ Configure token expiration (e.g., 7 days)
   - Set up refresh token strategy (optional for v1)

**Phase 2 Checklist:** (Use Standard Checklist above)
- [x] **Core:** Auth service, controller, DTOs, guards, decorators implemented
- [x] **Documentation:** Swagger decorators on auth endpoints, test login/register in Swagger UI
- [x] **Testing:** Unit tests for auth service and controller (token generation, validation, login flow)
- [x] **Security:** JWT properly configured, tokens validated, passwords compared with bcrypt
- [x] **Database:** No schema changes needed (uses existing User model)

**Testing & Documentation:** ✅
- ✅ 29 unit tests (14 service, 10 controller, 5 strategy) - all passing
- ✅ Swagger decorators on all endpoints with examples
- ✅ JWT auth support via "Authorize" button

**Validation:**
- ✅ Register new user and receive JWT
- ✅ Login with credentials and receive JWT
- ✅ Access protected route with valid JWT
- ✅ Verify invalid JWT is rejected
- ✅ Test @CurrentUser() decorator
- ✅ Test in Swagger UI with "Authorize" button

**Estimated Time:** 1-2 days

---

### Phase 3: Secure Users Module ✅ **COMPLETE**

**Priority:** HIGH - Lock down user endpoints

**Tasks:**
1. **~~Add Guards to Users Controller~~** ✅
   - ✅ Protect all endpoints except initial registration
   - ✅ Use `@UseGuards(JwtAuthGuard)`
   - ✅ Add `@CurrentUser()` to endpoints
   - ✅ POST /users remains public (registration)
   - ✅ GET, PATCH, DELETE require JWT authentication
   - ✅ All protected endpoints return 401 without token
   - ✅ Swagger updated with `@ApiBearerAuth()` decorator

2. **~~Implement Ownership Guards~~** ✅
   - ✅ Users can only view/update their own profile
   - ✅ Created `OwnershipGuard` to check `user.id === params.id`
   - ✅ Admin role exception implemented (future enhancement ready)
   - ✅ Applied to GET, PATCH, DELETE endpoints
   - ✅ Returns 403 Forbidden when accessing other users' resources
   - ✅ 8 tests for OwnershipGuard (100% coverage)

3. **~~Update Users Service~~** ✅
   - ✅ All methods require authenticated user ID parameter
   - ✅ Service enforces ownership validation (defense-in-depth)
   - ✅ `findOne(authenticatedUserId, targetUserId)` - verifies ownership
   - ✅ `update(authenticatedUserId, targetUserId, dto)` - verifies ownership
   - ✅ `remove(authenticatedUserId, targetUserId)` - verifies ownership
   - ✅ Throws ForbiddenException when users try to access other users' data
   - ✅ 3 additional tests for ownership enforcement at service layer
   - ✅ 85 total tests passing (18 users service, 7 users controller)

**Phase 3 Checklist:** ✅ **COMPLETE**
- [x] **Core:** Guards implemented and applied to Users controller, service layer enforces ownership
- [x] **Documentation:** Swagger updated with `@ApiBearerAuth()` decorator
- [x] **Testing:** Unit tests for ownership validation, unauthorized access attempts (85 tests passing)
- [x] **Security:** All endpoints protected except public registration, ownership verified at guard and service layers
- [x] **Database:** No changes needed

**Validation:** ✅
- ✅ Cannot access other users' profiles (enforced at guard and service layers)
- ✅ Cannot update other users' data (ForbiddenException thrown)
- ✅ Unauthenticated requests are rejected (401 Unauthorized)
- ✅ Ownership violations return 403 Forbidden
- ✅ Swagger "Authorize" button works correctly
- ✅ 97.43% code coverage maintained

**Estimated Time:** 0.5-1 day → **Actual: 1 day**

---

### Phase 4: Transactions Module with User Context

**Priority:** HIGH - Core business logic

**Tasks:**
1. **Define Transaction Model in Prisma Schema** (`prisma/schema.prisma`)
   ```typescript
   - id: UUID (primary key)
   - user_id: UUID (foreign key to users, not null)
   - amount: decimal(10,2) (not null)
   - description: string
   - notes: string (optional, for additional comments/details)
   - category_id: UUID (foreign key to categories, optional)
   - account_id: UUID (foreign key to accounts, optional)
   - transaction_type: enum ('income', 'expense', 'transfer')
   - date: timestamp (transaction date, can be updated)
   - original_date: timestamp (initial transaction date, set on creation, immutable)
   - is_active: boolean (default true, false to exclude from calculations)
   - created_at: timestamp
   - updated_at: timestamp
   ```

2. **Create Transaction DTOs** (`src/transactions/dto/`)
   - `create-transaction.dto.ts` - amount, description, notes, category, account, type, date
   - `update-transaction.dto.ts` - partial updates (amount, description, notes, category, account, date, is_active)
   - `transaction-response.dto.ts` - with category/account details, includes date, original_date, is_active
   - `transaction-filter.dto.ts` - date ranges, categories, amounts, type, is_active filter
   - `transaction-totals-response.dto.ts` - total income, total expense, net total, date range

3. **Implement Transactions Service** (`src/transactions/transactions.service.ts`)
   - All methods require `userId` parameter
   - `create(userId, createDto)` - create transaction for user (is_active defaults to true, original_date set from date)
   - `findAll(userId, filters)` - get user's transactions with filters (default: active only)
   - `findOne(userId, transactionId)` - get specific transaction
   - `update(userId, transactionId, updateDto)` - update transaction (including notes and is_active, can update date but original_date remains unchanged)
   - `toggleActive(userId, transactionId)` - toggle is_active status
   - `remove(userId, transactionId)` - delete transaction (permanent)
   - `getTotals(userId, startDate, endDate)` - aggregation query for date range (active transactions only)
   - `getMonthlyTotals(userId, year, month)` - convenience method, calls getTotals with month boundaries

4. **Implement Transactions Controller** (`src/transactions/transactions.controller.ts`)
   - Protect all routes with `@UseGuards(JwtAuthGuard)`
   - Use `@CurrentUser()` to get authenticated user
   - POST `/transactions` - create transaction
   - GET `/transactions` - list with filters (supports ?is_active=true/false/all)
   - GET `/transactions/:id` - get specific transaction
   - GET `/transactions/totals` - get totals by date range (?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD)
   - GET `/transactions/totals/:year/:month` - monthly totals (convenience endpoint)
   - PATCH `/transactions/:id` - update transaction (including notes and is_active)
   - PATCH `/transactions/:id/toggle-active` - toggle is_active status
   - DELETE `/transactions/:id` - delete transaction permanently

5. **Add Ownership Validation**
   - Verify transaction belongs to current user
   - Return 404 if transaction doesn't exist or belongs to another user
   - Never expose other users' data

**Phase 4 Checklist:** (Use Standard Checklist above)
- [ ] **Core:** Transaction service, controller, DTOs implemented with user scoping
- [ ] **Documentation:** Swagger decorators on all endpoints, test in Swagger UI with auth token
- [ ] **Testing:** Unit tests for CRUD, filtering, ownership validation, aggregation queries
- [ ] **Security:** All endpoints protected with JwtAuthGuard, userId scoping enforced
- [ ] **Database:** Prisma schema updated, migration created with user_id foreign key

**Validation:**
- Create transaction as authenticated user with notes
- List only own transactions (active by default)
- Filter by is_active status (true/false/all)
- Cannot access other users' transactions
- Filters work correctly (date range, category, amount, status)
- Update/delete only own transactions
- Toggle transaction active status
- Update transaction date - original_date remains unchanged
- Response includes both date and original_date fields
- Inactive transactions excluded from monthly totals
- Get totals for custom date range (active only)
- Monthly totals endpoint works as convenience method
- Totals calculate correctly (income, expense, net)

**Estimated Time:** 2-3 days

---

### Phase 5: Categories Module

**Priority:** MEDIUM - Needed for transaction organization

**Tasks:**
1. **Define Categories Model in Prisma Schema** (`prisma/schema.prisma`)
   ```typescript
   - id: UUID
   - user_id: UUID (foreign key)
   - name: string
   - type: enum ('income', 'expense')
   - color: string (hex color for UI)
   - icon: string (icon identifier)
   - parent_category_id: UUID (for subcategories)
   - created_at: timestamp
   - updated_at: timestamp
   ```

2. **Implement Categories CRUD**
   - User-scoped categories
   - Optional: System default categories + user custom
   - Support for nested categories

3. **Update Transactions**
   - Add category relationship
   - Validate category belongs to same user

**Phase 5 Checklist:** Apply Standard Checklist (Core, Documentation, Testing, Security, Database)

**Estimated Time:** 1-2 days

---

### Phase 6: Accounts Module

**Priority:** LOW - Track multiple accounts

**Tasks:**
1. **Define Accounts Model in Prisma Schema** (`prisma/schema.prisma`)
   ```typescript
   - id: UUID
   - user_id: UUID
   - name: string (e.g., "Chase Checking")
   - type: enum ('checking', 'savings', 'credit', 'investment', 'cash')
   - balance: decimal(10,2)
   - currency: string (default 'USD')
   - institution: string (optional)
   - account_number: string (encrypted, optional)
   - created_at: timestamp
   - updated_at: timestamp
   ```

2. **Implement Accounts CRUD**
   - User-scoped accounts
   - Track current balance
   - Update balance on transaction create/update/delete

3. **Update Transactions**
   - Add account relationship
   - Support transfers between accounts

**Phase 6 Checklist:** Apply Standard Checklist (Core, Documentation, Testing, Security, Database)

**Estimated Time:** 1-2 days

---

### Phase 7: Budgets Module

**Priority:** LOW - Premium feature

**Tasks:**
1. **Define Budgets Model in Prisma Schema** (`prisma/schema.prisma`)
   ```typescript
   - id: UUID
   - user_id: UUID
   - category_id: UUID (optional)
   - amount: decimal(10,2)
   - period: enum ('monthly', 'quarterly', 'yearly')
   - start_date: timestamp
   - end_date: timestamp (optional)
   - created_at: timestamp
   - updated_at: timestamp
   ```

2. **Implement Budget Tracking**
   - Compare actual spending vs budget
   - Alert when approaching/exceeding limits
   - Historical budget performance

**Phase 7 Checklist:** Apply Standard Checklist (Core, Documentation, Testing, Security, Database)

**Estimated Time:** 2-3 days

---

### Phase 8: Reports Module

**Priority:** LOW - Analytics and insights

**Tasks:**
1. **Implement Report Endpoints**
   - Monthly spending by category
   - Income vs expenses trends
   - Account balances over time
   - Net worth calculation
   - Budget performance

2. **Create Visualization Data**
   - Format data for charts
   - Aggregate by time periods
   - Calculate percentages and trends

**Phase 8 Checklist:** Apply Standard Checklist (Core, Documentation, Testing, Security, Database)

**Estimated Time:** 2-3 days

---

## Development Best Practices

### Database Migrations
- Create migration for each schema change
- Never modify existing migrations
- Test migrations on fresh database
- Document breaking changes

### Testing Strategy
- Unit tests for services (business logic)
- Integration tests for controllers (API endpoints)
- E2E tests for critical user flows
- Test with multiple users to ensure isolation

### Security Checklist
- [ ] All endpoints protected with authentication
- [ ] User data properly scoped by user_id
- [ ] Passwords hashed with bcrypt (cost factor 10-12)
- [ ] JWT secrets in environment variables
- [ ] Input validation on all DTOs
- [ ] SQL injection prevention (ORM parameterized queries)
- [ ] Rate limiting on auth endpoints
- [ ] CORS configured properly

### Code Standards
- Use path aliases (`@users/`, `@transactions/`, etc.)
- Return type annotations on all functions
- Explicit `.js` extensions on imports (ESM)
- Follow NestJS module pattern
- Use dependency injection
- Write comprehensive error messages

---

## Quick Start Commands

```bash
# Install ORM (choose one)
npm install @nestjs/typeorm typeorm pg           # TypeORM
npm install @prisma/client && npm install -D prisma  # Prisma

# Install authentication packages
npm install @nestjs/passport @nestjs/jwt passport passport-jwt bcrypt
npm install -D @types/passport-jwt @types/bcrypt

# Start development database
docker-compose up -d postgres

# Run migrations (TypeORM)
npm run migration:run

# Start development server
npm run start:dev

# Run tests
npm test
npm run test:watch
```

---

## Milestones

- **Milestone 1:** Users + Auth working (can register/login)
- **Milestone 2:** Transactions CRUD with user association
- **Milestone 3:** Categories + Accounts + Budgets
- **Milestone 4:** Reports and analytics
- **Milestone 5:** Production deployment

**Total Estimated Time:** 2-3 weeks for Phases 1-4 (MVP)

---

## Future Enhancements

- [ ] Forgot password / password reset flow (`POST /auth/forgot-password` — send reset email with time-limited token; `POST /auth/reset-password` — validate token and set new password)
- [ ] Recurring transactions
- [ ] Transaction import (CSV, bank APIs)
- [ ] Multi-currency support
- [ ] Shared accounts (household mode)
- [ ] Mobile app support
- [ ] Email notifications
- [ ] Two-factor authentication
- [ ] Email change workflow with verification (send confirmation to old and new email, require password)
- [ ] OAuth providers (Google, Apple)
- [ ] Receipt image upload
- [ ] AI-powered categorization
- [ ] Financial goals tracking
- [ ] Investment portfolio tracking
