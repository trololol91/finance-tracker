## Test Report: mcp-server Package
**Date**: 2026-07-19
**Command**: `npx vitest run --coverage` from `packages/mcp-server` (automated),
plus a manual curl-driven run against a real backend (TC-M01–M08 in `backend.md`)
**Environment**: automated suite needs no live backend (mocks `fetch`/the MCP
SDK's transport classes); the manual tier was run against the real NestJS
backend + real Postgres (see "Test Data Created")

---

### Summary

| Suite | Total | Passed | Failed |
|-------|-------|--------|--------|
| Automated (`npx vitest run`) | 119 | 119 | 0 |
| Manual, live (TC-M01–M09) | 9 | 8 | 0 (1 not executed — TC-M09) |

Automated suite stable across repeated runs (checked 3x, no flakiness). The
manual tier surfaced and fixed a real bug — see Bug 3 below.

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| **All files** | 98.95% | 90.96% | 98.03% | 99.62% |
| `http-transport.ts` | 99.19% | 89.13% | 94.44% | 100% |
| `stdio-transport.ts` | 100% | 100% | 100% | 100% |
| `server.ts` | 100% | 100% | 100% | 100% |
| `services/fetcher.ts` | 100% | 100% | 100% | 100% |
| `tools/accounts.ts` | 100% | 100% | 100% | 100% |
| `tools/categories.ts` | 100% | 100% | 100% | 100% |
| `tools/dashboard.ts` | 100% | 100% | 100% | 100% |
| `tools/enrich.ts` | 93.1% | 70% | 100% | 96.15% |
| `tools/transactions.ts` | 100% | 93.75% | 100% | 100% |

`vitest.config.ts`'s coverage `exclude` only covers `src/api/**` (generated),
`src/__TEST__/**`/`src/tools/__TEST__/**` (test files), `src/index.ts`
(thin dispatcher, no branching logic) and `src/tools/types.ts` (type-only,
no runtime code) — every other file in the package is measured.

---

### Bugs Found (this session)

1. **`app.listen()`'s callback can fire before a bind failure is detected.**
   Found by TC-15 (`startHttpServer` EADDRINUSE test): a second
   `startHttpServer()` call on an already-bound port resolved instead of
   rejecting. Root cause verified with standalone repro scripts — Express's
   `app.listen(port, cb)` convenience wrapper's callback fired, then the
   `error` event fired afterward, whereas wrapping the app explicitly in
   `http.createServer(app)` before calling `.listen()` does not have this
   quirk. Fixed by reverting `startHttpServer` to the explicit-wrap form
   (`createHttpApp()` itself still returns a bare Express app, unaffected).
2. **Custom error-handling middleware wasn't being recognized by Express.**
   Added while fixing an unhandled-promise-rejection gap
   (`app.use('/mcp', (req,res)=>{void handleMcpRequest(...)})` discarded the
   promise) — the replacement error handler initially declared only 3
   parameters (`err, _req, res`), and Express detects error-handling
   middleware by checking the function has exactly 4 declared parameters.
   TC-14's regression test caught the resulting empty response body; fixed
   by declaring the unused 4th `_next` parameter.
3. **`DELETE /mcp` never actually freed the session it was supposed to
   terminate.** Found by re-running TC-M08 against a real backend and
   actually following up with a `GET` on the same session id afterward (the
   earlier stand-in-backend run only checked that `DELETE` itself returned
   `200` — it never verified the session was actually gone). That follow-up
   `GET` hung indefinitely as a live SSE stream instead of returning
   `400`/`404`. Root cause: in [http-transport.ts](../../packages/mcp-server/src/http-transport.ts),
   `newTransport.onclose = () => { sessions.delete(sid); }` was assigned
   **before** `await newServer.connect(newTransport)` — and the SDK's
   `Protocol.connect()` (which `Server.connect()` calls) unconditionally
   overwrites `transport.onclose` with its own internal handler, silently
   discarding ours. So the SDK's real `close()` → `onclose()` chain fired
   correctly on `DELETE`, but by then `onclose` was the SDK's handler, not
   the one that cleared our `sessions` Map. Bounded impact in practice (the
   30-minute TTL sweep deletes directly, without depending on this
   callback, so it wasn't a true leak), but `DELETE` was functionally a
   no-op for its one job: a "terminated" session remained fully usable.
   Fixed by moving the assignment to *after* `connect()` and **chaining**
   to the SDK's handler instead of clobbering it back:
   ```ts
   await newServer.connect(newTransport);
   const sdkOnClose = newTransport.onclose;
   newTransport.onclose = (): void => {
       sdkOnClose?.call(newTransport);
       const sid = newTransport.sessionId;
       if (sid) sessions.delete(sid);
   };
   ```
   Also updated the automated suite's `createMcpServer` mock to replicate
   the SDK's real clobbering behavior on `connect()` (it previously no-op'd
   `connect`, so TC-12's "removes the session" test passed regardless of
   assignment order) — verified this actually catches the regression by
   deliberately reintroducing the old ordering and confirming the test
   fails (`400` expected, `200` received), then re-applying the fix.
4. Bugs 1 and 2 were only findable because `http-transport.ts` had 0% test
   coverage before this session (excluded from `vitest.config.ts`'s
   `exclude` list as an apparent side effect of an unrelated earlier
   refactor, not a deliberate exemption); bug 3 was only findable by
   actually running the real SDK transport instead of the automated
   suite's fake — none of the mocked unit tests could have caught it.

No other bugs found. All 19 automated test-case groups (TC-01–TC-19) and
all 8 executable manual test cases (TC-M01–M08) in `backend.md` now pass;
TC-M09 was not executed (requires a live Claude session, see Testing Gaps).

---

### Results by module

#### ✅ TC-01 through TC-05 — `server.ts`
18 tests, 100% coverage. Tool registry composition, `tools/list`/`tools/call`
dispatch (including unknown-tool and thrown-error paths), and
`validateBearerToken`'s full branch set all pass.

#### ✅ TC-06, TC-07 — `fetcher.ts`
19 tests, 100% coverage. `tokenStorage` isolation and every `mcpFetcher`
branch (headers, query serialization, error propagation, empty body,
env-var base URL, abort signal) pass.

#### ✅ TC-08 through TC-15 — `http-transport.ts`
24 tests, 100% line coverage (99.19% statements — the remaining gaps are a
few defensive branch arms, e.g. an already-hashed-token fallback, not
reachable via the public HTTP surface). Covers the Express migration done
this session (routing, case-sensitivity, `X-Powered-By` disable, session
hijack protection, TTL eviction, the error-handling middleware, and real
port-binding success/failure via `startHttpServer`).

#### ✅ TC-16 — `stdio-transport.ts`
3 tests, 100% coverage. Missing-token exit, backend-rejected-token exit,
and the successful connect-and-log-readiness path.

#### ✅ TC-17, TC-18 — `tools/{accounts,categories,dashboard,transactions}.ts`
43 tests total, 100% line coverage across all four files (93.75% branch on
`transactions.ts` — an unreachable defensive arm in the `fitid` fallback
logic, see Testing Gaps below). Endpoint calls, token propagation, param
handling, and enrichment integration all pass.

#### ✅ TC-19 — `tools/enrich.ts`
12 tests, 96.15% line / 70% branch coverage. Name resolution (including
unknown-id → `null`) and lookup-map construction (including nested-category
flattening and empty-array handling) pass. The uncovered branch is the
60-second cache **hit** path in `fetchLookupMaps` (every test exercises a
cold cache) — see Testing Gaps.

#### ✅ TC-M01 through TC-M08 — live manual verification
Run twice. **First pass**: the real `MCP_TRANSPORT=http` process against a
throwaway stand-in backend (`/api/auth/me` + `/api/accounts` returning
canned data) — confirmed TC-M01–M04, M06, M07; TC-M05 skipped (stand-in
didn't implement `/transactions`); TC-M08 only checked that `DELETE` itself
returned `200`, not that the session was actually gone afterward.
**Second pass**: the real process against the **real** NestJS backend +
real Postgres (a fresh admin user, an account, and a scoped API token were
created via the real `/api/auth/setup`, `/api/accounts`, `/api/api-tokens`
endpoints) — this run is what caught Bug 3 above, and confirms every test
case end-to-end:

- **TC-M01**: confirmed — `200`, real `mcp-session-id` header, real SSE-framed
  body (`event: message\ndata: {...}`), not the plain-JSON shape one might
  assume without running it
- **TC-M02**: confirmed — omitting `Accept: application/json, text/event-stream`
  produces `406` with the exact error body documented in `backend.md`
- **TC-M03**: confirmed — `tools/list` returns all 6 real tools with real
  `inputSchema`s (captured verbatim into `backend.md`'s TC-M03)
- **TC-M04**: confirmed — `list_accounts` returned the exact real account
  row from the real backend, byte-identical to a direct `GET /api/accounts`
  call, correctly wrapped in the MCP `content[0].text` shape
- **TC-M05**: confirmed — `create_transaction` persisted through the real
  API (same transaction `id` and fields visible via the backend's own
  `GET /api/transactions`), and the created transaction appeared correctly
  enriched (`accountName` resolved) in a follow-up `list_transactions` call
- **TC-M06**: confirmed — `401 {"error":"Unauthorized"}` with no token
- **TC-M07**: confirmed — hijack attempt (same session, different token)
  rejected `400` with the exact vague message, live — matches the automated
  TC-11 assertion exactly
- **TC-M08**: **initially failed** — see Bug 3. After the fix, re-verified
  live: `DELETE` returns `200`, and an immediate follow-up `GET` on the same
  session id now correctly returns `400` instantly (previously hung
  indefinitely as an open SSE stream)

This closes Testing Gap #3 from the previous version of this report ("no
automated test drives a real MCP protocol handshake") for the manual tier —
the real SDK transport's wire format (SSE framing, Accept-header
enforcement) and its `onclose`/session-lifecycle behavior are now verified
against the real thing, not assumed or only checked against the fake.

- **TC-M09**: still not executed — needs a live Claude session and a
  reachable instance. See Testing Gaps.

---

### Test Data Created

None from the automated suite (every test mocks `fetch`/the SDK's transport
classes). The manual run's first pass used a throwaway stand-in backend
(plain `node:http`, canned responses, killed at the end) — no real database
touched. The **second pass**, run against the real backend to close the
TC-M05/TC-M08 gaps, created real rows in the dev Postgres database
(`finance-tracker-db` docker container):

| Resource | Value |
|----------|-------|
| User | `mcp-test@example.com` (id `57cd2833-9aad-4c05-8c83-a22c9b6be310`) |
| Account | "MCP Test Chequing" (id `6bd082cf-7a01-49ea-8636-0e988f2101b6`) |
| API token | `mcp-test-token` (scopes: transactions read/write, accounts/categories/dashboard read) |
| Transaction | "MCP test grocery run", $42.50 (id `8583b650-093b-4906-8d0e-b51d90aae329`) |
| Categories | 13 default categories (Income, Housing, Food & Dining, ...) — auto-seeded by `POST /api/auth/setup`, not something this test created directly |

**Cleaned up** — deleted via direct `psql` against `finance-tracker-db`, in
FK-dependency order (`transactions` → `accounts` → `api_tokens` →
`categories` → `users`). Correction to the assumption above: only
`ApiToken` actually has `onDelete: Cascade` in the Prisma schema —
`Account`, `Transaction`, and `Category` do not, so deleting the `users` row
directly failed twice with FK constraint violations until each dependent
table was cleared first (the categories violation was a surprise — the
setup flow auto-seeds 13 default categories per new user, which isn't
mentioned anywhere in `backend.md`'s preconditions). All 5 tables confirmed
empty (`SELECT count(*)` = 0) after cleanup.

Note: a separate backend process (unrelated to this session, already
running before this testing started) is also live on port 3001 against the
same database — nothing about that process was touched by this cleanup.

---

### Testing Gaps — Retrospective

1. **Cache-hit path in `enrich.ts`'s `fetchLookupMaps`** (line 46) is
   untested — every test triggers a cold-cache fetch. Low risk (the logic
   is a simple `expiresAt > Date.now()` check) but worth a fake-timers test
   if this file is touched again.
2. **`transactions.ts`'s `fitid` type-guard fallbacks** (lines 186-188) —
   the `typeof args.date === 'string' ? args.date : ''`-style guards exist
   for a misbehaving client sending non-string/non-number values; the input
   schema should reject these before the handler runs, so this path is
   believed unreachable via the real MCP framework and is untested by
   design, not by omission.
3. **No *automated* test drives a real MCP protocol handshake** through the
   actual `@modelcontextprotocol/sdk` transport classes — `http-transport.spec.ts`
   replaces `StreamableHTTPServerTransport` with a hand-rolled fake
   specifically to keep those tests scoped to this file's own logic. All 8
   executable manual test cases (TC-M01–M08) now confirm the real transport
   end-to-end, including the real backend integration for TC-M05 — but that
   coverage isn't repeatable via `npx vitest run`; it needs to be re-run by
   hand (or built into a real integration test, see the earlier discussion
   on a lighter-weight version using the SDK's own client) any time this
   file changes. Bug 3 above is a direct example of a defect this automated
   suite structurally cannot catch on its own — the mock had to be updated
   to *simulate* the real SDK's `onclose`-overwriting behavior before the
   automated regression test became meaningful.
4. **TC-M09 (full live Claude connector)** was not executed — needs a live
   Claude session and a reachable instance (see `CONNECT.md`'s HTTPS
   requirement).
5. **`backend.md`'s preconditions don't mention that `POST /api/auth/setup`
   auto-seeds 13 default categories per new user** — discovered only while
   cleaning up test data (a direct `users` delete failed on an FK violation
   from `categories` that nothing in the test plan anticipated). Worth
   adding to `backend.md`'s preconditions if this manual run is repeated.
6. **OAuth connector support is still unimplemented** — this report only
   covers the mcp-server package's existing bearer-token auth and the
   Express migration done this session. `test-plan/oauth-connector/implementation-plan.md`
   remains a plan, not a built feature; nothing in this report should be
   read as OAuth being done.
