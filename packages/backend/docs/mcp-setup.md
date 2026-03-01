# Setting Up MCP Server in the Backend

This document covers how to scaffold and run the MCP (Model Context Protocol) server inside the NestJS backend using the official `@modelcontextprotocol/sdk`.

---

## Architecture Overview

The MCP server lives at `src/mcp/` and is a standard NestJS feature module. It:

- Creates an `McpServer` instance from the official SDK
- Registers tools by injecting existing services (`TransactionsService`, `AccountsService`, etc.)
- Supports two transports:
  - **stdio** — for local clients (Claude Desktop, Cursor, VS Code Copilot)
  - **Streamable HTTP** — for remote clients (claude.ai web, Claude iOS via Connectors)

```
Claude Desktop / Cursor / VS Code
        │
        │  stdio (process spawn)
        ▼
packages/backend/dist/main.js
        │
        └─► McpModule ──► McpService
                               │
                               ├─► TransactionsService
                               ├─► AccountsService
                               ├─► BudgetsService
                               └─► ReportsService
```

---

## Dependencies

```bash
# In packages/backend/
npm install @modelcontextprotocol/sdk zod
```

No additional packages required. The official SDK is maintained directly by Anthropic (6.7k+ stars, 1.6k+ forks).

> **Why not `@rekog/mcp-nest`?**
> That library is a single-maintainer wrapper (589 stars). Its `McpAuthModule` is labelled "Beta" and its session storage only works with TypeORM — incompatible with this project's Prisma setup.

---

## Module Structure

```
src/mcp/
├── mcp.module.ts             # NestJS module declaration
├── mcp.service.ts            # McpServer bootstrap + tool registration
├── mcp.controller.ts         # HTTP endpoints (POST /mcp, GET /mcp, DELETE /mcp)
├── tools/
│   ├── transactions.tools.ts # Transaction tool registrations
│   ├── accounts.tools.ts     # Account tool registrations
│   ├── budgets.tools.ts      # Budget tool registrations
│   └── reports.tools.ts      # Report / analytics tool registrations
└── __TEST__/
    ├── mcp.service.spec.ts
    └── mcp.controller.spec.ts
```

---

## Path Alias

Add `#mcp/` to `packages/backend/tsconfig.json` and `packages/backend/package.json`.

**tsconfig.json** — inside `compilerOptions.paths`:
```json
"#mcp/*": ["./src/mcp/*"]
```

**package.json** — inside `imports`:
```json
"#mcp/*": "./dist/src/mcp/*"
```

---

## McpModule

```typescript
// src/mcp/mcp.module.ts
import { Module } from '@nestjs/common';
import { McpService } from '#mcp/mcp.service.js';
import { McpController } from '#mcp/mcp.controller.js';
import { TransactionsModule } from '#transactions/transactions.module.js';
import { AccountsModule } from '#accounts/accounts.module.js';
import { BudgetsModule } from '#budgets/budgets.module.js';
import { ReportsModule } from '#reports/reports.module.js';

@Module({
  imports: [TransactionsModule, AccountsModule, BudgetsModule, ReportsModule],
  providers: [McpService],
  controllers: [McpController],
})
export class McpModule {}
```

Register in `app.module.ts`:
```typescript
import { McpModule } from '#mcp/mcp.module.js';

@Module({
  imports: [
    // ...existing modules
    McpModule,
  ],
})
export class AppModule {}
```

---

## McpService — Core Bootstrap

`McpService` owns the `McpServer` instance, registers all tools, and exposes helpers used by the controller.

```typescript
// src/mcp/mcp.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { TransactionsService } from '#transactions/transactions.service.js';
import { z } from 'zod';

@Injectable()
export class McpService implements OnModuleInit {
  private server: McpServer;

  constructor(private readonly transactionsService: TransactionsService) {}

  onModuleInit(): void {
    this.server = new McpServer({ name: 'finance-tracker', version: '1.0.0' });
    this.registerTools();
  }

  private registerTools(): void {
    this.server.registerTool(
      'list-transactions',
      {
        description: 'List recent transactions for the authenticated user',
        inputSchema: z.object({
          limit: z.number().optional().default(20),
          offset: z.number().optional().default(0),
        }),
      },
      async ({ limit, offset }) => {
        const transactions = await this.transactionsService.findAll({ limit, offset });
        return {
          content: [{ type: 'text', text: JSON.stringify(transactions, null, 2) }],
          structuredContent: transactions,
        };
      },
    );

    // Add more tools here, or call helpers like registerTransactionTools(this.server, ...)
  }

  async handleHttpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const transport = new NodeStreamableHTTPServerTransport({ path: '/mcp' });
    await this.server.connect(transport);
    await transport.handleRequest(req, res);
  }

  async connectStdio(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}
```

