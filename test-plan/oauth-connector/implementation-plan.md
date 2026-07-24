# OAuth 2.1 Authorization Server for Claude Custom Connector: Implementation Plan

**Date**: 2026-07-18 (mcp-server sections updated 2026-07-19; Phase 1
implemented 2026-07-19; Phase 2 planned and implemented 2026-07-19)
**Planner**: assistant (interactive session)
**Status**: ✅ Phase 1 **and** Phase 2 implemented, and live-verified (backend
+ mcp-server + frontend). Phase 1 committed as `1fa4f60`; Phase 2 (dynamic
client registration, gated behind an admin-issued Initial Access Token —
§11) not yet committed. Only the real claude.ai/GitHub Copilot browser
round-trips (the "End-to-end" checklist items) remain — everything
reachable via curl/unit tests/Playwright has been built and verified; see
`test-plan/oauth-connector/backend.md` and `frontend.md` for results.
Prerequisite complete: the mcp-server HTTP transport was migrated from raw
`node:http` to Express first (commit `2010bb1`, test-first — see
`test-plan/mcp-server/`).

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

**Correction to an earlier assumption in this plan**: the MCP SDK already
ships a full Express-based OAuth framework — `mcpAuthRouter`,
`mcpAuthMetadataRouter` (explicitly documented for resource-server-only
servers, i.e. exactly what mcp-server needs), `requireBearerAuth`
middleware, and an `OAuthServerProvider` interface — it isn't
Express-adjacent tooling, it's real. (True of both the v1
`@modelcontextprotocol/sdk` package this was originally written against and
the v2 `@modelcontextprotocol/server`/`/express` packages mcp-server
actually runs on now — see §5's note.) None of it fit `http-transport.ts`'s
*previous* raw-`node:http` shape, which is exactly why the Express
migration (now complete) was done first rather than hand-rolling the
well-known endpoint and migrating later.

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

### mcp-server implementation specifics

> **Superseded 2026-07-24**: mcp-server migrated off `@modelcontextprotocol/sdk`
> v1 entirely onto the split v2 beta packages
> (`@modelcontextprotocol/server`/`/express`/`/node`, stateless 2026-07-28
> protocol) — a bigger rewrite than originally scoped here, done as its own
> piece of work. Full design/verification:
> `test-plan/mcp-server/backend.md` and
> `test-plan/mcp-server/backend-report-sdk-v2-migration.md`. The bullets
> below are corrected to match what's actually running now; the original
> "bump to `1.29.0`" plan this section described is stale and kept only for
> history in git blame, not reproduced here.

