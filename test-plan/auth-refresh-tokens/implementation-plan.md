# Refresh Tokens & Remember Me: Implementation Plan

**Date**: 2026-07-18
**Planner**: assistant (interactive session)
**Status**: ✅ Done — implemented, unit tested, live-verified in browser, two bugs found and fixed

---

## 1. Overview

Before this change, `AuthService.generateToken()` signed a single JWT with a hardcoded 7-day life and there was no refresh mechanism — once that token expired, the user was simply logged out. The "Remember me" checkbox on `LoginForm` was pure UI dead weight: tracked in form state, rendered, but never sent to the API.

This adds the standard short-access-token / long-refresh-token split:
- Access token life drops from 7d → 15m (`JWT_EXPIRES_IN`), shrinking the window an XSS bug could abuse a stolen `localStorage` token.
- A new opaque, hashed, single-use-rotating refresh token (mirrors the existing `ApiToken` model's hash-at-rest pattern) is issued as an **httpOnly cookie**, so it's never reachable from JS.
- The frontend axios client transparently uses it to mint new access tokens on a 401, so normal usage never surfaces a login prompt.
- "Remember me" controls whether that cookie is persistent (30 days, sliding — renewed on every rotation) or a browser-session cookie (dies when the browser closes).

### Key design decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Refresh token storage | httpOnly cookie, not `localStorage` | Standard practice for long-lived refresh tokens; an XSS bug already exposes the short-lived access token in `localStorage`, but a stolen long-lived refresh token would be far worse. Backend CORS was already `credentials: true` with a specific origin, so this fit with minimal plumbing. |
| Rotation | Single-use — every `POST /auth/refresh` issues a new token and revokes the old one | Standard replay-detection pattern; limits the blast radius of a leaked refresh token to one use. |
| Rotation grace period | 30s window where a just-rotated (revoked) token is still accepted | Cookies are shared across all tabs of one browser. Two tabs racing on the same expired access token can both present the same not-yet-rotated cookie; without a grace period the loser gets hard-logged-out instead of just getting a fresh token. |
| Remember-me semantics | Persistent cookie (30d, sliding) vs. session cookie (no `Max-Age`, dies at browser close) + 1-day server-side safety net | Matches literal "remember me" expectations: checked → survive weeks of infrequent use; unchecked → gone once the browser actually closes, but a page refresh mid-session still works. |
| Logout revocation | Hard-delete the row, not soft-revoke (`revokedAt`) | A soft-revoke would fall into the same rotation-grace-period check above and let a just-logged-out cookie keep working for up to 30s — **this was a real bug found during implementation**, see §8. |
| Access token lifetime source | `JWT_EXPIRES_IN` env var (already existed in `.env.example`, previously dead/unused since `auth.module.ts` hardcoded `'7d'`) | Repurposed rather than inventing a new var name; default changed from `7d` to `15m`. |

---

## 2. Prisma Schema Changes

### New `RefreshToken` model

```prisma
model RefreshToken {
  id         String    @id @default(uuid()) @db.Uuid
  userId     String    @map("user_id") @db.Uuid
  tokenHash  String    @unique @map("token_hash")
  rememberMe Boolean   @map("remember_me")
  expiresAt  DateTime  @map("expires_at") @db.Timestamptz
  revokedAt  DateTime? @map("revoked_at") @db.Timestamptz

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz

  @@index([userId])
  @@map("refresh_tokens")
}
```

`User` gained a `refreshTokens RefreshToken[]` relation, mirrored next to the existing `apiTokens ApiToken[]`.

### Migration note
No live database was available in the environment at implementation time (Docker daemon was down). The migration SQL was hand-authored to exactly match this schema (mirroring the checked-in `20260402000923_add_api_tokens` migration's style), then — once Docker/Postgres were started — applied via `prisma db execute --file <migration.sql>` followed by `prisma migrate resolve --applied <name>`, rather than `prisma migrate dev` (which wanted to `reset`/drop all data due to unrelated pre-existing drift in the dev DB from an untracked baseline migration). This was purely additive (one new table, no changes to existing tables) so it carried no risk to existing data.

---

## 3. Backend Changes

```
packages/backend/src/auth/
├── auth.controller.ts        (modified — cookie helper, rememberMe, POST /refresh, POST /logout)
├── auth.module.ts             (modified — JWT_EXPIRES_IN wired in, RefreshTokensService registered)
├── auth.service.ts            (modified — login/register/setupAdmin take rememberMe, new refresh()/logout())
├── refresh-tokens.service.ts  (new — issue/validateAndRotate/revoke)
└── dto/
    └── login.dto.ts            (modified — optional rememberMe field)

packages/backend/src/config/
└── env.validation.ts           (modified — JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN Joi validators)

packages/backend/src/main.ts    (modified — cookie-parser wired in before route handling)
```

`cookie-parser` + `@types/cookie-parser` added as backend dependencies.

---

## 4. API Contract

| Method | Route | Auth | Notes |
|--------|-------|------|-------|
| `POST` | `/auth/register` | No | Now also sets `refresh_token` cookie |
| `POST` | `/auth/login` | No | `LoginDto` gains optional `rememberMe?: boolean` (default `false`); sets `refresh_token` cookie |
| `POST` | `/auth/setup` | No | Sets `refresh_token` cookie same as register |
| `GET` | `/auth/setup-status` | No | Unchanged |
| `POST` | `/auth/refresh` | No — authenticates via the `refresh_token` cookie itself | **New**. Rotates the cookie, returns a new `AuthResponseDto` |
| `POST` | `/auth/logout` | No — authenticates via the `refresh_token` cookie itself | **New**. `204`, clears the cookie |
| `GET` | `/auth/me` | Yes (JWT or API key) | Unchanged |

**Cookie**: `refresh_token`, `httpOnly`, `SameSite=Lax`, `Path=/api/auth` (scoped so it's only ever sent to auth endpoints), `Secure` when `NODE_ENV=production`. `Expires` set only when `rememberMe` was true; omitted otherwise for a session cookie.

**Response body never contains the raw refresh token** — only the access token and user profile, matching the pre-existing `AuthResponseDto` shape exactly, so no frontend type changes were needed beyond the new endpoints.

---

## 5. Service Methods

```typescript
// RefreshTokensService
public async issue(userId: string, rememberMe: boolean): Promise<IssuedRefreshToken>
public async validateAndRotate(rawToken: string): Promise<RotatedRefreshToken | null>
public async revoke(rawToken: string): Promise<void>  // hard-deletes, see §8

// AuthService
public async register(dto: CreateUserDto): Promise<AuthResult>
public async login(email: string, password: string, rememberMe: boolean): Promise<AuthResult>
public async setupAdmin(dto: CreateUserDto): Promise<AuthResult>
public async refresh(rawRefreshToken: string | undefined): Promise<AuthResult>   // new
public async logout(rawRefreshToken: string | undefined): Promise<void>          // new

interface AuthResult {
    authResponse: AuthResponse;      // response body — access token + user
    refreshToken: IssuedRefreshToken; // controller-only — used to set the cookie
}
```

`AuthController` is the only layer that knows about cookies — the service layer stays cookie-agnostic, returning the raw token/expiry/rememberMe for the controller's `setRefreshCookie` helper to apply.

---

## 6. Frontend Integration Points

```
packages/frontend/src/
├── services/api/client.ts                          (modified — withCredentials, refresh-on-401 interceptor,
│                                                       redirect-preserving hard-redirect fallback)
├── features/auth/
│   ├── context/AuthContext.tsx                       (modified — login() takes rememberMe, logout() is now
│   │                                                    async and calls the backend)
│   ├── components/LoginForm.tsx                      (modified — passes rememberMe, uses resolveRedirectTarget)
│   ├── types/auth.types.ts                            (modified — login/logout signatures)
│   └── utils/resolveRedirectTarget.ts                 (new — shared by LoginForm and PublicRoute)
├── routes/
│   ├── AuthGuard.tsx                                  (modified — passes origin location as router state)
│   └── PublicRoute.tsx                                (modified — uses resolveRedirectTarget instead of a
│                                                          hardcoded dashboard redirect; see §8 for why)
├── pages/ProfilePage.tsx                              (modified — logout() call site awaited)
├── components/layout/Sidebar/Sidebar.tsx              (modified — logout() call site awaited)
└── utils/helpers.ts                                   (modified — isSafeRedirectPath open-redirect guard)
```

`packages/frontend/src/api/` (Orval-generated) and `packages/mcp-server/src/api/` were regenerated via `npm run generate:api:live` against a running backend, picking up `authControllerRefresh` / `authControllerLogout`. Both packages' checked-in `openapi.json` snapshots were updated so a plain (non-live) `generate:api` also works for anyone else on the team.

---

## 7. Implementation Steps (as actually executed)

1. Prisma schema + hand-authored migration (no live DB available yet) → `prisma generate` (schema-only, no DB needed).
2. Backend env validation (`JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`) + `.env.example` updated.
3. `cookie-parser` installed, wired into `main.ts`.
4. `RefreshTokensService` built (issue / validateAndRotate with grace period / revoke) + unit tests.
5. `AuthService` updated (rememberMe threading, `refresh()`, `logout()`) + `AuthModule` (JWT_EXPIRES_IN wiring, provider registration) + unit tests.
6. `AuthController` updated (cookie helper, new endpoints) + unit tests.
7. Started Docker/Postgres (was down), applied the migration (additively — see §2 migration note), regenerated Prisma client.
8. Started backend dev server; hit a pre-existing, unrelated local environment bug (stale TypeScript incremental build cache meant `nest start --watch` reported "0 errors" but emitted nothing to `dist/`) — fixed by clearing `.tsbuildinfo` files and doing one full non-incremental build, then normal watch mode worked.
9. Regenerated the OpenAPI spec + Orval clients (frontend and mcp-server) against the running backend.
10. Frontend: `client.ts` interceptor, `AuthContext`, `LoginForm`, `AuthGuard` updated; ran typecheck/lint/tests after each logical chunk rather than at the end.
11. Full backend + frontend test suites run (779 + 1477 tests, all passing) and both typecheck/lint clean.
12. **Live verification** in an actual running browser (Playwright) and via `curl` against the live backend — this is where §8's two bugs were caught. Unit tests alone did not surface either one.

---

## 8. Bugs Found & Fixed During Implementation

Both were caught by live end-to-end testing, not by the unit test suite — the unit tests were internally consistent with the (buggy) implementation they were written against.

### Bug 1: Logout wasn't actually immediate
`RefreshTokensService.revoke()` originally soft-revoked by setting `revokedAt`, the same field the rotation grace-period check reads. A `curl` sequence of login → logout → refresh-with-the-same-cookie returned **200**, not 401 — a just-logged-out session kept working for up to 30 seconds because the grace-period logic couldn't distinguish "revoked because of concurrent-tab rotation" from "revoked because the user explicitly logged out." Fixed by making `revoke()` hard-delete the row instead — logout is now unambiguous and immediate, and rotation's grace period is untouched for its actual purpose.

### Bug 2: Redirect-back-after-login lost the race to a hardcoded dashboard redirect
`LoginForm` computed a redirect target (from `state.from` or `?redirect=`) and navigated there after a successful login — but `PublicRoute` (which wraps `/login`) independently redirects to `/dashboard` the moment `isAuthenticated` flips true, as a *declarative* re-render, and that redirect was hardcoded. Whichever one won the race determined where the user landed, and in practice `PublicRoute`'s always won. Manually testing the full login form submission (not just the already-authenticated case) is what surfaced it — a unit test of either component in isolation would not have. Fixed by extracting `resolveRedirectTarget` into a shared util and having `PublicRoute` use the same logic instead of a hardcoded destination, so the two can no longer disagree.

---

## 9. Test Strategy

### Unit tests (Vitest)
- **Backend** (`packages/backend/src/auth/__TEST__/`): `refresh-tokens.service.spec.ts` (new — issue/rotate/grace-period/expiry/revoke, using `vi.useFakeTimers`), `auth.service.spec.ts` and `auth.controller.spec.ts` (updated for the new signatures and endpoints).
- **Frontend**: `AuthContext.test.tsx`, `LoginForm.test.tsx`, `AuthGuard.test.tsx`, `PublicRoute.test.tsx` updated/extended, including a regression test for Bug 2 above (`PublicRoute` honoring `?redirect=` instead of hardcoding dashboard).

### Manual / live verification
See `test-plan/auth-refresh-tokens/backend.md` (18 curl-driven API test cases) and `test-plan/auth-refresh-tokens/frontend.md` (11 Playwright-driven UI/flow test cases) for the full test plans — both were derived directly from the sequences actually run against the live backend and a real browser during this implementation, including the two bug repros above as dedicated regression cases (backend TC-12, frontend TC-08).

### Results at time of writing
- Backend: 779/779 tests passing, typecheck clean, lint clean.
- Frontend: 1477/1477 tests passing, typecheck clean, lint clean.
- Live verification: all cases in `backend.md`/`frontend.md` executed at least once against a running stack; both bugs found this way were fixed and re-verified live before being written up as regression cases.

---

## 10. Migration Notes / Breaking Changes

- `JWT_EXPIRES_IN` default changes from the previously-hardcoded `7d` to `15m` — any existing session's access token will now expire much sooner, but the refresh flow means this is invisible during normal use. No action needed for existing users; their next silent refresh just starts happening more often.
- `refresh_tokens` table is purely additive — no changes to existing tables' data.
- `LoginDto.rememberMe` is optional (defaults to `false` server-side) — existing API clients that don't send it are unaffected.
- Frontend `logout()` is now `async` (`Promise<void>` instead of `void`) — any other call sites added in the future must `await`/`void` it rather than calling it bare.

---

## 11. Checklist

### Backend
- [x] `RefreshToken` model added; `User.refreshTokens` relation wired
- [x] Migration created and applied (additively, without resetting existing data)
- [x] `RefreshTokensService` implemented (issue / rotate+grace-period / revoke)
- [x] `AuthService` updated; `AuthModule` wires `JWT_EXPIRES_IN` and registers the new service
- [x] `AuthController`: `rememberMe` on login, `POST /auth/refresh`, `POST /auth/logout`, cookie helper
- [x] `cookie-parser` installed and wired
- [x] Env validation + `.env.example` updated
- [x] Unit tests passing (backend: 779/779)
- [x] Zero TypeScript errors, zero lint warnings
- [x] Live API tested (18 cases, `backend.md`)

### Frontend
- [x] `npm run generate:api:live` run — `authControllerRefresh`/`authControllerLogout` available
- [x] `client.ts` — `withCredentials`, refresh-on-401 interceptor with in-flight dedup, redirect-preserving fallback
- [x] `AuthContext` — `rememberMe` threaded through `login()`, `logout()` calls the backend
- [x] `LoginForm` — "Remember me" checkbox finally wired up; honors redirect target
- [x] `AuthGuard` / `PublicRoute` — agree on the same redirect-back target (post-bug-2 fix)
- [x] Open-redirect guard (`isSafeRedirectPath`) on both redirect sources
- [x] All component/context tests passing (frontend: 1477/1477)
- [x] Zero TypeScript errors, zero lint warnings
- [x] Live E2E tested via Playwright (11 cases, `frontend.md`)
