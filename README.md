# Finance Tracker

A self-hosted personal finance application for tracking transactions, accounts, budgets, and bank sync. Built as a monorepo with a NestJS API and a React frontend.

## Features

### Backend
- **Authentication** — JWT-based login and registration
- **User management** — profile, preferences (timezone/currency), role-based access (USER / ADMIN), soft-delete
- **Accounts** — multiple account types (checking, savings, credit, investment, loan), opening balance, multi-currency
- **Categories** — hierarchical categories (parent/child) with color and icon support
- **Transactions** — income, expense, and transfer types; filtering, pagination, soft-delete, toggle active; FITID-based deduplication for imported data; pending transaction support
- **Dashboard** — monthly income/expense/net balance summary, savings rate, spending by category, account balances, recent transactions
- **Bank scraper system** — plugin-based architecture running scrapers in worker threads; built-in TD Bank scraper; external plugin support via `@finance-tracker/plugin-sdk`; admin controls to test and reload plugins
- **File import** — CSV and OFX file upload with per-job status tracking (pending / processing / completed / failed)
- **Scheduled sync** — cron-based sync schedules per account with configurable lookback window; MFA challenge/response flow; sync job history
- **Push notifications** — Web Push (VAPID) and email (SMTP) alerts when a bank sync requires MFA; per-user notification preferences
- **Google Drive integration** — optional Google Drive directory service
- **Export tools** — CLI scripts for exporting transactions by week (TD and CIBC formats)

### Frontend
- **Auth pages** — login and registration with form validation
- **Accounts page** — list, create, edit, delete accounts with balance summary
- **Categories page** — list, create, edit, delete hierarchical categories
- **Transactions page** — filterable, paginated list with date range picker; create/edit modal; toggle active/delete actions; income/expense summary
- **Scraper page** — drag-and-drop file import, import job list with status badges, sync schedule management, real-time sync status panel, MFA modal for interactive bank challenges
- **Profile page** — view and edit profile, delete account
- **Admin** — user list and role management (admin users only)
- **Reports / Budgets** — pages scaffolded, in development
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
│   │   │   ├── categories/     # Hierarchical categories
│   │   │   ├── common/         # Shared guards, decorators
│   │   │   ├── dashboard/      # Monthly summary & spending breakdown
│   │   │   ├── database/       # Prisma service
│   │   │   ├── integrations/
│   │   │   │   └── google-drive/
│   │   │   ├── push/           # Web Push + email notifications
│   │   │   ├── scraper/        # Plugin-based bank scraper
│   │   │   │   ├── admin/      # Admin test/reload endpoints
│   │   │   │   ├── banks/      # Built-in scrapers (TD)
│   │   │   │   ├── crypto/     # Credential encryption
│   │   │   │   ├── import/     # CSV/OFX file import
│   │   │   │   └── sync/       # Cron schedules & sync jobs
│   │   │   ├── transactions/   # Transaction CRUD & filtering
│   │   │   └── users/          # User management & admin panel
│   │   └── prisma/             # Schema & migrations
│   └── frontend/               # React + Vite app (port 3002)
│       └── src/
│           ├── api/            # Orval-generated API client
│           ├── components/     # Shared UI components
│           ├── features/       # Feature modules (accounts, auth, categories, scraper, transactions, users)
│           └── pages/          # Route-level pages
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

## Bank Scraper Plugins

The scraper system supports external plugins via the `@finance-tracker/plugin-sdk` package. A plugin exports a `BankScraper` class that implements the scraper interface. Plugins are loaded at runtime from the configured plugin directory.

The built-in TD Bank scraper is included. Additional bank scrapers can be added as standalone npm packages and installed into the plugin directory without modifying the core application.

See [`docs/scraper-plugins/roadmap.md`](./docs/scraper-plugins/roadmap.md) for the plugin development roadmap.

## API Documentation

Swagger/OpenAPI docs are served at **http://localhost:3001/api** when the backend is running in development mode.

## License

Apache 2.0 — applies to all versions of this project from the initial commit onward.
