# Frontend Directory Structure

This document outlines the directory structure and organization principles for the finance-tracker frontend application.

## Overview

The frontend is built with **React 19**, **TypeScript**, **Vite**, and follows a **feature-based architecture** with strict path alias usage. The structure mirrors the backend's modular organization while adhering to React best practices.

## Root Structure

```
packages/frontend/
├── public/                 # Static assets served directly
├── src/                    # Source code
├── docs/                   # Documentation
├── index.html             # HTML entry point
├── vite.config.ts         # Vite configuration with path aliases
├── vitest.config.ts       # Vitest test configuration
├── tsconfig.json          # Base TypeScript config
├── tsconfig.app.json      # App-specific TypeScript config with path aliases
├── tsconfig.node.json     # Node-specific TypeScript config
├── eslint.config.js       # ESLint configuration (no relative imports rule)
├── package.json           # Dependencies and scripts
└── README.md              # Frontend documentation
```

## Source Directory (`src/`)

### Core Application Files

```
src/
├── main.tsx               # Application entry point, renders App with Router
├── App.tsx                # Root component with route configuration
├── App.css                # Global application styles
└── index.css              # Base CSS resets and variables
```

### Configuration (`src/config/`)

Environment variables and application constants.

```
config/
├── env.ts                 # Environment variable configuration with validation
└── constants.ts           # Application-wide constants (API URLs, timeouts, etc.)
```

**Purpose**: Centralized configuration management with type safety.

**Guidelines**:
- Use `env.ts` for environment-specific settings
- Use `constants.ts` for hardcoded application values
- Export typed objects for autocomplete support
- Never commit sensitive values (use .env files)

### Routes (`src/routes/`)

Routing configuration and guards.

```
routes/
├── index.tsx              # Main route definitions with lazy loading
├── PrivateRoute.tsx       # Authentication guard for protected routes
└── PublicRoute.tsx        # Guard for public-only routes (redirects if authenticated)
```

**Purpose**: Centralized routing with code splitting and authentication.

**Guidelines**:
- Use lazy loading for all page components
- Implement route guards for authentication/authorization
- Use React Router 7 with data APIs
- Keep route definitions flat and maintainable

### Pages (`src/pages/`)

Route-level components (thin, mainly composition).

```
pages/
├── HomePage.tsx           # Landing page
├── LoginPage.tsx          # Authentication page
├── DashboardPage.tsx      # Main dashboard (protected)
├── TransactionsPage.tsx   # Transaction management
├── CategoriesPage.tsx     # Category management
├── AccountsPage.tsx       # Account management
├── BudgetsPage.tsx        # Budget management
├── ReportsPage.tsx        # Financial reports
├── ScraperPage.tsx        # Bank scraper interface
└── NotFoundPage.tsx       # 404 error page
```

**Purpose**: Top-level route components that compose features and layouts.

**Guidelines**:
- Keep pages thin - delegate to feature components
- Handle route-level data fetching
- Compose layout components (Header, Footer, etc.)
- Use path aliases for all imports
- Return type: `React.JSX.Element`

### Components (`src/components/`)

Reusable UI components organized by type.

#### Common Components (`src/components/common/`)

Shared, reusable UI primitives.

```
components/common/
├── Button/
│   ├── Button.tsx         # Button component with variants
│   ├── Button.css         # Button styles
│   ├── Button.test.tsx    # Component tests
│   └── index.ts           # Re-export
├── Input/
│   ├── Input.tsx
│   ├── Input.css
│   ├── Input.test.tsx
│   └── index.ts
├── Card/
│   ├── Card.tsx
│   ├── Card.css
│   ├── Card.test.tsx
│   └── index.ts
├── Loading/
│   ├── Loading.tsx
│   ├── Loading.css
│   ├── Loading.test.tsx
│   └── index.ts
└── index.ts               # Barrel export for all common components
```

**Purpose**: Design system primitives used throughout the application.

**Guidelines**:
- Each component in its own directory
- Include `.tsx`, `.css`, `.test.tsx`, and `index.ts`
- Write comprehensive tests (accessibility, interactions, variants)
- Use TypeScript interfaces for props
- Return type: `React.JSX.Element`
- Export from parent `index.ts`

#### Layout Components (`src/components/layout/`)

Application layout structure.

```
components/layout/
├── Header/
│   ├── Header.tsx         # Top navigation bar
│   ├── Header.css
│   ├── Header.test.tsx
│   └── index.ts
├── Footer/               # (Planned) Footer component
├── Sidebar/              # (Planned) Sidebar navigation
└── index.ts
```

