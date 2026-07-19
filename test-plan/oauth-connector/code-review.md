# Code Review: OAuth 2.1 Authorization Server (Plan 2)

Reviewed the full working-tree diff implementing the OAuth 2.1 connector flow across `packages/backend/src/oauth/**`, `packages/mcp-server/src/http-transport.ts` + `oauth-metadata.ts`, and `packages/frontend/src/features/oauth/**` (~2,650 insertions across 46 files, excluding generated files).

Method: 8 independent finder passes (line-by-line, removed-behavior, cross-file tracer, reuse, simplification, efficiency, altitude, conventions) surfaced 46 candidates, deduplicated to 10, each independently verified against the actual source (and, where relevant, the installed `@modelcontextprotocol/sdk` source). 9 findings survived verification (8 CONFIRMED, 1 PLAUSIBLE); 1 was REFUTED and dropped (see bottom).

**Status: all 9 fixed** (2026-07-19). Each section below now includes a Fix note. Full backend/mcp-server/frontend typecheck, lint, and test suites (840 + 125 + 1494 tests) pass after all fixes.

Ranked most severe first.

---

## 1. mcp-server crashes on boot under the shipped docker-compose config — CONFIRMED
**File:** `packages/mcp-server/src/http-transport.ts:217`

`buildAuthorizationServerMetadata()`'s `issuer` field is fed from `process.env.FINANCE_TRACKER_URL`. `docker-compose.yml` sets `FINANCE_TRACKER_URL=http://backend:3001` for the mcp-server service. The installed SDK's `mcpAuthMetadataRouter` (`node_modules/@modelcontextprotocol/sdk/dist/esm/server/auth/router.js`) calls `checkIssuerUrl()` unconditionally, which throws `"Issuer URL must be HTTPS"` for any issuer whose protocol isn't `https:` and whose hostname isn't literally `localhost`/`127.0.0.1` — no override env var is set anywhere in the repo. `createHttpApp()` is called synchronously inside `async startHttpServer()`, so the throw becomes a rejected promise; `index.ts`'s `.catch()` turns it into `process.exit(1)`. Combined with `restart: unless-stopped`, **the mcp-server container crash-loops indefinitely in the exact deployment this diff ships.**

**Fix:** mcp-server now reads `PUBLIC_API_BASE_URL` (falling back to `FINANCE_TRACKER_URL`) for the issuer instead of the internal service URL — the same externally-facing value the backend already uses for its own metadata document, added to `docker-compose.yml`'s mcp-server service. Passes `checkIssuerUrl()` in both dev (`localhost`) and production (real HTTPS URL).

## 2. Backend crashes on any in-place upgrade via docker-compose — CONFIRMED
**File:** `docker-compose.yml:56`

`OAUTH_STATIC_CLIENT_ID`/`OAUTH_STATIC_REDIRECT_URIS` default to `${VAR:-}` (empty string) in the backend service's environment block, but `env.validation.ts` declares both `Joi.string().required()` with no `.allow('')` (unlike `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`, which explicitly chain `.optional().allow('')` elsewhere in the same file). Joi's `.required()` rejects `''` the same as a missing key. Any existing deployment that pulls this change without adding these two vars to its `.env` gets the backend container crash-looping on every boot until an operator notices. `PUBLIC_API_BASE_URL` doesn't have this problem — its compose default falls back to a real URI.

**Fix:** docker-compose now falls back to the same placeholder values `.env.example` documents (`claude-ai` / `https://claude.ai/api/mcp/auth_callback`) instead of empty strings — wrong-but-non-crashing until the operator sets real values, instead of crash-looping the whole backend.

## 3. Unhandled crash if `CORS_ORIGIN` is unset — CONFIRMED
**File:** `packages/backend/src/oauth/oauth.controller.ts:79`

`authorize()` does `this.config.get<string>('CORS_ORIGIN')!` — a non-null assertion — even though `CORS_ORIGIN` is `Joi.string().uri().optional()` in `env.validation.ts` (legally unset). Every other consumer (`main.ts`, `scraper.service.ts`) falls back with `??`; this is the one inconsistent call site. If unset, `new URL('/oauth/consent', undefined)` throws a plain `TypeError`, which `OAuthExceptionFilter` (`@Catch(HttpException)`) does not catch — it falls through to Nest's default handler as a generic unstructured 500 for every `GET /oauth/authorize` request, instead of the RFC 6749 redirect/error behavior the rest of the handler is built around. No test covers this (the spec's `ConfigService` mock always returns a defined string).

