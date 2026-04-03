# Finance Tracker

A self-hosted personal finance application for tracking transactions, accounts, budgets, and bank sync. Built as a monorepo with a NestJS API and a React frontend.

## Features

### Backend
- **Authentication** — JWT-based login and registration
- **User management** — profile, preferences (timezone/currency), role-based access (USER / ADMIN), soft-delete
- **Accounts** — multiple account types (checking, savings, credit, investment, loan), opening balance, multi-currency
- **Categories** — hierarchical categories (parent/child) with color and icon support; 13 default categories seeded on registration (Income, Housing, Food & Dining, Transport, Health, Entertainment, Shopping, Finance, Education, Travel, Personal Care, Transfers, Other)
- **Category rules** — keyword-based auto-categorization rules per user; case-insensitive substring matching; rules checked before AI to avoid unnecessary API calls; optional back-fill of existing uncategorized transactions on rule creation
- **AI categorization** — LLM-powered transaction categorization via Anthropic (Claude Haiku) or OpenAI (configurable); batch processing of up to 20 transactions per API call; three entry points: suggest on transaction form, auto-categorize on sync, bulk categorize action; falls back gracefully when no API key is configured
- **Transactions** — income, expense, and transfer types; filtering, pagination, soft-delete, toggle active; FITID-based deduplication for imported data; pending transaction support
- **Dashboard** — monthly income/expense/net balance summary, savings rate, spending by category, account balances, recent transactions
- **Bank scraper system** — plugin-based architecture running scrapers in worker threads; built-in TD Bank scraper; external plugin support via `@finance-tracker/plugin-sdk`; admin controls to test and reload plugins
- **File import** — CSV file upload with per-job status tracking (pending / processing / completed / failed)
- **Scheduled sync** — cron-based sync schedules per account with configurable lookback window; MFA challenge/response flow; sync job history
- **Push notifications** — Web Push (VAPID) and email (SMTP) alerts when a bank sync requires MFA; per-user notification preferences
- **Export tools** — CLI scripts for exporting transactions by week (TD and CIBC formats)
- **API tokens** — personal access tokens with configurable scopes (`transactions:read/write`, `accounts:read/write`, `categories:read/write`, `dashboard:read`, `admin`); SHA-256 hashed storage; optional expiry; soft-delete revocation; managed from Settings → API Tokens

### MCP Server
- **Model Context Protocol server** — exposes finance data to AI assistants (Claude, GitHub Copilot, Cursor, Windsurf, and any MCP-compatible client)
- **Dual transport** — stdio mode for local/desktop clients; HTTP mode for remote/Docker deployments
- **Token-based auth** — uses the same API tokens generated in Settings; no credentials in client config
- **Tools** — `list_transactions` (full filter surface: date range, category, account, type, search), `get_transaction_totals`, `list_accounts`, `list_categories`, `get_dashboard_summary`
- See [`packages/mcp-server/CONNECT.md`](./packages/mcp-server/CONNECT.md) for client setup instructions

### Frontend
- **Auth pages** — login and registration with form validation
- **Accounts page** — list, create, edit, delete accounts with balance summary
- **Categories page** — list, create, edit, delete hierarchical categories; category rules management (view, delete)
- **Transactions page** — filterable, paginated list with date range picker; create/edit modal; toggle active/delete actions; income/expense summary; bulk AI auto-categorize action; "Save as rule" button in edit modal for recording categorization patterns
- **Scraper page** — drag-and-drop file import, import job list with status badges, sync schedule management with optional AI auto-categorize on sync, real-time sync status panel, MFA modal for interactive bank challenges
- **Profile page** — view and edit profile, delete account
- **Admin** — user list and role management (admin users only)
- **Reports / Budgets** — pages scaffolded, in development
- **Settings — API Tokens** — generate, list, and revoke personal API tokens with scope selection; generated token shown once with copy prompt
- **API layer** — auto-generated TypeScript client via Orval from OpenAPI spec; TanStack Query for data fetching and caching

## Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | NestJS v11 |
| Language | TypeScript v5.7 (ESM) |
| Database | PostgreSQL 17 + Prisma ORM |
| Frontend | React + Vite |
| API client | Orval (OpenAPI codegen) + TanStack Query |
| Testing | Vitest |
| Containerisation | Docker + Docker Compose |
| Node.js | v24.13.0 |

## Project Structure