---

## McpController — HTTP Transport

The Streamable HTTP transport requires three endpoints:

```typescript
// src/mcp/mcp.controller.ts
import { Controller, Post, Get, Delete, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { McpService } from '#mcp/mcp.service.js';
import { JwtAuthGuard } from '#auth/guards/jwt-auth.guard.js';

@UseGuards(JwtAuthGuard)
@Controller('mcp')
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  @Post()
  async handlePost(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.mcpService.handleHttpRequest(req as never, res as never);
  }

  @Get()
  async handleGet(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.mcpService.handleHttpRequest(req as never, res as never);
  }

  @Delete()
  async handleDelete(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.mcpService.handleHttpRequest(req as never, res as never);
  }
}
```

---

## Stdio Mode (Local Clients)

Detect a CLI flag in `main.ts` and skip the HTTP server when running in stdio mode:

```typescript
// src/main.ts
import { McpService } from '#mcp/mcp.service.js';

const isMcpStdio = process.argv.includes('--mcp-stdio');

if (isMcpStdio) {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const mcpService = app.get(McpService);
  await mcpService.connectStdio();
} else {
  // ...existing HTTP bootstrap
}
```

When `--mcp-stdio` is present the process communicates via stdin/stdout only — no HTTP server starts, no port is bound.

---

## Authentication

### Local clients (stdio) — no auth needed

The process is spawned directly by the AI client and is not network-exposed. No authentication is required.

### Remote HTTP clients — JWT guard

`JwtAuthGuard` is already applied to `McpController` above. The guard reads `Authorization: Bearer <token>` on every request, identical to all other REST endpoints in this project.

To scope tool calls to the authenticated user:
```typescript
async ({ ... }, { meta }) => {
  const userId = (meta?.requestContext as Request).user?.id;
  const transactions = await this.transactionsService.findAllForUser(userId, { limit, offset });
  // ...
}
```

> **Future: Full OAuth for claude.ai Connectors**
> Adding official Connectors on claude.ai requires OAuth 2.0 with dynamic client registration (RFC 7591). This is a future phase in the roadmap and is NOT required for local client or manual-JWT usage.

---

## Configuring Local AI Clients

### Claude Desktop

macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "finance-tracker": {
      "command": "node",
      "args": [
        "C:/Users/richm/Projects/finance-tracker/packages/backend/dist/main.js",
        "--mcp-stdio"
      ]
    }
  }
}
```

### VS Code Copilot

`.vscode/mcp.json` in the workspace root:
```json
{
  "servers": {
    "finance-tracker": {
      "type": "stdio",
      "command": "node",
      "args": ["packages/backend/dist/main.js", "--mcp-stdio"]
    }
  }
}
```

### Cursor

`.cursor/mcp.json` in the workspace root:
```json
{
  "mcpServers": {
    "finance-tracker": {
      "command": "node",
      "args": ["packages/backend/dist/main.js", "--mcp-stdio"]
    }
  }
}
```

---

## Remote Clients (claude.ai Web / Claude iOS)

Remote clients connect over Streamable HTTP and require:

1. **Public HTTPS endpoint** — deploy the backend (Railway, Fly.io, etc.) and note the URL
2. **JWT guard applied** — already covered above
3. **Add Connector on claude.ai** — Settings → Connectors → Add Custom Connector → URL: `https://your-domain.com/mcp`

> Claude iOS supports remote MCP Connectors since July 26, 2025. Connectors configured on claude.ai web sync automatically to the mobile app.

---

## Testing

### MCP Inspector (quickest)

```bash
npx @modelcontextprotocol/inspector
```

Point it at `http://localhost:3000/mcp` with a valid JWT in the Authorization header.

### curl

```bash
# List available tools
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# Call a tool
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list-transactions","arguments":{"limit":5}}}'
```

---

## Related Docs

- [MCP Apps Setup — Backend & Frontend](./mcp-apps-setup.md)
- [Development Roadmap](./development-roadmap.md)
