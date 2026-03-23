# Build Requirements and Order

## Package Dependency Graph

```
plugin-sdk
├── scraper-cibc          (built for release asset)
├── scraper-td-credit-card (built for release asset)
├── scraper-stub          (used by backend at runtime for dev/testing)
└── backend               (also depends on scraper-stub and scraper-cibc)

frontend                  (no workspace dependencies — uses generated API client)
```

`plugin-sdk` must be built before any package that depends on it. All other packages are independent of each other.

---

## Generated Artifacts

| Artifact | Package | How to generate | Required before |
|---|---|---|---|
| `packages/plugin-sdk/dist` | plugin-sdk | `npm run build -w packages/plugin-sdk` | building backend, scrapers |
| `packages/scraper-stub/dist` | scraper-stub | `npm run build -w packages/scraper-stub` | building/typechecking backend |
| `node_modules/.prisma/client` | backend | `npm run prisma:generate -w packages/backend` | typechecking/testing backend |
| `packages/frontend/src/api/` | frontend | `npm run generate:api -w packages/frontend` | typechecking/linting/testing frontend |

`src/api/` is gitignored and must be regenerated from the committed `openapi.json` snapshot. To regenerate from a live backend instead, use `generate:api:live`.

---

## Local Development

```bash
npm ci

# If working on backend or scrapers
npm run build -w packages/plugin-sdk

# If working on backend
npm run build -w packages/scraper-stub
npm run prisma:generate -w packages/backend

# If working on frontend
npm run generate:api -w packages/frontend
```

---

## CI (typecheck, lint, test:coverage)

Both packages run in parallel. Each runner installs all dependencies with `npm ci`, then:

**Backend runner**
1. Build `plugin-sdk`
2. Build `scraper-stub`
3. Generate Prisma client
4. Typecheck → Lint → Test (coverage)

**Frontend runner**
1. Generate API client (from `openapi.json`)
2. Typecheck → Lint → Test (coverage)

---

## Release Build Order

Release jobs run in parallel after CI passes:

| Job | Build steps |
|---|---|
| `build-scraper-cibc` | `npm ci` → build `plugin-sdk` → build + pack `scraper-cibc` |
| `build-scraper-td-credit-card` | `npm ci` → build `plugin-sdk` → build + pack `scraper-td-credit-card` |
| `build-backend` | Docker build + push |
| `build-frontend` | Docker build + push |

All four jobs must complete before the `release` job uploads assets and creates the GitHub Release.