- **`mcpAuthMetadataRouter` and `requireBearerAuth` both come from
  `@modelcontextprotocol/express`** (not `@modelcontextprotocol/sdk`, which
  no longer exists in mcp-server's dependency tree at all). Mounted in
  `createHttpApp()` (`http-transport.ts`), before the terminal 4-parameter
  error-handling middleware, same positioning constraint as originally
  planned.
- **Both well-known paths are real, not speculative** (unchanged from the
  original investigation): the SDK's client-side discovery code tries the
  path-suffixed form first (`/.well-known/oauth-protected-resource/mcp`)
  and falls back to the bare root path only on a 4xx this server never
  produces — the bare fallback route is deliberately not hand-added, same
  reasoning as before, re-confirmed against the v2 client's actual source.
- **`MCP_PUBLIC_URL`**: added as planned, unchanged.
- **`WWW-Authenticate` is no longer hand-rolled** — this is the one
  substantive behavior change from the original plan. `requireBearerAuth`
  (from `@modelcontextprotocol/express`) builds the header itself once
  given a `resourceMetadataUrl`, backed by a small `BackendTokenVerifier`
  class that wraps the existing backend check
  (`checkTokenWithBackend`/`validateBearerToken` in `server.ts`). This was
  only possible because the SDK's auth story changed shape between v1 and
  v2 — v1's equivalent middleware assumed an `OAuthServerProvider`, which
  didn't fit this app's NestJS-backend-validates-the-token model; v2's
  `OAuthTokenVerifier` interface is a much narrower "just verify a token"
  contract that does fit. There's also no more "session-init" 401 site to
  special-case — auth is now checked on **every** request, not once per
  session (the stateless migration's other headline change), so there's
  exactly one 401 site, not two.
- **Routing is case-sensitive** (unchanged) — the well-known paths must
  match exact case.
- **CORS is still unverified**: unchanged from the original plan — no CORS
  handling exists in `http-transport.ts`. Still needs confirming
  empirically with a real browser, not curl.

---

## 6. Service Methods

```typescript
// OAuthClientsService
public async findByClientId(clientId: string): Promise<OAuthClient | null>
public async register(dto: RegisterClientDto): Promise<OAuthClient>   // Phase 2 — full spec in §11.4

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
7. `packages/mcp-server`: add `MCP_PUBLIC_URL` env var; mount
   `mcpAuthMetadataRouter` + `requireBearerAuth` (both from
   `@modelcontextprotocol/express`) in `http-transport.ts`'s
   `createHttpApp()` (before the terminal error handler) to serve both
   well-known paths and build the `WWW-Authenticate` header automatically —
   no hand-rolled header code needed. (Superseded 2026-07-24: this step
   originally assumed staying on `@modelcontextprotocol/sdk` v1; mcp-server
   has since migrated to the v2 packages entirely — see §5's note.)
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
- Dynamic client registration itself — Phase 1 supports exactly one hardcoded client. See §11 for the full Phase 2 plan (now scoped, not yet built).
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
- [x] `@modelcontextprotocol/sdk` v1 bumped to `1.29.0`, then (2026-07-24)
      migrated off it entirely onto the split v2 beta packages — see
      `test-plan/mcp-server/backend-report-sdk-v2-migration.md`
- [x] `MCP_PUBLIC_URL` env var added
- [x] `mcpAuthMetadataRouter` (now from `@modelcontextprotocol/express`)
      mounted, serving the path-suffixed protected-resource route + the
      mirrored authorization-server metadata route. The bare (non-suffixed)
      protected-resource fallback path was deliberately **not** hand-added:
      traced the SDK's own client code and confirmed it only attempts that
      fallback after a 4xx from the path-suffixed route, which we never
      produce — hand-rolling it would be dead code the primary client
      never reaches. Re-confirmed against the v2 client during the SDK
      migration.
- [x] `WWW-Authenticate` header verified present on 401s — as of the SDK v2
      migration this is built automatically by `requireBearerAuth` (from
      `@modelcontextprotocol/express`), not hand-rolled code in this repo;
      verified via `packages/mcp-server/src/__TEST__/http-transport.spec.ts`
      and a live curl walk (see the SDK v2 migration report)
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
- [ ] (Phase 2) GitHub Copilot (or another real DCR-capable client) successfully self-registers via the discovered `registration_endpoint` and completes the flow with an admin-issued IAT

*(These End-to-end items need a real claude.ai/Copilot account and a publicly reachable backend/mcp-server — not achievable from this environment. Everything else — the full authorize→consent→token flow for both a static and a self-registered client, PKCE, replay protection, error shapes, IAT gating, and the mcp-server discovery routes — has been verified live.)*

---

## 11. Phase 2: Dynamic Client Registration (Implemented and live-verified 2026-07-19)

### 11.1 Motivation

Phase 1 supports exactly **one** OAuth client, hardcoded via
`OAUTH_STATIC_CLIENT_ID`/`OAUTH_STATIC_REDIRECT_URIS` env vars. Adding a
second real client (e.g. GitHub Copilot, or any other MCP-compatible tool
that speaks OAuth 2.1) is currently impossible without editing `.env` and
restarting the backend for every new client, and — more fundamentally —
without knowing that client's exact `client_id` and `redirect_uri` in
advance, which for most third-party clients isn't published anywhere and
isn't stable enough to hardcode. This is the exact problem RFC 7591
(OAuth 2.0 Dynamic Client Registration) exists to solve, and the schema
from Phase 1 was deliberately designed for it: `OAuthClient` needs **zero
schema changes** for Phase 2 (§3).

### 11.2 Design decision: registration is gated behind an Initial Access Token

RFC 7591 describes two common deployment modes: fully open registration, or
registration gated behind an **Initial Access Token** (IAT) issued
out-of-band by the authorization server operator (§3 of the RFC).

The natural first instinct is to gate `/oauth/register` behind the app's
own JWT auth (matching how `/admin/*` routes work) — but that's wrong:
real DCR-capable clients generally check the authorization-server metadata
for a `registration_endpoint` and, if present, self-register automatically
with **no human in the loop**, since that's the whole design goal of DCR.
A client can't obtain this app's own JWT, so gating registration behind it
would make Phase 2 unusable by the clients it's meant to support.

**Correction (2026-07-20), confirmed via [Anthropic's connector docs](https://claude.com/docs/connectors/building/authentication)
and the actual "Add custom connector" dialog**: the "and likely Claude too"
assumption originally in this paragraph was wrong. Claude's connector setup
has no field to supply a bearer token during registration at all — no IAT,
no registration token, nothing — so an IAT-gated `/oauth/register` was
never actually reachable *or* a blocker for Claude specifically. More
importantly, Claude only attempts DCR when the "Add custom connector"
dialog's **OAuth Client ID** field is left blank; supplying it (this
server's static `claude-ai` client) makes Claude "avoid dynamic client
registration entirely," per Anthropic's own docs. So Claude was always
going to use the Phase 1 static client, not Phase 2's DCR path — see
`packages/mcp-server/CONNECT.md`'s OAuth section, corrected the same day
this was found (it previously told users to leave Client ID blank, which
would have made Claude fall back to DCR and fail with a 401 against the
IAT gate). The IAT-gating decision below still stands for its original
purpose — Copilot and other real DCR-capable clients that *do* have
somewhere to configure a registration token — it just never applied to
Claude.

**Revised decision (superseding an earlier draft of this section that
recommended open registration): gate `POST /oauth/register` behind an
Initial Access Token.** The earlier reasoning was that "registering a
client grants nothing by itself," which is true in isolation but misses
the actual attack this enables:

> Open registration lets an attacker register a client with
> `client_name: "Claude"` and their own `redirect_uri`, then send a
> logged-in user a crafted `/oauth/authorize` link. `AuthGuard` doesn't
> re-prompt for credentials (the user's already signed in), so they land
> straight on the consent screen — which, showing only `client_name`,
> displays exactly the branding the attacker chose. If approved, the
> attacker's own client (which generated the PKCE challenge in the crafted
> link) immediately exchanges the code for a real, full-access `ft_...`
> token. **Being logged in isn't the security boundary here — it's the
> attacker's precondition, not something they need to defeat.** Showing
> the real `client_name` (§11.4) only helps against unsophisticated
> impersonation; it does nothing against an attacker who deliberately sets
> `client_name` to something trustworthy-sounding.

IAT gating closes this at the root: an attacker without a valid IAT cannot
register a client at all, so the crafted-link phishing chain above never
gets step one. For this app's actual use case — a small, known set of
clients (Claude, Copilot, maybe a couple more) rather than open public
registration — issuing one IAT per client during its setup is not a
meaningful burden, unlike a scenario with many unknown/anonymous
registrants where IAT distribution itself becomes the bottleneck.

**Also added regardless of the gating decision**: the consent screen now
shows the redirect URI's **domain**, not just `client_name` (§11.4) — the
domain can't be spoofed the same way a self-chosen display name can, and
is the stronger of the two signals (matches how Google's/GitHub's own
OAuth consent screens display the redirecting domain for exactly this
reason).

**Addendum (2026-07-20): `OAUTH_REGISTRATION_OPEN` escape hatch added.**
The "small, known set of clients" assumption above hasn't held up in
practice: neither Claude nor GitHub Copilot's real DCR implementations have
anywhere to supply an IAT (confirmed via official docs and issue trackers —
see `packages/mcp-server/CONNECT.md`'s "OAuth for other clients" and
"GitHub Copilot" sections for the specifics and sources), so as shipped,
IAT-gated DCR is unusable by every real client currently identified,
including the one that motivated building it. Rather than remove the gate
outright, added an env var (`IatGuard`, `env.validation.ts`) that makes it
a no-op when explicitly set — defaults to `false` (gated, unchanged
behavior) so nothing changes for existing deployments; a backend operator
can temporarily set it to `true` to test/use a specific DCR client, same
tradeoff as if the gate had never been built (relying solely on the
redirect-domain display, §11.4, as the anti-phishing signal — the same
model Google/GitHub run their own open-registration ecosystems on).
Deliberately not the default, since there's no evidence yet that any real
client actually needs it enabled continuously rather than for occasional
testing.

### 11.3 Initial Access Tokens: issuance and enforcement

**New Prisma model** (this is the one place Phase 2 does need a schema
change — the "zero schema changes" claim in §3/§11.1 was specific to
`OAuthClient`/`OAuthAuthorizationCode`, both already shaped for Phase 2;
IATs are a genuinely new Phase 2 concept):

```prisma
model OAuthInitialAccessToken {
  id         String    @id @default(uuid()) @db.Uuid
  tokenHash  String    @unique @map("token_hash")
  label      String    // admin-supplied, e.g. "GitHub Copilot setup"
  expiresAt  DateTime  @map("expires_at") @db.Timestamptz
  lastUsedAt DateTime? @map("last_used_at") @db.Timestamptz
  createdAt  DateTime  @default(now()) @map("created_at") @db.Timestamptz

  @@map("oauth_initial_access_tokens")
}
```

Styled like every other opaque-credential table in this app (hash-at-rest
via the existing `hash-token.ts`, uuid/`@db.Uuid`, snake_case `@map`).

**Issuance** — `POST /oauth/initial-access-tokens`, JWT + the existing
`AdminGuard` (matching `/admin/*` conventions; this is the one endpoint in
the whole OAuth flow that legitimately *should* require being logged in as
admin, since it's the actual access-control decision point):

- Request: `{label: string, expiresInHours?: number}` (default 24h —
  short-lived by default; a leaked IAT is a standing risk only until it
  expires, so default short rather than requiring the admin to remember to
  revoke it).
- Response: `{token: string, label, expiresAt}` — the raw token is shown
  **once**, matching `ApiTokensService.create()`'s existing convention.
  Hand this value to whatever client's setup flow asks for a "registration
  token" / "DCR token" (naming varies by client).

**Enforcement in `POST /oauth/register`**: requires
`Authorization: Bearer <IAT>`. Missing/unknown/expired → `401`
`{error: 'invalid_token'}` (RFC 6750 Bearer-usage error convention,
reshaped through the existing `OAuthExceptionFilter` like every other
OAuth error in this app). On a successful registration, updates
`lastUsedAt` but does **not** invalidate the token — it stays valid for
repeat registrations until `expiresAt`, deliberately not single-use. A
strictly single-use IAT would make a client's reinstall/re-registration
fail confusingly (the token that worked yesterday inexplicably rejected
today); an admin who wants single-use behavior can just set a very short
`expiresInHours`.

### 11.4 Prerequisite fix: consent screen must show the real client and its redirect domain, not a hardcoded "Claude"

Found while planning this phase, and worth fixing regardless of IAT
gating: `ConsentScreen.tsx` currently hardcodes **"Connect Claude to
Finance Tracker"** as its title and "Claude is requesting access..." in its
body copy — it never reads or displays which client is actually asking.
`OAuthController.token()` similarly hardcodes the minted token's name as
`'Claude (OAuth)'` regardless of which client requested it. Both need to
become dynamic before a second client exists, or every approval screen and
every Settings → API Tokens row would misleadingly say "Claude" even for a
Copilot connection.

- `GET /oauth/authorize` already looks up the client (`OAuthClientsService.findByClientId`)
  to validate `redirect_uri` — it now also forwards `client_name` (the
  looked-up `client.clientName`, URL-encoded) as a query param on its
  redirect to `/oauth/consent`, the same way it already forwards `scope`
  (added during the Phase 1 code-review pass, §"Fix" notes).
- `ConsentScreen.tsx` reads `client_name` off its own URL (same pattern as
  `scopes`) and renders `"${client_name} wants to access your Finance
  Tracker account"` / `"If you approve, ${client_name} will be able
  to:"` instead of the hardcoded strings. Missing `client_name` joins the
  existing missing-required-param fallback UI.
- `ConsentScreen.tsx` **also** derives and displays the redirect URI's
  domain — `new URL(redirect_uri).host`, e.g. `"You'll be redirected to:
  github.com"` — from `redirect_uri`, which the screen already reads (no
  new param needed for this part; §11.2's stronger, unspoofable signal).
- `OAuthController.token()` looks up the client by `consumed.clientId`
  (one extra `findByClientId` call) and mints the token as
  `` `${client.clientName} (OAuth)` `` instead of the hardcoded string.

### 11.5 New endpoints: `POST /oauth/register` and `POST /oauth/initial-access-tokens`

| Method | Route | Auth | Notes |
|--------|-------|------|-------|
| `POST` | `/oauth/register` | **Yes** — `Authorization: Bearer <IAT>` (§11.3), rate-limited the same way `/authorize`/`/token` already are | RFC 7591 dynamic client registration |
| `POST` | `/oauth/initial-access-tokens` | Yes (JWT + `AdminGuard`) | Issues a new IAT for a client's setup flow (§11.3) |

Request body (`RegisterClientDto` — a deliberately small subset of RFC
7591's full client-metadata surface; only what this AS actually uses):

```typescript
export class RegisterClientDto {
    @ApiProperty()
    @IsString() @IsNotEmpty() @MaxLength(100)
    client_name!: string;

    @ApiProperty({type: [String]})
    @IsArray() @ArrayMinSize(1)
    @IsUrl({}, {each: true})
    redirect_uris!: string[];
}
```

Response (RFC 7591 §3.2.1 shape; no `client_secret` — public client +
mandatory PKCE, same decision as Phase 1's static client):

```json
{
  "client_id": "3f9a2b1c8e4d5f6a7b8c9d0e1f2a3b4c",
  "client_name": "GitHub Copilot",
  "redirect_uris": ["https://github.com/copilot/oauth/callback"],
  "token_endpoint_auth_method": "none",
  "grant_types": ["authorization_code"],
  "response_types": ["code"]
}
```

`client_id` generation: `crypto.randomBytes(16).toString('hex')` — matches
the entropy/generation convention already used for the `ft_`/`oac_`-prefixed
opaque tokens elsewhere in this codebase (`ApiTokensService.create`,
`OAuthCodesService.issue`). Not a secret (public clients don't have one),
just needs to be unique — already enforced by `OAuthClient.clientId`'s
`@unique` constraint from Phase 1's schema.

**`OAuthClientsService.register(dto: RegisterClientDto): Promise<OAuthClient>`**
— the stub signature already sketched in §6 — simply `create()`s a new row
with `tokenEndpointAuthMethod: 'none'`, `grantTypes: ['authorization_code']`,
same shape as `ensureStaticClient`'s `create` branch, but without the
upsert-on-existing-clientId logic (registration always creates a new row —
there's no "the same client re-registering" concept in RFC 7591; each
registration is a fresh credential, by design). The IAT check (§11.3)
happens in the controller, before this is called.

### 11.6 Discovery: advertise the registration endpoint

`well-known.controller.ts`'s `getAuthorizationServerMetadata()` must add:

```typescript
registration_endpoint: `${baseUrl}/api/oauth/register`,
```

Without this, a real DCR-capable client has no standard way to discover
that registration is even possible — RFC 8414 metadata's optional
`registration_endpoint` claim is exactly how clients find it. Since this
metadata document is mirrored in `packages/mcp-server/src/oauth-metadata.ts`
(fixed to stay in sync during the Phase 1 code-review pass — see finding
#6 in `code-review.md`), that mirror needs the same field added at the
same time, or the drift-prevention fix from Phase 1 immediately regresses
for this one field. Note RFC 8414 has no standard metadata claim for "this
registration endpoint requires an IAT" — a client attempting open
registration just gets a `401 invalid_token`; the IAT itself is configured
into the client out-of-band (e.g. a "Registration token" field in its own
OAuth setup, a pattern some DCR-supporting clients have a slot for).
**Confirmed (2026-07-20) Claude's own connector UI is not one of them** —
its "Add custom connector" dialog has no such field, and per Anthropic's
docs, supplying a static Client ID instead sidesteps DCR entirely, so
Claude never actually needs this endpoint (see the §11.2 correction above).

### 11.7 Coexistence with the Phase 1 static client

No changes needed to `OAuthModule.onModuleInit()`'s static-client bootstrap
— it keeps idempotently upserting the env-seeded row (e.g. `claude-ai`) on
every boot exactly as today. Phase 2 just adds more rows to the same table
via a different write path. `findByClientId` already reads from the table
uniformly regardless of a row's origin (documented as a design goal back
in §3/§4) — genuinely zero changes needed there.

### 11.8 Admin visibility (optional, not blocking)

IAT *issuance* (§11.3) is already a required admin-facing endpoint —
that's not optional, since without it there's no way to hand a client a
token to register with. What's still optional here is *listing what's
already registered*:

- Minimal: `npm run prisma:studio` to eyeball the `oauth_clients` /
  `oauth_initial_access_tokens` tables.
- Nicer, deferred: `GET /oauth/clients` (JWT + `AdminGuard`) listing
  `{clientId, clientName, redirectUris, createdAt}` for every non-deleted
  row, and similarly `GET /oauth/initial-access-tokens` for outstanding
  IATs (label, expiresAt, lastUsedAt — never the token itself, already
  hashed at rest). Natural home: a small "Connected Apps" section in
  Settings, alongside API Tokens. Flagged as a follow-up UI feature, not
  part of Phase 2's core scope.

### 11.9 Implementation steps (proposed order)

1. Prisma migration: `OAuthInitialAccessToken` (§11.3).
2. `OAuthInitialAccessTokensService` (issue via hash-at-rest, validate by
   raw-token lookup + expiry check) + unit tests.
3. `OAuthController` (or a small dedicated controller): add
   `POST /oauth/initial-access-tokens` (JWT + `AdminGuard`) + tests.
4. `register-client.dto.ts` + `OAuthClientsService.register()` + unit tests
   (uniqueness, no-`client_secret`-in-response, rejects an empty
   `redirect_uris` array).
5. `OAuthController`: add `POST /oauth/register`, enforcing the IAT check
   before calling `register()`; `@Throttle` override for its own rate,
   separate from `/authorize`'s and `/token`'s existing limits + tests
   (missing IAT → 401, expired IAT → 401, valid IAT → success, reused
   valid IAT → still succeeds since it's not single-use).
6. `well-known.controller.ts`: add `registration_endpoint` to the metadata
   response + test asserting its presence/shape.
7. `packages/mcp-server/src/oauth-metadata.ts`: mirror the same field +
   test (matching the existing drift-prevention pattern from the Phase 1
   review).
8. §11.4's consent-screen fix: `authorize()` forwards `client_name`;
   `ConsentScreen.tsx` renders it plus the parsed `redirect_uri` domain;
   `token()` mints with the real client name. Unit + component tests for
   all three, including a test asserting the domain shown matches
   `new URL(redirect_uri).host` for a redirect_uri with a path/query (not
   just a bare origin).
9. Full backend + mcp-server + frontend test suites, typecheck, lint.
10. Live verification: issue a real IAT via curl, confirm registration
    fails without it (401) and succeeds with it, then complete a full
    register→authorize→consent→token cycle end-to-end (mirrors
    `backend.md`'s existing TC-M01–M11 structure — add TC-M12+ for
    IAT issuance/enforcement and registration specifically). Then attempt
    a real Copilot connection if/when that's practical to test from this
    environment.
11. Write up results in `test-plan/oauth-connector/backend.md` /
    `frontend.md`, same structure as the Phase 1 sections.

### 11.10 Out of scope for Phase 2 (flagged, not built)

- IAT revocation endpoint — an issued-but-unused IAT can't currently be
  invalidated early, only left to expire. Low priority given the default
  24h expiry already bounds exposure; add `DELETE
  /oauth/initial-access-tokens/:id` later if this turns out to matter in
  practice.
- Per-client scope restriction — every client, static or self-registered,
  still gets the same fixed `OAUTH_FIXED_SCOPES` block grant (§1's existing
  "Scope grant" decision carries over unchanged; Phase 2 only changes *who*
  can request a code, not *what* they're granted).
- Client TTL / automatic cleanup of unused self-registered clients — RFC
  7591 registrations are expected to accumulate over time (each
  registration is a fresh credential by design, not a stable app identity
  to dedupe against); a periodic hygiene pass is a possible future
  addition, not required for Phase 2 to work correctly.
- The optional `GET /oauth/clients` / `GET /oauth/initial-access-tokens`
  admin-visibility endpoints and any Settings UI for them (§11.8) —
  deferred as a separate follow-up feature.
- Redoing the existing "Known gap, flagged not fixed" token-pileup item
  from §9 — still applies identically to Phase 2 clients, not made worse
  or better by this phase.

### 11.11 Checklist

- [x] `OAuthInitialAccessToken` model added; migration applied
- [x] IAT issuance (`POST /oauth/initial-access-tokens`, admin-only) implemented + tests
- [x] `register-client.dto.ts` implemented
- [x] `OAuthClientsService.register()` implemented + unit tests
- [x] `POST /oauth/register` enforces the IAT check, rate-limited + tests
      (missing/unknown/valid/reused-valid IAT cases — unit-tested; live
      curl covered missing/unknown/valid/reused, expiry only unit-tested)
- [x] `registration_endpoint` added to both the backend's and mcp-server's
      metadata documents (kept in sync)
- [x] Consent screen shows the real requesting client's name **and** the
      redirect URI's domain (`authorize()` forwards `client_name`;
      `ConsentScreen.tsx` renders both dynamically)
- [x] `token()` mints with the real client's name, not a hardcoded string
- [x] Full test suites passing (backend 855, mcp-server 125, frontend 1497),
      zero TypeScript errors, zero lint warnings, coverage thresholds hold
      in all three packages
- [x] Live curl verification: registration rejected without a valid IAT
      (TC-M13), succeeds with one (TC-M16), IAT reusable not single-use
      (TC-M21), then a full register→authorize→consent→token cycle
      (TC-M18) — see `test-plan/oauth-connector/backend.md` TC-M12–M22
- [x] Live Playwright verification: consent screen renders the real
      client name and redirect domain for a genuinely self-registered
      client — see `test-plan/oauth-connector/frontend.md` TC-M04
- [x] `test-plan/oauth-connector/backend.md` / `frontend.md` updated with
      Phase 2 results
- [ ] Not committed yet — pending explicit go-ahead (Phase 1 was committed
      separately as `1fa4f60`; Phase 2 is still working-tree only)

## 12. RFC 9207 Issuer Identification (`iss` parameter, implemented and live-verified 2026-07-24)

### 12.1 Motivation

The MCP project's 2026-07-28 spec revision includes an "Authorization
Hardening" section (six SEPs aligning the spec more closely with real-world
OAuth 2.0/OIDC deployments). One of them requires OAuth clients to validate
the `iss` parameter on authorization responses per
[RFC 9207](https://datatracker.ietf.org/doc/html/rfc9207), and says
authorization servers "should begin supplying it now if they don't
already." RFC 9207 defines `iss` as a query parameter the authorization
server includes on every redirect back to the client (both success and
error responses), naming itself so the client can detect mix-up attacks in
multi-authorization-server setups — MCP's single-client-many-servers
deployment pattern (one Claude/Copilot instance, potentially many MCP
servers each with their own AS) is exactly the shape this mitigates.

### 12.2 Design decision

- `iss` is added to **every** authorization response this backend
  produces: both branches of `redirectWithError()` (called from
  `authorize()` for `unsupported_response_type`/`invalid_request`) and both
  outcomes of `consent()` (approve and deny).
- The value is the exact same one already served as `issuer` in the RFC
  8414 metadata document (`well-known.controller.ts`, sourced from
  `PUBLIC_API_BASE_URL`) — RFC 9207 requires `iss` to match that `issuer`
  value exactly for client-side validation to succeed. **No new env var.**
- Rather than three independent inline `config.get('PUBLIC_API_BASE_URL')`
  reads (one pre-existing in `well-known.controller.ts`, two new ones this
  would otherwise add to `oauth.controller.ts`), added one shared
  `getIssuerUrl(config)` helper (`src/oauth/oauth-issuer.ts`, matching the
  small-shared-constant convention already established by
  `oauth-scopes.ts`) that all three call sites use. Reading the same env
  var in three places independently is sync-by-convention, not
  sync-by-construction — this codebase already has one real instance of
  that failure mode (the backend/mcp-server metadata `SYNC OBLIGATION`,
  undocumented in code since the two live in different npm packages); no
  reason to accept the same risk here when `well-known.controller.ts` and
  `oauth.controller.ts` are in the same package and it's a one-function fix.
- No feature flag — purely additive query parameter, a client that doesn't
  yet validate `iss` simply ignores it. Safe to ship unconditionally.
- **Out of scope, deliberately**: `packages/mcp-server` is a resource
  server only and never issues authorization responses — `iss` doesn't
  touch it. No frontend changes either; the SPA only forwards `consent()`'s
  `redirectTo` as an opaque URL string.

### 12.3 Checklist

- [x] `getIssuerUrl()` helper added; `well-known.controller.ts` switched to
      it (behavior unchanged, confirmed via its existing test suite)
- [x] `iss` added to `redirectWithError()` and both `consent()` branches
- [x] Unit tests updated (`oauth.controller.spec.ts` — 4 assertions across
      the 2 `authorize()` error cases and 2 `consent()` outcomes)
- [x] Full backend suite passing (870 tests), zero TypeScript errors, zero
      lint warnings
- [x] Live curl verification against a throwaway Postgres-backed instance
      (fresh container + migrations, torn down afterward — not the shared
      dev database): confirmed `iss` byte-identical to the metadata
      `issuer` across the `authorize()` error redirect and both
      `consent()` outcomes — see `test-plan/oauth-connector/backend.md`
      TC-M25
- [x] `test-plan/oauth-connector/backend.md` updated (TC-M02/TC-M10
      amended, TC-M25 added)
- [ ] Not committed yet — pending explicit go-ahead
