# Code Review: Targeted Pass on the Phase 2 Fix Round

Scope: not a re-review of the OAuth feature (already reviewed twice — see `code-review.md` and `code-review-phase2.md`), but a targeted check of the fix round itself — the 8 changes made in response to `code-review-phase2.md`'s findings — to catch anything the fixes themselves introduced.

Method: 4 targeted finder passes (line-by-line, removed-behavior, cross-file tracer, test-coverage) scoped explicitly to the fix-round diff, since nothing is committed and a plain `git diff` can't isolate "the fixes" from "the already-reviewed Phase 2 feature" they sit on top of. 3 candidates survived across the 4 passes; 1 (the highest-priority thing going in) was independently checked against NestJS's actual source by two separate agents and confirmed correct, not a bug.

**Status: #1 and #3 fixed, #2 accepted as a documented gap and closed via manual live verification instead of automated coverage** (2026-07-19/20, per direction — building e2e/supertest infrastructure for this was judged out of proportion to the finding). Backend suite: 863 tests passing (was 861; +2 from this round).

---

## 1. Removed client-existence fallback leaves `consume()` without a null guard — real but currently unreachable

**File:** `packages/backend/src/oauth/oauth-codes.service.ts:88`

Fixing finding #8 (redundant `findByClientId` lookup) removed `token()`'s old `client ? ... : 'Unknown Client (OAuth)'` fallback along with the lookup itself, replacing it with `consumed.clientName` sourced from a Prisma `include` on the authorization code's `client` relation. `consume()` now does `record.client.clientName` with no null check. Today this is safe — `OAuthAuthorizationCode.client` is a required (non-nullable) Prisma relation, there's no `onDelete` cascade, and `OAuthClientsService` has no hard-delete method (only `findByClientId`, `ensureStaticClient`, `register`) — so nothing in the app can actually produce a dangling reference; Postgres's FK constraint would block it even via direct SQL deletion while a code still references the client. But the old code's graceful fallback was defense-in-depth against exactly this kind of edge case, and it's gone with nothing replacing it — if `OAuthClientsService` ever gains a hard-delete/purge method, this becomes a real, silently-reachable `TypeError` → bare 500 instead of a clean error.

**Recommendation:** add a defensive check in `consume()` (or type `client` as nullable and handle it) so a future hard-delete path degrades gracefully instead of crashing. Low cost, easy to do now.

**Fix:** `DeletedCodeWithUser`'s `client` field is now typed `{clientName: string} | null`, and `consume()` uses `record.client?.clientName ?? 'Unknown Client'`. Added a test asserting the fallback fires when the mocked `delete()` result has `client: null`. Backend now at 863 passing tests.

## 2. No automated test proves the `@UseFilters` decorator-placement fix actually works — coverage gap, not a live bug

**File:** `packages/backend/src/oauth/__TEST__/oauth.controller.spec.ts`

Every test in this file instantiates `OAuthController` directly and calls methods as plain functions (`controller.authorize(...)`, etc.) — this never exercises Nest's HTTP/DI pipeline, so `@UseGuards`/`@UseFilters` decorators are inert in every one of these tests. The repo has no e2e/supertest coverage of any OAuth route either (the only e2e spec covers `GET /`). So the fix for finding #5 — moving `@UseFilters(OAuthExceptionFilter)` from class-level to per-method on `authorize`/`consent`/`token`/`register` — has zero automated regression protection: if a future edit accidentally drops the decorator from one of those routes (or reintroduces the original bug), every existing test still passes.

**This is a coverage gap, not a live bug** — both the cross-file tracer and the line-by-line finder independently read NestJS's actual installed source (`router-execution-context.js`, `router-proxy.js`, `router-exception-filters.js`) and confirmed the current wiring is correct: a route's `ExceptionsHandler` merges global + class + method `@UseFilters` metadata, so a method-level filter does catch exceptions from class-level guards (`ThrottlerGuard`) and from guards bound to that same route (`JwtAuthGuard` on `consent`, `IatGuard` on `register`). I also live-verified this manually for `register` and `issueInitialAccessToken` during the fix pass. The gap is specifically that nothing *automated* would catch a regression here going forward.

**Recommendation:** this is a scope decision, not a one-line fix — the repo has no existing e2e harness for any authenticated route, so adding real supertest coverage for OAuth specifically would be new infrastructure, not a small addition. Flagging it rather than unilaterally building an e2e suite; your call whether it's worth the investment now or something to pick up separately.

**Resolution:** decided not to build e2e/supertest infrastructure for this — the gap is documented here instead, and the two specific untested live paths were closed via manual verification against a temporary backend instance (2026-07-19):
- `POST /oauth/consent` with no `Authorization` header, and with a garbage Bearer token — both returned `{"error":"unauthorized","error_description":"Unauthorized"}` (the OAuth shape from `consent`'s method-level filter catching `JwtAuthGuard`'s 401), not Nest's default `{statusCode, message, error}` shape.
- `POST /oauth/token`, tripping `ThrottlerGuard`'s 5/min limit with 6 rapid requests — the 6th returned `429 {"error":"slow_down","error_description":"ThrottlerException: Too Many Requests"}`, confirming the method-level filter also catches the class-level `ThrottlerGuard`'s exception for that route.

Both match the behavior the two finder agents predicted from reading NestJS's source. No automated regression protection exists for either path — a future accidental removal of one of the 4 `@UseFilters` decorators would not be caught by CI, only by a manual re-check like this one.

## 3. `register-client.dto.spec.ts` doesn't test a protocol-less redirect_uri — doesn't actually pin down `require_protocol: true`

**File:** `packages/backend/src/oauth/__TEST__/register-client.dto.spec.ts`

The 6 existing tests cover valid https, valid localhost http, `javascript:`/`data:` rejection, empty array, and empty `client_name` — but the `javascript:`/`data:` rejections would pass even if `require_protocol: true` were dropped or flipped, since those payloads carry an explicit (disallowed) protocol token regardless. Nothing tests a bare, protocol-less string like `evil.example.com/callback`, which is specifically what `require_protocol: true` guards against.

**Recommendation:** trivial to add — one more test case, no design decision involved. Will add this now regardless of what you decide on #1/#2.

**Fix:** added a test for `dto.redirect_uris = ['evil.example.com/callback']` (no scheme at all), asserting rejection — this specifically exercises `require_protocol: true` rather than the protocol allowlist.

---

## Dropped after independent double-verification (not a finding)

**Guard/filter execution order for the `@UseFilters` decorator move** — the top-priority thing this pass was launched to check. Confirmed correct by reading actual `@nestjs/core` source (see #2 above for detail). Not a bug.
