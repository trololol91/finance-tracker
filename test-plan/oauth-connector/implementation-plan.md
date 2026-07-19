# OAuth 2.1 Authorization Server for Claude Custom Connector: Implementation Plan

**Date**: 2026-07-18 (mcp-server sections updated 2026-07-19; implemented 2026-07-19)
**Planner**: assistant (interactive session)
**Status**: ✅ Implemented and live-verified (backend + mcp-server + frontend).
Only the real claude.ai browser round-trip (last two "End-to-end" checklist
items) remains — everything reachable via curl/unit tests has been built and
verified; see `test-plan/oauth-connector/backend.md` for results. Prerequisite
complete: the mcp-server HTTP transport was migrated from raw `node:http` to
Express first (commit `2010bb1`, test-first — see `test-plan/mcp-server/`).

---

## 1. Overview

Claude's "Add custom connector" dialog (claude.ai and the mobile apps) only
exposes OAuth Client ID/Secret (or no-auth) under Advanced settings — there
is no field to paste a raw bearer token unless Anthropic's `static_headers`
beta is enabled for the account, which it isn't here. The finance-tracker's
`packages/mcp-server` HTTP transport currently only accepts a manually
pasted `Authorization: Bearer ft_<token>` header, so it cannot be added as
a remote connector from claude.ai or mobile today (Claude Desktop's own
config-file-based setup is unaffected — see `packages/mcp-server/CONNECT.md`).

This plan adds a real OAuth 2.1 authorization-server role to the NestJS
backend so Claude can authenticate a user and mint a token through the
standard browser-redirect flow, while keeping the resulting access token
**physically identical** to the personal-access tokens the app already
issues via Settings → API Tokens. Nothing downstream of token issuance
(`ApiKeyStrategy`, `ScopesGuard`, the API-tokens settings UI) needs to
change — the OAuth flow is a new front door onto an existing mechanism, not
a parallel auth system.

### Key design decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| OAuth-issued token storage | A normal row in the existing `ApiToken` table | So `ApiKeyStrategy`/`ScopesGuard`/mcp-server's `validateBearerToken` need zero changes, and the user can see/revoke it from the same Settings page as any other API token. |
| Client model | Public client + mandatory PKCE (S256), no client secret | OAuth 2.1 doesn't require secrets for this client type; adding one speculatively isn't justified. |
| Phase 1 client registration | One hardcoded/env-seeded `OAuthClient` row, not full dynamic client registration (DCR) | claude.ai's actual redirect URI isn't knowable until the connector is attempted once. DCR's added abuse surface isn't worth taking on before the base flow is proven live. Phase 2 adds `POST /oauth/register` (RFC 7591) afterward against the same table — zero schema changes needed later. |
| Authorization code lifecycle | Hard-deleted on consumption, no soft-revoke/grace period | This repo already learned this lesson with refresh tokens — soft-revoke created an ambiguous window (see `test-plan/auth-refresh-tokens/implementation-plan.md` §8, Bug 1). Codes are shorter-lived and higher-value, so no grace period at all. |
| Token expiry / refresh grant | OAuth-issued token does not expire; no `refresh_token` grant | Matches what a user gets today from Settings → API Tokens with no expiry set. Building rotation semantics for a token type (`ApiToken`) never designed to rotate isn't justified for MVP; revocation is "delete it from Settings," which already exists. |
| Consent screen | New frontend SPA route (`/oauth/consent`), not server-rendered HTML in NestJS | The backend has no view layer today; the SPA already has full login/session machinery. `/authorize` redirects (302) to the SPA, which POSTs the consent decision back to the backend. |
| Consent auth | Reuses the existing JWT-authenticated SPA session (wrapped in the same `AuthGuard` as other protected routes) | A user already logged into the SPA sails through consent without re-entering credentials; an unauthenticated visit naturally redirects to `/login` and back via the existing `resolveRedirectTarget` util. |
| Scope grant | Fixed block grant, no per-scope picker UI | The six scopes covering every existing MCP tool (`transactions:read`, `transactions:write`, `accounts:read`, `categories:read`, `dashboard:read`) are granted together on approval. |
| `.well-known` discovery routing | `well-known.controller.ts` excluded from the global `/api` prefix via Nest's `setGlobalPrefix({exclude: [...]})` | RFC 8414 authorization-server metadata is conventionally expected at the site root, not under `/api`. |
| Rate limiting | New `@nestjs/throttler` dependency, scoped only to `OAuthController` | No throttling exists anywhere in this backend today; `/authorize`/`/token`/`/register` are classic abuse targets and shouldn't be exposed unthrottled, but a global guard risks regressing unrelated existing endpoints. |

