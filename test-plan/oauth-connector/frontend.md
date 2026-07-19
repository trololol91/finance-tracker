## Test Plan: OAuth 2.1 Authorization Server (Frontend — Consent Screen)

### Feature Summary
Adds `/oauth/consent`, an authenticated-but-`AppShell`-free route (same tier as `/login`) that renders `ConsentScreen`. It reads `client_id`/`redirect_uri`/`code_challenge`/`code_challenge_method`/`state` off its own URL (placed there by the backend's `GET /oauth/authorize` redirect), shows a fixed, human-readable list of what Claude is requesting, and on Approve/Deny calls `POST /api/oauth/consent` (auto-authenticated via the existing axios interceptor — no new auth plumbing) then does `window.location.href = response.redirectTo`. See `test-plan/oauth-connector/implementation-plan.md` for the full flow.

### Preconditions
- [ ] Backend running with the OAuth env vars set (`PUBLIC_API_BASE_URL`, `OAUTH_STATIC_CLIENT_ID`, `OAUTH_STATIC_REDIRECT_URIS`) — include a redirect URI you control for testing, e.g. `http://localhost:9999/callback` (doesn't need to actually be listening — see TC-M01 below)
- [ ] Frontend dev server running at a port matching the backend's `CORS_ORIGIN`
- [ ] A logged-in test user (the consent route sits inside `AuthGuard`; an unauthenticated visit redirects to `/login` and back via the existing `resolveRedirectTarget`, same as any other protected route — not re-tested here, it's pre-existing machinery)
- [ ] A fresh PKCE pair per run (see `backend.md`'s Preconditions for the one-liner)

### UI Inventory
| # | Element | Location |
|---|---------|----------|
| 1 | Permissions list (5 fixed items) | `/oauth/consent` |
| 2 | "Deny" button | `/oauth/consent` |
| 3 | "Approve" button | `/oauth/consent` |
| 4 | Missing-params fallback message | `/oauth/consent` with no/incomplete query string |

---

### Automated coverage (Vitest + Testing Library, 5 tests)
`src/features/oauth/components/__TEST__/ConsentScreen.test.tsx` — missing-params fallback, permissions list rendering, Approve submits `approved: true` and navigates to the mocked `redirectTo`, Deny submits `approved: false`, API failure shows an inline error. The API hook (`useOAuthControllerConsent`) is mocked in these — they prove the component's own logic, not the real network/auth/CORS wiring.

### Live/manual verification (Playwright, against a real backend + real session)
Run against a temporary backend/frontend pair (not the shared dev servers) with a disposable test user, since this flow needs a live 200 from `/api/oauth/consent` with a real JWT attached — mocking it, as the automated tests do, can't catch an interceptor/CORS/auth-wiring regression.

#### TC-M01: Approve — real API call, real redirect
- **Type**: Smoke
- **Steps**: Log in as a test user → navigate to `/oauth/consent?client_id=claude-ai&redirect_uri=http%3A%2F%2Flocalhost%3A9999%2Fcallback&code_challenge=...&code_challenge_method=S256&state=...` → click Approve
- **Expected**: Screen renders the 5 fixed permissions; clicking Approve fires `POST /api/oauth/consent` with a real `Authorization: Bearer <jwt>` header (confirms the axios interceptor attaches it here same as everywhere else) and gets a real `200`; the browser then actually navigates to the returned `redirectTo` (using an unreachable `localhost:9999` target deliberately, so the resulting `ERR_CONNECTION_REFUSED` / ROR "site can't be reached" page is itself the proof that `window.location.href` assignment executed with a real, backend-returned, cross-origin URL — not a bug)
- **Actual result** (2026-07-19): confirmed. Network log: `POST http://localhost:3098/api/oauth/consent => 200`, request had `authorization: Bearer eyJ...` and `access-control-allow-origin: http://localhost:3003` in the response (matching the frontend's actual origin — CORS correctly scoped). Final page: Chrome's "localhost refused to connect" / `ERR_CONNECTION_REFUSED`, confirming navigation to the real `redirectTo` target was attempted.

#### TC-M02: Deny — same real-call proof, different outcome
- **Type**: Smoke
- **Steps**: Same as TC-M01, click Deny instead
- **Expected**: Same `POST /api/oauth/consent` call shape, `approved: false`; browser navigates to `<redirect_uri>?error=access_denied&state=...`
- **Actual result**: confirmed — `200` response, same connection-refused navigation proof as TC-M01.

#### TC-M03: Missing/incomplete OAuth params
- **Type**: Edge Case
- **Steps**: Navigate directly to `/oauth/consent` with no query string
- **Expected**: Renders the fallback alert ("This link is missing required information...") instead of a blank page or a crash; no API call fires
- **Actual result**: confirmed — alert rendered, `role="alert"`, no `/oauth/consent` network request in the log.

---

### Not yet exercised live
- **Actual claude.ai round-trip**: this verifies the frontend's half of the flow (real backend call, real redirect) with a synthetic `redirect_uri`. It does not prove Claude's own client is happy with the resulting `?code=...&state=...` query shape — that's only provable via the real "Add custom connector" dialog (see backend.md's matching note).
- **CORS from a genuinely different origin than the backend's configured `CORS_ORIGIN`**: this pass used a frontend port matched to `CORS_ORIGIN` on purpose (same as `auth-refresh-tokens/frontend.md`'s cross-cutting note) — a mismatched-origin failure mode wasn't separately induced.

---

### Cross-cutting note
Like the refresh-token frontend tests, this depends on the frontend's dev port matching the backend's `CORS_ORIGIN` — if `POST /api/oauth/consent` fails with a CORS error rather than reaching the assertions above, check that mismatch before assuming the component logic is broken.
