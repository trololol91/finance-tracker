## Test Plan: mcp-server Package

Unlike the other `test-plan/` entries, `packages/mcp-server` isn't a NestJS
REST API — it's a standalone MCP (Model Context Protocol) server with two
transports (stdio, HTTP) and a set of tools that proxy to the finance-tracker
backend's REST API. This plan covers the package's own automated Vitest
suite (unit + supertest-driven integration tests), not a curl walk of the
backend's endpoints (those are covered by the other `test-plan/` entries).

### Preconditions
- [ ] `npm install` run at the repo root (workspace deps resolved) —
      `packages/mcp-server` runs on `@modelcontextprotocol/server` /
      `/express` / `/node` (exact-pinned `2.0.0-beta.5`), **not**
      `@modelcontextprotocol/sdk` v1.x, since the 2026-07-24
      migration to the stateless (2026-07-28 protocol) SDK
- [ ] No live backend or database required for the automated suite —
      `validateBearerToken` is mocked; `http-transport.spec.ts` runs the
      **real** `createMcpHandler`/`NodeStreamableHTTPServerTransport` stack
      (unmocked) against the mocked backend boundary, not a hand-rolled fake
      transport
- [ ] Run from `packages/mcp-server`: `npx vitest run` / `npx vitest run --coverage`

### Module Inventory

