# Database Module

This module provides database connectivity for the Finance Tracker backend using **Prisma** ORM with **PostgreSQL**.

## Overview

The database module is a global NestJS module that provides the `PrismaService` to all other modules in the application. It manages the database connection lifecycle and provides a type-safe client for database operations.

### Components

- **PrismaService**: Injectable service that manages the Prisma Client instance and connection lifecycle
- **DatabaseModule**: Global NestJS module that exports PrismaService
- **Prisma Client**: Auto-generated type-safe database client (in `src/generated/prisma/`)

## Technology Stack

- **Prisma 7.4.0**: Modern TypeScript ORM
- **PostgreSQL 17**: Relational database (running in Docker)
- **Database Driver**: Native PostgreSQL driver via Prisma

## Initial Setup

### Prerequisites

- Docker Desktop installed and running
- Node.js 24.13.0
- PostgreSQL connection details (provided via Docker Compose)

### 1. Start PostgreSQL Database

From the project root:

```bash
docker-compose up -d postgres
```

This starts PostgreSQL 17 Alpine on `localhost:5432` with:
- Database: `finance_tracker`
- User: `finance_user`
- Password: `change_this_password`
- Data persisted in Docker volume: `postgres_data`

Verify the database is healthy:

```bash
docker-compose ps postgres
```

### 2. Configure Environment Variables

The backend `.env` file is already configured with:

```env
DATABASE_URL="postgresql://finance_user:change_this_password@localhost:5432/finance_tracker"
```

**Note**: This file is gitignored. For production, update credentials in `.env` or use environment-specific configuration.

### 3. Generate Prisma Client

After any schema changes in `prisma/schema.prisma`:

```bash
npm run prisma:generate
```

This generates the type-safe Prisma Client in `src/generated/prisma/`.

### 4. Run Migrations

Apply database migrations:

```bash
npm run prisma:migrate
```

This creates the database schema based on your Prisma schema file.

## Development Environment Setup

### Quick Start

1. **Start the database**:
   ```bash
   docker-compose up -d postgres
   ```

2. **Run migrations** (first time or after schema changes):
   ```bash
   npm run prisma:migrate
   ```

3. **Start development server**:
   ```bash
   npm run start:dev
   ```

### Prisma Commands

All Prisma commands are available via npm scripts:

```bash
# Generate Prisma Client (after schema changes)
npm run prisma:generate

# Create and apply a migration
npm run prisma:migrate

# Apply pending migrations (production)
npm run prisma:deploy

# Open Prisma Studio (database GUI)
npm run prisma:studio

# Run database seed script
npm run prisma:seed
```

### Direct Prisma CLI

For advanced operations, use Prisma CLI directly:

```bash
# Create a migration without applying
npx prisma migrate dev --create-only

# Reset database (WARNING: destroys all data)
npx prisma migrate reset

# View migration status
npx prisma migrate status

# Format schema file
npx prisma format

# Pull schema from existing database
npx prisma db pull

# Push schema without migrations (dev only)
npx prisma db push
```

## Usage in Application Code

### Inject PrismaService

The `DatabaseModule` is global, so `PrismaService` is available in any module without importing `DatabaseModule`.

```typescript
import {Injectable} from '@nestjs/common';
import {PrismaService} from '@database/prisma.service.js';

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) {}

    async findAll() {
        return this.prisma.client.user.findMany();
    }

    async findOne(id: string) {
        return this.prisma.client.user.findUnique({
            where: {id}
        });
    }

    async create(data: CreateUserDto) {
        return this.prisma.client.user.create({
            data: {
                email: data.email,
                passwordHash: data.passwordHash
            }
        });
    }
}
```

### Transactions

```typescript
async transferFunds(fromAccountId: string, toAccountId: string, amount: number) {
    return this.prisma.client.$transaction(async (tx) => {
        // Deduct from source account
        await tx.account.update({
            where: {id: fromAccountId},
            data: {balance: {decrement: amount}}
        });

        // Add to destination account
        await tx.account.update({
            where: {id: toAccountId},
            data: {balance: {increment: amount}}
        });

        // Create transaction records
        await tx.transaction.createMany({
            data: [
                {accountId: fromAccountId, amount: -amount, type: 'transfer'},
                {accountId: toAccountId, amount: amount, type: 'transfer'}
            ]
        });
    });
}
```

### Raw Queries

For complex queries not supported by Prisma's query builder:

```typescript
async getMonthlyTotals(userId: string, year: number, month: number) {
    return this.prisma.client.$queryRaw`
        SELECT 
            DATE_TRUNC('day', date) as day,
            SUM(amount) as total
        FROM transactions
        WHERE user_id = ${userId}
          AND EXTRACT(YEAR FROM date) = ${year}
          AND EXTRACT(MONTH FROM date) = ${month}
        GROUP BY day
        ORDER BY day
    `;
}
```

## Schema Management

### Modifying the Schema

