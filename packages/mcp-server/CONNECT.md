# Connecting to the Finance Tracker MCP Server

The finance tracker MCP server supports two transports:

| Transport | Use case |
|---|---|
| **Stdio** | Local dev, Claude Desktop, any client that spawns processes |
| **HTTP (Streamable HTTP)** | Remote/hosted, Docker, clients that connect over a URL |

For the HTTP transport, there are now **three ways to authenticate** — pick
whichever fits your client:

| Method | Use when |
|---|---|
| **"Add custom connector"** (OAuth 2.1, static client) | claude.ai, Claude Desktop, **or** the mobile apps — the same connector dialog and OAuth infrastructure backs all of them (per Anthropic's docs). Its dialog has no field to paste a token, only OAuth Client ID/Secret. See "OAuth (Add custom connector)" below — no manual steps needed, Claude drives the whole browser login/consent flow itself. |
| **Dynamic Client Registration** (OAuth 2.1, RFC 7591) | Any other OAuth 2.1 client that supports DCR and has somewhere to configure a registration/Initial Access Token. See "OAuth for other clients" below — confirmed working via curl; not yet confirmed working against a real non-Claude client (see the GitHub Copilot section for what's actually known there). |
| **Manually pasted API token** (Steps 1–2 below) | Claude Desktop's config file (if you'd rather not do OAuth there), GitHub Copilot (recommended for now — see that section), or any other MCP client that lets you paste a bearer token directly |

## OAuth (Add custom connector — claude.ai, Desktop, or mobile)

1. In claude.ai (**Settings → Connectors**), Claude Desktop, or the mobile
   app, open **Add custom connector**.
2. Enter this mcp-server's URL (e.g. `https://your-mcp-host/mcp`) as the
   **Remote MCP server URL**.
3. Expand **Advanced settings** and enter the static client ID
   (`OAUTH_STATIC_CLIENT_ID`'s value, e.g. `claude-ai`) as the **OAuth
   Client ID**. Leave **OAuth Client Secret** blank — this server issues
   public clients with no secret. **Do not leave Client ID blank**: per
   [Anthropic's connector docs](https://claude.com/docs/connectors/building/authentication),
   supplying a Client ID "avoids dynamic client registration entirely,"
   which is required here — this server's `POST /oauth/register` is
   gated behind an admin-issued Initial Access Token (see
   `test-plan/oauth-connector/implementation-plan.md` §11.2/§11.3), and
   Claude's connector UI has no field to supply one. Leaving Client ID
   blank makes Claude fall back to dynamic registration and fail with a
   `401` at that endpoint, since this server doesn't advertise Client ID
   Metadata Document support either.
4. Claude will open a browser window, redirect you to log in to the finance
   tracker web app (if not already), then show a consent screen listing
   what it's requesting access to. Approve it.
5. Claude is redirected back and immediately usable — no token to copy.

Under the hood: the mcp-server returns a `401` + `WWW-Authenticate` header
pointing at its own protected-resource metadata (RFC 9728), which names the
backend as the trusted authorization server; the backend then runs the
actual OAuth 2.1 + PKCE flow and mints a normal `ApiToken` row scoped to
`transactions:read`, `transactions:write`, `accounts:read`, `categories:read`,
`dashboard:read` — the same token type Step 1 below creates by hand, so it
shows up in **Settings → API Tokens** as `"Claude (OAuth)"` and can be
revoked from there like any other token. Full protocol details:
`test-plan/oauth-connector/implementation-plan.md`.

---

## OAuth for other clients — Dynamic Client Registration (RFC 7591)

Claude connects using the one hardcoded ("static") OAuth client described
above. Any *other* OAuth 2.1 client that supports Dynamic Client
Registration (DCR) can register itself instead of needing a manually
configured client ID — this is how GitHub Copilot was originally expected
to connect (see `test-plan/oauth-connector/implementation-plan.md` §11 for
the full design), though see the Copilot section below for what's actually
confirmed to work today.

Registration is gated behind an admin-issued **Initial Access Token**
(IAT) — RFC 7591 §3 — rather than left open, so a stranger can't
self-register a client that impersonates a trusted one and phish an
already-logged-in user's consent (the full threat model is in the
implementation plan §11.2). Concretely:

1. **An admin issues an IAT**, once per new client:
   ```bash
   curl -s -X POST https://your-backend/api/oauth/initial-access-tokens \
     -H "Authorization: Bearer <your admin JWT>" -H "Content-Type: application/json" \
     -d '{"label": "GitHub Copilot setup"}'
   # => {"token": "iat_...", "label": "...", "expiresAt": "<+24h by default>"}
   ```
   The raw token is shown once. It's valid for repeat registrations (not
   single-use) until `expiresAt` — see the implementation plan §11.3 for
   why. Set `expiresInHours` in the body for a different lifetime.

2. **The client (or you, on its behalf via curl) registers**, presenting
   that IAT as a Bearer token:
   ```bash
   curl -s -X POST https://your-backend/api/oauth/register \
     -H "Authorization: Bearer iat_..." -H "Content-Type: application/json" \
     -d '{"client_name": "GitHub Copilot", "redirect_uris": ["<the client'"'"'s real redirect_uri>"]}'
   # => {"client_id": "...", "client_name": "...", "redirect_uris": [...], "token_endpoint_auth_method": "none", "grant_types": ["authorization_code"], "response_types": ["code"]}
   ```
   `redirect_uris` must be `http:`/`https:` — anything else is rejected.
   No `client_secret` comes back; this server only issues public clients
   (mandatory PKCE S256 instead).

3. From here, the flow is identical to Claude's — `GET /oauth/authorize`
   → consent screen → `POST /oauth/token` with the PKCE `code_verifier`.
   If your client supports DCR *and* has somewhere to configure a
   registration/Initial Access Token, it will do all of this automatically
   the moment it discovers `registration_endpoint` in this server's
   `/.well-known/oauth-authorization-server` metadata. If it doesn't have
   that field, you'll need to either register on its behalf via curl (step
   2) and paste the resulting `client_id` into a static Client ID field
   (same as Claude), or fall back to a manually pasted API token.