**Purpose**: Consistent layout across pages.

**Guidelines**:
- Handle navigation and global UI elements
- Responsive design considerations
- Include accessibility features (skip links, ARIA labels)

#### Form Components (`src/components/forms/`)

Form-specific reusable components.

```
components/forms/
├── FormField/            # (Planned) Form field wrapper with label and error
├── FormGroup/            # (Planned) Form section grouping
└── index.ts
```

**Purpose**: Complex form patterns and validation UI.

**Guidelines**:
- Integrate with React Hook Form
- Display validation errors
- Accessible form controls

### Features (`src/features/`)

Feature-based modules mirroring backend structure.

```
features/
├── auth/
│   ├── components/        # Auth-specific components
│   ├── hooks/             # Auth hooks (useAuth, useLogin)
│   ├── services/          # Auth API calls
│   └── types/             # Auth type definitions
├── transactions/
│   ├── components/        # TransactionList, TransactionForm, etc.
│   ├── hooks/             # useTransactions, useTransactionForm
│   ├── services/          # Transaction API calls
│   └── types/             # Transaction types
├── categories/
│   ├── components/
│   ├── hooks/
│   ├── services/
│   └── types/
├── accounts/
│   ├── components/
│   ├── hooks/
│   ├── services/
│   └── types/
├── budgets/
│   ├── components/
│   ├── hooks/
│   ├── services/
│   └── types/
├── reports/
│   ├── components/
│   ├── hooks/
│   ├── services/
│   └── types/
└── scraper/
    ├── components/
    ├── hooks/
    ├── services/
    └── types/
```

**Purpose**: Encapsulate feature-specific business logic and UI.

**Guidelines**:
- Mirror backend module structure
- Keep features isolated and self-contained
- `components/`: Feature-specific React components
- `hooks/`: Custom hooks for feature logic
- `services/`: API calls and business logic
- `types/`: TypeScript interfaces and types
- Export public API from feature's `index.ts`

### Services (`src/services/`)

Application-wide services and integrations.

#### API Service (`src/services/api/`)

HTTP client and API endpoints.

```
services/api/
├── client.ts              # Axios instance with interceptors
├── endpoints.ts           # API endpoint definitions
└── index.ts
```

**Purpose**: Centralized API communication.

**Guidelines**:
- `client.ts`: Configure Axios with base URL, auth tokens, interceptors
- `endpoints.ts`: Type-safe endpoint definitions
- Handle errors consistently
- Implement request/response transformations
- Auto-inject authentication tokens

#### Storage Service (`src/services/storage/`)

Browser storage abstractions.

```
services/storage/
├── localStorage.ts        # LocalStorage wrapper with type safety
└── index.ts
```

**Purpose**: Type-safe browser storage.

**Guidelines**:
- Wrap localStorage/sessionStorage APIs
- Serialize/deserialize with type safety
- Handle storage errors gracefully
- Use for auth tokens, user preferences, cache

### Hooks (`src/hooks/`)

Shared custom React hooks.

```
hooks/
├── useDebounce.ts        # (Planned) Debounce hook
├── useLocalStorage.ts    # (Planned) LocalStorage hook with state
├── useMediaQuery.ts      # (Planned) Responsive design hook
└── index.ts
```

**Purpose**: Reusable React hooks for common patterns.

**Guidelines**:
- Prefix with `use`
- Include TypeScript generics where appropriate
- Write unit tests for hooks
- Document hook behavior and parameters

### Types (`src/types/`)

Shared TypeScript type definitions.

```
types/
├── common.types.ts        # Common types (User, ApiResponse, etc.)
├── api.types.ts           # API request/response types
└── index.ts               # Barrel export
```

**Purpose**: Shared type definitions across features.

**Guidelines**:
- Use `interface` for object shapes
- Use `type` for unions, intersections, utilities
- Export from `index.ts`
- Keep feature-specific types in feature directories

### Utilities (`src/utils/`)

Pure utility functions.

```
utils/
├── formatters.ts          # Format dates, currency, numbers
├── formatters.test.ts     # Formatters tests (11 tests)
├── validators.ts          # Validation functions
├── validators.test.ts     # Validators tests (19 tests)
├── helpers.ts             # General helper functions
├── helpers.test.ts        # Helpers tests (11 tests)
├── constants.ts           # Utility constants
└── index.ts
```

