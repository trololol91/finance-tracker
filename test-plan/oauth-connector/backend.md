## API Test Plan: OAuth 2.1 Authorization Server (Claude Custom Connector)

### Feature Summary
Adds a real OAuth 2.1 authorization-server role to the NestJS backend so Claude's "Add custom connector" dialog can authenticate a user via browser redirect and mint an access token, instead of requiring a manually pasted API token. The issued token is a normal `ApiToken` row (`name: "<client name> (OAuth)"`, fixed scopes, no expiry) — nothing downstream (`ApiKeyStrategy`/`ScopesGuard`/mcp-server's `validateBearerToken`) changes. Full design: `test-plan/oauth-connector/implementation-plan.md`.

Flow: `GET /oauth/authorize` (validates client + redirect_uri, 302s to the frontend `/oauth/consent` screen) → `POST /oauth/consent` (JWT-authenticated, re-validates server-side, issues a short-lived single-use code on approval) → `POST /oauth/token` (public; PKCE S256 `code_verifier` check; mints the real `ft_...` token). `GET /.well-known/oauth-authorization-server` (RFC 8414, served at the site root, outside the `/api` prefix) advertises the flow for discovery.

**Phase 2** adds RFC 7591 dynamic client registration (`POST /oauth/register`) so more than the one hardcoded static client (e.g. GitHub Copilot alongside Claude) can connect — gated behind an admin-issued Initial Access Token (`POST /oauth/initial-access-tokens`) rather than open registration, since open registration would let an attacker self-register a client named "Claude" and phish an already-logged-in user's consent (see implementation plan §11.2 for the full attack walkthrough this defends against). **`OAUTH_REGISTRATION_OPEN=true`** (env var, defaults `false`) is a backend-operator escape hatch that skips the IAT check entirely — added after confirming neither Claude nor GitHub Copilot's real DCR implementations have anywhere to supply one; see the implementation plan's §11.2 addendum and `packages/mcp-server/CONNECT.md` for the tradeoff.

