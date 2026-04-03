# Connecting to the Finance Tracker MCP Server

The finance tracker MCP server supports two transports:

| Transport | Use case |
|---|---|
| **Stdio** | Local dev, Claude Desktop, any client that spawns processes |
| **HTTP (Streamable HTTP)** | Remote/hosted, Docker, clients that connect over a URL |

---

## Step 1 — Generate an API token

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

**Production:** Put the server behind a TLS-terminating reverse proxy (nginx, Caddy).

Health check (no auth required):
```
GET http://your-host:3010/health
```

---

## Client configuration examples

### Claude Desktop

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
| `list_transactions` | List transactions with filters: `startDate`, `endDate`, `categoryId[]`, `accountId[]`, `transactionType[]`, `search`, `limit`, `offset` |
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