```
finance-tracker/
├── packages/
│   ├── backend/                # NestJS API (port 3001)
│   │   ├── src/
│   │   │   ├── accounts/       # Account management
│   │   │   ├── auth/           # JWT authentication
│   │   │   ├── ai-categorization/ # LLM-based categorization (Anthropic / OpenAI)
│   │   │   ├── categories/     # Hierarchical categories + default seeding
│   │   │   ├── category-rules/ # Keyword rules for auto-categorization
│   │   │   ├── common/         # Shared guards, decorators
│   │   │   ├── config/         # Centralized env validation (Joi)
│   │   │   ├── dashboard/      # Monthly summary & spending breakdown
│   │   │   ├── database/       # Prisma service
│   │   │   ├── push/           # Web Push + email notifications
│   │   │   ├── scraper/        # Plugin-based bank scraper
│   │   │   │   ├── admin/      # Admin test/reload endpoints
│   │   │   │   ├── banks/      # Built-in scrapers (TD)
│   │   │   │   ├── crypto/     # Credential encryption
│   │   │   │   ├── import/     # CSV file import
│   │   │   │   └── sync/       # Cron schedules & sync jobs
│   │   │   ├── transactions/   # Transaction CRUD & filtering
│   │   │   └── users/          # User management & admin panel
│   │   └── prisma/             # Schema & migrations
│   ├── frontend/               # React + Vite app (port 3002)
│   │   └── src/
│   │       ├── api/            # Orval-generated API client
│   │       ├── components/     # Shared UI components
│   │       ├── features/       # Feature modules (accounts, auth, categories, scraper, transactions, users)
│   │       └── pages/          # Route-level pages
│   └── mcp-server/             # MCP server (stdio + HTTP, port 3010)
│       └── src/
│           ├── index.ts        # Server entry point, tool definitions, HTTP/stdio transport
│           └── services/       # API fetcher with AsyncLocalStorage token threading
├── tools/
│   └── export/                 # Transaction export scripts (TD, CIBC)
└── docs/                       # Architecture docs, roadmaps, design docs
```

## Prerequisites

### Local Development
- Node.js v24.13.0 (use `.nvmrc` with nvm)
- npm v11.6.2 (bundled with Node.js)
- PostgreSQL 17 (or use Docker)

### Docker Deployment
- Docker Engine 20.10+
- Docker Compose 2.0+

## Getting Started

### 1. Clone and install

```bash
git clone <repository-url>
cd finance-tracker
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — at minimum set SECRET_KEY and POSTGRES_PASSWORD
```

### 3. Start the database

```bash
docker-compose up -d postgres
```

### 4. Run migrations

```bash
cd packages/backend
npm run prisma:migrate
```

### 5. Start development servers

```bash
# From project root
npm run backend start:dev   # Backend on http://localhost:3001
npm run frontend dev        # Frontend on http://localhost:3002
```

## Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### Services

| Service | Port | URL |
|---|---|---|
| PostgreSQL | 5432 | — |
| Backend API | 3001 | http://localhost:3001 |
| Frontend | 3002 | http://localhost:3002 |
| MCP Server | 3010 | http://localhost:3010/mcp |
| Health check | — | http://localhost:3001/health |
| Prisma Studio | 5555 | http://localhost:5555 |

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Required
SECRET_KEY=your_secret_key_minimum_32_characters
POSTGRES_PASSWORD=your_secure_password

# JWT
JWT_SECRET=your_jwt_secret_minimum_32_characters
JWT_EXPIRES_IN=7d

# Database (auto-constructed from above in Docker; set manually for local)
DATABASE_URL=postgresql://finance_user:your_password@localhost:5432/finance_tracker

# Optional defaults
POSTGRES_USER=finance_user
POSTGRES_DB=finance_tracker
PORT=3001
NODE_ENV=development

# AI categorization (optional — features disabled if not set)
AI_PROVIDER=anthropic          # anthropic | openai
AI_MODEL=claude-haiku-4-5-20251001
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Push notifications (optional)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com

# Email notifications (optional)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

## Development Scripts

### Root

```bash
npm run lint:all              # Lint all packages
npm run test:all              # Run all tests
npm run test:coverage:all     # Test coverage for all packages
```

### Backend

```bash
npm run backend start:dev     # Dev server with hot reload
npm run backend test          # Run tests
npm run backend build         # Compile to dist/

# From packages/backend/
npm run prisma:migrate        # Create and apply migration
npm run prisma:deploy         # Apply pending migrations (production)
npm run prisma:studio         # Open database GUI at localhost:5555
npm run prisma:seed           # Seed the database
```

### Frontend

```bash
# From packages/frontend/
npm run dev                   # Dev server
npm run build                 # Production build
npm run orval                 # Regenerate API client from OpenAPI spec
```

### MCP Server

```bash
# From packages/mcp-server/
npm run dev                   # Run with tsx (no build step)
npm run build                 # Compile to dist/
npm run start                 # Run compiled output
```

See [`packages/mcp-server/CONNECT.md`](./packages/mcp-server/CONNECT.md) for connecting Claude Desktop, GitHub Copilot, Cursor, Windsurf, and other MCP clients.

## Build Order

Some packages must be built before others. The full dependency graph and per-context instructions are in [`build-order.md`](./build-order.md). Summary:

```
plugin-sdk  →  scraper-cibc
            →  scraper-td-credit-card
            →  scraper-stub  →  backend
```

Before typechecking or testing locally:

```bash
# Backend
npm run build -w packages/plugin-sdk
npm run build -w packages/scraper-stub
npm run prisma:generate -w packages/backend

# Frontend
npm run generate:api -w packages/frontend
```

## Bank Scraper Plugins

The scraper system supports external plugins via the `@finance-tracker/plugin-sdk` package. A plugin exports a `BankScraper` class that implements the scraper interface. Plugins are loaded at runtime from the configured plugin directory.

The built-in TD Bank scraper is included. Additional bank scrapers can be added as standalone npm packages and installed into the plugin directory without modifying the core application.

See [`docs/scraper-plugins/roadmap.md`](./docs/scraper-plugins/roadmap.md) for the plugin development roadmap.

## API Documentation

Swagger/OpenAPI docs are served at **http://localhost:3001/api** when the backend is running in development mode.

## License

Apache 2.0 — applies to all versions of this project from the initial commit onward.
