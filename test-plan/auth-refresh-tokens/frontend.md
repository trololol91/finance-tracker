## Test Plan: Refresh Tokens & Remember Me (Frontend)

### Feature Summary
- `LoginForm`'s "Remember me" checkbox now actually does something — passed through to `POST /auth/login` as `rememberMe`.
- The axios response interceptor (`services/api/client.ts`) silently exchanges an expired/invalid access token for a new one via `POST /auth/refresh` (cookie-based) before falling back to a hard redirect to `/login`. Concurrent 401s share one in-flight refresh call instead of each firing their own.
- A forced redirect to `/login` (either from `AuthGuard` blocking a protected route, or from the interceptor's failed-refresh fallback) preserves the page the user was headed to, so login sends them back instead of always landing on the dashboard.
- `logout()` now calls `POST /auth/logout` (revokes the server-side refresh token) before clearing local state.

### Preconditions
- [ ] Frontend dev server running at a port matching backend `CORS_ORIGIN` (e.g. `npx vite --port 3002` if `.env` has `CORS_ORIGIN=http://localhost:3002`) — cookies will silently fail to be set/sent cross-origin otherwise, without a helpful error
- [ ] Backend running at http://localhost:3001
- [ ] A test user account (register one via the UI or `POST /auth/register`)
- [ ] Browser devtools / an evaluate-capable driver (Playwright `browser_evaluate`) to inspect `localStorage` and `document.cookie`, and `browser_network_requests` to inspect the auth call sequence

### UI Inventory
| # | Element | Location |
|---|---------|----------|
| 1 | Email / Password inputs | `/login` form |
| 2 | "Remember me" checkbox | `/login` form |
| 3 | "Sign In" submit button | `/login` form |
| 4 | "Log out" button | Sidebar, bottom |

---

### Test Cases

#### TC-01: Login without "Remember me" — session cookie only
- **Type**: Smoke
- **Steps**: Go to `/login`, fill credentials, leave "Remember me" unchecked, submit
- **Expected**: Redirected to `/dashboard`; `localStorage.auth_token` set; `document.cookie` is **empty** (the `refresh_token` cookie exists but is httpOnly — unreadable from JS, which is itself the assertion)

#### TC-02: Login with "Remember me" checked
- **Type**: Smoke
- **Steps**: Same as TC-01, but check "Remember me" before submit
- **Expected**: Same as TC-01. (Cookie persistence/expiry itself is only observable via devtools' Application/cookie panel or the backend test plan — `document.cookie` reads the same either way since it's httpOnly.)

#### TC-03: Silent refresh on an expired/invalid access token — no visible interruption
- **Type**: Regression — the core of this feature
- **Steps**:
  1. Log in (either remember-me state)
  2. `localStorage.setItem('auth_token', 'corrupted-token')` via evaluate, to simulate expiry without waiting 15 minutes
  3. Reload the current protected page
- **Expected**: Page loads normally, **no redirect to `/login`**. Network log shows: `GET /auth/me` → 401, `POST /auth/refresh` → 200, `GET /auth/me` (retried) → 200. `localStorage.auth_token` now holds a new, different token.

#### TC-04: Concurrent 401s trigger exactly one refresh call
- **Type**: Regression
- **Steps**: Same trigger as TC-03 on a page/lifecycle that fires more than one authenticated request on load (e.g. a fresh full-page load, where React's dev-mode double-effect fires two `GET /auth/me` calls)
- **Expected**: `browser_network_requests` filtered on `/api/auth` shows **exactly one** `POST /auth/refresh`, even though multiple requests independently hit 401 — confirms the shared in-flight-promise dedup in the interceptor, not a stampede of refresh calls

#### TC-05: Refresh token also invalid — falls through to login, preserving the path
- **Type**: Regression
- **Steps**:
  1. Log in, navigate to a non-dashboard protected page (e.g. `/transactions`)
  2. Via evaluate, call `fetch('/api/auth/logout', {credentials:'include'})` to revoke the refresh token server-side (simulates it having expired) — `document.cookie` manipulation does **not** work here since the cookie is httpOnly
  3. Corrupt `localStorage.auth_token` as in TC-03
  4. Trigger a request (e.g. client-side nav to another protected route, not a full reload — a full reload's double-effect races two redirects and can lose the query string, which is a known limitation, not a bug)
- **Expected**: Redirected to `/login?redirect=%2Ftransactions` (or whatever the origin path was); `localStorage` cleared

#### TC-06: AuthGuard preserves the origin location via router state
- **Type**: Regression
- **Steps**: While logged out, directly navigate (client-side, not a hard URL load) to a protected route
- **Expected**: `AuthGuard` redirects to `/login` with router `state.from` set to the original location (verify via a test harness reading `location.state`, or indirectly via TC-07)

#### TC-07: Login honors the preserved redirect target
- **Type**: Regression
- **Steps**: Arrive at `/login?redirect=%2Ftransactions` (or via TC-06's `state.from` path), log in successfully
- **Expected**: Lands on `/transactions`, **not** `/dashboard`

#### TC-08: Already-authenticated visit to `/login?redirect=...` also honors the target
- **Type**: Regression — covers a real bug found during implementation (PublicRoute originally hardcoded a redirect to `/dashboard`, which raced with and silently overrode LoginForm's redirect-back logic)
- **Steps**: While already logged in, navigate directly to `/login?redirect=%2Ftransactions`
- **Expected**: Immediately redirected to `/transactions`, not `/dashboard` — `PublicRoute` and `LoginForm` must agree on the same target

#### TC-09: Unsafe redirect target falls back to the dashboard
- **Type**: Security
- **Steps**: Navigate to `/login?redirect=%2F%2Fevil.com` (a `//`-prefixed value, which browsers can treat as protocol-relative), log in (or, if already authenticated, just load the URL)
- **Expected**: Lands on `/dashboard` — the open-redirect guard (`helpers.isSafeRedirectPath`) rejects anything not starting with a single `/`

#### TC-10: Logout revokes the session server-side
- **Type**: Regression
- **Steps**: Log in, click "Log out" in the sidebar
- **Expected**: Redirected/rendered as logged out, `localStorage` cleared. Network log shows `POST /auth/logout` → 204. A subsequent manual `POST /auth/refresh` call with the old cookie value (if captured beforehand) returns 401 — logout must be immediate (see backend TC-12, the bug this specifically guards against).

#### TC-11: Logout is best-effort — doesn't block on a failed request
- **Type**: Edge Case
- **Steps**: Stop the backend (or block `/api/auth/logout` via network throttling/mock), then click "Log out"
- **Expected**: Local state still clears and the user still lands on `/login` — a failed logout call must not trap the user in a logged-in-looking state

---

### Cross-cutting note
TC-03/04/05 depend on the browser actually treating requests to `http://localhost:3001` from the frontend origin as same-site enough to send the `SameSite=Lax` cookie, and on `withCredentials: true` being honored — if these fail with the refresh never firing at all, check `CORS_ORIGIN` matches the frontend's actual port before assuming the interceptor logic is broken.
