## Test Report: mcp-server Package — SDK v2 / Stateless (2026-07-28) Migration
**Date**: 2026-07-24
**Command**: `npx vitest run --coverage` from `packages/mcp-server` (automated),
plus a manual curl-driven run and a real v1-era client compatibility check
against a stand-in backend (TC-M01–M10 in `backend.md`)
**Environment**: automated suite needs no live backend
(`validateBearerToken` mocked; `createMcpServer` and the real
`createMcpHandler`/`NodeStreamableHTTPServerTransport` stack are unmocked);
the manual tier ran against a minimal stand-in backend (plain `node:http`,
canned `/api/auth/me`/`/api/accounts` responses) — no real Postgres involved
in this pass, unlike the previous report (see Testing Gaps)

This report covers the migration from `@modelcontextprotocol/sdk@1.29.0` to
the split v2 packages (`@modelcontextprotocol/server`/`/express`/`/node`,
exact-pinned `2.0.0-beta.5`) and the accompanying architectural rewrite of
`http-transport.ts` from a hand-rolled sessionful design (in-memory `Map`,
30-minute TTL sweep, `tokenHash` hijack check) to `createMcpHandler`'s
stateless-per-request model. See `backend-report.md` for the prior report
(2026-07-19), which remains accurate for the pre-migration architecture it
describes — this is a new report, not a correction of that one.

---

### Summary

| Suite | Total | Passed | Failed |
|-------|-------|--------|--------|
| Automated (`npx vitest run`) | 115 | 115 | 0 |
| Manual, live (TC-M01–M10 in `backend.md`) | 10 | 8 | 0 (2 not executed — TC-M05 not re-run, TC-M10 requires a live Claude session) |

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| **All files** | 97.11% | 90.00% | 97.82% | 97.35% |
| `http-transport.ts` | 90.69% | 72.72% | 91.66% | 90.47% |
| `oauth-metadata.ts` | 100% | 100% | 100% | 100% |
| `server.ts` | 100% | 100% | 100% | 100% |
| `stdio-transport.ts` | 100% | 100% | 100% | 100% |
| `services/fetcher.ts` | 100% | 100% | 100% | 100% |
| `tools/accounts.ts` | 100% | 100% | 100% | 100% |
| `tools/categories.ts` | 100% | 100% | 100% | 100% |
| `tools/dashboard.ts` | 100% | 100% | 100% | 100% |
| `tools/enrich.ts` | 93.1% | 70% | 100% | 96.15% |
| `tools/transactions.ts` | 100% | 93.75% | 100% | 100% |

`http-transport.ts`'s coverage dropped from the prior report's 99.19%/100%
statements/lines to 90.69%/90.47% — expected, not a regression: the file is
smaller and simpler post-migration (no session Map/TTL/hijack code to
cover), and the uncovered lines (141-144) are the error handler's
`!res.headersSent` defensive branch (headers already sent before the error
occurred), which the automated suite doesn't construct a scenario for —
same category of "defensive, not reachable via the public surface" gap the
prior report noted for other files. Coverage still clears the 80% threshold
across every metric.

Test count dropped from 119 (prior report) to 115 — expected: the session
lifecycle/GET-DELETE/TTL-eviction tests (TC-11 through TC-13 in the old
numbering) tested functionality that no longer exists and were replaced
with fewer, differently-scoped tests (per-request re-verification, stateless
legacy serving, 405 on GET/DELETE) rather than a like-for-like swap.

---

### Notable Findings (this session)

Two real bugs were found and fixed during implementation, before this test
run — both would have broken every real connection in production had they
shipped:

