## API Test Plan: Refresh Tokens & Remember Me

### Feature Summary
Replaces the flat 7-day JWT with a short-lived access token (15m, `JWT_EXPIRES_IN`) plus an opaque, hashed, single-use-rotating refresh token delivered as an httpOnly cookie (`refresh_token`, scoped to `/api/auth`). "Remember me" (`LoginDto.rememberMe`) controls whether that cookie is persistent (~30 days, `JWT_REFRESH_EXPIRES_IN`, sliding — renewed on every rotation) or a browser-session cookie (dies when the browser closes; 1-day server-side safety net). Rotation allows a 30-second grace period so concurrent requests from multiple tabs sharing one cookie jar don't spuriously fail each other out. Logout permanently deletes the token row (no grace period — a soft-revoke would let a just-logged-out cookie keep working for up to 30s).

### Preconditions
- [ ] Backend running at http://localhost:3001 (`npm run start:dev` in `packages/backend`)
- [ ] `CORS_ORIGIN` in `.env` matches whatever origin sends the requests (cookies require an exact-origin allowlist + `credentials: true`, already configured in `main.ts`)
- [ ] A disposable test user — register one fresh per run via `POST /auth/register`, delete afterward (see cleanup note at bottom)
- [ ] `curl` with `-c`/`-b` cookie-jar flags for stateful sequences; all commands in one shell session (cookie-jar files and shell vars don't survive across separate invocations)

### Endpoint Inventory

| Method | Route | Auth | Notes |
|--------|-------|------|-------|
| POST | `/auth/register` | No | Now also sets `refresh_token` cookie (session-only — register has no rememberMe field) |
| POST | `/auth/login` | No | Now accepts optional `rememberMe: boolean`; sets `refresh_token` cookie |
| POST | `/auth/setup` | No | First-admin setup; sets `refresh_token` cookie same as register |
| GET | `/auth/setup-status` | No | Unchanged |
| POST | `/auth/refresh` | No — authenticates via the `refresh_token` cookie itself | New |
| POST | `/auth/logout` | No — authenticates via the `refresh_token` cookie itself | New |
| GET | `/auth/me` | Yes (JWT or API key) | Unchanged; access-token lifetime now 15m instead of 7d |

---

### Test Cases

#### TC-01: POST /auth/login — happy path, rememberMe omitted → session cookie
- **Type**: Smoke
- **Request**: `{ "email": "<user>", "password": "<pass>" }`
- **Expected status**: 200
- **Expected response**: `{ accessToken, user: {id, email, firstName, lastName} }` — no refresh token in the body
- **Cookie assertion**: `Set-Cookie: refresh_token=...; Path=/api/auth; HttpOnly; SameSite=Lax` — **no `Expires`/`Max-Age`** (session cookie)
- **curl**:
  ```bash
  curl -sS -i -c /tmp/jar.txt -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"<user>","password":"<pass>"}'
  ```

#### TC-02: POST /auth/login — rememberMe: true → persistent cookie
- **Type**: Smoke
- **Request**: `{ "email": "<user>", "password": "<pass>", "rememberMe": true }`
- **Expected status**: 200
- **Cookie assertion**: `Set-Cookie` includes `Expires=<~30 days from now>` (matches `JWT_REFRESH_EXPIRES_IN`, default `30d`)
- **curl**: same as TC-01 with `rememberMe:true` added to the body

#### TC-03: POST /auth/register — sets a session cookie by default
- **Type**: Smoke
- **Expected status**: 201
- **Cookie assertion**: same session-cookie shape as TC-01 (register has no `rememberMe` input)

#### TC-04: refresh_token cookie attributes
- **Type**: Security
- **Description**: Inspect the raw `Set-Cookie` header from any login/register/refresh response
- **Expected**: `HttpOnly` present (unreadable via `document.cookie`), `Path=/api/auth` (not sent on unrelated routes), `SameSite=Lax`, `Secure` present when `NODE_ENV=production` (absent in dev over http)

#### TC-05: POST /auth/refresh — happy path, rotates the cookie
- **Type**: Smoke
- **Steps**: Login → capture `refresh_token` from jar → call `/auth/refresh` with that cookie
- **Expected status**: 200
- **Expected response**: new `accessToken` + `user`
- **Cookie assertion**: new `Set-Cookie: refresh_token=<different value>`
- **curl**:
  ```bash
  curl -sS -i -b /tmp/jar.txt -c /tmp/jar.txt -X POST http://localhost:3001/api/auth/refresh
  ```

#### TC-06: New access token from refresh is actually usable
- **Type**: Regression
- **Steps**: TC-05, then call `GET /auth/me` with `Authorization: Bearer <new accessToken>`
- **Expected status**: 200, returns the same user's profile

#### TC-07: Reuse of just-rotated (old) token within the 30s grace period
- **Type**: Regression — covers the multi-tab race this grace period exists for
- **Steps**: Login → refresh once (rotates token A → B) → immediately call `/auth/refresh` again using **token A**
- **Expected status**: 200 — and the response's `Set-Cookie` value for the second call must be **identical** to the first call's, i.e. token B again, not a third token C
- **Why the identical-token check matters**: an earlier implementation minted a brand-new token on every grace-period replay instead of returning the one already-issued replacement — harmless for exactly two racing tabs, but with no rate limiting anywhere in the backend, N rapid replays of the same stale token within the window produced N independently-valid, orphaned sessions (a real amplification: a single leaked token could be replayed repeatedly within 30s to mint many long-lived sessions). Fixed by caching each rotation's result in-memory keyed by the old token's hash, so replays within the window converge on the one cached replacement instead of each minting a new row.
- **Note**: must run in a single shell session; shell variables holding the raw token do not survive across separate tool/process invocations

#### TC-08: Reuse of old token *outside* the grace period
- **Type**: Regression
- **Steps**: Same as TC-07, but `sleep 31` before the reuse attempt
- **Expected status**: 401 (rotation replay correctly rejected once the grace window has passed)

#### TC-09: POST /auth/refresh — no cookie present
- **Type**: Security
- **Expected status**: 401
- **curl**: plain `curl -i -X POST http://localhost:3001/api/auth/refresh` (no `-b`)

#### TC-10: POST /auth/refresh — garbage/unknown token
- **Type**: Security
- **curl**: `-H "Cookie: refresh_token=not-a-real-token"`
- **Expected status**: 401

#### TC-11: POST /auth/logout — happy path, revokes and clears cookie
- **Type**: Smoke
- **Expected status**: 204, empty body
- **Cookie assertion**: response clears the cookie (`Set-Cookie: refresh_token=; Expires=Thu, 01 Jan 1970 ...`)

#### TC-12: POST /auth/logout is immediate — no grace-period reuse (regression for a real bug found in manual testing)
- **Type**: Regression — **do not skip**, this exact sequence caught a real bug during implementation (logout was soft-revoking through the same field the rotation grace period reads, so a just-logged-out cookie kept working for up to 30s)
- **Steps**: Login → `POST /auth/logout` with that cookie → **immediately** (well within 30s) call `/auth/refresh` with the same, now-logged-out cookie
- **Expected status**: 401 (must fail immediately, not succeed for up to 30s post-logout)

#### TC-13: POST /auth/logout — no cookie present is still a no-op success
- **Type**: Edge Case
- **Expected status**: 204 (idempotent — logging out with nothing to revoke isn't an error)

#### TC-14: POST /auth/login — invalid credentials
- **Type**: Security
- **Expected status**: 401, `{"message":"Invalid credentials", ...}`
- **Cookie assertion**: no `Set-Cookie` header at all

#### TC-15: POST /auth/login — rememberMe as a non-boolean
- **Type**: Validation
- **Request**: `{ "email": "...", "password": "...", "rememberMe": "yes" }`
- **Expected status**: 400 (class-validator `@IsBoolean`)

#### TC-16: GET /auth/me — 401 without a token (sanity regression)
- **Type**: Regression
- **Expected status**: 401 — confirms the guard chain is untouched by the refresh-token changes

#### TC-17: Access token lifetime reflects `JWT_EXPIRES_IN`
- **Type**: Regression
- **Steps**: Decode the `accessToken` JWT payload (base64) from any login response
- **Expected**: `exp - iat` ≈ 900s (15 minutes, the `JWT_EXPIRES_IN` default) — **not** 7 days

#### TC-18: 401/400 responses — no internal stack leak
- **Type**: Security
- **Description**: All new-endpoint error responses must contain only `{message, error, statusCode}` — no stack traces, Prisma errors, or token hashes

#### TC-19: POST /auth/login — deactivated user is rejected
- **Type**: Security — regression for a gap found in code review
- **Steps**: Set a test user's `isActive` to `false` directly in the DB, then attempt login with correct credentials
- **Expected status**: 401, same `{"message":"Invalid credentials"}` shape as wrong-password (does not leak that the account exists but is deactivated)
- **Cookie assertion**: no `Set-Cookie` header — no refresh token is issued

#### TC-20: POST /auth/refresh — deactivated user's still-valid refresh token is rejected
- **Type**: Security — regression for a gap found in code review
- **Steps**: Login while active (capture the refresh cookie) → deactivate the user (`isActive: false`) → call `/auth/refresh` with that still-unexpired cookie
- **Expected status**: 401 — a deactivated account must not be able to keep silently refreshing on a cookie obtained before deactivation. Without this check, "remember me" turns a fixed access-token expiry into an indefinitely-renewable window for a deactivated account, bounded only by 30 days of inactivity.

#### TC-21: POST /auth/refresh — soft-deleted user returns 401, not 404
- **Type**: Regression — regression for a gap found in code review
- **Steps**: Login (capture the refresh cookie) → soft-delete the user (`deletedAt` set) → call `/auth/refresh` with that cookie
- **Expected status**: 401 (previously returned 404, inconsistent with every other "session no longer valid" case in the app and with the endpoint's own documented contract)

#### TC-22: Misconfigured JWT_EXPIRES_IN / JWT_REFRESH_EXPIRES_IN fails at startup, not at request time
- **Type**: Regression — not curl-testable against an already-running server; verify separately
- **Steps**: Set `JWT_REFRESH_EXPIRES_IN` to an unsupported format (e.g. `1w`, `2y`, `"30 days"`) in `.env`, then attempt to start the backend (`npm run start:dev`)
- **Expected**: App fails to start with a clear Joi validation error naming the bad env var, instead of starting fine and only surfacing a generic 500 the first time a `rememberMe: true` login is attempted
- **Covered by**: `packages/backend/src/config/__TEST__/env.validation.spec.ts` (unit-level; this TC is the manual/startup-level confirmation)

---

### Cleanup
Test users created via `POST /auth/register` during this test pass leave rows in `users`, `refresh_tokens`, and auto-seeded `categories`. Delete via Prisma (categories/accounts/transactions/refresh_tokens first, then the user, to satisfy FK constraints) rather than leaving throwaway accounts in a shared dev database.
