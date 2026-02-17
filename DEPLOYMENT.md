# Finance Tracker - Deployment Guide

## Initial Setup

### 1. Generate Secure Credentials

Before deploying, generate strong passwords and secrets:

```bash
# Generate PostgreSQL user (or use your own strong password)
openssl rand -base64 32

# Generate PostgreSQL password
openssl rand -base64 32

# Generate JWT secret
openssl rand -base64 32
```

### 2. Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your generated credentials
nano .env # or vim, or any editor
```

**Example `.env` file:**
```env
POSTGRES_USER=<your-db-username>
POSTGRES_PASSWORD=<your-strong-password>
POSTGRES_DB=finance_tracker
JWT_SECRET=<your-jwt-secret>
JWT_EXPIRES_IN=7d
NODE_ENV=production
PORT=3001
VITE_API_URL=http://localhost:3001
```

### 3. Backup .env File Securely

```bash
# Copy to secure location (encrypted USB drive, password manager, etc.)
# NEVER commit this file to git!
```

### 4. Deploy

```bash
# Build and start all services
docker-compose up -d --build

# View logs
docker-compose logs -f backend

# Check health
curl http://localhost:3001/health
```

## Upgrading

```bash
# Pull latest code
git pull origin main

# Backup database first!
docker exec finance-tracker-db pg_dump -U $POSTGRES_USER finance_tracker > backup-$(date +%Y%m%d).sql

# Rebuild and restart
docker-compose up -d --build

# Migrations run automatically on container start
```

## Security Checklist

- [ ] Generated cryptographically random passwords (32+ characters)
- [ ] `.env` file is not committed to git (check `.gitignore`)
- [ ] `.env` file backed up securely offline
- [ ] PostgreSQL port (5432) not exposed to internet (only localhost or internal network)
- [ ] JWT_SECRET is at least 32 characters
- [ ] Using HTTPS in production (via reverse proxy like Nginx/Caddy)
- [ ] Regular database backups scheduled
- [ ] OS and Docker images kept up to date

## Backup & Restore

### Backup Database
```bash
# Manual backup
docker exec finance-tracker-db pg_dump -U $POSTGRES_USER finance_tracker > backup.sql

# Automated daily backup (add to crontab)
0 2 * * * docker exec finance-tracker-db pg_dump -U $POSTGRES_USER finance_tracker > /backups/finance-tracker-$(date +\%Y\%m\%d).sql
```

### Restore Database
```bash
# Stop backend first
docker-compose stop backend

# Restore
docker exec -i finance-tracker-db psql -U $POSTGRES_USER finance_tracker < backup.sql

# Restart
docker-compose start backend
```

## Troubleshooting

### Container won't start - "connection refused"
- Check `.env` file exists and has correct credentials
- Verify PostgreSQL is healthy: `docker-compose logs postgres`

### Migrations fail
- Check DATABASE_URL in `.env` matches PostgreSQL credentials
- View migration logs: `docker-compose logs backend`
- Manually run: `docker-compose exec backend npx prisma migrate deploy`

### Password authentication failed
- Ensure POSTGRES_USER and POSTGRES_PASSWORD match in `.env`
- Recreate containers: `docker-compose down && docker-compose up -d`