### Preconditions
- [ ] Backend running at `http://localhost:3001` (`npm run start:dev` in `packages/backend`) with `PUBLIC_API_BASE_URL`, `OAUTH_STATIC_CLIENT_ID`, `OAUTH_STATIC_REDIRECT_URIS` set in `.env` (all three are Joi-`required()` — the app refuses to boot without them)
- [ ] `OAUTH_STATIC_REDIRECT_URIS` includes a redirect URI you control for testing (a real one doesn't need to be reachable — the backend only checks it against the registered list, never dereferences it itself)
- [ ] A disposable test user with a valid JWT — register/setup one fresh per run, delete afterward (see Cleanup)
- [ ] A PKCE pair generated per run (S256 only is supported):
  ```bash
  python3 -c "
  import hashlib, base64, secrets
  verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b'=').decode()
  challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b'=').decode()
  print('CODE_VERIFIER=' + verifier); print('CODE_CHALLENGE=' + challenge)"
  ```

### Endpoint Inventory

| Method | Route | Auth | Notes |
|--------|-------|------|-------|
| GET | `/.well-known/oauth-authorization-server` | No | RFC 8414 metadata; excluded from the `/api` global prefix, served at site root |
| GET | `/oauth/authorize` | No | Validates `client_id` + registered `redirect_uri` + `response_type=code` + `code_challenge_method=S256`; 302s to the frontend `/oauth/consent` |
| POST | `/oauth/consent` | Yes (JWT) | Re-validates `client_id`/`redirect_uri` server-side; issues a code on approval; returns `{redirectTo}` JSON (not a raw 302 — an XHR call from the SPA) |
| POST | `/oauth/token` | No — authenticates via `code` + `code_verifier` | `authorization_code` grant only; mints a real `ApiToken` and returns `{access_token, token_type: "Bearer", scope}` |
| POST | `/oauth/initial-access-tokens` | Yes (JWT + admin) | Phase 2. Issues an IAT for a new client's registration; raw token shown once |
| POST | `/oauth/register` | Yes — `Authorization: Bearer <IAT>` | Phase 2. RFC 7591 dynamic client registration; returns `{client_id, client_name, redirect_uris, ...}`, no `client_secret` |
| GET | `/api/api-tokens` | Yes (JWT) | Unchanged — used here only to confirm the OAuth-issued token is visible/revocable like any other |

---

### Automated coverage (Vitest, 84 tests: 64 in `src/oauth`, 20 in `env.validation.spec.ts`)

| File | What it covers |
|------|-----------------|
| `src/oauth/__TEST__/oauth-clients.service.spec.ts` | `findByClientId` (found/not-found), `ensureStaticClient` upsert shape (including self-healing a stale `clientName` on an already-provisioned row), `register()` (fresh `clientId` per call, no upsert/reuse) |
| `src/oauth/__TEST__/oauth-codes.service.spec.ts` | Code hashed at rest (never the raw value stored), 1-minute expiry, single-use (`delete()`-based consume — a second `consume()` for the same code fails since the row is gone), expired-code rejection, rethrows non-`P2025` errors instead of misreporting them as `invalid_grant`, falls back to a generic client name instead of crashing if the joined client is somehow missing |
| `src/oauth/__TEST__/oauth-initial-access-tokens.service.spec.ts` | Phase 2. Hashed at rest, default/custom expiry, unknown/expired token rejection, **not** single-use (a second `validate()` for the same token still succeeds), `lastUsedAt` update fires without blocking/failing `validate()` on a DB error |
| `src/oauth/__TEST__/iat.guard.spec.ts` | Phase 2. Missing/non-Bearer/invalid/expired → `401 invalid_token`; valid IAT allows the request through; **`OAUTH_REGISTRATION_OPEN=true` bypasses the check entirely without ever calling `validate()`** |
| `src/oauth/__TEST__/register-client.dto.spec.ts` | `redirect_uris` restricted to `http:`/`https:` — rejects `javascript:`/`data:`/protocol-less strings, accepts `https://` and `http://localhost:PORT/...` (no TLD required for local testing); empty `redirect_uris`/`client_name` rejected |
| `src/oauth/__TEST__/pkce.spec.ts` | S256 verifier/challenge match, mismatch, and that a `plain`-style equality check is rejected (S256 only) |
| `src/oauth/__TEST__/oauth.controller.spec.ts` | Full `authorize`/`consent`/`token` branch coverage — unknown client, unregistered redirect_uri (no redirect, since that's an open-redirect vector), unsupported `response_type`/`code_challenge_method` (redirect-with-error once redirect_uri is trusted), consent re-validation, approve/deny, `unsupported_grant_type`, `invalid_grant` (unknown/expired code, client_id/redirect_uri mismatch, PKCE mismatch, invalid scope), successful mint named after the real client (not hardcoded, and without a second `findByClientId` lookup), `CORS_ORIGIN`-unset fallback; Phase 2: `issueInitialAccessToken` delegation, `register` delegation + RFC 7591 response reshaping |
| `src/oauth/__TEST__/oauth-exception.filter.spec.ts` | RFC 6749 §5.2 `{error, error_description}` reshaping — passes an `OAuthException` body through unchanged, reshapes class-validator's default `{message: [...]}` array and a generic string `HttpException`, maps 401/429/5xx to `unauthorized`/`slow_down`/`server_error` instead of a blanket `invalid_request` |
| `src/oauth/__TEST__/well-known.controller.spec.ts` | Absolute URL construction from `PUBLIC_API_BASE_URL`, advertised grant/PKCE/scope values, `registration_endpoint` (Phase 2) |
| `src/oauth/__TEST__/oauth.module.spec.ts` | `onModuleInit` doesn't crash the whole app's boot if the static-client upsert fails |
| `src/config/__TEST__/env.validation.spec.ts` (`OAUTH_REGISTRATION_OPEN` block, 3 of the file's 20 tests) | Defaults to `false` when unset; correctly coerces the `"true"`/`"false"` string env values Docker/`.env` actually deliver into real booleans |

Run: `cd packages/backend && npx vitest run src/oauth src/config/__TEST__/env.validation.spec.ts`

---

### Live/manual verification (curl-driven)

All 11 cases below were run against a real local instance (temporary port, so as not to disturb an already-running dev server) with a real Postgres-backed test user, and passed. Re-run this sequence after any change to `src/oauth/**`.

#### TC-M01: GET /oauth/authorize — happy path redirects to the consent screen
- **Type**: Smoke
- **Expected**: `302`, `Location` header = `${CORS_ORIGIN}/oauth/consent?client_id=...&redirect_uri=...&code_challenge=...&code_challenge_method=S256&state=...` — every authorize param carried over
- **curl**:
  ```bash
  curl -si "http://localhost:3001/api/oauth/authorize?response_type=code&client_id=claude-ai&redirect_uri=https%3A%2F%2Fclaude.ai%2Fapi%2Fmcp%2Fauth_callback&code_challenge=${CODE_CHALLENGE}&code_challenge_method=S256&state=xyz"
  ```
- **Actual result** (2026-07-19): `302`, `Location: http://localhost:3002/oauth/consent?client_id=claude-ai&redirect_uri=...&code_challenge=...&code_challenge_method=S256&state=xyz` — confirmed.

#### TC-M02: POST /oauth/consent — approved: true issues a code
- **Type**: Smoke
- **Expected**: `200`, `{"redirectTo": "<redirect_uri>?state=...&code=oac_..."}`
- **curl**:
  ```bash
  curl -s -X POST http://localhost:3001/api/oauth/consent \
    -H "Authorization: Bearer ${JWT}" -H "Content-Type: application/json" \
    -d "{\"client_id\":\"claude-ai\",\"redirect_uri\":\"https://claude.ai/api/mcp/auth_callback\",\"code_challenge\":\"${CODE_CHALLENGE}\",\"code_challenge_method\":\"S256\",\"state\":\"xyz\",\"approved\":true}"
  ```
- **Actual result**: `{"redirectTo":"https://claude.ai/api/mcp/auth_callback?state=xyz&code=oac_b0db8540...f371b79"}` — confirmed.

#### TC-M03: POST /oauth/token — correct code_verifier mints a real token
- **Type**: Smoke
- **Description**: Sent `application/x-www-form-urlencoded` (matching the MCP SDK's real `exchangeAuthorization()` request shape, traced from `node_modules/@modelcontextprotocol/sdk/dist/esm/client/auth.js`), not JSON
- **Expected**: `200`, `{"access_token": "ft_...", "token_type": "Bearer", "scope": "transactions:read transactions:write accounts:read categories:read dashboard:read"}`
- **curl**:
  ```bash
  curl -s -X POST http://localhost:3001/api/oauth/token \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "grant_type=authorization_code" \
    --data-urlencode "code=${CODE}" \
    --data-urlencode "redirect_uri=https://claude.ai/api/mcp/auth_callback" \
    --data-urlencode "client_id=claude-ai" \
    --data-urlencode "code_verifier=${CODE_VERIFIER}"
  ```
- **Actual result**: `{"access_token":"ft_b813c244...3914e56b","token_type":"Bearer","scope":"transactions:read transactions:write accounts:read categories:read dashboard:read"}` — confirmed.

#### TC-M04: The OAuth-issued token is a real, usable ApiToken
- **Type**: Regression — proves the "new front door onto an existing mechanism" design goal, not a parallel auth system
- **curl**: `curl -o /dev/null -w "%{http_code}" http://localhost:3001/api/auth/me -H "Authorization: Bearer ${ACCESS_TOKEN}"`
- **Actual result**: `200` — confirmed.

#### TC-M05: The token is visible in Settings → API Tokens as "Claude (OAuth)"
- **Type**: Regression
- **curl**: `curl http://localhost:3001/api/api-tokens -H "Authorization: Bearer ${JWT}"`
- **Actual result**: one entry, `name: "Claude (OAuth)"`, `scopes` = the fixed five, `expiresAt: null` — confirmed. (Deleting it from this same list is the only revocation path — see implementation plan §"Out of Scope".)

#### TC-M06: Replay of an already-consumed code
- **Type**: Security — codes are single-use, hard-deleted on consumption (same lesson this repo learned with refresh tokens: no soft-revoke grace period for a short-lived, high-value credential)
- **Expected**: `400`, `{"error":"invalid_grant","error_description":"Unknown, expired, or already-used authorization code"}`
- **Actual result**: confirmed exactly as above.

#### TC-M07: Wrong code_verifier
- **Type**: Security
- **Expected**: `400`, `{"error":"invalid_grant","error_description":"code_verifier does not match code_challenge"}`
- **Actual result**: confirmed.

#### TC-M08: Unregistered redirect_uri on /authorize
- **Type**: Security — open-redirect protection; must be a local error, never a redirect to the unregistered URI
- **curl**: same as TC-M01 with `redirect_uri=https://evil.example.com/callback`
- **Expected**: `400`, no `Location` header
- **Actual result**: `400 Bad Request`, no `Location` header — confirmed.

#### TC-M09: Unknown client_id
- **Type**: Security
- **Expected**: `400`, `{"error":"invalid_client","error_description":"Unknown client_id"}`
- **Actual result**: confirmed.

#### TC-M10: Consent denial
- **Type**: Smoke
- **Request**: same as TC-M02 with `"approved": false`
- **Expected**: `200`, `{"redirectTo": "<redirect_uri>?state=...&error=access_denied"}` — no code issued
- **Actual result**: `{"redirectTo":"https://claude.ai/api/mcp/auth_callback?state=abc&error=access_denied"}` — confirmed.

#### TC-M11: POST /oauth/consent with no Authorization header
- **Type**: Security
- **Expected**: `401` (guarded by `JwtAuthGuard`, same as any other authenticated endpoint)
- **Actual result**: `401` — confirmed.

---

### Phase 2 live/manual verification (curl-driven)

All 11 cases below were run 2026-07-19 against a real local instance (temporary port) with a real Postgres-backed admin user, and passed.

#### TC-M12: registration_endpoint appears in the RFC 8414 metadata document
- **Type**: Smoke
- **curl**: `curl -s http://localhost:3001/.well-known/oauth-authorization-server`
- **Actual result**: `"registration_endpoint": "http://localhost:3001/api/oauth/register"` present alongside the existing fields — confirmed.

#### TC-M13: POST /oauth/register without an IAT
- **Type**: Security — this is the core Phase 2 gating decision (implementation plan §11.2)
- **Expected**: `401`, `{"error":"invalid_token","error_description":"Missing or invalid initial access token"}`
- **Actual result**: confirmed exactly as above.

#### TC-M14: POST /oauth/initial-access-tokens as admin
- **Type**: Smoke
- **curl**:
  ```bash
  curl -s -X POST http://localhost:3001/api/oauth/initial-access-tokens \
    -H "Authorization: Bearer ${ADMIN_JWT}" -H "Content-Type: application/json" \
    -d '{"label":"GitHub Copilot setup"}'
  ```
- **Expected**: `201`, `{"token": "iat_...", "label": "...", "expiresAt": "<+24h>"}`
- **Actual result**: `{"token":"iat_ab4e724b...ad59901","label":"GitHub Copilot setup","expiresAt":"2026-07-20T22:55:29.981Z"}` — confirmed, default 24h expiry.

#### TC-M15: POST /oauth/initial-access-tokens with no auth at all
- **Type**: Security
- **Expected**: `401` (guarded by `JwtAuthGuard` + `AdminGuard`)
- **Actual result**: `401` — confirmed.

#### TC-M16: POST /oauth/register with a valid IAT
- **Type**: Smoke
- **curl**:
  ```bash
  curl -s -X POST http://localhost:3001/api/oauth/register \
    -H "Authorization: Bearer ${IAT}" -H "Content-Type: application/json" \
    -d '{"client_name":"GitHub Copilot","redirect_uris":["https://github.com/copilot/oauth/callback"]}'
  ```
- **Expected**: `201`, RFC 7591 shape, no `client_secret`
- **Actual result**: `{"client_id":"7dbb2c62...b902d13","client_name":"GitHub Copilot","redirect_uris":["https://github.com/copilot/oauth/callback"],"token_endpoint_auth_method":"none","grant_types":["authorization_code"],"response_types":["code"]}` — confirmed, `client_id` is 32 hex chars.

#### TC-M17: GET /oauth/authorize for the newly self-registered client forwards its real client_name
- **Type**: Regression — this is the §11.4 fix that makes registration safe to display
- **curl**: same shape as TC-M01, with the new client's `client_id`/`redirect_uri`
- **Expected**: redirect `Location` includes `client_name=GitHub+Copilot` (not a hardcoded "Claude")
- **Actual result**: `Location: http://localhost:3002/oauth/consent?client_id=7dbb2c62...&client_name=GitHub+Copilot&redirect_uri=...` — confirmed.

#### TC-M18: Full register→authorize→consent→token cycle for the new client
- **Type**: Smoke — end-to-end for a Phase 2 client, not just the static Phase 1 one
- **Steps**: TC-M16's client → authorize → consent (approve) → token exchange
- **Actual result**: real `ft_...` token minted — confirmed (same shape as TC-M03).

#### TC-M19: Minted token is named after the real client, not hardcoded "Claude (OAuth)"
- **Type**: Regression — the other half of the §11.4 fix
- **curl**: `curl http://localhost:3001/api/api-tokens -H "Authorization: Bearer ${ADMIN_JWT}"`
- **Actual result**: `"name": "GitHub Copilot (OAuth)"` — confirmed, not "Claude (OAuth)".

#### TC-M20: The consent screen itself renders the real client name and redirect domain
- **Type**: Smoke — live browser check (Playwright), not just curl
- **Steps**: log in as the test user, navigate to `/oauth/consent` with the real Copilot client's params
- **Expected**: heading "Connect GitHub Copilot to Finance Tracker", body "GitHub Copilot is requesting access...", and "You'll be redirected to: **github.com**"
- **Actual result**: confirmed — all three render exactly as expected (see `frontend.md` TC-M04 for the full snapshot).

#### TC-M21: An IAT is reusable — not single-use
- **Type**: Regression — confirms the deliberate (not accidental) not-single-use design (§11.3)
- **Steps**: use the same IAT from TC-M16 to register a second, different client
- **Expected**: `201`, succeeds identically
- **Actual result**: confirmed — second client registered with a different `client_id`.

#### TC-M22: An unknown/garbage IAT is rejected
- **Type**: Security
- **Expected**: `401 invalid_token`
- **Actual result**: confirmed.

---

### `OAUTH_REGISTRATION_OPEN` escape-hatch verification (2026-07-20)

Added after discovering (via official docs, not assumption) that neither
Claude's nor GitHub Copilot's real DCR implementations have anywhere to
supply an IAT — see `packages/mcp-server/CONNECT.md`'s "OAuth for other
clients" and "GitHub Copilot" sections, and implementation plan §11.2's
addendum. Both cases below were run against a temporary backend instance,
restarted between them to change the env var (this flag is read once at
`ConfigService` init, not per-request).

#### TC-M23: Default (unset) — registration without an IAT is still rejected
- **Type**: Regression — confirms adding the flag didn't change default behavior
- **curl**: `curl -si -X POST http://localhost:3097/api/oauth/register -H "Content-Type: application/json" -d '{"client_name":"Test Client","redirect_uris":["https://example.com/callback"]}'`
- **Expected**: `401`, `{"error":"invalid_token","error_description":"Missing or invalid initial access token"}`
- **Actual result**: confirmed exactly as above.

#### TC-M24: `OAUTH_REGISTRATION_OPEN=true` — registration succeeds with no Authorization header at all
- **Type**: Smoke — proves the bypass actually works, not just that the code compiles
- **Steps**: restart the backend with `OAUTH_REGISTRATION_OPEN=true`, repeat TC-M23's request with no `Authorization` header
- **Expected**: `201`, RFC 7591 shape, same as a normal IAT-authenticated registration
- **Actual result**: `{"client_id":"f5ba3f0f07bd6046979e673e52ea0c12","client_name":"Flag Test Client","redirect_uris":["https://example.com/callback"],"token_endpoint_auth_method":"none","grant_types":["authorization_code"],"response_types":["code"]}` — confirmed. Test client row deleted afterward (see Cleanup).

---

### Not yet exercised live (flagged, not run this pass)
- **Full browser round-trip**: actually adding the mcp-server URL as a claude.ai custom connector and completing the login/consent flow through a real browser. The curl sequence above proves every backend endpoint independently; it does not prove the two-hop discovery chain (mcp-server's `WWW-Authenticate` → protected-resource metadata → this backend's `/.well-known/oauth-authorization-server` → `/oauth/authorize`) end-to-end from Claude's actual client. See `test-plan/mcp-server/backend.md` TC-M01–TC-M09 for the mcp-server-side discovery verification (path-suffixed + bare well-known routes, `WWW-Authenticate` header shape) that was run separately. The same applies to an actual GitHub Copilot connection now that Phase 2 makes it possible in principle — not attempted from this environment.
- **Rate limiting** (`@nestjs/throttler`, 20/min on `/authorize`, 5/min on `/token`, 10/hour on `/register`): not driven past the limit in this pass — would require repeated rapid requests and isn't idempotent against the throttler's in-memory window, so deferred to avoid polluting a shared dev environment's rate-limit state.
- **IAT expiry**: TC-M14's IAT was confirmed to carry a correct `expiresAt` 24h out, but actually waiting 24h (or issuing one with `expiresInHours: 1` and waiting) to confirm expired-IAT rejection wasn't done live — covered at the unit level instead (`oauth-initial-access-tokens.service.spec.ts`).

---

### Cleanup
Test users created via `POST /auth/setup` (or `/auth/register`) during this test pass leave rows in `users`, `categories` (auto-seeded), and `api_tokens` (`ApiToken.onDelete: Cascade` on the user relation handles this one automatically). `oauth_authorization_codes` rows are already gone by the time a code is consumed (hard-deleted on use) or will expire/never be looked up again if abandoned mid-flow. Delete in FK order — `categories` before `users` (categories has no cascade) — rather than leaving throwaway accounts in a shared dev database:
```sql
DELETE FROM categories WHERE user_id = '<test-user-id>';
DELETE FROM users WHERE id = '<test-user-id>';
```
The `oauth_clients` row for the static client (`OAUTH_STATIC_CLIENT_ID`) is not test data — it's real config, idempotently re-upserted on every backend boot from `.env`. Leave it in place.

**Phase 2 additions**: any self-registered clients created via `POST /oauth/register` during testing (e.g. TC-M16/TC-M21's "GitHub Copilot"/"Second Client") and any IATs issued via `POST /oauth/initial-access-tokens` are real test data, not config — delete both, excluding the static client row:
```sql
DELETE FROM oauth_initial_access_tokens;
DELETE FROM oauth_clients WHERE client_id != '<OAUTH_STATIC_CLIENT_ID value>';
```
