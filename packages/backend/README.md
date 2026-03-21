# Finance Tracker - Backend

NestJS-based REST API server for the Finance Tracker application.

## Tech Stack

- **Framework:** NestJS v11.0.1
- **Runtime:** Node.js v24.13.0
- **Language:** TypeScript v5.7.3 (ESM modules)
- **Testing:** Vitest v4.0.15
- **Database:** PostgreSQL 17 + Prisma ORM
- **Linting:** ESLint v9 with TypeScript ESLint
- **Architecture:** Feature-based modules with path aliases

## Quick Start

Get the backend running in under 2 minutes:

```bash
# 1. Install dependencies (from project root)
npm install

# 2. Start PostgreSQL database
docker-compose up -d postgres

# 3. Run database migrations
cd packages/backend
npm run prisma:migrate

# 4. Start development server
npm run start:dev
```

**Server runs at:** http://localhost:3001

**Test endpoints:**
```bash
curl http://localhost:3001/health
```

**Database GUI:**
```bash
npm run prisma:studio  # Opens at http://localhost:5555
```

> **Note:** For detailed setup instructions, environment configuration, and troubleshooting, see sections below.

## Prerequisites

- **Node.js:** v24.13.0 (use `.nvmrc` with nvm)
- **npm:** v11.6.2 (bundled with Node.js)
- **Docker:** (optional) For running PostgreSQL

## Development Setup

### 1. Install Node.js

```bash
# Using nvm (recommended)
nvm install 24.13.0
nvm use 24.13.0

# Verify installation
node --version  # Should output: v24.13.0
npm --version   # Should output: v11.6.2
```

### 2. Install Dependencies

**From project root:**
```bash
npm install
```

**Or from backend directory:**
```bash
cd packages/backend
npm install
```

### 3. Setup Database

**Start PostgreSQL with Docker:**
```bash
# From project root
docker-compose up -d postgres
```

**Configure environment** (already set in `.env`):
```env
DATABASE_URL="postgresql://finance_user:change_this_password@localhost:5432/finance_tracker"
```

**Run migrations:**
```bash
cd packages/backend
npm run prisma:migrate
```

**Generate Prisma Client** (if needed):
```bash
npm run prisma:generate
```

### 4. Start Development Server

```bash
# From project root
npm run backend start:dev

# Or from backend directory
npm run start:dev
```

Server runs at: **http://localhost:3001**

Benefits:
- ✅ Live reload on code changes
- ✅ Hot module replacement
- ✅ PostgreSQL database with Prisma ORM
- ✅ Type-safe database access

### 5. Verify Installation

```bash
# Test health check
curl http://localhost:3001/health
```

**Open Prisma Studio** (database GUI):
```bash
npm run prisma:studio  # http://localhost:5555
```

## Available Scripts

### Development
```bash
npm run start          # Start server
npm run start:dev      # Start with auto-reload (recommended)
npm run start:debug    # Start with debugger (port 9229)
npm run start:prod     # Start production build
```

### Testing
```bash
npm test               # Run all tests once
npm run test:watch     # Run tests in watch mode
npm run test:ui        # Open interactive test UI
npm run test:coverage  # Generate coverage report
npm run test:e2e       # Run end-to-end tests
```

### Code Quality
```bash
npm run lint           # Lint and auto-fix
npm run format         # Format with Prettier
```

### Database (Prisma)
```bash
npm run prisma:generate  # Generate Prisma Client
npm run prisma:migrate   # Create and apply migration
npm run prisma:deploy    # Apply pending migrations (production)
npm run prisma:studio    # Open database GUI
npm run prisma:seed      # Run seed script
```

### Build
```bash
npm run build          # Compile to dist/
```

## Project Structure

```
packages/backend/
├── src/
│   ├── accounts/           # Account CRUD (checking, savings, credit, investment, loan)
│   ├── auth/               # JWT authentication (login, register, guards, strategies)
│   ├── categories/         # Hierarchical categories with color/icon support
│   ├── common/             # Shared utilities
│   │   └── guards/         # AdminGuard, OwnershipGuard, JwtAuthGuard
│   ├── dashboard/          # Monthly summary, spending by category, account balances
│   ├── database/           # Prisma service
│   ├── push/               # Web Push (VAPID) + email (SMTP) notifications for MFA
│   ├── scraper/            # Plugin-based bank scraper system
│   │   ├── admin/          # Admin endpoints (test scraper, reload plugins)
│   │   ├── banks/          # Built-in scrapers (TD)
│   │   ├── crypto/         # AES credential encryption
│   │   ├── import/         # CSV file import with job tracking
│   │   ├── interfaces/     # BankScraper plugin contract
│   │   └── sync/           # Cron sync schedules, sync jobs, SSE status stream
│   ├── transactions/       # Transaction CRUD, filtering, pagination, deduplication
│   ├── users/              # User management, profile, admin panel
│   ├── app.module.ts       # Root module
│   ├── app.controller.ts   # Root controller (health check)
│   ├── app.service.ts      # Root service
│   └── main.ts             # Entry point
├── prisma/                 # Prisma schema and migrations
├── dist/                   # Compiled output
├── Dockerfile              # Production container
├── .dockerignore           # Docker ignore rules
├── nest-cli.json           # NestJS configuration
├── tsconfig.json           # TypeScript configuration
├── vitest.config.ts        # Vitest configuration
└── eslint.config.js        # ESLint configuration
```