**Purpose**: Pure, testable utility functions.

**Guidelines**:
- Keep functions pure (no side effects)
- Write comprehensive unit tests
- Use TypeScript strict mode
- Document complex logic with JSDoc

### Store (`src/store/`)

State management (planned).

```
store/
├── slices/               # Redux slices or Zustand stores
├── hooks.ts              # Typed store hooks
└── index.ts
```

**Purpose**: Global state management.

**Guidelines**:
- Consider if needed (React Query may suffice)
- Use Zustand for simplicity or Redux Toolkit for complex state
- Keep business logic in services, not store

### Styles (`src/styles/`)

Global styles and theme.

```
styles/
├── variables.css         # (Planned) CSS variables
├── theme.css             # (Planned) Theme definitions
└── utilities.css         # (Planned) Utility classes
```

**Purpose**: Design system styles.

**Guidelines**:
- Use CSS variables for theming
- Create utility classes for spacing, typography
- Keep component styles in component directories

### Test Setup (`src/test/`)

Testing configuration.

```
test/
└── setup.ts              # Vitest setup with @testing-library/jest-dom
```

**Purpose**: Global test configuration.

**Guidelines**:
- Configure testing library matchers
- Set up global mocks
- Configure jsdom environment

### Assets (`src/assets/`)

Static assets imported in code.

```
assets/
├── images/               # Images imported in components
├── icons/                # SVG icons
└── fonts/                # Custom fonts
```

**Purpose**: Assets processed by Vite.

**Guidelines**:
- Use `public/` for assets served as-is
- Use `assets/` for assets imported in code
- Optimize images before committing

## Path Aliases

### Configured Aliases (12 total)

```typescript
{
  '@/': './src/',
  '@components/': './src/components/',
  '@common/': './src/components/common/',
  '@layout/': './src/components/layout/',
  '@forms/': './src/components/forms/',
  '@features/': './src/features/',
  '@pages/': './src/pages/',
  '@services/': './src/services/',
  '@hooks/': './src/hooks/',
  '@utils/': './src/utils/',
  '@types/': './src/types/',
  '@config/': './src/config/',
}
```

### Usage Rules

1. **ALWAYS use path aliases** - relative imports are forbidden by ESLint
2. **Include `.js` extensions** on imports (ESM requirement, even for `.ts` files)
3. **Prefer specific aliases** over generic `@/`

### Examples

```typescript
// ✅ CORRECT
import { Button } from '@common/Button';
import { useTransactions } from '@features/transactions/hooks/useTransactions.js';
import { formatCurrency } from '@utils/formatters.js';
import { API_BASE_URL } from '@config/env.js';

// ❌ WRONG - Relative imports
import { Button } from '../components/common/Button';
import { useTransactions } from '../../features/transactions/hooks/useTransactions';

// ❌ WRONG - Missing .js extension
import { formatCurrency } from '@utils/formatters';
```

## File Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `TransactionList.tsx` |
| Hooks | camelCase with `use` prefix | `useTransactions.ts` |
| Services | camelCase with `Service` suffix | `transactionService.ts` |
| Utilities | camelCase | `formatters.ts`, `validators.ts` |
| Types | camelCase with `.types.ts` suffix | `transaction.types.ts` |
| Tests | Same as file with `.test.tsx` or `.spec.ts` | `Button.test.tsx`, `formatters.test.ts` |
| Styles | Same as component with `.css` | `Button.css` |

## Module Organization Patterns

### Component Module Structure

```
ComponentName/
├── ComponentName.tsx      # Component implementation
├── ComponentName.css      # Component styles
├── ComponentName.test.tsx # Component tests
└── index.ts               # Re-export
```

**index.ts** pattern:
```typescript
export { ComponentName } from './ComponentName.js';
export type { ComponentNameProps } from './ComponentName.js';
```

### Feature Module Structure

```
feature-name/
├── components/
│   ├── FeatureList/
│   ├── FeatureForm/
│   └── index.ts
├── hooks/
│   ├── useFeature.ts
│   ├── useFeatureList.ts
│   └── index.ts
├── services/
│   ├── featureService.ts
│   └── index.ts
├── types/
│   ├── feature.types.ts
│   └── index.ts
└── index.ts               # Public API
```

**Feature's index.ts** pattern:
```typescript
// Re-export public components
export { FeatureList, FeatureForm } from './components/index.js';

// Re-export public hooks
export { useFeature, useFeatureList } from './hooks/index.js';

// Re-export public types
export type { Feature, FeatureFormData } from './types/index.js';
```

