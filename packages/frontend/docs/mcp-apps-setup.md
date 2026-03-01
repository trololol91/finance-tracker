# MCP App UIs — Frontend Setup

This document covers the frontend side of building MCP App UIs: project structure, Vite config, React component patterns, and the build pipeline.

For the backend side (serving the HTML over MCP), see [mcp-apps-setup.md](../../backend/docs/mcp-apps-setup.md).

---

## What This Produces

The frontend Vite build outputs one self-contained `.html` file per MCP App — all JavaScript and CSS inlined. These files are placed directly into `packages/backend/src/mcp/apps/` where the NestJS backend reads and serves them over MCP.

---

## Dependencies

```bash
# In packages/frontend/
npm install @modelcontextprotocol/ext-apps
```

This is the official MCP Apps SDK. Key exports:

| Import | Purpose |
|--------|---------|
| `registerAppTool` | Bind an MCP tool call result to component state |
| `useApp` | React hook — access `toolResult`, `hostStyles`, `sendMessage` |
| `applyHostStyleVariables` | Sync host theme CSS variables into the iframe |

---

## Directory Structure

```
packages/frontend/src/mcp-apps/
├── spending-chart/
│   ├── main.tsx               # React entry point
│   ├── SpendingChart.tsx      # Root component
│   └── spending-chart.css
├── transaction-list/
│   ├── main.tsx
│   ├── TransactionList.tsx
│   └── transaction-list.css
└── budget-overview/
    ├── main.tsx
    ├── BudgetOverview.tsx
    └── budget-overview.css
```

Each subdirectory is a separate Vite entry point that compiles to its own `.html` file.

---

## Vite Config

A dedicated Vite config handles the MCP App build, separate from the main app build:

```typescript
// packages/frontend/vite.mcp-apps.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  build: {
    // Output directly into the backend source tree
    outDir: '../backend/src/mcp/apps',
    emptyOutDir: false,          // don't delete other apps on each build
    rollupOptions: {
      input: {
        'spending-chart': resolve(import.meta.dirname, 'src/mcp-apps/spending-chart/main.tsx'),
        'transaction-list': resolve(import.meta.dirname, 'src/mcp-apps/transaction-list/main.tsx'),
        'budget-overview': resolve(import.meta.dirname, 'src/mcp-apps/budget-overview/main.tsx'),
      },
      output: {
        // All assets must be inlined — no separate JS/CSS chunks
        inlineDynamicImports: true,
        entryFileNames: '[name].html',
      },
    },
  },
});
```

Add the build script to `package.json`:
```json
{
  "scripts": {
    "build:mcp-apps": "vite build --config vite.mcp-apps.config.ts"
  }
}
```

---

## Entry Point Pattern

Every MCP App entry point follows the same shape:

```tsx
// src/mcp-apps/spending-chart/main.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import SpendingChart from './SpendingChart.js';
import './spending-chart.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SpendingChart />
  </React.StrictMode>,
);
```

The HTML template for each app (in `index.html` at the mcp-apps level) needs a `<div id="root"></div>`. With `inlineDynamicImports: true`, Vite will produce a single HTML file.

---

## Component Pattern

```tsx
// src/mcp-apps/spending-chart/SpendingChart.tsx
import { useApp, applyHostStyleVariables } from '@modelcontextprotocol/ext-apps/react';
import { useEffect, useState } from 'react';

interface CategorySpend {
  category: string;
  amount: number;
  percentage: number;
}

export default function SpendingChart(): React.JSX.Element {
  const { toolResult, hostStyles } = useApp();
  const [data, setData] = useState<CategorySpend[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Sync host theme (light/dark mode, font size, accent colour)
  useEffect(() => {
    if (hostStyles) applyHostStyleVariables(hostStyles);
  }, [hostStyles]);

  // Consume data pushed from the MCP tool call result
  useEffect(() => {
    if (toolResult?.name === 'get-spending-by-category') {
      setData(toolResult.result as CategorySpend[]);
      setIsLoading(false);
    }
  }, [toolResult]);

  if (isLoading) {
    return <p className="status">Loading spending data…</p>;
  }

  if (data.length === 0) {
    return <p className="status">No transactions in this period.</p>;
  }

  return (
    <div className="spending-chart">
      {data.map((item) => (
        <div key={item.category} className="category-row">
          <span className="category-name">{item.category}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${item.percentage}%` }} />
          </div>
          <span className="amount">${item.amount.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}
