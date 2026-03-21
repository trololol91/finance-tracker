# Finance Tracker

A comprehensive financial tracking application built with modern web technologies.

## Project Overview

The Finance Tracker is a monorepo-based application designed to help users track their personal finances, expenses, and budget. The application consists of a NestJS backend and a frontend (in development).

## Project Structure

This project uses a monorepo structure with the following packages:

- `packages/backend`: NestJS-based API server
- `packages/frontend`: Frontend application (in development)

## Prerequisites

### Local Development
- Node.js v24.13.0 (use `.nvmrc` file with nvm)
- npm v11.6.2 (bundled with Node.js)

### Docker Deployment
- Docker Engine 20.10+
- Docker Compose 2.0+

## Getting Started

### Clone the repository

```bash
git clone <repository-url>
cd finance-tracker
```

### Install dependencies

```bash
npm install
```

This will install all dependencies for the root project and all workspaces.

## Development

### Backend

To run the backend in development mode:

```bash
npm run backend start:dev
```

To run tests:

```bash
npm run backend test
```

For more backend-specific commands, see the [backend README](./packages/backend/README.md).

### Frontend

The frontend package is currently in development.

### Running linting

To run linting for all packages:

```bash
npm run lint:all
```

### Running tests

To run tests for all packages:

```bash
npm run test:all
```

To generate test coverage:

```bash
npm run test:coverage:all
```

## Deployment

The project includes Docker Compose configuration with PostgreSQL database:

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# Update SECRET_KEY and POSTGRES_PASSWORD

# Build and start all services (PostgreSQL + Backend + Frontend)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

For detailed Docker documentation, see [Docker Setup Guide](./docs/docker-setup.md).

### Services

- **PostgreSQL Database** - Port 5432
- **Backend API** - Port 3001 (http://localhost:3001)
- **Frontend** - Port 3002 (http://localhost:3002)
- **Health Check** - http://localhost:3001/health

### Environment Variables

Copy `.env.example` to `.env` and update the following:

```bash
# Required
SECRET_KEY=your_secret_key_minimum_32_characters
POSTGRES_PASSWORD=your_secure_password

# Optional (have defaults)
POSTGRES_USER=finance_user
POSTGRES_DB=finance_tracker
```

## License

Apache 2.0 — applies to all versions of this project from the initial commit onward.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