## Import Order

```typescript
// 1. External dependencies
import React from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// 2. Internal path aliases (alphabetical by alias)
import { Button } from '@common/Button';
import { API_BASE_URL } from '@config/env.js';
import { useTransactions } from '@features/transactions/hooks/useTransactions.js';
import { formatCurrency } from '@utils/formatters.js';

// 3. Type imports (if not inline)
import type { Transaction } from '@features/transactions/types/transaction.types.js';

// 4. Styles (last)
import './ComponentName.css';
```

## Testing Strategy

### Test File Organization

- **Unit Tests**: `*.test.ts` for utilities, services, hooks
- **Component Tests**: `*.test.tsx` for React components
- **E2E Tests**: Separate `e2e/` directory (planned)

### Testing Patterns

**Component Tests**:
```typescript
// ✅ Use accessibility-first queries
getByRole('button', { name: /submit/i })
getByLabelText(/email address/i)

// ✅ Test user behavior
await user.click(button);
await user.type(input, 'test value');

// ✅ Assert on user-facing output
expect(screen.getByText(/success/i)).toBeInTheDocument();
```

**Utility Tests**:
```typescript
// ✅ Arrange-Act-Assert pattern
describe('formatCurrency', () => {
  it('should format positive numbers with currency symbol', () => {
    // Arrange
    const amount = 1234.56;
    
    // Act
    const result = formatCurrency(amount);
    
    // Assert
    expect(result).toBe('$1,234.56');
  });
});
```

## Development Workflow

### Creating a New Feature

1. **Create feature directory structure**:
   ```bash
   mkdir -p src/features/feature-name/{components,hooks,services,types}
   touch src/features/feature-name/index.ts
   ```

2. **Define types** in `types/feature-name.types.ts`

3. **Create service** in `services/featureNameService.ts` with API calls

4. **Create hooks** in `hooks/useFeatureName.ts` with business logic

5. **Create components** in `components/` with tests

6. **Create page** in `src/pages/FeatureNamePage.tsx`

7. **Add route** in `src/routes/index.tsx`

8. **Write tests** for all new code

### Adding a New Component

1. **Create component directory**: `src/components/common/ComponentName/`

2. **Create files**:
   - `ComponentName.tsx` - Component with `React.JSX.Element` return type
   - `ComponentName.css` - Styles
   - `ComponentName.test.tsx` - Tests
   - `index.ts` - Re-export

3. **Export from parent**: Add to `src/components/common/index.ts`

4. **Write comprehensive tests**: Accessibility, interactions, variants

## Code Style Guidelines

### TypeScript

- **Strict mode**: All files use strict TypeScript
- **Return types**: Required for all functions
- **Component return type**: `React.JSX.Element`
- **Type imports**: Use `import type { ... }` for types
- **Prefer interfaces**: For object shapes, types for unions

### React

- **Functional components**: No class components
- **Hooks**: Follow rules of hooks
- **Props destructuring**: In function signature
- **Event handlers**: Inline for simple, separate function for complex

### CSS

- **Component-scoped**: Keep styles in component directory
- **BEM naming**: Optional but consistent
- **CSS variables**: Use for theme values
- **Mobile-first**: Responsive design from small to large

## Best Practices

### Performance

- **Code splitting**: Lazy load pages and heavy features
- **Memoization**: Use `useMemo` and `useCallback` judiciously
- **Virtualization**: For long lists (react-window)
- **Image optimization**: Use WebP, lazy loading

### Accessibility

- **Semantic HTML**: Use proper elements (`<button>`, `<nav>`, etc.)
- **ARIA labels**: When semantic HTML insufficient
- **Keyboard navigation**: All interactive elements
- **Focus management**: Visible focus indicators

### Security

- **Input validation**: Both client and server
- **XSS prevention**: Sanitize user content
- **Auth tokens**: Store in httpOnly cookies or secure storage
- **HTTPS**: Enforce in production

### Error Handling

- **Error boundaries**: Catch React errors
- **API errors**: Display user-friendly messages
- **Loading states**: Show feedback during async operations
- **Validation**: Client-side for UX, server-side for security

## Environment Configuration

### Environment Variables

Create `.env` files for environment-specific configuration:

