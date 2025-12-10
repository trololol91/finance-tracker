# Backend Directory Structure

This document outlines the recommended directory structure for the finance-tracker backend application.

## Current Structure

```
packages/backend/src/
├── main.ts                          # Application entry point
├── app.module.ts                    # Root module
├── app.controller.ts                # Root controller
├── app.service.ts                   # Root service
├── app.controller.spec.ts           # Root controller tests
│
├── common/                          # Shared utilities and cross-cutting concerns
│   ├── common.module.ts             # Common module registration
│   ├── decorators/                  # Custom decorators
│   ├── filters/                     # Exception filters
│   ├── guards/                      # Auth guards, etc.
│   └── interceptors/                # Request/response interceptors
│
├── config/                          # Configuration management
│   ├── config.module.ts             # Configuration module
│   ├── database.config.ts           # Database configuration
│   ├── auth.config.ts               # Authentication configuration
│   └── app.config.ts                # General app configuration
│
├── database/                        # Database layer
│   ├── database.module.ts           # Database module
│   ├── migrations/                  # Database migrations
│   └── seeds/                       # Database seed data
│
├── auth/                            # Authentication & Authorization
│   ├── auth.module.ts               # Auth module
│   ├── auth.controller.ts           # Auth endpoints (login, register, etc.)
│   ├── auth.service.ts              # Auth business logic
│   ├── strategies/                  # Passport strategies (JWT, Local, etc.)
│   │   ├── jwt.strategy.ts
│   │   └── local.strategy.ts
│   ├── guards/                      # Auth-specific guards
│   │   └── jwt-auth.guard.ts
│   └── dto/                         # Auth DTOs
│       ├── login.dto.ts
│       └── register.dto.ts
│
├── users/                           # User management
│   ├── users.module.ts              # Users module
│   ├── users.controller.ts          # User CRUD endpoints
│   ├── users.service.ts             # User business logic
│   ├── entities/                    # User entity/model
│   │   └── user.entity.ts
│   └── dto/                         # User DTOs
│       ├── create-user.dto.ts
│       └── update-user.dto.ts
│
├── transactions/                    # Transaction management
│   ├── transactions.module.ts       # Transactions module
│   ├── transactions.controller.ts   # Transaction CRUD endpoints
│   ├── transactions.service.ts      # Transaction business logic
│   ├── entities/                    # Transaction entity/model
│   │   └── transaction.entity.ts
│   └── dto/                         # Transaction DTOs
│       ├── create-transaction.dto.ts
│       └── update-transaction.dto.ts
│
├── categories/                      # Category management
│   ├── categories.module.ts         # Categories module
│   ├── categories.controller.ts     # Category CRUD endpoints
│   ├── categories.service.ts        # Category business logic
│   ├── entities/                    # Category entity/model
│   │   └── category.entity.ts
│   └── dto/                         # Category DTOs
│       ├── create-category.dto.ts
│       └── update-category.dto.ts
│
├── accounts/                        # Account/Bank account management
│   ├── accounts.module.ts           # Accounts module
│   ├── accounts.controller.ts       # Account CRUD endpoints
│   ├── accounts.service.ts          # Account business logic
│   ├── entities/                    # Account entity/model
│   │   └── account.entity.ts
│   └── dto/                         # Account DTOs
│       ├── create-account.dto.ts
│       └── update-account.dto.ts
│
├── budgets/                         # Budget management
│   ├── budgets.module.ts            # Budgets module
│   ├── budgets.controller.ts        # Budget CRUD endpoints
│   ├── budgets.service.ts           # Budget business logic
│   ├── entities/                    # Budget entity/model
│   │   └── budget.entity.ts
│   └── dto/                         # Budget DTOs
│       ├── create-budget.dto.ts
│       └── update-budget.dto.ts
│
├── reports/                         # Reporting & Analytics
│   ├── reports.module.ts            # Reports module
│   ├── reports.controller.ts        # Report generation endpoints
│   ├── reports.service.ts           # Report business logic
│   └── dto/                         # Report DTOs
│       └── report-query.dto.ts
│
├── scraper/                         # Bank statement scraping
│   ├── scraper.module.ts            # Scraper module
│   ├── scraper.controller.ts        # Scraper endpoints (trigger scraping, status)
│   ├── scraper.service.ts           # Scraping orchestration logic
│   ├── parsers/                     # Bank-specific parsers
│   │   ├── chase.parser.ts
│   │   ├── bofa.parser.ts
│   │   └── generic.parser.ts
│   └── dto/                         # Scraper DTOs
│       └── scrape-request.dto.ts
│
├── ai/                              # AI-powered features
│   ├── ai.module.ts                 # AI module
│   ├── categorization/              # Transaction categorization
│   │   ├── categorization.service.ts
│   │   └── categorization.controller.ts
│   ├── insights/                    # AI insights generation
│   │   └── insights.service.ts
│   └── prompts/                     # AI prompt templates
│       └── categorization.prompts.ts
│
└── integrations/                    # Third-party integrations
    ├── google-drive/                # Google Drive integration
    │   ├── google-drive.service.ts
    │   ├── google-drive-directory.service.ts
    │   ├── README.md
    │   └── __TEST__/
    │       ├── google-drive.service.spec.ts
    │       └── google-drive-directory.service.spec.ts
    ├── openai/                      # OpenAI integration
    │   └── openai.service.ts
    └── plaid/                       # Plaid banking API (future)
        └── plaid.service.ts
```

## Path Aliases

All imports use TypeScript path aliases for cleaner code:

- `@/*` - Root src directory
- `@common/*` - Common utilities
- `@config/*` - Configuration
- `@database/*` - Database layer
- `@auth/*` - Authentication
- `@users/*` - User management
- `@transactions/*` - Transactions
- `@categories/*` - Categories
- `@accounts/*` - Accounts
- `@budgets/*` - Budgets
- `@reports/*` - Reports
- `@scraper/*` - Bank scraping
- `@ai/*` - AI features
- `@integrations/*` - Third-party integrations

## Module Organization

Each feature module follows NestJS best practices:

1. **Module file** (`*.module.ts`) - Registers controllers, services, and imports
2. **Controller** (`*.controller.ts`) - Handles HTTP requests and responses
3. **Service** (`*.service.ts`) - Contains business logic
4. **Entities** (`entities/*.entity.ts`) - Database models/entities
5. **DTOs** (`dto/*.dto.ts`) - Data transfer objects for validation
6. **Tests** (`*.spec.ts`) - Unit and integration tests

## Design Principles

1. **Separation of Concerns** - Each module handles a specific domain
2. **Single Responsibility** - Services focus on one area of business logic
3. **Dependency Injection** - Loose coupling between modules
4. **Clean Imports** - Path aliases instead of relative paths
5. **Type Safety** - TypeScript strict mode with explicit types
6. **Testability** - Each module is independently testable

## Future Enhancements

- Add GraphQL schema directory if implementing GraphQL
- Add WebSocket gateway directory for real-time features
- Add caching layer directory (Redis integration)
- Add queue directory for background job processing
- Add notifications directory for email/SMS alerts
