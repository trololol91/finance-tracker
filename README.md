# Finance Tracker

A comprehensive financial tracking application built with modern web technologies.

## Project Overview

The Finance Tracker is a monorepo-based application designed to help users track their personal finances, expenses, and budget. The application consists of a NestJS backend and a frontend (in development).

## Project Structure

This project uses a monorepo structure with the following packages:

- `packages/backend`: NestJS-based API server
- `packages/frontend`: Frontend application (in development)

## Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)
- Docker and Docker Compose (for containerized deployment)

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

The project includes Docker configuration for easy deployment:

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```
SECRET_KEY=your_secret_key_here
```

## License

This project is licensed under the ISC License - see the LICENSE file for details.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