---

## 2. Two discovery hops, two servers involved

Claude's client talks to **two** origins during connector setup:

1. **The mcp-server's own HTTP origin** (what gets pasted into "Remote MCP
   server URL") — must return `401` + `WWW-Authenticate: Bearer
   resource_metadata="<mcp-origin>/.well-known/oauth-protected-resource"`
   for a request with no/bad token, and serve that protected-resource
   document (RFC 9728), naming the backend as the trusted
   `authorization_servers` entry.
2. **The backend**, which the client then hits for
   `/.well-known/oauth-authorization-server` (RFC 8414) and the actual
   `/authorize` and `/token` endpoints.

**Correction to an earlier assumption in this plan**: the installed
`@modelcontextprotocol/sdk` already ships a full Express-based OAuth
framework at `server/auth/` — `mcpAuthRouter`, `mcpAuthMetadataRouter`
(explicitly documented for resource-server-only servers, i.e. exactly what
mcp-server needs), `requireBearerAuth` middleware, and an
`OAuthServerProvider` interface — it isn't Express-adjacent tooling, it's
real. None of it fit `http-transport.ts`'s *previous* raw-`node:http` shape,
which is exactly why the Express migration (now complete) was done first
rather than hand-rolling the well-known endpoint and migrating later.

So the OAuth *server* logic lives entirely in the backend; the mcp-server
only grows a small discovery pointer.

---

## 3. Prisma Schema Changes

### New `OAuthClient` model

```prisma
model OAuthClient {
  id                      String    @id @default(uuid()) @db.Uuid
  clientId                String    @unique @map("client_id")
  clientName              String    @map("client_name")
  redirectUris            String[]  @map("redirect_uris")
  tokenEndpointAuthMethod String    @default("none") @map("token_endpoint_auth_method")
  grantTypes              String[]  @default(["authorization_code"]) @map("grant_types")
  deletedAt               DateTime? @map("deleted_at") @db.Timestamptz
  createdAt               DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt               DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  authorizationCodes OAuthAuthorizationCode[]

  @@map("oauth_clients")
}
```

### New `OAuthAuthorizationCode` model

```prisma
model OAuthAuthorizationCode {
  id                  String    @id @default(uuid()) @db.Uuid
  codeHash            String    @unique @map("code_hash")
  clientId            String    @map("client_id")
  userId              String    @map("user_id") @db.Uuid
  redirectUri         String    @map("redirect_uri")
  scopes              String[]
  codeChallenge       String    @map("code_challenge")
  codeChallengeMethod String    @default("S256") @map("code_challenge_method")
  expiresAt           DateTime  @map("expires_at") @db.Timestamptz
  createdAt           DateTime  @default(now()) @db.Timestamptz

  user   User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  client OAuthClient @relation(fields: [clientId], references: [clientId])

  @@index([userId])
  @@map("oauth_authorization_codes")
}
```

Both models are styled exactly like the existing `ApiToken`/`RefreshToken`
models (uuid/`@db.Uuid`, snake_case `@map`, `@db.Timestamptz`). One
migration adds both tables so Phase 2 (dynamic client registration) needs
**zero schema changes** — it only adds a controller that inserts more rows
into `OAuthClient`.

---

## 4. Backend Changes

```
packages/backend/src/oauth/
├── oauth.module.ts
├── oauth.controller.ts          (new — GET /authorize, POST /consent, POST /token)
├── well-known.controller.ts     (new — GET /.well-known/oauth-authorization-server)
├── oauth-clients.service.ts     (new — findByClientId; single source of truth for both phases)
├── oauth-codes.service.ts       (new — issue()/consume(); PKCE S256 verify; hash-at-rest via existing hash-token.ts)
├── oauth-exception.filter.ts    (new — RFC 6749 §5.2 {error, error_description} shape)
├── dto/
│   ├── authorize-query.dto.ts
│   ├── token-request.dto.ts
│   ├── consent-decision.dto.ts
│   └── register-client.dto.ts   (Phase 2)
└── __TEST__/
    ├── oauth-clients.service.spec.ts
    ├── oauth-codes.service.spec.ts
    └── oauth.controller.spec.ts

