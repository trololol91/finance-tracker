# Docker Setup for Finance Tracker

This document explains the Docker setup for the Finance Tracker application.

## Overview

The application uses Docker Compose to orchestrate three services:
- **PostgreSQL Database** - PostgreSQL 17 Alpine
- **Backend API** - NestJS application
- **Frontend** - React application (when ready)

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+

## Quick Start

1. **Copy environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Update `.env` with your values:**
   - Set a strong `SECRET_KEY` (minimum 32 characters)
   - Change `POSTGRES_PASSWORD` to a secure password

3. **Start all services:**
   ```bash
   docker-compose up -d
   ```

4. **View logs:**
   ```bash
   docker-compose logs -f
   ```

5. **Stop services:**
   ```bash
   docker-compose down
   ```

## Services

### PostgreSQL Database
- **Port:** 5432
- **Image:** postgres:17-alpine
- **Default Credentials:**
  - User: `finance_user`
  - Password: Set in `.env`
  - Database: `finance_tracker`
- **Persistent Storage:** Docker volume `postgres_data`
- **Initialization Scripts:** `packages/backend/database/init/*.sql`

### Backend API
- **Port:** 3001 (host) → 3000 (container)
- **Built from:** `packages/backend/Dockerfile`
- **Multi-stage build for optimization**
- **Health check endpoint:** `http://localhost:3001/health`
- **Logs:** Mounted to `packages/backend/logs/`

### Frontend
- **Port:** 3002
- **Built from:** `packages/frontend/Dockerfile` (when available)
- **API URL:** Configured via `VITE_API_URL`

## Docker Compose Commands

### Start services
```bash
docker-compose up -d              # Start in detached mode
docker-compose up --build         # Rebuild and start
```

### View logs
```bash
docker-compose logs -f            # All services
docker-compose logs -f backend    # Specific service
```

### Stop services
```bash
docker-compose stop               # Stop (preserves containers)
docker-compose down               # Stop and remove containers
docker-compose down -v            # Stop and remove volumes (deletes database!)
```

### Rebuild services
```bash
docker-compose build              # Rebuild all
docker-compose build backend      # Rebuild specific service
docker-compose up -d --build      # Rebuild and restart
```

### Database operations
```bash
# Access PostgreSQL shell
docker-compose exec postgres psql -U finance_user -d finance_tracker

# Backup database
docker-compose exec postgres pg_dump -U finance_user finance_tracker > backup.sql

# Restore database
docker-compose exec -T postgres psql -U finance_user finance_tracker < backup.sql

# View database logs
docker-compose logs -f postgres
```

### Health checks
```bash
# Check service health
docker-compose ps

# Test backend health endpoint
curl http://localhost:3001/health
```

## Production Deployment

### Security Checklist
- [ ] Change all default passwords in `.env`
- [ ] Generate strong `SECRET_KEY` (32+ characters)
- [ ] Use secrets management (Docker secrets, vault, etc.)
- [ ] Never commit `.env` file to version control
- [ ] Configure firewall rules
- [ ] Use HTTPS/SSL certificates
- [ ] Enable database backups
- [ ] Set up log rotation

### Environment Variables
See `.env.example` for all available configuration options.

### Volumes
- `postgres_data` - Database persistent storage
- `./packages/backend/logs` - Application logs

## Troubleshooting

### Database connection issues
```bash
# Check if database is healthy
docker-compose ps postgres

# View database logs
docker-compose logs postgres

# Verify connection from backend
docker-compose exec backend ping postgres
```

### Container won't start
```bash
# Check logs
docker-compose logs <service-name>

# Remove containers and volumes, start fresh
docker-compose down -v
docker-compose up -d
```

### Port already in use
- Stop service using the port or change port mapping in `docker-compose.yml`
- Backend: `3001:3000` (change 3001 to another port)
- Frontend: `3002:3002`
- Database: `5432:5432`

### Performance issues
```bash
# Check resource usage
docker stats

# View service status
docker-compose ps
```

## Development vs Production

The current setup is configured for production. For development:

1. Use bind mounts for live code reloading:
   ```yaml
   volumes:
     - ./packages/backend/src:/usr/src/app/src
   ```

2. Set environment to development:
   ```yaml
   environment:
     - NODE_ENV=development
   ```

3. Or use local development without Docker:
   ```bash
   # Start only database
   docker-compose up -d postgres
   
   # Run backend locally
   cd packages/backend
   npm run start:dev
   ```

## Monitoring

### Health Checks
All services include health checks:
- Backend: `http://localhost:3001/health`
- Frontend: `http://localhost:3002`
- Database: PostgreSQL `pg_isready` command

### Logs
Access logs in real-time:
```bash
docker-compose logs -f --tail=100 <service-name>
```

## Database Migrations

(To be implemented with TypeORM/Prisma)

When database migrations are set up:
```bash
# Run migrations
docker-compose exec backend npm run migration:run

# Revert migrations
docker-compose exec backend npm run migration:revert
```
