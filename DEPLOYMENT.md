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
| `VITE_API_BASE_URL` | **Browser-facing** URL of the backend API |

> **Important — `VITE_API_BASE_URL`:** This must be the address your *browser* uses to reach
> the backend API — not an internal Docker hostname.
>
> - Home server accessed by IP: `http://192.168.1.x:3001`
> - Home server accessed by hostname: `http://myserver.local:3001`
> - Subdomain routing: `https://finance-api.server.com`
> - Local machine only: `http://localhost:3001`
>
> The value is injected at container startup (not baked into the image), so you can change it
> in `.env` and restart the frontend container without rebuilding: `docker compose restart frontend`.

### 3. Back Up `.env` Securely

The `.env` file contains your secrets. Store a copy on an encrypted USB drive or password manager.
**Never commit it to git** (it is already in `.gitignore`).

### 4. Deploy

```bash
docker compose up -d --build
```

### 5. Create Your Admin Account

Register via the API, then promote the account to admin directly in the database:

```bash
# Register
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"yourpassword","name":"Your Name"}'

# Promote to admin
source .env
docker compose exec postgres psql -U $POSTGRES_USER $POSTGRES_DB \
  -c "UPDATE \"User\" SET role='ADMIN' WHERE email='you@example.com';"
```

> Do not run the dev seed (`prisma db seed`) in production — it creates accounts with
> known default passwords.

### 6. Install Playwright Browsers

The scraper feature requires Chromium. Browser binaries are stored in a Docker volume (not
the image) and only need to be installed once:

```bash
docker compose exec backend npx playwright install chromium
```

> Skip this step if you don't use the bank scraper feature.

### 7. Verify

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
- If Playwright was upgraded, reinstall the browser: `docker compose exec backend npx playwright install chromium`

---

## Publishing Images

Pre-built images let others deploy without the source code — they only need
`docker-compose.release.yml` and a `.env` file.

### 1. Set your registry

Edit `scripts/publish.sh` and replace `ghcr.io/yourusername` with your actual registry path,
or pass it as an environment variable:

```bash
# GitHub Container Registry (free for personal use)
export REGISTRY=ghcr.io/yourusername

# Docker Hub
export REGISTRY=docker.io/yourusername
```

### 2. Log in

```bash
# GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u yourusername --password-stdin

# Docker Hub
docker login
```

### 3. Publish

```bash
# Tag as :latest only
./scripts/publish.sh

# Tag as a version AND :latest
./scripts/publish.sh 1.2.0
```

### 4. Share with others

Provide two files:
- `docker-compose.release.yml`
- `.env.example`

They then:
```bash
cp .env.example .env
# edit .env with their credentials and VITE_API_BASE_URL
docker compose -f docker-compose.release.yml up -d
docker compose -f docker-compose.release.yml exec backend npx playwright install chromium
```

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

The most common cause is a wrong `VITE_API_BASE_URL`. Check that:

1. The value in `.env` matches the address your browser uses to reach the backend.
2. The frontend container was restarted after changing the value: `docker compose restart frontend`.
3. The backend is healthy: `curl http://localhost:3001/health`.

### Scraper fails — "Executable doesn't exist" or browser won't launch

Playwright browsers are not bundled in the image. Install them:

```bash
docker compose exec backend npx playwright install chromium
```

If the `playwright_browsers` volume was deleted, this will re-download (~300 MB).
For headless:false scrapers, Xvfb is started automatically — no extra steps needed.

### Password authentication failed for PostgreSQL

Credentials are stored in the `postgres_data` Docker volume. If you change credentials in
`.env` after the volume already exists, PostgreSQL will reject the new values.
Either use the original credentials or recreate the volume (destroys data):

```bash
docker compose down -v
docker compose up -d --build
```
