# Setting Up MCP Apps (Backend + Frontend)

MCP Apps are interactive mini-applications that run inside Claude's chat interface (and other MCP-aware hosts) as sandboxed iframes. They are announced in the MCP spec as of January 26, 2026.

This document covers the full pipeline: building UI apps in the frontend, bundling them into the backend, and serving them over MCP.

---

## What Are MCP Apps?

A **MCP App** is a self-contained HTML file returned by the MCP server via `resources/read`. The host (Claude, VS Code, ChatGPT) renders it in a sandboxed iframe inside the chat window. The app communicates with the host via `postMessage` — it does NOT make network calls back to your server at runtime.

Use cases include:
- Spending breakdown charts
- Transaction list with filtering
- Budget vs. actuals visualization
- Category management UI

---

## How It Works — End to End

```
packages/frontend/src/mcp-apps/
    SpendingChart/index.tsx         ← React component
    TransactionList/index.tsx
    ...
         │
         │  Vite build (standalone HTML, all JS/CSS inlined)
         ▼
packages/backend/src/mcp/apps/
    spending-chart.html             ← single file, self-contained
    transaction-list.html
         │
         │  NestJS reads file at startup (fs.readFileSync)
         ▼
McpService.registerResource('ui://spending-chart')
         │
         │  MCP resources/read
         ▼
Host (Claude / VS Code) renders in sandboxed iframe
         │
         │  postMessage (JSON-RPC)
         ▼
App sends/receives tool-input / tool-result notifications
```

---

## Dependencies

### Backend

No new packages required beyond the MCP SDK already installed.

### Frontend

```bash
# In packages/frontend/
npm install @modelcontextprotocol/ext-apps
```

This is the official MCP Apps SDK published by Anthropic. It provides:
- `registerAppTool` — bind MCP tool calls to in-app state
- `useApp` — React hook to access host capabilities
- `useHostStyles` / `applyHostStyleVariables` — sync host theme into the app

---

## Part 1: Frontend — Building MCP App UIs

### Directory Layout

```
packages/frontend/src/mcp-apps/
├── spending-chart/
│   ├── main.tsx          # entry point
│   ├── SpendingChart.tsx
│   └── spending-chart.css
└── transaction-list/
    ├── main.tsx
    ├── TransactionList.tsx
    └── transaction-list.css
```

### Vite Config for MCP Apps

Each MCP App must compile to a **single self-contained HTML file** with all JS and CSS inlined. Add a second Vite config for this:

```typescript
// packages/frontend/vite.mcp-apps.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../backend/src/mcp/apps',    // output directly into backend source
    emptyOutDir: false,                   // don't wipe other app HTML files
    rollupOptions: {
      input: {
        'spending-chart': resolve(__dirname, 'src/mcp-apps/spending-chart/main.tsx'),
        'transaction-list': resolve(__dirname, 'src/mcp-apps/transaction-list/main.tsx'),
      },
      output: {
        entryFileNames: '[name].html',    // produce spending-chart.html etc.
        inlineDynamicImports: true,       // everything in one file
      },
    },
  },
});
```

Add a build script to `packages/frontend/package.json`:
```json
{
  "scripts": {
    "build:mcp-apps": "vite build --config vite.mcp-apps.config.ts"
  }
}
```

### Example MCP App Component

```tsx
// packages/frontend/src/mcp-apps/spending-chart/SpendingChart.tsx
import { useApp, applyHostStyleVariables } from '@modelcontextprotocol/ext-apps/react';
import { useEffect, useState } from 'react';

interface SpendingData {
  category: string;
  amount: number;
}

export default function SpendingChart(): React.JSX.Element {
  const { hostStyles, toolResult } = useApp();
  const [data, setData] = useState<SpendingData[]>([]);

  useEffect(() => {
    applyHostStyleVariables(hostStyles);
  }, [hostStyles]);

  useEffect(() => {
    if (toolResult?.name === 'get-spending-by-category') {
      setData(toolResult.result as SpendingData[]);
    }
  }, [toolResult]);

  return (
    <div className="chart-container">
      {data.map((item) => (
        <div key={item.category} className="bar">
          <span className="label">{item.category}</span>
          <span className="amount">${item.amount.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}
```

### Entry Point