**Fix:** replaced the `!` assertion with `?? 'http://localhost:5173'`, matching `main.ts`'s existing fallback. Added a test asserting the fallback is used when `CORS_ORIGIN` is unset.

## 4. Transient DB errors misreported as invalid OAuth codes — CONFIRMED
**File:** `packages/backend/src/oauth/oauth-codes.service.ts:92`

`deleteByCodeHash()`'s bare `catch { return null; }` swallows *every* Prisma error, not just "record not found." A connection drop or `P2028` timeout during token exchange gets silently converted into `invalid_grant: Unknown, expired, or already-used authorization code` — a legitimate, unexpired code gets rejected, and the real infrastructure failure is invisible in logs (no logging, no error-code check, no rethrow). This exact narrower pattern (catch only `PrismaClientKnownRequestError` with code `P2025`, rethrow everything else) is already the established convention elsewhere in this backend (`sync-schedule.service.ts`, `import.service.ts`, `accounts.service.ts`, `categories.service.ts`) — this file is the one deviation.

**Fix:** narrowed the catch to check `err instanceof PrismaClientKnownRequestError && err.code === 'P2025'`, matching the established pattern; anything else is logged and rethrown, surfacing as a 500 instead of a misleading `invalid_grant`. Added a test covering the rethrow path.

## 5. Wrong RFC 6749 error code for guard-level rejections — CONFIRMED
**File:** `packages/backend/src/oauth/oauth-exception.filter.ts:49`

The filter's fallback branch hardcodes `error: 'invalid_request'` for any non-`OAuthException` `HttpException`, regardless of status code. Since `@UseFilters(OAuthExceptionFilter)` is applied at the controller level, it also catches `JwtAuthGuard`'s 401 (on `POST /consent`) and `ThrottlerGuard`'s 429 (on all three routes) — both get mislabeled `invalid_request`, which per RFC 6749 §5.2 specifically means a malformed token request, not an auth failure or rate limit. An OAuth client that branches on the `error` field gets the wrong signal for every guard-level rejection. The actual HTTP status code is preserved correctly — only the `error` string is wrong. No existing test exercises a 401 or 429 through this filter.

**Fix:** added `errorCodeForStatus()` mapping 401 → `unauthorized`, 429 → `slow_down`, 5xx → `server_error`, defaulting to `invalid_request` only for everything else (still correct for the validation-pipe case this filter was originally written for). Added tests for all three new cases.

## 6. mcp-server's mirrored OAuth metadata has already drifted from the backend's — CONFIRMED
**File:** `packages/mcp-server/src/oauth-metadata.ts:14`

mcp-server hand-reconstructs the backend's RFC 8414 metadata document from a *different* env var (`FINANCE_TRACKER_URL`) than the backend uses for its own copy (`PUBLIC_API_BASE_URL`) — two independently-set values with nothing enforcing they agree. Concretely, they've already diverged: the backend's `well-known.controller.ts` includes `scopes_supported: [...OAUTH_FIXED_SCOPES]`; mcp-server's copy omits it entirely. Adding `scopesSupported` to the `mcpAuthMetadataRouter(...)` call wouldn't even fix this — that option only feeds the *protected-resource* document, not the mirrored authorization-server one (confirmed by tracing the SDK's `router.js`). A client fetching metadata directly from mcp-server sees an incomplete document, and if the two env vars ever hold genuinely different real values, the mirrored issuer/endpoints actively disagree with the real ones.

**Fix:** fixed together with #1 — now built from `PUBLIC_API_BASE_URL`, the same value the backend itself uses. Also added the missing `scopes_supported` field (hardcoded to the same 5 scope strings, since mcp-server can't import the backend's constant across packages). Added a test asserting `scopes_supported` is present.

## 7. Consent screen can silently misdescribe what a token grants — CONFIRMED
**File:** `packages/frontend/src/features/oauth/components/ConsentScreen.tsx:11`

