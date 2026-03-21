# Finance Tracker — Deployment Guide

## Initial Deployment

### 1. Generate Secure Credentials

```bash
openssl rand -base64 32   # use once for POSTGRES_PASSWORD
openssl rand -base64 32   # use again for JWT_SECRET
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in at minimum:

| Variable | Description |
|----------|-------------|
| `POSTGRES_USER` | Database username (e.g. `finance`) |
| `POSTGRES_PASSWORD` | Strong random password (32+ chars) |
| `JWT_SECRET` | Strong random secret (32+ chars) |
| `VITE_API_URL` | **Browser-facing** URL of the backend API |

> **Important — `VITE_API_URL`:** This value is baked into the frontend bundle at build time.
> It must be the address your *browser* uses to reach port 3001, not an internal Docker hostname.
>
> - Home server accessed by IP: `http://192.168.1.x:3001`
> - Home server accessed by hostname: `http://myserver.local:3001`
> - Local machine only: `http://localhost:3001`
>
> If you change this value later, you must rebuild the frontend image (`docker compose build frontend`).

### 3. Back Up `.env` Securely

The `.env` file contains your secrets. Store a copy on an encrypted USB drive or password manager.
**Never commit it to git** (it is already in `.gitignore`).

### 4. Deploy

```bash
docker compose up -d --build
```

### 5. Verify

```bash
docker compose ps                    # all services should show "healthy"
curl http://localhost:3001/health    # expect: {"status":"ok"}
# Open in browser: http://<server-ip>:3002
```

**Boot order (enforced by health checks):**
`postgres` → `backend` (runs `prisma migrate deploy`) → `frontend`

---

## Upgrading

```bash
# 1. Back up the database FIRST
source .env
docker exec finance-tracker-db \
  pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup-$(date +%Y%m%d-%H%M%S).sql

# 2. Pull latest code
git pull origin main

# 3. Rebuild and restart
docker compose up -d --build

# 4. Verify
docker compose ps
docker compose logs --tail=50 backend
curl http://localhost:3001/health
```

**Notes:**
- Prisma runs `migrate deploy` automatically on every backend startup — safe to re-run.
- If a migration fails, the backend container will exit with a non-zero code.
  Restore the backup, investigate with `docker compose logs backend`, then redeploy.
- If `VITE_API_URL` is unchanged, Docker's layer cache makes the frontend rebuild fast.

---

## Backup & Restore

### Manual backup

```bash
source .env
docker exec finance-tracker-db \
  pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup.sql
```

### Automated daily backup (crontab)

```cron
0 2 * * * source /path/to/finance-tracker/.env && docker exec finance-tracker-db pg_dump -U $POSTGRES_USER $POSTGRES_DB > /backups/finance-tracker-$(date +\%Y\%m\%d).sql
```

### Restore

```bash
# Stop backend first to avoid writes during restore
docker compose stop backend

source .env
docker exec -i finance-tracker-db \
  psql -U $POSTGRES_USER $POSTGRES_DB < backup.sql

docker compose start backend
```

---

## Security Checklist

- [ ] `POSTGRES_PASSWORD` is 32+ random characters
- [ ] `JWT_SECRET` is 32+ random characters
- [ ] `.env` is **not** committed to git
- [ ] `.env` is backed up securely offline
- [ ] PostgreSQL port 5432 is **not** exposed to the internet
- [ ] OS and Docker images are kept up to date
- [ ] Regular database backups are scheduled

---

## Troubleshooting

### Backend won't start — "connection refused" or DB errors

```bash
docker compose logs postgres   # check DB is healthy
docker compose logs backend    # check migration output
```

Verify that `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` in `.env` match what
PostgreSQL was initialised with. If you change credentials on an existing volume, you must
recreate it: `docker compose down -v && docker compose up -d --build` (destroys DB data).

### Migrations fail

```bash
docker compose logs backend
# Manually re-run migrations:
docker compose exec backend npx prisma migrate deploy
```

### Frontend shows "Network Error" or blank page

The most common cause is a wrong `VITE_API_URL`. Check that:

1. The value in `.env` matches the address your browser uses to reach the backend.
2. The frontend image was rebuilt after changing the value (`docker compose build frontend`).
3. The backend is healthy: `curl http://localhost:3001/health`.

### Password authentication failed for PostgreSQL

Credentials are stored in the `postgres_data` Docker volume. If you change credentials in
`.env` after the volume already exists, PostgreSQL will reject the new values.
Either use the original credentials or recreate the volume (destroys data):

```bash
docker compose down -v
docker compose up -d --build
```
