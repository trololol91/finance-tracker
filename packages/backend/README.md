# Finance Tracker - Backend

NestJS-based REST API server for the Finance Tracker application.

## Tech Stack

- **Framework:** NestJS v11.0.1
- **Runtime:** Node.js v24.13.0
- **Language:** TypeScript v5.7.3 (ESM modules)
- **Testing:** Vitest v4.0.15
- **Database:** PostgreSQL (planned - currently mock data)
- **Linting:** ESLint v9 with TypeScript ESLint
- **Architecture:** Feature-based modules with path aliases

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

### 3. Start Development Server

**Option A: Without Database (Mock Data)**
```bash
# From project root
npm run backend start:dev

# Or from backend directory
npm run start:dev
```

Server runs at: **http://localhost:3000**

**Option B: With PostgreSQL Database**
```bash
# Start only database with Docker
docker-compose up -d postgres

# Run backend locally with database access
npm run start:dev
```

Benefits:
- ✅ Live reload on code changes
- ✅ Local debugging capabilities
- ✅ Real PostgreSQL database for testing

### 4. Verify Installation

```bash
# Test root endpoint
curl http://localhost:3000

# Test health check
curl http://localhost:3000/health
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

### Build
```bash
npm run build          # Compile to dist/
```

## Project Structure

```
packages/backend/
├── src/
│   ├── accounts/           # Account management module
│   ├── ai/                 # AI categorization module
│   ├── auth/               # Authentication module
│   ├── budgets/            # Budget tracking module
│   ├── categories/         # Transaction categories module
│   ├── common/             # Shared utilities
│   │   ├── decorators/     # Custom decorators
│   │   ├── filters/        # Exception filters
│   │   ├── guards/         # Auth guards
│   │   └── interceptors/   # HTTP interceptors
│   ├── config/             # Configuration module
│   ├── database/           # Database module (planned)
│   ├── integrations/       # External integrations
│   │   └── google-drive/   # Google Drive integration
│   ├── reports/            # Financial reports module
│   ├── scraper/            # Data scraper module
│   ├── transactions/       # Transaction management
│   ├── users/              # User management
│   ├── app.module.ts       # Root module
│   ├── app.controller.ts   # Root controller
│   ├── app.service.ts      # Root service
│   └── main.ts             # Entry point
├── test/                   # E2E tests
├── database/               # Database initialization scripts
│   └── init/               # SQL initialization files
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

Currently not required for development. When database is integrated:

```bash
# Create .env file
NODE_ENV=development
PORT=3000
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=finance_user
DATABASE_PASSWORD=finance_password
DATABASE_NAME=finance_tracker
```

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

(To be added - Swagger/OpenAPI integration planned)

## Contributing

See root [Contributing Guide](../../.github/copilot-instructions.md) for guidelines.

## Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- [Vitest Documentation](https://vitest.dev)
- [Project Architecture](./docs/directory-structure.md)

## License

UNLICENSED - Private project