**If your client supports DCR but has nowhere to configure an IAT** (this
is the actual situation for VS Code/GitHub Copilot today — see that section
below), there's a backend-operator escape hatch: set
`OAUTH_REGISTRATION_OPEN=true` in the backend's `.env` and restart. This
skips the IAT check entirely, so any client's DCR attempt succeeds with no
token. **This is a real security tradeoff, not a free option** — it means
anyone who can reach `/oauth/register` can self-register a client (see the
phishing walkthrough in the implementation plan §11.2); the redirect-domain
display on the consent screen (§11.4) becomes the only remaining defense.
Defaults to `false` (gated) — only turn it on for as long as you're
actually testing/using a specific DCR client, then turn it back off.

---

## Step 1 — Generate an API token (manual-token path only — skip if you used OAuth above)

1. Log in to the finance tracker web app
2. Go to **Settings → API Tokens**
3. Click **Generate new token**, select the scopes you need (read-only recommendation: `transactions:read`, `accounts:read`, `categories:read`, `dashboard:read`), and copy the token
4. Store it somewhere safe — it is shown only once

---

## Step 2 — Choose a transport and configure your client

### Stdio transport (local)

The client spawns the MCP server as a local process. No network port is needed.

**Prerequisites:** Node.js 18+, the repo checked out (or the package published)

```bash
# From the repo root, install deps if not already done
npm install
```

The command to start the server:
```
npx tsx /path/to/finance-tracker/packages/mcp-server/src/index.ts
```

Required environment variables:
| Variable | Value |
|---|---|
| `FINANCE_TRACKER_URL` | URL of the finance tracker backend, e.g. `http://localhost:3001` |
| `FINANCE_TRACKER_API_TOKEN` | The token you generated in Step 1 |

---

### HTTP transport (remote / Docker)

The server listens on an HTTP port and accepts Bearer token auth per-request.

```bash
MCP_TRANSPORT=http MCP_PORT=3010 FINANCE_TRACKER_URL=http://your-backend node dist/index.js
```

Or via Docker Compose (already configured):
```bash
docker compose up mcp-server
```

The client connects to `https://your-host/mcp` with:
```
Authorization: Bearer ft_<your-api-token>
```

> **HTTPS requirement:** Claude.ai's web connector and most hosted MCP clients require HTTPS — plain `http://` is rejected. For local development, use one of the options below.

#### Local dev HTTPS options

**Option A — Use stdio instead (recommended for local dev)**
Claude Desktop and IDE extensions support stdio; no HTTPS needed. See the stdio config examples below.

**Option B — `cloudflared` quick tunnel (free, no account)**
```bash
# Terminal 1 — start the server in HTTP mode
MCP_TRANSPORT=http npm run dev -w packages/mcp-server

# Terminal 2 — create an HTTPS tunnel
cloudflared tunnel --url http://localhost:3010
```
Copy the `https://....trycloudflare.com` URL and use `https://....trycloudflare.com/mcp` as the connector URL.

**Option C — `ngrok`**
```bash
ngrok http 3010
```
Use the `https://....ngrok-free.app/mcp` URL.

**Production:** Put the server behind a TLS-terminating reverse proxy (nginx, Caddy, Cloudflare Tunnel, etc.).

