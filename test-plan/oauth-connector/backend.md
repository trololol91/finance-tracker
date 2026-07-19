## API Test Plan: OAuth 2.1 Authorization Server (Claude Custom Connector)

### Feature Summary
Adds a real OAuth 2.1 authorization-server role to the NestJS backend so Claude's "Add custom connector" dialog can authenticate a user via browser redirect and mint an access token, instead of requiring a manually pasted API token. The issued token is a normal `ApiToken` row (`name: "Claude (OAuth)"`, fixed scopes, no expiry) — nothing downstream (`ApiKeyStrategy`/`ScopesGuard`/mcp-server's `validateBearerToken`) changes. Full design: `test-plan/oauth-connector/implementation-plan.md`.

Flow: `GET /oauth/authorize` (validates client + redirect_uri, 302s to the frontend `/oauth/consent` screen) → `POST /oauth/consent` (JWT-authenticated, re-validates server-side, issues a short-lived single-use code on approval) → `POST /oauth/token` (public; PKCE S256 `code_verifier` check; mints the real `ft_...` token). `GET /.well-known/oauth-authorization-server` (RFC 8414, served at the site root, outside the `/api` prefix) advertises the flow for discovery.

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
| GET | `/api/api-tokens` | Yes (JWT) | Unchanged — used here only to confirm the OAuth-issued token is visible/revocable like any other |

---

### Automated coverage (Vitest, 30 tests)

| File | What it covers |
|------|-----------------|
| `src/oauth/__TEST__/oauth-clients.service.spec.ts` | `findByClientId` (found/not-found), `ensureStaticClient` upsert shape |
| `src/oauth/__TEST__/oauth-codes.service.spec.ts` | Code hashed at rest (never the raw value stored), 1-minute expiry, single-use (`delete()`-based consume — a second `consume()` for the same code fails since the row is gone), expired-code rejection |
| `src/oauth/__TEST__/pkce.spec.ts` | S256 verifier/challenge match, mismatch, and that a `plain`-style equality check is rejected (S256 only) |
| `src/oauth/__TEST__/oauth.controller.spec.ts` | Full `authorize`/`consent`/`token` branch coverage — unknown client, unregistered redirect_uri (no redirect, since that's an open-redirect vector), unsupported `response_type`/`code_challenge_method` (redirect-with-error once redirect_uri is trusted), consent re-validation, approve/deny, `unsupported_grant_type`, `invalid_grant` (unknown/expired code, client_id/redirect_uri mismatch, PKCE mismatch), successful mint |
| `src/oauth/__TEST__/oauth-exception.filter.spec.ts` | RFC 6749 §5.2 `{error, error_description}` reshaping — passes an `OAuthException` body through unchanged, reshapes class-validator's default `{message: [...]}` array and a generic string `HttpException` |
| `src/oauth/__TEST__/well-known.controller.spec.ts` | Absolute URL construction from `PUBLIC_API_BASE_URL`, advertised grant/PKCE/scope values |

Run: `cd packages/backend && npx vitest run src/oauth`

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

### Not yet exercised live (flagged, not run this pass)
- **Full browser round-trip**: actually adding the mcp-server URL as a claude.ai custom connector and completing the login/consent flow through a real browser. The curl sequence above proves every backend endpoint independently; it does not prove the two-hop discovery chain (mcp-server's `WWW-Authenticate` → protected-resource metadata → this backend's `/.well-known/oauth-authorization-server` → `/oauth/authorize`) end-to-end from Claude's actual client. See `test-plan/mcp-server/backend.md` TC-M01–TC-M09 for the mcp-server-side discovery verification (path-suffixed + bare well-known routes, `WWW-Authenticate` header shape) that was run separately.
- **Rate limiting** (`@nestjs/throttler`, 20/min on `/authorize`, 5/min on `/token`): not driven past the limit in this pass — would require ~6+ rapid requests and isn't idempotent against the throttler's in-memory window, so deferred to avoid polluting a shared dev environment's rate-limit state.
- **Dynamic client registration** (`POST /oauth/register`): out of scope for this phase — see implementation plan §1.

---

### Cleanup
Test users created via `POST /auth/setup` (or `/auth/register`) during this test pass leave rows in `users`, `categories` (auto-seeded), and `api_tokens` (`ApiToken.onDelete: Cascade` on the user relation handles this one automatically). `oauth_authorization_codes` rows are already gone by the time a code is consumed (hard-deleted on use) or will expire/never be looked up again if abandoned mid-flow. Delete in FK order — `categories` before `users` (categories has no cascade) — rather than leaving throwaway accounts in a shared dev database:
```sql
DELETE FROM categories WHERE user_id = '<test-user-id>';
DELETE FROM users WHERE id = '<test-user-id>';
```
The `oauth_clients` row for the static client (`OAUTH_STATIC_CLIENT_ID`) is not test data — it's real config, idempotently re-upserted on every backend boot from `.env`. Leave it in place.