```tsx
// packages/frontend/src/mcp-apps/spending-chart/main.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import SpendingChart from './SpendingChart.js';
import './spending-chart.css';

const root = document.getElementById('root')!;
createRoot(root).render(<SpendingChart />);
```

### postMessage Communication Model

The app does NOT call your backend API at runtime. Instead:

1. The MCP host sends a `tool-result` message to the iframe via `postMessage` after the model calls a tool
2. The app reads the result and updates its UI
3. The app can send `tool-input` messages back to the host to request another tool call

This is all handled by `registerAppTool` from `@modelcontextprotocol/ext-apps`.

---

## Part 2: Backend — Serving MCP Apps

### Reading App Files at Startup

```typescript
// src/mcp/mcp.service.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

@Injectable()
export class McpService implements OnModuleInit {
  private appHtml: Map<string, string> = new Map();

  onModuleInit(): void {
    this.server = new McpServer({ name: 'finance-tracker', version: '1.0.0' });
    this.loadAppHtml();
    this.registerTools();
    this.registerResources();
  }

  private loadAppHtml(): void {
    const appsDir = join(import.meta.dirname, 'apps');
    for (const name of ['spending-chart', 'transaction-list']) {
      const filePath = join(appsDir, `${name}.html`);
      try {
        this.appHtml.set(name, readFileSync(filePath, 'utf-8'));
      } catch {
        // App not yet built — skip gracefully
      }
    }
  }
```

### Registering UI Resources

```typescript
  private registerResources(): void {
    this.server.registerResource(
      'ui://spending-chart',
      {
        description: 'Interactive spending breakdown chart by category',
        mimeType: 'text/html;profile=mcp-app',
      },
      async () => {
        const html = this.appHtml.get('spending-chart');
        if (!html) {
          return { contents: [{ uri: 'ui://spending-chart', text: '<p>App not built yet. Run npm run build:mcp-apps in packages/frontend.</p>' }] };
        }
        return { contents: [{ uri: 'ui://spending-chart', mimeType: 'text/html;profile=mcp-app', text: html }] };
      },
    );
  }
```

### Pairing a UI Resource with a Tool

Use `visibility: ['app']` on a tool to mark it as UI-only — it will not appear in the model's tool list, only in the app's tool registry:

```typescript
  private registerTools(): void {
    // Model-visible tool — returns data + surfaces the UI
    this.server.registerTool(
      'get-spending-by-category',
      {
        description: 'Show spending by category for a date range. Opens an interactive chart.',
        inputSchema: z.object({
          from: z.string().describe('Start date ISO 8601'),
          to: z.string().describe('End date ISO 8601'),
        }),
        // Signals to the host that this tool has an associated UI
        ui: { resource: 'ui://spending-chart' },
      },
      async ({ from, to }) => {
        const data = await this.reportsService.spendingByCategory({ from, to });
        return {
          content: [{ type: 'text', text: `Spending breakdown loaded (${data.length} categories)` }],
          structuredContent: data,
        };
      },
    );
  }
```

---

## Build Pipeline Summary

```bash
# 1. Build MCP App UIs (run from packages/frontend/)
npm run build:mcp-apps
# → produces packages/backend/src/mcp/apps/*.html

# 2. Build and run the backend
cd packages/backend
npm run build
npm run start:dev
```

For CI/CD, add the frontend MCP Apps build as a pre-step before the backend Docker build.

---

## CSP / Security Notes

- MCP App HTML runs in a sandboxed iframe managed by the host
- The host enforces its own Content Security Policy — apps should not rely on external CDNs
- All assets (JS, CSS, fonts, images) must be inlined at build time via Vite
- Apps do NOT have access to `localStorage`, `sessionStorage`, or cookies belonging to the host origin

---

## Supported Clients

| Client | MCP Apps Support |
|--------|-----------------|
| VS Code Copilot | Yes |
| Claude Desktop | Yes (as of MCP Apps announcement, Jan 26, 2026) |
| claude.ai web | Yes |
| Claude iOS | Per claude.ai Connectors support |
| Cursor | Check Cursor release notes |
| ChatGPT | Yes (MCP Apps compatible) |

---

## Related Docs

- [Setting Up MCP Server](./mcp-setup.md)
- [Development Roadmap — Backend](./development-roadmap.md)
- [Development Roadmap — Frontend](../../frontend/docs/development-roadmap.md)