**If your proxy routes by path prefix per service** (e.g. `/api/*` → backend,
`/mcp/*` → mcp-server, everything else → frontend), you need **two more
explicit rules** beyond the obvious ones, or OAuth discovery silently
breaks. The well-known metadata paths are deliberately *not* under `/api`
or `/mcp` — RFC 8414/RFC 9728 expect them at the site root — so a
prefix-only proxy falls through its catch-all and routes both documents to
the frontend instead. That's worse than a 404: the frontend returns its
`index.html` with a `200`, so it looks like a response until a real OAuth
client tries to parse HTML as the JSON metadata document it expected, and
the whole connector setup fails with no obvious cause.

Route these two paths to the **backend** and **mcp-server** respectively,
in addition to your existing `/api` and `/mcp` rules (Cloudflare Tunnel
`ingress` example — the same two extra rules apply to nginx/Caddy/Traefik
just as path-match rules instead):
```yaml
ingress:
  - hostname: your-host.example.com
    path: ^/api(/.*)?$
    service: http://127.0.0.1:3001        # backend
  - hostname: your-host.example.com
    path: ^/mcp(/.*)?$
    service: http://127.0.0.1:3010        # mcp-server
  - hostname: your-host.example.com
    path: ^/\.well-known/oauth-authorization-server$
    service: http://127.0.0.1:3001        # backend — RFC 8414
  - hostname: your-host.example.com
    path: ^/\.well-known/oauth-protected-resource(/.*)?$
    service: http://127.0.0.1:3010        # mcp-server — RFC 9728
```
The protected-resource rule needs the `(/.*)?` suffix — the mcp-server's
metadata router serves both the bare path and a path-suffixed form
(`/.well-known/oauth-protected-resource/mcp`), and real clients try the
suffixed form first (see `test-plan/oauth-connector/implementation-plan.md`
§2, "Two discovery hops, two servers involved," for why). The
authorization-server rule doesn't need it; that one's always served bare.

Health check (no auth required):
```
GET http://your-host:3010/health
```

---

## Client configuration examples

### Claude Desktop

> **If you want to authenticate with a manually pasted API token instead of OAuth, don't use the "Add custom connector" dialog for that** — its GUI (in Claude Desktop and on claude.ai) only exposes OAuth Client ID/Secret under Advanced settings, with no field for a bearer token or custom header. Anthropic has a header-based auth mode (`static_headers`) that matches this server's design exactly, but as of writing it's still beta and not rolled out to every account, so the field may simply not appear for you. Edit the config file directly instead (below) — Claude Desktop honors the `headers` block from the file even though the GUI can't create it. **If OAuth is fine for you, "Add custom connector" works the same way here as it does on claude.ai — see the OAuth section above.**

Config file location:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

**Stdio:**
```json
{
  "mcpServers": {
    "finance-tracker": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/packages/mcp-server/src/index.ts"],
      "env": {
        "FINANCE_TRACKER_URL": "http://localhost:3001",
        "FINANCE_TRACKER_API_TOKEN": "ft_your_token_here"
      }
    }
  }
}
```

**HTTP (localhost):**
```json
{
  "mcpServers": {
    "finance-tracker": {
      "url": "http://localhost:3010/mcp",
      "headers": {
        "Authorization": "Bearer ft_your_token_here"
      }
    }
  }
}
```

**HTTP (remote, requires HTTPS):**
```json
{
  "mcpServers": {
    "finance-tracker": {
      "url": "https://your-domain.com/mcp",
      "headers": {
        "Authorization": "Bearer ft_your_token_here"
      }
    }
  }
}
```

---

### GitHub Copilot (VS Code)