1. Edit `prisma/schema.prisma`:

```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String   @map("password_hash")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@map("users")
}
```

2. Create migration:

```bash
npm run prisma:migrate
```

3. Enter migration name when prompted (e.g., "add_user_table")

4. Regenerate Prisma Client:

```bash
npm run prisma:generate
```

### Schema Best Practices

- Use `@map()` for column names (e.g., `snake_case` in DB, `camelCase` in code)
- Use `@@map()` for table names
- Always include `createdAt` and `updatedAt` timestamps
- Use UUIDs for primary keys: `@id @default(uuid())`
- Add indexes for foreign keys and frequently queried columns
- Document complex relationships with comments

## Testing

### Unit Tests with Mocked PrismaService

Mock the Prisma Client for unit tests:

```typescript
import {Test} from '@nestjs/testing';
import {PrismaService} from '@database/prisma.service.js';

const mockPrismaService = {
    client: {
        user: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn()
        }
    }
};

const module = await Test.createTestingModule({
    providers: [
        UsersService,
        {
            provide: PrismaService,
            useValue: mockPrismaService
        }
    ]
}).compile();
```

### Integration Tests with Test Database

Use a separate test database:

```typescript
// test/setup.ts
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/finance_tracker_test';
```

Or use Prisma's test helpers for isolated test environments.

### Running Tests

```bash
# Unit tests (with mocked database)
npm test

# Integration tests (with real database)
npm run test:e2e

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## Database GUI Tools

### Prisma Studio

Built-in Prisma GUI for browsing and editing data:

```bash
npm run prisma:studio
```

Opens on `http://localhost:5555`

### pgAdmin or DBeaver

Connect using:
- Host: `localhost`
- Port: `5432`
- Database: `finance_tracker`
- Username: `finance_user`
- Password: `change_this_password`

## Troubleshooting

### Connection Issues

**Error**: `Can't reach database server`

1. Check Docker container is running:
   ```bash
   docker-compose ps postgres
   ```

2. Check logs:
   ```bash
   docker-compose logs postgres
   ```

3. Restart container:
   ```bash
   docker-compose restart postgres
   ```

### Migration Errors

**Error**: `Migration failed to apply`

1. Check migration history:
   ```bash
   npx prisma migrate status
   ```

2. If stuck, reset (WARNING: destroys data):
   ```bash
   npx prisma migrate reset
   ```

3. For production, manually resolve conflicts

### Schema Drift

**Error**: `Schema drift detected`

Run:
```bash
npx prisma migrate resolve --applied <migration_name>
```

Or reset and reapply:
```bash
npx prisma migrate reset
```

### Generated Client Issues

**Error**: `Cannot find module '@/generated/prisma/client.js'`

Regenerate client:
```bash
npm run prisma:generate
```

Restart TypeScript server in VS Code: `Ctrl+Shift+P` → "TypeScript: Restart TS Server"

### Port Conflicts

**Error**: `Port 5432 is already in use`

Check for existing PostgreSQL instances:
```bash
# Windows
netstat -ano | findstr :5432

# macOS/Linux
lsof -i :5432
```

Stop conflicting service or change port in `docker-compose.yml`

## Performance Optimization

### Connection Pooling

Prisma automatically manages connection pooling. Default settings work for most cases.

For high-traffic applications, configure in `prisma.config.ts`:

```typescript
datasource: {
    url: process.env.DATABASE_URL,
    // Add connection pool settings if needed
}
```

### Query Optimization

1. **Use select to fetch only needed fields**:
   ```typescript
   await prisma.user.findMany({
       select: {id: true, email: true}
   });
   ```

2. **Use include for relations strategically**:
   ```typescript
   await prisma.user.findUnique({
       where: {id},
       include: {transactions: {take: 10}}
   });
   ```

3. **Add database indexes** for frequently queried columns

4. **Use batch operations**:
   ```typescript
   await prisma.transaction.createMany({data: transactions});
   ```

## Production Considerations

### Environment Variables

Ensure `DATABASE_URL` is set securely:
- Use environment variables (not `.env` files)
- Store in secrets manager (AWS Secrets Manager, Azure Key Vault, etc.)
- Enable SSL: `?sslmode=require` in connection string

### Migrations

Use `prisma:deploy` for production:

```bash
npm run prisma:deploy
```

This applies pending migrations without prompting.

### Monitoring

Monitor database performance:
- Connection pool usage
- Query duration
- Error rates
- Slow query logs

### Backups

Configure automated backups:
- PostgreSQL pg_dump
- Continuous archiving (WAL)
- Point-in-time recovery
- Regular restore testing

## Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [NestJS Database Documentation](https://docs.nestjs.com/recipes/prisma)
- [Finance Tracker Development Roadmap](../docs/development-roadmap.md)

## Support

For issues or questions:
1. Check this README
2. Review Prisma documentation
3. Check project GitHub issues
4. Contact the development team