`GRANTED_PERMISSIONS` is a hand-written mirror of the backend's `OAUTH_FIXED_SCOPES`, tied together only by a code comment — no shared constant, no test comparing the two (`ConsentScreen.test.tsx` only asserts 2 of the 5 hardcoded strings render). If `OAUTH_FIXED_SCOPES` ever changes, nothing forces this list to follow. For a screen whose entire purpose is informed consent, that's a real disclosure gap, not a cosmetic one.

**Fix:** `GET /oauth/authorize` now includes a real `scope` param (space-separated, built from the actual `OAUTH_FIXED_SCOPES`) on its redirect to the consent screen. `ConsentScreen` reads and renders that param directly — via a `SCOPE_LABELS` lookup that falls back to the raw scope string for anything unrecognized — instead of a hardcoded list, so what's displayed can never drift from what's actually granted (the label wording can still lag, but the *set* can't). Added tests for the fallback-to-raw-string case and for the missing-`scope` fallback UI.

## 8. OAuth-minted tokens bypass the normal scope validation — PLAUSIBLE
**File:** `packages/backend/src/oauth/oauth.controller.ts:159`

`token()` mints a real `ApiToken` via a direct in-process call to `ApiTokensService.create()` with a type-only cast (`as typeof OAUTH_FIXED_SCOPES[number][]`). `@IsIn` validation on `CreateApiTokenDto.scopes` only fires through class-validator's pipe on an HTTP body — never for a plain object passed directly from TypeScript — and `ApiTokensService.create()` doesn't independently re-check scopes at runtime (only the admin-scope rule). Today this is safe only because `OAUTH_FIXED_SCOPES` is the sole, compile-time-typed source ever passed through; it's a coincidence of the current call graph, not an enforced invariant. A future second caller, a manually-edited DB row, or scopes issued under a since-narrowed `OAUTH_FIXED_SCOPES` would sail through with no guard where the normal token-creation path has one.

**Fix:** added an explicit runtime check (`consumed.scopes.every(isValidScope)` against `API_TOKEN_SCOPES`) before minting — throws `server_error` instead of silently trusting the cast if a code somehow carries an invalid scope. Added a test for the rejection path.

## 9. OAuth client bootstrap blocks the entire app's boot — CONFIRMED (minor)
**File:** `packages/backend/src/oauth/oauth.module.ts:37`

`onModuleInit()` awaits a DB upsert; Nest's `NestFactory.create()` awaits every `OnModuleInit` hook before resolving, and `main.ts` only calls `app.listen()` after that resolves — so a slow/unreachable Postgres during this one OAuth-bootstrap step delays (or, if it throws, prevents) the *entire* backend's HTTP listener from binding, not just OAuth routes. Separately, `ensureStaticClient()`'s upsert runs unconditionally on every boot (no read-and-compare), issuing a write even when nothing changed. Self-assessed as minor in practice — Prisma has no other eager connection warmup, so this doubles as a reasonable fail-fast check, and the write itself is cheap against a single-row table — but worth noting as a design/blast-radius tradeoff.

**Fix:** wrapped the upsert in try/catch — a failure now logs and lets boot continue (the static client just stays stale/missing, causing `/oauth/authorize` to 400 rather than the whole app failing to bind). `ensureStaticClient()` now reads the existing row first and skips the write entirely when `redirectUris` already match, avoiding an `UPDATE` on every routine restart. Added tests for both.

---

## Dropped (REFUTED)

**ConsentScreen swallows error detail, no 401 handling** — `packages/frontend/src/features/oauth/components/ConsentScreen.tsx`. Initially flagged because the `catch` block shows a generic "Something went wrong" message regardless of error type. Refuted on verification: `POST /oauth/consent` goes through the same shared axios instance as every other API call, and the existing response interceptor (`services/api/client.ts`) already handles a 401 here — either silently refreshing and retrying (success, `ConsentScreen`'s catch never runs), or, if refresh also fails, hard-redirecting to `/login?redirect=<full oauth/consent URL>` before the rejection ever reaches `ConsentScreen`. The claimed "user stranded forever" scenario doesn't hold given existing shared behavior.