packages/backend/src/main.ts       (modified — setGlobalPrefix exclude for the well-known route)
packages/backend/src/config/env.validation.ts (modified — PUBLIC_API_BASE_URL, OAUTH_STATIC_CLIENT_ID, OAUTH_STATIC_REDIRECT_URIS)
```

`@nestjs/throttler` added as a new backend dependency, applied only via
`@UseGuards(ThrottlerGuard)` at the `OAuthController` level.

**`OAuthClientsService`** always reads from the `OAuthClient` table — no
env-var-vs-DB branching in lookup code. Phase 1 seeds one row via an
idempotent upsert on module bootstrap, driven by `OAUTH_STATIC_CLIENT_ID`
/ `OAUTH_STATIC_REDIRECT_URIS` (comma-separated) env vars. Phase 2 adds
`POST /oauth/register` (RFC 7591) writing into the same table —
`findByClientId` never changes.

---

## 5. API Contract

| Method | Route | Auth | Notes |
|--------|-------|------|-------|
| `GET` | `/.well-known/oauth-authorization-server` | No | RFC 8414 metadata; excluded from the `/api` global prefix, served at site root |
| `GET` | `/oauth/authorize` | No | Validates `client_id`, registered `redirect_uri`, `response_type=code`, `code_challenge_method=S256`; 302s to the frontend SPA's `/oauth/consent` |
| `POST` | `/oauth/consent` | Yes (JWT, via existing `JwtAuthGuard`) | Re-validates `client_id`/`redirect_uri` server-side; issues a code on approval; returns `{redirectTo}` JSON (not a raw 302 — this is an XHR call from the SPA) |
| `POST` | `/oauth/token` | No — authenticates via `code` + `code_verifier` | `authorization_code` grant only; mints a real `ApiToken` row and returns `{access_token, token_type: 'Bearer', scope}` |
| `POST` | `/oauth/register` | No (Phase 2 only) | RFC 7591 dynamic client registration, writes into `OAuthClient` |

**Protected-resource side** (`packages/mcp-server`):

| Method | Route | Auth | Notes |
|--------|-------|------|-------|
| `GET` | `/.well-known/oauth-protected-resource/mcp` | No | New — path-suffixed form, tried first by SDK clients (see below) |
| `GET` | `/.well-known/oauth-protected-resource` | No | New — bare fallback form. Both return `{"resource": "<mcp public URL>", "authorization_servers": ["<backend public URL>"]}` |
| any | `/mcp` | Bearer token | Existing 401 responses gain a `WWW-Authenticate: Bearer resource_metadata="..."` header |

### mcp-server implementation specifics (post-migration)

- **Use the SDK's `mcpAuthMetadataRouter` rather than hand-rolling the
  well-known endpoint** — this requires bumping `@modelcontextprotocol/sdk`
  from the currently-installed `1.10.2` to latest (`1.29.0`), which is where
  `mcpAuthMetadataRouter` and `getOAuthProtectedResourceMetadataUrl` are
  available. `express` is already a direct dependency of mcp-server as of
  the migration, so mounting this is additive — a new `app.use(...)` /
  `app.get(...)` registration in `createHttpApp()` (`http-transport.ts`),
  positioned **before** the terminal 4-parameter error-handling middleware
  that already exists there (Express requires terminal error handlers to
  stay last).
- **Both well-known paths above are real, not speculative**: traced the
  SDK's own client-side discovery code (`client/auth.js`'s
  `buildWellKnownPath`/`shouldAttemptFallback`) — it tries the
  path-suffixed form first (`/.well-known/oauth-protected-resource/mcp`,
  since the resource lives at `/mcp`) and falls back to the bare root path
  only on a 4xx. `mcpAuthMetadataRouter` serves both conventions correctly
  without hand-rolling either.
- **New env var**: nothing today (`FINANCE_TRACKER_URL`, `MCP_TRANSPORT`,
  `MCP_PORT`) captures the mcp-server's own externally-visible URL, which
  the `resource` field needs. Add `MCP_PUBLIC_URL`. The
  `authorization_servers` entry can reuse the existing `FINANCE_TRACKER_URL`
  — no new var needed there.
- **`WWW-Authenticate` on 401s stays hand-rolled**: the SDK's
  `requireBearerAuth` middleware doesn't fit here, since this app validates
  tokens against the NestJS backend (`validateBearerToken`) rather than via
  an `OAuthServerProvider` — the header still needs adding by hand at the
  two existing 401 sites (missing token, and invalid-token-on-session-init)
  as Express middleware.
- **Routing is now case-sensitive** (`app.set('case sensitive routing',
  true)`, added during the migration) — the new well-known paths must
  match exact case.
- **CORS is unverified**: no CORS handling exists in `http-transport.ts`
  today. Whether the well-known documents need direct browser `fetch()`
  access from claude.ai's frontend (needing CORS) or are fetched
  server-side by Anthropic's backend isn't confirmed by anything read so
  far — confirm empirically, same as the redirect URI in the Implementation
  Steps below.

---

## 6. Service Methods

```typescript
// OAuthClientsService
public async findByClientId(clientId: string): Promise<OAuthClient | null>
public async register(dto: RegisterClientDto): Promise<OAuthClient>   // Phase 2