> **OAuth is not recommended here yet — use the manually pasted token below.**
> Researched this rather than assuming it works the same as Claude (sources
> at the bottom of this file). What's confirmed: VS Code's MCP OAuth support
> for arbitrary/custom remote servers defaults to Dynamic Client
> Registration, and as of writing there's an **open, unresolved feature
> request** (microsoft/vscode#252892) for VS Code to let you configure a
> static OAuth Client ID at all — the capability this server's static
> `claude-ai`-style client relies on doesn't appear to exist in VS Code's
> config today. Separately, GitHub's own Copilot CLI (a different product
> from VS Code's Copilot Chat) has a filed bug where it **ignores** any
> configured `oauth.clientId` for remote servers and always uses DCR
> regardless. Since this server's DCR (`/oauth/register`) is gated behind an
> Initial Access Token and neither product's docs mention anywhere to supply
> one, a DCR attempt from either would very likely fail with `401
> invalid_token` — the same failure mode Claude's connector would hit if you
> left its Client ID field blank (see the OAuth section above). This hasn't
> been tested live end-to-end from this environment, so treat it as a
> researched prediction, not a confirmed result. **The blocker is this
> server's IAT gate, not VS Code** — VS Code's DCR support itself is real
> and well-documented ("Dynamic Authentication Providers" is what it calls a
> successful registration). If you want to actually try OAuth with Copilot,
> set `OAUTH_REGISTRATION_OPEN=true` on the backend first (see "OAuth for
> other clients" below for the tradeoff that entails), then attempt the
> connection — this removes the only reason DCR would fail here.
> for how to issue an Initial Access Token, and report back whether VS Code
> or Copilot CLI ever prompts for one.

Add to your VS Code `settings.json` or `.vscode/mcp.json`:

**Stdio:**
```json
{
  "mcp": {
    "servers": {
      "finance-tracker": {
        "type": "stdio",
        "command": "npx",
        "args": ["tsx", "/absolute/path/to/packages/mcp-server/src/index.ts"],
        "env": {
          "FINANCE_TRACKER_URL": "http://localhost:3001",
          "FINANCE_TRACKER_API_TOKEN": "ft_your_token_here"
        }
      }
    }
  }
}
```

**HTTP:**
```json
{
  "mcp": {
    "servers": {
      "finance-tracker": {
        "type": "http",
        "url": "http://localhost:3010/mcp",
        "headers": {
          "Authorization": "Bearer ft_your_token_here"
        }
      }
    }
  }
}
```

---

### Cursor

Add to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project):

**Stdio:**
```json
{
  "mcpServers": {
    "finance-tracker": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/packages/mcp-server/src/index.ts"],
      "env": {
        "FINANCE_TRACKER_URL": "http://localhost:3001",
        "FINANCE_TRACKER_API_TOKEN": "ft_your_token_here"
      }
    }
  }
}
```

**HTTP:**
```json
{
  "mcpServers": {
    "finance-tracker": {
      "url": "http://localhost:3010/mcp",
      "headers": {
        "Authorization": "Bearer ft_your_token_here"
      }
    }
  }
}
```

---

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "finance-tracker": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/packages/mcp-server/src/index.ts"],
      "env": {
        "FINANCE_TRACKER_URL": "http://localhost:3001",
        "FINANCE_TRACKER_API_TOKEN": "ft_your_token_here"
      }
    }
  }
}
```

---

### Any MCP-compatible client (generic)

For clients that follow the MCP spec directly:

- **Stdio:** spawn the command `npx tsx src/index.ts` with the two env vars set
- **HTTP:** connect to `/mcp`, send `Authorization: Bearer ft_<token>` on every request, use the Streamable HTTP transport protocol

---

## Available tools

| Tool | Description |
|---|---|
| `list_transactions` | List transactions with filters: `startDate`, `endDate`, `categoryId[]`, `accountId[]`, `transactionType[]`, `search`, `limit`, `page` |
| `get_transaction_totals` | Income, expense and net totals for a given month |
| `list_accounts` | All accounts for the authenticated user |
| `list_categories` | All categories for the authenticated user |
| `get_dashboard_summary` | Net worth, income, expenses and savings rate for a given month |
| `create_transaction` | Create a new transaction; auto-generates a `fitid` from the fields to prevent AI-driven duplicates |

---

## Scopes reference

| Scope | Grants access to |
|---|---|
| `transactions:read` | `list_transactions`, `get_transaction_totals` |
| `transactions:write` | `create_transaction` |
| `accounts:read` | `list_accounts` |
| `categories:read` | `list_categories` |
| `dashboard:read` | `get_dashboard_summary` |

For read-only AI access, grant the four read scopes above. Add `transactions:write` only if you want the AI to be able to create transactions via `create_transaction`. The `admin` scope is never needed for MCP use.

---

## Security notes

### Token revocation and HTTP sessions

When using the **HTTP transport**, revoking an API token from Settings → API Tokens takes effect immediately for new connections. However, an already-established MCP session (created before the token was revoked) continues to work until it idles out — the server re-validates the token against the backend only when a new session is initialised, not on every tool call. Idle sessions time out after **30 minutes** of inactivity.

**Implication:** if you revoke a token because you believe it was compromised, the attacker's open MCP sessions can continue for up to 30 minutes. To terminate them immediately, restart the MCP server process.

The **stdio transport** is not affected — it validates the token at startup only, and the process lifespan is controlled by the client.

---

## Sources

Claims about Claude's and GitHub Copilot's own OAuth/connector behavior above are sourced from official documentation and issue trackers, not assumed:

- [Authentication for connectors - Claude.ai Documentation](https://claude.com/docs/connectors/building/authentication)
- [Setting up the GitHub MCP Server - GitHub Docs](https://docs.github.com/en/copilot/how-tos/provide-context/use-mcp-in-your-ide/set-up-the-github-mcp-server)
- [Feature: VSCode capability to register a clientId for MCP OAuth · Issue #252892 · microsoft/vscode](https://github.com/microsoft/vscode/issues/252892)
- [Copilot CLI ignores `oauth.clientId` in mcp-config.json, always uses Dynamic Client Registration (DCR) · Issue #2717 · github/copilot-cli](https://github.com/github/copilot-cli/issues/2717)
