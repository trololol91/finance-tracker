## Test Plan: mcp-server Package

Unlike the other `test-plan/` entries, `packages/mcp-server` isn't a NestJS
REST API — it's a standalone MCP (Model Context Protocol) server with two
transports (stdio, HTTP) and a set of tools that proxy to the finance-tracker
backend's REST API. This plan covers the package's own automated Vitest
suite (unit + supertest-driven integration tests), not a curl walk of the
backend's endpoints (those are covered by the other `test-plan/` entries).

### Preconditions
- [ ] `npm install` run at the repo root (workspace deps resolved)
- [ ] No live backend or database required — every test mocks `fetch` /
      `validateBearerToken` / the MCP SDK's transport classes rather than
      calling a real `finance-tracker` backend
- [ ] Run from `packages/mcp-server`: `npx vitest run` / `npx vitest run --coverage`

### Module Inventory

| File | Role | Test file |
|------|------|-----------|
| `src/server.ts` | Builds the MCP `Server`, registers `tools/list`/`tools/call` handlers, dispatches to tool modules; `validateBearerToken` (calls backend `/api/auth/me`) | `src/__TEST__/server.spec.ts` |
| `src/services/fetcher.ts` | `tokenStorage` (`AsyncLocalStorage` token propagation) + `mcpFetcher` (outbound HTTP client used by every tool) | `src/__TEST__/fetcher.spec.ts` |
| `src/http-transport.ts` | HTTP transport — Express app, session store, TTL eviction, bearer-token hijack protection, error handling | `src/__TEST__/http-transport.spec.ts` |
| `src/stdio-transport.ts` | stdio transport — startup token validation, connects `StdioServerTransport` | `src/__TEST__/stdio-transport.spec.ts` |
| `src/tools/accounts.ts` | `list_accounts` tool | `src/tools/__TEST__/accounts.spec.ts` |
| `src/tools/categories.ts` | `list_categories` tool | `src/tools/__TEST__/categories.spec.ts` |
| `src/tools/dashboard.ts` | `get_dashboard_summary` tool | `src/tools/__TEST__/dashboard.spec.ts` |
| `src/tools/transactions.ts` | `list_transactions`, `get_transaction_totals`, `create_transaction` tools | `src/tools/__TEST__/transactions.spec.ts` |
| `src/tools/enrich.ts` | Category/account name enrichment + 60s lookup cache used by the transaction tools | `src/tools/__TEST__/enrich.spec.ts` |
| `src/index.ts` | Entrypoint — reads `MCP_TRANSPORT`, dispatches to stdio or HTTP | none (thin dispatcher, no branching logic worth unit testing) |
| `src/tools/types.ts` | `ToolModule<T>` type only | none (no runtime code) |
| `src/api/**` | Orval-generated OpenAPI client/DTOs | none (generated code, excluded from lint/coverage) |