| File | Role | Test file |
|------|------|-----------|
| `src/server.ts` | Builds the low-level MCP `Server`, registers `tools/list`/`tools/call` handlers, dispatches to tool modules; `validateBearerToken` (calls backend `/api/auth/me`, also the guts of `http-transport.ts`'s `BackendTokenVerifier`) | `src/__TEST__/server.spec.ts` |
| `src/services/fetcher.ts` | `tokenStorage` (`AsyncLocalStorage` token propagation) + `mcpFetcher` (outbound HTTP client used by every tool) | `src/__TEST__/fetcher.spec.ts` |
| `src/http-transport.ts` | HTTP transport — Express app, `createMcpHandler` (stateless: fresh `Server` per request, no session state), `requireBearerAuth` + `BackendTokenVerifier` (per-request auth against the backend), OAuth discovery metadata, error handling | `src/__TEST__/http-transport.spec.ts` |
| `src/stdio-transport.ts` | stdio transport — startup token validation, connects `StdioServerTransport` | `src/__TEST__/stdio-transport.spec.ts` |
| `src/tools/accounts.ts` | `list_accounts` tool | `src/tools/__TEST__/accounts.spec.ts` |
| `src/tools/categories.ts` | `list_categories` tool | `src/tools/__TEST__/categories.spec.ts` |
| `src/tools/dashboard.ts` | `get_dashboard_summary` tool | `src/tools/__TEST__/dashboard.spec.ts` |
| `src/tools/transactions.ts` | `list_transactions`, `get_transaction_totals`, `create_transaction` tools | `src/tools/__TEST__/transactions.spec.ts` |
| `src/tools/enrich.ts` | Category/account name enrichment + 60s lookup cache used by the transaction tools | `src/tools/__TEST__/enrich.spec.ts` |
| `src/index.ts` | Entrypoint — reads `MCP_TRANSPORT`, dispatches to stdio or HTTP | none (thin dispatcher, no branching logic worth unit testing) |
| `src/tools/types.ts` | `ToolModule<T>` type only | none (no runtime code) |
| `src/api/**` | Orval-generated OpenAPI client/DTOs | none (generated code, excluded from lint/coverage) |

> **Out-of-scope for this automated suite**: a real live backend, and a real
> Claude/VS Code connector session. Since the 2026-07-24 SDK v2 migration,
> `http-transport.spec.ts` no longer fakes the SDK's transport — it runs the
> real `createMcpHandler` + `NodeStreamableHTTPServerTransport` stack
> in-process against the real (unmocked) `createMcpServer`, only mocking
> `validateBearerToken` (the boundary to the backend). `server.spec.ts`
> similarly drives a real protocol round-trip via the SDK's own `Client` +
> `InMemoryTransport` pair rather than reaching into SDK internals. A real
> end-to-end run (starting the server, adding it as a live Claude connector)
> is still a manual verification step, not part of this automated plan —
> see Section 10 of `test-plan/oauth-connector/implementation-plan.md`.

---

### Test Cases

#### TC-01: `server.ts` — tool registry composition
- **Type**: Unit
- Confirms `ALL_TOOLS` contains every expected tool name, and each tool
  exposes `name`/`description`/`inputSchema`/`handle`. Also confirms
  `createMcpServer` returns a distinct `Server` instance on each call (the
  property `createMcpHandler`'s per-request factory model now depends on).

#### TC-02: `server.ts` — `tools/list` handler
- **Type**: Unit (real protocol round-trip)
- Driven via a real SDK `Client` connected over `InMemoryTransport` to a
  real `createMcpServer(...)` instance (not a reach-in to
  `Server`'s private `_requestHandlers`, which isn't a stable/public surface
  across SDK versions). `client.listTools()` returns each tool's
  `name`/`description`/`inputSchema` with the internal `handle` function
  stripped from the wire response.

#### TC-03: `server.ts` — `tools/call` handler, unknown tool
- **Type**: Edge case (real protocol round-trip)
- `client.callTool({name: 'nonexistent_tool', ...})` rejects with a
  protocol-level error (`-32602`, "Tool nonexistent_tool not found"), not an
  in-band `{isError: true}` result. This is `McpServer`'s own dispatch
  behavior (adopted alongside the SDK v2 migration's move off the deprecated
  low-level `Server` API to `registerTool`) — previously, the hand-rolled
  `ALL_TOOLS.find(...)` lookup returned an in-band error result instead.

#### TC-04: `server.ts` — `tools/call` handler, success/error/non-Error-throw paths
- **Type**: Unit (real protocol round-trip)
- A successful `client.callTool(...)` returns JSON-stringified content; a
  rejected tool call (`Error` and non-`Error` throws) both return
  `isError: true` with the message/string surfaced, not swallowed.

#### TC-05: `server.ts` — `validateBearerToken`
- **Type**: Unit
- No/malformed/empty `Authorization` header → `null` without calling the
  backend. Valid header → calls `GET /api/auth/me` with the token, returns
  the token on 200, `null` on non-200 or a network error. Whitespace around
  the token is trimmed.

#### TC-06: `fetcher.ts` — `tokenStorage`
- **Type**: Unit
- Token is available inside `tokenStorage.run()`, `undefined` outside it,
  and isolated correctly across concurrent `run()` calls.

#### TC-07: `fetcher.ts` — `mcpFetcher`
- **Type**: Unit
- Throws without a token in context; injects `Authorization`/`Content-Type`
  headers; builds query strings (scalars, arrays as repeated params, `null`/
  `undefined` omitted); serializes JSON bodies for writes; throws with
  status + status text on a non-OK response (including when reading the
  error body itself fails); returns parsed JSON or `undefined` for an empty
  body; respects `FINANCE_TRACKER_URL`; forwards a custom `AbortSignal`.

#### TC-08: `http-transport.ts` — health check
- **Type**: Smoke
- `GET /health` → 200, no auth required, no `X-Powered-By` header.

#### TC-09: `http-transport.ts` — routing
- **Type**: Security / Edge case
- Unknown routes → 404. Routing is case-sensitive (`/HEALTH`, `/MCP` → 404).

#### TC-10: `http-transport.ts` — OAuth discovery (RFC 9728 / RFC 8414)
- **Type**: Smoke
- `GET /.well-known/oauth-protected-resource/mcp` and
  `GET /.well-known/oauth-authorization-server` return the expected
  metadata documents — unchanged in shape from before the SDK v2 migration
  (confirmed both by these tests and a live byte-for-byte diff, see the
  migration's manual verification below).

#### TC-11: `http-transport.ts` — auth requirement (per-request, not per-session)
- **Type**: Security
- No/non-`Bearer`/backend-rejected `Authorization` header → 401 with a
  `WWW-Authenticate: Bearer ... resource_metadata="..."` header pointing at
  the protected-resource metadata document. Unlike the pre-migration design
  (token verified once at session creation, trusted thereafter via a
  `tokenHash` comparison), **every** request now re-verifies the token
  against the backend independently — proven by a dedicated test that lets
  the same token succeed on one request and then simulates revocation
  (`validateBearerToken` resolving `null`) for the very next request with
  the identical token, confirming it's rejected immediately rather than
  honored until some TTL expires.

#### TC-12: `http-transport.ts` — MCP requests (stateless, both protocol eras)
- **Type**: Unit / Integration (real `createMcpHandler` stack)
- A claim-less (no `_meta`) `initialize` request and a claim-less
  `tools/list` request **each succeed standalone** — no session id is
  issued or required, and no prior `initialize` is needed before a
  `tools/list`/`tools/call`, since `createMcpHandler`'s default
  `legacy: 'stateless'` posture serves every pre-2026-07-28-style request
  as an independent, fresh instance. `GET /mcp` returns `405` — the old
  session-based GET/DELETE operations no longer exist since there's no
  session to read or delete (see the migration's manual verification for
  the live-captured `405` body).

#### TC-13: `http-transport.ts` — error handling
- **Type**: Unit
- A thrown error inside the `createMcpHandler` factory (`createMcpServer`
  itself throwing) produces a scoped `5xx` response instead of an unhandled
  promise rejection that would crash the process.

#### TC-14: `http-transport.ts` — `startHttpServer`
- **Type**: Integration (real port binding)
- Resolves with an actually-listening `http.Server` on the configured port
  (`MCP_PORT=0` for an OS-assigned free port). Rejects when the configured
  port is already bound by another listener (EADDRINUSE), confirming the
  "startup fails fast on a bind error" guarantee actually holds.

#### TC-15: `stdio-transport.ts` — startup validation
- **Type**: Unit
- Exits (via `process.exit(1)`) with a logged error when
  `FINANCE_TRACKER_API_TOKEN` is unset, and separately when the backend
  rejects the token. On a valid token, connects the stdio transport and
  logs readiness with the correct tool count.

#### TC-16: tool modules — `list_accounts` / `list_categories` / `get_dashboard_summary`
- **Type**: Unit
- Correct endpoint called, token forwarded, response returned as-is
  (including nested category structure), optional params included/omitted
  correctly, non-OK responses propagate as thrown errors.

#### TC-17: tool modules — `list_transactions` / `get_transaction_totals` / `create_transaction`
- **Type**: Unit
- Query param handling (dates, array filters, search/limit/page); enriched
  transactions never leak raw `categoryId`/`accountId` fields; month-string
  validation and UTC month-boundary derivation (including leap-year
  February) for totals; synthetic `fitid` derivation for dedup on create.

#### TC-18: `enrich.ts` — lookup maps and enrichment
- **Type**: Unit
- `enrichTransaction` resolves category/account names (or `null` for
  unknown/absent ids) without leaking internal id fields. `fetchLookupMaps`
  builds account/category-by-id maps (flattening nested child categories)
  from the API responses, including empty-array handling.

---

### Live/manual verification (not part of the automated suite)

These are executed by an AI agent (or a human) driving the **real** running
process via curl (and, for backward-compatibility, a real client library) —
not the automated Vitest suite. Since the automated suite's
`http-transport.spec.ts` now runs the real `createMcpHandler` stack too
(see above), this tier's main remaining value is exercising a real backend
and real external client libraries end-to-end. All request/response shapes
below were captured from a real run (real mcp-server + a minimal stand-in
backend returning canned `/api/auth/me`/`/api/accounts` responses) on
2026-07-24, post-SDK-v2-migration — not hand-guessed.

#### Preconditions
- [ ] mcp-server running in HTTP mode against a real backend:
      `MCP_TRANSPORT=http MCP_PORT=<port> FINANCE_TRACKER_URL=<backend-url> npx tsx src/index.ts`
- [ ] A real API token from the backend (Settings → API Tokens), or any
      backend whose `/api/auth/me` accepts the token used below
- [ ] Every POST to `/mcp` **must** send
      `Accept: application/json, text/event-stream` — the transport
      responds `406 Not Acceptable` otherwise (verified below in TC-M02) —
      **unchanged behavior from before the SDK v2 migration**
- [ ] The transport's real response `Content-Type` is `text/event-stream`
      (SSE-framed: `event: message\ndata: {...}\n\n`), not plain JSON —
      **also unchanged** — a test script parsing responses must strip the
      `event:`/`data:` framing
- [ ] **No `mcp-session-id` header is issued or expected anywhere below** —
      this is the one core behavior change from the SDK v2 migration: every
      request (including `initialize`) is served statelessly, standalone

#### TC-M01: `POST /mcp` initialize — happy path
- **Type**: Smoke
- **Steps**:
  ```bash
  curl -s -D - -X POST http://localhost:<port>/mcp \
    -H "Authorization: Bearer <token>" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
  ```
- **Expected result**: `200`, `Content-Type: text/event-stream`, **no**
  `mcp-session-id` response header (pre-migration behavior issued one; the
  stateless legacy fallback does not); body is
  `event: message\ndata: {"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{"name":"finance-tracker","version":"0.1.0"}},"jsonrpc":"2.0","id":1}`

#### TC-M02: `POST /mcp` initialize — missing/wrong `Accept` header
- **Type**: Regression
- **Steps**: Repeat TC-M01 without the `Accept` header
- **Expected result**: `406 Not Acceptable`,
  `{"jsonrpc":"2.0","error":{"code":-32000,"message":"Not Acceptable: Client must accept both application/json and text/event-stream"},"id":null}`
  — unchanged, re-confirmed live post-migration

#### TC-M03: `POST /mcp` `tools/list` — standalone, no prior `initialize`
- **Type**: Smoke
- **Steps**: POST directly with no session id and
  `{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}` — **no
  `initialize` call first**, proving the stateless legacy fallback serves
  every claim-less request independently
- **Expected result**: `200`, `result.tools` contains exactly 6 tools —
  `list_transactions`, `get_transaction_totals`, `create_transaction`,
  `list_accounts`, `list_categories`, `get_dashboard_summary` — each with a
  populated `inputSchema` matching what's documented in `CONNECT.md`'s
  "Available tools" table

#### TC-M04: `POST /mcp` `tools/call` — `list_accounts` against real data
- **Type**: Smoke
- **Steps**: POST
  `{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_accounts","arguments":{}}}`
  (again, no prior `initialize` needed)
- **Expected result**: `200`, `result.content[0].text` is a JSON string of
  the real accounts array from the backend — cross-check it against
  `GET /api/accounts` on the backend directly to confirm the tool isn't
  silently transforming or dropping data

#### TC-M05: `POST /mcp` `tools/call` — `create_transaction`, then verify via `list_transactions`
- **Type**: Regression
- **Steps**:
  1. `tools/call` with `name: "create_transaction"` and a valid
     `amount`/`description`/`transactionType`/`date`
  2. `tools/call` again with `name: "list_transactions"`
- **Expected result**: The created transaction appears in the
  `list_transactions` result with the same fields, and the transaction is
  also visible via the backend's own `GET /transactions` (confirming the
  tool actually persisted through the real API, not just echoed input back)
- **Status**: Not re-executed against a real backend as part of the SDK v2
  migration's verification (the stand-in backend used doesn't implement
  `/transactions`) — this case's mechanics (tool dispatch, real HTTP calls)
  are unchanged by the migration, so the pre-migration confirmation in the
  previous report still applies, but it hasn't been re-run since

#### TC-M06: `POST /mcp` — unauthenticated request
- **Type**: Security
- **Steps**: Repeat TC-M03 with no `Authorization` header
- **Expected result**: `401`,
  `{"error":"invalid_token","error_description":"Missing Authorization header"}`
  with a `WWW-Authenticate: Bearer error="invalid_token", error_description="...", resource_metadata="http://<host>/.well-known/oauth-protected-resource/mcp"`
  header — **body shape changed** from the pre-migration `{"error":"Unauthorized"}`
  since auth is now enforced by `@modelcontextprotocol/express`'s
  `requireBearerAuth`, which emits the standard OAuth `invalid_token` error
  shape rather than the old hand-rolled body

#### TC-M07: `POST /mcp` — token re-verified on every request (replaces session hijack protection)
- **Type**: Security
- The pre-migration "session hijack" mechanism (reusing a session id with a
  different token) no longer exists — there's no session id to reuse. Its
  replacement guarantee: **the same token is independently re-verified
  against the backend on every single request**, so revocation takes effect
  immediately rather than after up to 30 minutes (the old TTL).
- **Steps**:
  1. `tools/list` with a valid token → confirm `200`
  2. Revoke that token on the backend (e.g. delete it via Settings → API
     Tokens)
  3. Repeat the identical `tools/list` request with the same token
- **Expected result**: Step 1 → `200`. Step 3 → `401`,
  `{"error":"invalid_token","error_description":"Missing or invalid API token"}`
  — confirmed live against a stand-in backend that flips a token from valid
  to invalid between requests; matches the automated suite's
  "re-verifies the token on every request" test in TC-11 exactly

#### TC-M08: `GET`/`DELETE /mcp` — no longer session operations
- **Type**: Regression
- The pre-migration GET (session polling) and DELETE (session teardown)
  operations required a session id, which no longer exists.
- **Steps**: `GET /mcp` and `DELETE /mcp`, each with a valid `Authorization`
  header and `Accept: application/json, text/event-stream`
- **Expected result**: `405` for both,
  `{"jsonrpc":"2.0","error":{"code":-32000,"message":"Method not allowed."},"id":null}`
  — confirmed live

#### TC-M09: Backward compatibility — a real v1-era SDK client
- **Type**: Regression (highest fidelity for the migration's central claim)
- Proves the stateless server actually interoperates with a genuine
  pre-2026-07-28 client implementation, not just hand-crafted curl requests
  shaped like one.
- **Steps**: In a scratch project, install the **real**
  `@modelcontextprotocol/sdk@1.29.0` (the exact version this package ran on
  before the migration) and use its own `Client` +
  `StreamableHTTPClientTransport` to `connect()`, `listTools()`,
  `callTool({name: 'list_accounts', ...})`, then `listTools()` again as a
  second independent HTTP request on the same client instance
- **Expected result**: `connect()` succeeds; `transport.sessionId` is
  `undefined` after connecting (the v1 client transport reads
  `Mcp-Session-Id` from the response if present and simply doesn't send one
  back if absent — the spec has always allowed this); both `listTools()`
  calls and the `callTool()` return correctly; nothing in the v1 client
  errors or requires a session
- **Status**: Confirmed live, 2026-07-24 — real v1.29.0 `Client` connected,
  listed all 6 tools, called `list_accounts` successfully, and made a
  second independent `listTools()` call, all against the migrated stateless
  server

#### TC-M10: Full connector round trip (highest fidelity, not yet run)
- **Type**: E2E — requires manual execution outside this repo
- **Steps**: Add the mcp-server's URL as an actual Claude Desktop / claude.ai
  custom connector (see `CONNECT.md`), then ask Claude to list accounts /
  recent transactions
- **Expected result**: Claude lists the real tools and returns real data
  end-to-end through its own MCP client implementation, not a hand-crafted
  curl request
- **Status**: Not exercised as part of this report — requires a live
  Claude session and a publicly reachable (or tunneled) instance; see
  `CONNECT.md`'s HTTPS requirement notes.