```

### Key rules for MCP App components

1. **No API calls** — data arrives via `postMessage` from the MCP host, not via `fetch`
2. **No router** — each app is a single-screen UI
3. **No global state managers** — React state (`useState`) only
4. **Use host CSS variables** — call `applyHostStyleVariables` so the app matches the host theme
5. **All assets inlined** — no references to external CDNs or separate asset files

---

## postMessage Data Flow

```
MCP Host (Claude / VS Code)
        │
        │  window.postMessage({ type: 'tool-result', name: '...', result: {...} })
        ▼
MCP App iframe
        │  useApp() → toolResult
        ▼
React component state → UI update
```

The app can also request a tool call from the host:
```typescript
const { sendMessage } = useApp();

// Ask the host to call a tool
sendMessage({ type: 'tool-input', name: 'get-spending-by-category', arguments: { from, to } });
```

---

## Styling

- Use CSS custom properties so `applyHostStyleVariables` can override colours/fonts
- Avoid fixed pixel sizes for fonts — use `rem` or `em`
- Provide a sensible default theme so the app looks reasonable without host styles

```css
/* spending-chart.css */
:root {
  --mcp-accent: #7c3aed;
  --mcp-text: #111827;
  --mcp-bg: #ffffff;
}

.spending-chart {
  font-family: var(--mcp-font-family, system-ui, sans-serif);
  background: var(--mcp-bg);
  color: var(--mcp-text);
  padding: 1rem;
}

.bar-fill {
  background: var(--mcp-accent);
  height: 8px;
  border-radius: 4px;
  transition: width 0.3s ease;
}
```

---

## Testing

### Unit tests (Vitest)

Mock `useApp` from `@modelcontextprotocol/ext-apps/react`:

```typescript
// src/mcp-apps/spending-chart/__TEST__/SpendingChart.test.tsx
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import SpendingChart from '../SpendingChart.js';

vi.mock('@modelcontextprotocol/ext-apps/react', () => ({
  useApp: () => ({
    toolResult: {
      name: 'get-spending-by-category',
      result: [{ category: 'Groceries', amount: 450.0, percentage: 35 }],
    },
    hostStyles: null,
  }),
  applyHostStyleVariables: vi.fn(),
}));

test('renders category data from tool result', () => {
  render(<SpendingChart />);
  expect(screen.getByText('Groceries')).toBeInTheDocument();
  expect(screen.getByText('$450.00')).toBeInTheDocument();
});
```

### Build test

```bash
npm run build:mcp-apps
ls ../backend/src/mcp/apps/
# spending-chart.html  transaction-list.html  budget-overview.html
```

---

## Development Workflow

Since MCP Apps don't run as standalone pages during development, two approaches work:

**Option A — Build and test in MCP Inspector:**
```bash
npm run build:mcp-apps
# Then open MCP Inspector and trigger the relevant tool call
```

**Option B — Dev wrapper page (recommended):**
Create a temporary dev entry point at `src/mcp-apps/dev-harness.tsx` that simulates `postMessage` events so you can develop using `npm run dev` in the browser.

---

## Related Docs

- [MCP Apps Setup — Backend](../../backend/docs/mcp-apps-setup.md)
- [MCP Server Setup — Backend](../../backend/docs/mcp-setup.md)
- [Development Roadmap](./development-roadmap.md)