1. **`AuthInfo.expiresAt` requirement.** `requireBearerAuth`'s core
   (confirmed by reading the installed package's real `.d.ts`, not assumed)
   rejects any token whose `AuthInfo.expiresAt` is unset, regardless of
   whether it's otherwise valid. This codebase's API tokens don't carry a
   real expiry. Fixed by having `BackendTokenVerifier` return a synthetic
   near-future `expiresAt` — documented in `http-transport.ts` as carrying
   no security weight of its own, since the real check is the live backend
   call on every request.
2. **Codemod's default OAuth import re-point was wrong.** `npx
   @modelcontextprotocol/codemod@beta v1-to-v2` repoints
   `mcpAuthMetadataRouter`/`getOAuthProtectedResourceMetadataUrl` to the
   frozen, deprecated `@modelcontextprotocol/server-legacy/auth` package by
   default (the codemod's own warning output flagged this, but the default
   would silently apply if not manually corrected). Fixed by re-pointing
   both imports to `@modelcontextprotocol/express`, the actual maintained
   v2 home, confirmed against a real usage example in the SDK's own docs.

A third issue was caught by the automated suite itself during
implementation (not a shipped bug, since it never passed CI):
`mockCreateMcpServer.mockReset()` in `http-transport.spec.ts`'s `beforeEach`
was wiping out the real `createMcpServer` implementation the mock was set
up to default to, causing every MCP-request test to fail with `Cannot read
properties of undefined (reading 'connect')`. Fixed by re-establishing the
real implementation after every reset rather than only once at module-mock
time.

No bugs found via the manual/live tier this session — its role for this
migration was confirming intended behavior changes (statelessness, per-request
auth, backward compatibility), not turning up defects.

---

### Results by module

#### ✅ TC-01 through TC-04 — `server.ts`
18 tests, 100% coverage. Same tool-registry/dispatch behavior as before the
migration, but `tools/list`/`tools/call` are now exercised via a real SDK
`Client` + `InMemoryTransport` protocol round-trip instead of reaching into
`Server`'s private `_requestHandlers` Map — the old approach depended on an
SDK internal that isn't guaranteed stable across major versions (and, in
fact, calling handlers directly without going through the real protocol
layer throws `Cannot read properties of undefined (reading 'mcpReq')` under
v2, since handlers now expect a real `ctx` the protocol layer supplies).

#### ✅ TC-05 — `fetcher.ts`
Unaffected by the migration; still 19 tests, 100% coverage (`tokenStorage`
isolation, every `mcpFetcher` branch).

#### ✅ TC-08 through TC-14 — `http-transport.ts`
17 tests, 90.69%/90.47% statement/line coverage (branch gap explained
above). This is the module actually rewritten this session: the session
`Map`/TTL sweep/hijack check are gone, replaced by `createMcpHandler` +
`requireBearerAuth` + `BackendTokenVerifier`. New coverage proves: the same
token succeeding on one request and being rejected on the very next after
simulated revocation (the concrete, demonstrable payoff of moving to
per-request auth); a claim-less `tools/list` succeeding with no prior
`initialize` (the stateless legacy fallback); `GET /mcp` returning `405`
(the old session-poll operation no longer exists); a factory throw still
producing a scoped `5xx`, not a process crash.

#### ✅ TC-15 — `stdio-transport.ts`
Unaffected in behavior; mechanical import-path update only
(`@modelcontextprotocol/sdk/server/stdio.js` →
`@modelcontextprotocol/server/stdio`). 3 tests, 100% coverage.

#### ✅ TC-16 through TC-18 — tool modules
Entirely unaffected by the migration (no SDK types touch these files
directly). 55 tests total, unchanged from the prior report.

#### ✅ TC-M01 through TC-M09 — live manual verification
Run against a minimal stand-in backend (`/api/auth/me` + `/api/accounts`
returning canned data), captured 2026-07-24:

- **TC-M01**: confirmed — `200`, SSE-framed body identical in shape to the
  prior report, but **no `mcp-session-id` response header** (the one core
  observable change for a basic `initialize` call)
- **TC-M02**: confirmed — `Accept` header enforcement (`406`) unchanged
- **TC-M03**: confirmed, and strengthened — `tools/list` sent **with no
  prior `initialize` call at all** still returns all 6 real tools, proving
  the stateless legacy fallback serves any claim-less request standalone,
  not just requests that already went through a (now-vestigial) handshake
- **TC-M04**: confirmed — `list_accounts` returns the real stand-in data
- **TC-M05**: **not re-executed** — the stand-in backend used this pass
  doesn't implement `/transactions`; this case's underlying mechanics
  (tool dispatch → real HTTP call) are unchanged by the migration, so the
  prior report's confirmation is believed still valid but wasn't re-proven
  against a real backend this session
- **TC-M06**: confirmed, **body shape changed** —
  `{"error":"invalid_token","error_description":"Missing Authorization header"}`
  with a proper OAuth `WWW-Authenticate` challenge, replacing the old
  hand-rolled `{"error":"Unauthorized"}` — `requireBearerAuth` from
  `@modelcontextprotocol/express` owns this response now, not
  hand-written code in this repo
- **TC-M07**: confirmed live — a token valid on one request and revoked
  (simulated by flipping the stand-in backend's `/api/auth/me` response)
  before the next identical request is rejected `401` immediately; this is
  the concrete proof the migration delivers its intended benefit (the old
  design would have honored the same token for up to 30 more minutes)
- **TC-M08**: confirmed live — `GET /mcp` and `DELETE /mcp` both now
  return `405 {"jsonrpc":"2.0","error":{"code":-32000,"message":"Method not allowed."},"id":null}`
- **TC-M09** (new this session — real v1-era client): confirmed live —
  installed the actual `@modelcontextprotocol/sdk@1.29.0` package in a
  scratch project and drove its real `Client` + `StreamableHTTPClientTransport`
  against the migrated server: `connect()` succeeded, `transport.sessionId`
  was `undefined` post-connect (the real v1 client transport tolerates a
  server that doesn't issue one — this was verified against the actual
  historical client implementation, not inferred from the spec), two
  independent `listTools()` calls and one `callTool()` all succeeded. This
  is the strongest available evidence that real legacy clients (which is
  what Claude's and VS Code's MCP client implementations currently are)
  continue to work unmodified against the stateless server.
- **TC-M10**: still not executed — needs a live Claude session and a
  reachable instance, same gap as the prior report.

---

### Test Data Created

None. The manual tier this session used a throwaway stand-in backend (plain
`node:http`, canned responses, killed at the end of each check) — no real
database was touched, unlike the prior report's second pass (which created
and cleaned up real Postgres rows for TC-M05/TC-M08). TC-M05 in particular
is weaker in this report as a result (see above and Testing Gaps).

---

### Testing Gaps — Retrospective

1. **TC-M05 (`create_transaction` persistence) not re-verified against a
   real backend this session** — the stand-in backend used doesn't
   implement `/transactions`. The migration doesn't touch how tools call
   the backend (that's `mcpFetcher`/`fetcher.ts`, unaffected), so risk is
   low, but this is an honest gap: it's inferred safe, not re-proven.
2. **TC-M10 (full live Claude connector) still not executed** — same gap
   as the prior report, needs a live Claude session and a reachable
   instance (see `CONNECT.md`'s HTTPS requirement).
3. **No automated test exercises the real v1-era client library** — TC-M09
   (the real `@modelcontextprotocol/sdk@1.29.0` client check) is manual and
   was run once, by hand, in a scratch project outside this repo's own
   dependency tree (the v1 SDK is no longer a dependency of this package
   at all post-migration). If backward compatibility with pre-2026-07-28
   clients regresses in a future change, nothing in `npx vitest run` would
   catch it — only re-running this manual check would.
4. **Beta software risk carries forward, unmitigated by testing**: this
   report confirms the migration *works*, not that `2.0.0-beta.5` is
   production-safe to depend on long-term. The SDK's own README states
   v1.x remains the supported production release until v2 stable ships.
   Nothing in this test plan can substitute for that — it's a
   ship/no-ship decision independent of test coverage.
5. **`http-transport.ts`'s branch coverage gap (72.72%)** is the
   `!res.headersSent` defensive arm in the terminal error handler — same
   category of "believed unreachable via the public surface, untested by
   design" gap the prior report flagged elsewhere (`enrich.ts`'s cache-hit
   path, `transactions.ts`'s `fitid` type guards) — not investigated
   further this session.