## Path Aliases

The project uses TypeScript path aliases for cleaner imports:

```typescript
import { SomeService } from '@/some.service.js';           // Root src/
import { Guard } from '@common/guards/auth.guard.js';      // common/
import { Transaction } from '@transactions/entities/...';   // transactions/
import { User } from '@users/entities/user.entity.js';     // users/
// etc.
```

**Important:** ESM requires `.js` extensions even for `.ts` files.

## Environment Variables

The backend uses a `.env` file for configuration (already created during setup):

```env
# Database URL for Prisma
DATABASE_URL="postgresql://finance_user:change_this_password@localhost:5432/finance_tracker"

# JWT Authentication (for Phase 2)
JWT_SECRET="your_jwt_secret_key_here_minimum_32_characters_long_for_production"
JWT_EXPIRES_IN="7d"

# Application
PORT=3001
NODE_ENV="development"
```

**Note:** The `.env` file is gitignored. See `.env.example` in project root for reference.

## Database Setup (PostgreSQL)

### Using Docker Compose

```bash
# Start PostgreSQL only
docker-compose up -d postgres

# Access database shell
docker-compose exec postgres psql -U finance_user -d finance_tracker

# View logs
docker-compose logs -f postgres

# Stop database
docker-compose stop postgres
```

### Database Credentials (Docker)
- **Host:** localhost
- **Port:** 5432
- **User:** finance_user
- **Password:** finance_password (change in `.env`)
- **Database:** finance_tracker

## IDE Setup (VS Code)

### Recommended Extensions
- **ESLint** (dbaeumer.vscode-eslint)
- **Prettier** (esbenp.prettier-vscode)
- **EditorConfig** (editorconfig.editorconfig)

Settings are pre-configured in project files.

## Debugging

### VS Code Debug Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug NestJS",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "start:debug"],
      "port": 9229,
      "restart": true,
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

Then press **F5** or use Debug panel.

## Troubleshooting

### Port 3000 Already in Use

```bash
# Find process using port
lsof -i :3000              # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Change port in src/main.ts or kill the process
```

### Module Not Found Errors

```bash
# Clean reinstall
rm -rf node_modules dist
npm install
```

### Path Alias Issues

Ensure imports use `.js` extensions:
```typescript
// ✅ Correct
import { Service } from '@/service.js';

// ❌ Wrong
import { Service } from '@/service';
```

### ESLint Errors

```bash
# Auto-fix most issues
npm run lint

# Check specific file
npx eslint src/path/to/file.ts --fix
```

## Testing Guidelines

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest';

describe('UserService', () => {
  it('should return user by id', () => {
    // Arrange
    const userId = '123';
    
    // Act
    const result = service.findOne(userId);
    
    // Assert
    expect(result.id).toBe(userId);
  });
});
```

### Test Coverage

```bash
# Generate coverage report
npm run test:coverage

# Open coverage in browser
open coverage/index.html  # macOS
start coverage/index.html # Windows
```

## Deployment

See root [Docker Setup Guide](../../docs/docker-setup.md) for production deployment with PostgreSQL.

## Code Style

- **TypeScript:** Strict mode with explicit types
- **Imports:** Path aliases with `.js` extensions
- **Functions:** Return type annotations required
- **Formatting:** Prettier with 4-space indentation
- **Linting:** ESLint with TypeScript rules
- **Testing:** Vitest with AAA pattern

## API Documentation

Swagger UI is available at **http://localhost:3001/api** when the backend is running.

The raw OpenAPI JSON spec is served at **http://localhost:3001/api-json** — used by the frontend's `npm run generate:api:live` to regenerate the Orval API client.

## Contributing

See root [Contributing Guide](../../.github/copilot-instructions.md) for guidelines.

## Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- [Vitest Documentation](https://vitest.dev)
- [Project Architecture](./docs/directory-structure.md)

## License

Apache 2.0 — applies to all versions of this project from the initial commit onward.