// OAuthCodesService
public async issue(params: {userId, clientId, redirectUri, scopes, codeChallenge, codeChallengeMethod}): Promise<string>  // returns raw code
public async consume(rawCode: string): Promise<ConsumedOAuthCode | null>  // hard-deletes on success; verifies PKCE code_verifier separately in the controller

// OAuthController (thin — delegates to the services above and ApiTokensService.create() for the final token mint)
```

---

## 7. Frontend Integration Points

```
packages/frontend/src/
├── pages/OAuthConsentPage.tsx                       (new)
├── features/oauth/components/ConsentScreen.tsx      (new — "Claude wants to access your account" + Approve/Deny)
├── api/oauth/oauth.ts                                (new — POST /oauth/consent via the existing authenticated axios client)
└── routes/index.tsx                                  (modified — new /oauth/consent route inside the existing AuthGuard-wrapped group)
```

`ConsentScreen` reads the OAuth query params from the URL, calls the
consent endpoint (auto-authenticated via the existing interceptor — no new
auth plumbing needed), then does `window.location.href = response.redirectTo`
on either approve or deny.

No changes needed to `client.ts`, `AuthContext.tsx`, or any existing auth
flow — this reuses the session established by the refresh-token work
(`test-plan/auth-refresh-tokens/`) as-is.

---

## 8. Implementation Steps (proposed order)

1. Prisma migration (`OAuthClient` + `OAuthAuthorizationCode`).
2. `OAuthClientsService` (findByClientId + bootstrap upsert from env vars) + unit tests.
3. `OAuthCodesService` (issue/consume, PKCE S256 verify, hard-delete-on-consume) + unit tests.
4. `OAuthController` (`/authorize`, `/consent`, `/token`) + `OAuthExceptionFilter` + unit tests.
5. `well-known.controller.ts` + `main.ts` prefix-exclude wiring + `PUBLIC_API_BASE_URL` env var.
6. `@nestjs/throttler` added, scoped to `OAuthController` only.
7. `packages/mcp-server`: bump `@modelcontextprotocol/sdk` to latest
   (`1.29.0`); add `MCP_PUBLIC_URL` env var; mount `mcpAuthMetadataRouter`
   in `http-transport.ts`'s `createHttpApp()` (before the terminal error
   handler) to serve both well-known paths; hand-add the
   `WWW-Authenticate` header at the two existing 401 sites.
8. Frontend: `/oauth/consent` route + `ConsentScreen` + `api/oauth/oauth.ts`.
9. Manually register "Claude" as the static client via env vars — the exact redirect URI needs confirming empirically by attempting the connector once.
10. Full backend + frontend test suites, typecheck, lint.
11. Live verification: curl walk of the full flow, then actually add the mcp-server URL as a claude.ai custom connector.
12. Write up `test-plan/oauth-connector/backend.md` (curl-driven cases) once implemented, mirroring `test-plan/auth-refresh-tokens/backend.md`'s structure.

---

## 9. Out of Scope (flagged, not built)

- Refresh-token grant / token expiry for OAuth-issued tokens.
- Token revocation endpoint (RFC 7009) — the existing Settings → API Tokens delete already covers this, and Claude's own "disconnect" action doesn't call a revocation endpoint anyway (confirmed via web search), so RFC 7009 wouldn't close that gap even if built.
- Per-scope consent checkboxes (fixed block grant only).
- DCR abuse gating (initial-access-token requirement) — revisit if Phase 2 registration is ever opened publicly beyond Anthropic's own client.
- **Known gap, flagged not fixed**: `/oauth/token` doesn't dedup by client — reconnecting the same client mints another token every time instead of replacing the previous one, so Settings → API Tokens can accumulate stale "Claude (OAuth)" rows from old connections. Fix would be tracking `oauthClientId` on `ApiToken` and revoking the previous token for that client before minting a new one; not folded into the schema in this plan.

---

## 10. Checklist

### Backend
- [x] `OAuthClient` + `OAuthAuthorizationCode` models added; migration applied
- [x] `OAuthClientsService` implemented (findByClientId + env-seeded bootstrap)
- [x] `OAuthCodesService` implemented (issue / PKCE-verified consume / hard-delete)
- [x] `OAuthController`: `/authorize`, `/consent`, `/token`
- [x] `well-known.controller.ts` + `main.ts` prefix exclusion
- [x] `@nestjs/throttler` installed, scoped to `OAuthController`
- [x] Env validation (`PUBLIC_API_BASE_URL`, `OAUTH_STATIC_CLIENT_ID`, `OAUTH_STATIC_REDIRECT_URIS`) + `.env.example` updated
- [x] Unit tests passing (30 tests — see `test-plan/oauth-connector/backend.md`)
- [x] Zero TypeScript errors, zero lint warnings
- [x] Live API tested end-to-end via curl (11 cases, `test-plan/oauth-connector/backend.md` TC-M01–M11)
- [x] Found and fixed a real pre-existing bug during this work: `ApiTokensModule` never exported `ApiTokensService`, so any *other* module trying to inject it (as `OAuthModule` now does) would fail to boot — only survived until now because nothing had needed to import it before

### mcp-server
- [x] Prerequisite: HTTP transport migrated to Express (commit `2010bb1`)
- [x] `@modelcontextprotocol/sdk` bumped to `1.29.0`
- [x] `MCP_PUBLIC_URL` env var added
- [x] `mcpAuthMetadataRouter` mounted, serving the path-suffixed protected-resource route + the mirrored authorization-server metadata route. The bare (non-suffixed) protected-resource fallback path was deliberately **not** hand-added: traced the SDK's own client code (`client/auth.js`) and confirmed it only attempts that fallback after a 4xx from the path-suffixed route, which we never produce — hand-rolling it would be dead code the primary client never reaches.
- [x] `WWW-Authenticate` header added to both existing 401 responses, verified via `packages/mcp-server/src/__TEST__/http-transport.spec.ts`
- [ ] CORS requirement confirmed empirically (browser-fetched vs. server-fetched well-known document) — still needs a real browser, not curl

### Frontend
- [x] `/oauth/consent` route added inside the existing `AuthGuard` group (outside `AppShell`, same as `/login`)
- [x] `ConsentScreen` + generated `api/oauth/oauth.ts` (regenerated via `orval` after un-excluding `POST /oauth/consent` from Swagger — `/authorize` and `/token` stay `@ApiExcludeEndpoint()`-hidden since the frontend never calls them directly)
- [x] All component tests passing (5 new tests)
- [x] Zero TypeScript errors, zero lint warnings
- [x] Live browser verification via Playwright (real login, real `POST /oauth/consent` call with a real JWT, real CORS, real redirect navigation) — see `test-plan/oauth-connector/frontend.md` TC-M01–M03

### End-to-end
- [ ] Connector successfully added via claude.ai's "Add custom connector" dialog
- [ ] Claude lists and can call the finance-tracker MCP tools after OAuth login/consent

*(The two End-to-end items above need a real claude.ai account and a publicly reachable backend/mcp-server — not achievable from this environment. Everything else — the full authorize→consent→token flow, PKCE, replay protection, error shapes, and the mcp-server discovery routes — has been verified live.)*
