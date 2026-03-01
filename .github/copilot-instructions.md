# GitHub Copilot Instructions

This document provides instructions and guidelines for GitHub Copilot when working on the finance-tracker project.

## Project Context

This is a finance tracker monorepo with:
- **Backend**: NestJS + TypeScript + Vitest + PostgreSQL (planned)
- **Frontend**: React + TypeScript + Vite + Vitest
- **Module System**: Full ESM across entire codebase
- **Architecture**: Feature-based organization with path aliases

## Code Style & Standards

### TypeScript
- Use strict mode with explicit types
- Return type annotations required for all functions
- Use `React.JSX.Element` for component return types
- Prefer type imports: `import type { ... }`
- Use `interface` for object shapes, `type` for unions/intersections

### Import Rules
- **REQUIRED**: Use path aliases - NO relative imports
  - **Backend**: Use `#` aliases (`#users/`, `#common/`, `#database/`, etc.)
  - **Frontend**: Use `@` aliases (`@/`, `@components/`, `@features/`, etc.)
- ESM requires explicit `.js` extensions on imports (even for `.ts` files)
- Group imports: external → internal → relative
- Examples:
  - Backend: `import { UsersService } from '#users/users.service.js';`
  - Frontend: `import { Button } from '@components/common';`

### CSS / Design Tokens
- **REQUIRED**: All CSS variables used in component/feature `.css` or `.module.css` files **must be defined** in `src/index.css` under the Semantic Color Aliases section.
- The app uses a **dark-theme-first scale** with remapped names: `--color-gray-100` is `#0f172a` (darkest, page bg), `--color-gray-900` is `#f1f5f9` (lightest, headings).
- Semantic aliases bridge scale tokens to descriptive names: `--color-background`, `--color-surface`, `--color-text-primary`, etc.
- **Never rely on a hardcoded fallback** (e.g. `var(--color-surface, #fff)`) as the actual colour — those are emergency fallbacks only. If a variable is needed, define it in `src/index.css` first.
- When adding a new component that uses a new semantic token, add the token to `src/index.css` `:root` before writing the component CSS.
- `--space-*` scale (`--space-1` through `--space-12`) is defined in `src/index.css`. Use scale values, not raw `rem` values, in component CSS.
- Use CSS Modules (`.module.css`) for all feature and page components to avoid class name collisions.

### Naming Conventions
- Components: PascalCase (`TransactionList.tsx`)
- Hooks: camelCase with `use` prefix (`useTransactions.ts`)
- Services: camelCase with `Service` suffix (`transactionService.ts`)
- Types: camelCase with `.types.ts` suffix (`transaction.types.ts`)
- Tests: Same name as file with `.test.tsx` or `.spec.ts`

### Testing
- Write tests for all utilities and components
- Use Vitest + React Testing Library
- Follow Arrange-Act-Assert pattern
- Use accessibility-first queries (getByRole, getByLabelText)
- Test user-facing behavior, not implementation details
- **Cross-feature tests**: When a feature change adds UI or behaviour to an existing feature's route (e.g. wiring a `categoryId` selector into the Transactions page), add the new test cases to the **existing feature's test plan and report** (`test-plan/<feature>/frontend.md` and `frontend-report.md`) under a clearly labelled section — do **not** create a separate file. A separate file is only justified for a genuinely new, standalone feature that has no existing plan document.

## Git Workflow

### Committing Changes
**INSTRUCTION**: When asked to commit changes, always:
1. Stage all changes with `git add`
2. Create comprehensive commit messages with:
   - **Summary line**: Clear, concise description (imperative mood)
   - **Type prefix**: feat/fix/test/docs/refactor/style/chore
   - **Detailed body**: 
     - What changed and why
     - Breaking changes (if any)
     - Technical details and implementation notes
     - Files created/modified counts
     - Test results if applicable
   - **Format example**:
     ```
     feat: add transaction categorization with AI

     Implemented OpenAI integration for automatic transaction categorization
     using GPT-4o-mini model with custom prompts.

     Changes:
     - Created ai/categorization module with service and controller
     - Added OpenAI client wrapper in integrations/
     - Implemented prompt templates for category suggestions
     - Added unit tests for categorization logic (15 tests passing)

     Breaking Changes:
     - Transaction entity now requires categoryId field

     12 files changed, 456 insertions, 23 deletions
     ```