```bash
# .env.development
VITE_API_BASE_URL=http://localhost:3000/api
VITE_APP_NAME=Finance Tracker (Dev)

# .env.production
VITE_API_BASE_URL=https://api.financetracker.com
VITE_APP_NAME=Finance Tracker
```

**Access in code**:
```typescript
// src/config/env.ts
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  appName: import.meta.env.VITE_APP_NAME,
} as const;
```

## Build and Deployment

### Scripts

```json
{
  "dev": "vite",                    // Development server
  "build": "tsc && vite build",     // Production build
  "preview": "vite preview",        // Preview production build
  "test": "vitest",                 // Run tests
  "test:watch": "vitest --watch",   // Watch mode
  "test:ui": "vitest --ui",         // Interactive UI
  "test:coverage": "vitest --coverage", // Coverage report
  "lint": "eslint .",               // Lint code
  "type-check": "tsc --noEmit"      // Type checking
}
```

### Build Output

```
dist/
├── index.html              # Entry HTML
├── assets/
│   ├── index-[hash].js    # Bundled JavaScript
│   └── index-[hash].css   # Bundled CSS
└── [public files]         # Static assets from public/
```

## API Client Generation (Orval)

The frontend uses **Orval** to auto-generate typed React Query hooks and DTO types from the backend's OpenAPI spec. The generated output lives in `src/api/` and should **never be edited manually**.

### Generated Files

```
src/api/
├── auth/
│   └── auth.ts            # useAuthControllerLogin, useAuthControllerRegister, etc.
├── users/
│   └── users.ts           # useUsersControllerGetMe, useUsersControllerUpdate, etc.
├── transactions/
│   └── transactions.ts    # useTransactionsController* hooks
└── model/
    ├── loginDto.ts        # LoginDto interface
    ├── createUserDto.ts   # CreateUserDto interface
    ├── authResponseDto.ts # AuthResponseDto interface
    ├── userResponseDto.ts # UserResponseDto interface
    └── ...                # All other DTO types
```

### Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `openapi:fetch` | `npm run openapi:fetch` | Fetches `/api-json` from the running backend and saves to `openapi.json` |
| `generate:api` | `npm run generate:api` | Runs Orval against the local `openapi.json` snapshot |
| `generate:api:live` | `npm run generate:api:live` | Runs both in sequence (fetch then generate) |

### Workflow: Regenerating the API Client

Run this whenever backend DTOs, controllers, or routes change:

1. **Start the backend** (requires Docker/Postgres to be running):
   ```bash
   cd packages/backend
   npm run start:dev
   ```

2. **From `packages/frontend`**, fetch the latest spec and regenerate:
   ```bash
   npm run generate:api:live
   ```

   This runs:
   - `openapi:fetch` — fetches `http://localhost:3001/api-json` → saves to `openapi.json`
   - `generate:api` — runs Orval to regenerate `src/api/`

3. **Alternatively**, if you only changed `openapi.json` manually (e.g. patching a broken schema), regenerate without fetching:
   ```bash
   npm run generate:api
   ```

### Configuration

- **Orval config**: `orval.config.ts` — controls output paths, mode (`tags-split`), and the custom mutator
- **Spec snapshot**: `openapi.json` — committed to source control so generation works offline
- **Custom mutator**: `src/services/api/mutator.ts` — routes all generated requests through `apiClient` (handles auth token injection and 401 redirects)

### Notes

- The backend exposes its OpenAPI spec at `GET /api-json` when running (set up in `main.ts` via `SwaggerModule.setup`)
- Orval uses `tags-split` mode: one file per OpenAPI tag (auth, users, transactions, etc.)
- If a nullable string field generates as `{ [key: string]: unknown } | null` instead of `string | null`, the backend `@ApiProperty` decorator is missing `type: String` — add it and regenerate

## Related Documentation


- **Backend Structure**: `packages/backend/docs/directory-structure.md`
- **Copilot Instructions**: `.github/copilot-instructions.md`
- **Project README**: `packages/frontend/README.md`
- **AI Categorization**: `docs/ai-categorization-recommendations.md`

## Future Enhancements

- [ ] State management with Zustand or Redux Toolkit
- [ ] Form validation with React Hook Form + Zod
- [ ] UI component library (shadcn/ui or similar)
- [ ] E2E testing with Playwright
- [ ] Storybook for component documentation
- [ ] PWA capabilities (service workers, offline support)
- [ ] Internationalization (i18n) support
- [ ] Analytics integration
- [ ] Performance monitoring (Web Vitals)