> **Out-of-scope for this automated suite**: an actual MCP protocol
> handshake against the real `@modelcontextprotocol/sdk` transport classes.
> `http-transport.spec.ts` replaces `StreamableHTTPServerTransport` with a
> hand-rolled fake so tests exercise this file's own routing/session/hijack
> logic in isolation — the SDK's own protocol-compliance is out of scope
> here (that's the SDK's own test suite's job). A real end-to-end run
> (starting the server, adding it as a live Claude connector) is a manual
> verification step, not part of this automated plan — see Section 10 of
> `test-plan/oauth-connector/implementation-plan.md` for that.

---

### Test Cases

#### TC-01: `server.ts` — tool registry composition
- **Type**: Unit
- Confirms `ALL_TOOLS` contains every expected tool name, and each tool
  exposes `name`/`description`/`inputSchema`/`handle`.

#### TC-02: `server.ts` — `tools/list` handler
- **Type**: Unit
- Returns each tool's `name`/`description`/`inputSchema` and strips the
  internal `handle` function from the response.

#### TC-03: `server.ts` — `tools/call` handler, unknown tool
- **Type**: Edge case
- Calling a nonexistent tool name returns `isError: true` with a
  descriptive message, not a thrown exception.

#### TC-04: `server.ts` — `tools/call` handler, success/error/non-Error-throw paths
- **Type**: Unit
- A successful tool call returns JSON-stringified content; a rejected tool
  call (`Error` and non-`Error` throws) both return `isError: true` with the
  message/string surfaced, not swallowed.

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
- Unknown routes → 404. Routing is case-sensitive (`/HEALTH`, `/MCP` → 404),
  matching the pre-Express raw `node:http` behavior.

#### TC-10: `http-transport.ts` — auth requirement
- **Type**: Security
- No/malformed `Authorization` header → 401. A syntactically valid but
  backend-rejected token on session init → 401. An unsupported HTTP method
  on `/mcp` (with a valid-looking token) → 405.

#### TC-11: `http-transport.ts` — session lifecycle
- **Type**: Unit / Security
- `initialize` creates a session and returns an `mcp-session-id` header.
  A follow-up request with the same session id + same token succeeds.
  A follow-up request with the same session id but a **different** token
  is rejected 400 (hijack protection) with a deliberately vague message
  (doesn't confirm the session exists). A non-init POST with no known
  session id → 400. Malformed JSON body → 400.

#### TC-12: `http-transport.ts` — GET/DELETE `/mcp`
- **Type**: Unit
- `GET`: 400 for missing/unrecognized session id, 400 for a mismatched
  token on a known session, 200 for a matching token. `DELETE`: 404 for an
  unrecognized session id, 400 for a mismatched token, 200 + actual session
  removal (confirmed by a follow-up `GET` on the same id returning 400) on
  success.

#### TC-13: `http-transport.ts` — TTL eviction
- **Type**: Unit (fake timers)
- An idle session is evicted after `SESSION_TTL_MS`; verified by advancing
  past two sweep ticks (the sweep's cutoff lands exactly on the boundary on
  the first tick) and confirming a subsequent request 400s.

#### TC-14: `http-transport.ts` — error handling
- **Type**: Unit
- A thrown/rejected error inside `handleMcpRequest` (e.g. `Server.connect`
  rejecting) produces a scoped 500 `{error: 'Internal Server Error'}` via
  Express 5's automatic async-rejection forwarding, not an unhandled
  promise rejection that would crash the process.

#### TC-15: `http-transport.ts` — `startHttpServer`
- **Type**: Integration (real port binding)
- Resolves with an actually-listening `http.Server` on the configured port
  (`MCP_PORT=0` for an OS-assigned free port). Rejects when the configured
  port is already bound by another listener (EADDRINUSE), confirming the
  "startup fails fast on a bind error" guarantee actually holds.

#### TC-16: `stdio-transport.ts` — startup validation
- **Type**: Unit
- Exits (via `process.exit(1)`) with a logged error when
  `FINANCE_TRACKER_API_TOKEN` is unset, and separately when the backend
  rejects the token. On a valid token, connects the stdio transport and
  logs readiness with the correct tool count.

#### TC-17: tool modules — `list_accounts` / `list_categories` / `get_dashboard_summary`
- **Type**: Unit
- Correct endpoint called, token forwarded, response returned as-is
  (including nested category structure), optional params included/omitted
  correctly, non-OK responses propagate as thrown errors.

#### TC-18: tool modules — `list_transactions` / `get_transaction_totals` / `create_transaction`
- **Type**: Unit
- Query param handling (dates, array filters, search/limit/page); enriched
  transactions never leak raw `categoryId`/`accountId` fields; month-string
  validation and UTC month-boundary derivation (including leap-year
  February) for totals; synthetic `fitid` derivation for dedup on create.

#### TC-19: `enrich.ts` — lookup maps and enrichment
- **Type**: Unit
- `enrichTransaction` resolves category/account names (or `null` for
  unknown/absent ids) without leaking internal id fields. `fetchLookupMaps`
  builds account/category-by-id maps (flattening nested child categories)
  from the API responses, including empty-array handling.

---

### Live/manual verification (not part of the automated suite)

These are executed by an AI agent (or a human) driving the **real** running
process via curl — not the automated Vitest suite, and not the hand-rolled
fake transport `http-transport.spec.ts` uses. This exercises the actual
`@modelcontextprotocol/sdk` `StreamableHTTPServerTransport`, which the
automated suite deliberately fakes out. All request/response shapes below
were captured from a real run (real mcp-server + a minimal stand-in backend
returning canned `/api/auth/me` and `/api/accounts` responses) — not
hand-guessed.

#### Preconditions
- [ ] mcp-server running in HTTP mode against a real backend:
      `MCP_TRANSPORT=http MCP_PORT=<port> FINANCE_TRACKER_URL=<backend-url> npx tsx src/index.ts`
- [ ] A real API token from the backend (Settings → API Tokens), or any
      backend whose `/api/auth/me` accepts the token used below
- [ ] Every POST to `/mcp` **must** send
      `Accept: application/json, text/event-stream` — the transport
      responds `406 Not Acceptable` otherwise (verified below in TC-M02)
- [ ] The transport's real response `Content-Type` is `text/event-stream`
      (SSE-framed: `event: message\ndata: {...}\n\n`), not plain JSON — a
      test script parsing responses must strip the `event:`/`data:` framing

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
- **Expected result**: `200`, response headers include `mcp-session-id`
  (save it for the next test cases) and `Content-Type: text/event-stream`;
  body is `event: message\ndata: {"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{"name":"finance-tracker","version":"0.1.0"}},"jsonrpc":"2.0","id":1}`

#### TC-M02: `POST /mcp` initialize — missing/wrong `Accept` header
- **Type**: Regression
- **Steps**: Repeat TC-M01 without the `Accept` header
- **Expected result**: `406 Not Acceptable`,
  `{"jsonrpc":"2.0","error":{"code":-32000,"message":"Not Acceptable: Client must accept both application/json and text/event-stream"},"id":null}`

#### TC-M03: `POST /mcp` `tools/list` — real tool inventory
- **Type**: Smoke
- **Steps**: POST with the session id from TC-M01 and
  `{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}`
- **Expected result**: `200`, `result.tools` contains exactly 6 tools —
  `list_transactions`, `get_transaction_totals`, `create_transaction`,
  `list_accounts`, `list_categories`, `get_dashboard_summary` — each with a
  populated `inputSchema` matching what's documented in `CONNECT.md`'s
  "Available tools" table

#### TC-M04: `POST /mcp` `tools/call` — `list_accounts` against real data
- **Type**: Smoke
- **Steps**: POST with the session id and
  `{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_accounts","arguments":{}}}`
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

#### TC-M06: `POST /mcp` — unauthenticated request
- **Type**: Security
- **Steps**: Repeat TC-M03 with no `Authorization` header
- **Expected result**: `401`, `{"error":"Unauthorized"}`

#### TC-M07: `POST /mcp` — session hijack rejected
- **Type**: Security
- **Steps**:
  1. Initialize a session with `Authorization: Bearer token-a`
  2. Reuse that `mcp-session-id` in a follow-up request with
     `Authorization: Bearer token-b`
- **Expected result**: `400`,
  `{"jsonrpc":"2.0","error":{"code":-32000,"message":"Bad Request: No valid session ID provided"},"id":null}`
  — confirmed live, matches TC-11's automated coverage exactly

#### TC-M08: `DELETE /mcp` — session teardown
- **Type**: Smoke
- **Steps**: `DELETE /mcp` with the session id and matching token
- **Expected result**: `200`, empty body; a subsequent request with the
  same session id then behaves as an unrecognized session (400/404 per
  TC-12)

#### TC-M09: Full connector round trip (highest fidelity, not yet run)
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