### Commit Message Guidelines
- Use imperative mood ("add" not "added")
- Be specific about what changed
- Include file counts and test results
- Document breaking changes clearly
- Add context for future developers

## Architecture Guidelines

### Backend Structure
- Feature modules: `auth/`, `users/`, `transactions/`, `categories/`, etc.
- Shared utilities: `common/` (decorators, filters, guards, interceptors)
- Integrations: `integrations/` (google-drive, openai, plaid)
- Each module: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`, `entities/`

### Frontend Structure
- Pages: Route-level components (thin, mainly composition)
- Components: Reusable UI in `components/common/`
- Features: Business logic in `features/` (mirrors backend)
- Services: API calls, storage, external integrations
- Each feature: `components/`, `hooks/`, `services/`, `types/`

## Development Commands

### Backend
- `npm run start:dev` - Development server
- `npm test` - Run tests
- `npm run test:ui` - Interactive test UI
- `npm run lint` - ESLint

### Frontend
- `npm run dev` - Development server
- `npm test` - Run tests
- `npm run test:watch` - Watch mode
- `npm run test:ui` - Interactive test UI
- `npm run test:coverage` - Coverage report

## Common Tasks

### Creating a New Feature Module (Backend)
1. Create directory: `src/[feature]/`
2. Add files: `[feature].module.ts`, `[feature].controller.ts`, `[feature].service.ts`
3. Create subdirectories: `dto/`, `entities/`
4. Register in `app.module.ts`
5. Use path aliases for imports
6. Write unit tests

### Creating a New Feature (Frontend)
1. Create directory: `src/features/[feature]/`
2. Add subdirectories: `components/`, `hooks/`, `services/`, `types/`
3. Create page component in `src/pages/`
4. Add route in `src/routes/index.tsx`
5. Use path aliases for imports
6. Write component and utility tests

### Validating Frontend Pages (REQUIRED)
**INSTRUCTION**: After creating or editing any frontend page or component, always validate it is working:
1. Run `get_errors` on every file created or modified — fix all TypeScript and ESLint errors before finishing
2. Run ESLint via terminal: `npx eslint <file> --max-warnings 0` — confirm zero warnings and errors
3. If the dev server is already running, verify the page renders without a runtime crash by checking the browser console output or terminal for errors
4. If the dev server is not running, run `npm run dev` in `packages/frontend` (background) and verify it starts successfully
5. Confirm the page is reachable at its route (e.g. navigate to `/profile` after adding ProfilePage)
6. Open the page in the Simple Browser (`open_simple_browser`) and confirm it loads without a blank screen or error boundary

### Adding a New Component
1. Create component directory in appropriate location
2. Add `.tsx` file with component
3. Add `.css` file for styles (if needed)
4. Create `.test.tsx` with comprehensive tests
5. Export from parent `index.ts`
6. Use `React.JSX.Element` return type

### Adding API Endpoints
1. Create DTO in `dto/` directory
2. Add controller method with decorators
3. Implement service method
4. Update `services/api/endpoints.ts` (frontend)
5. Create service method in feature service (frontend)
6. Write integration tests

## Best Practices

### Error Handling
- Use NestJS exception filters in backend
- Handle async errors with try-catch
- Provide meaningful error messages
- Log errors appropriately

### Performance
- Use React.lazy for code splitting
- Memoize expensive computations
- Avoid prop drilling (use context or state management)
- Index database queries appropriately

### Security
- Validate all inputs (use class-validator in backend, zod in frontend)
- Sanitize user data
- Use parameterized queries
- Implement proper authentication guards
- Never commit secrets or API keys

### Accessibility
- Use semantic HTML
- Include ARIA labels where needed
- Ensure keyboard navigation
- Test with screen readers
- Maintain color contrast ratios

## Documentation

- Update README.md for significant changes
- Document complex business logic
- Add JSDoc comments for public APIs
- Keep architecture docs current
- Document environment variables

## Questions & Issues

If uncertain about:
- Architecture decisions → Check `docs/directory-structure.md`
- Testing patterns → Look at existing test files
- Component patterns → Review `components/common/`
- API patterns → Check existing controllers/services

When encountering errors:
1. Check ESLint output for path alias violations
2. Verify TypeScript configuration
3. Ensure `.js` extensions on imports
4. Check for duplicate dependencies
5. Review test output for specifics
