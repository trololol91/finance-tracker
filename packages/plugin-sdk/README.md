# @finance-tracker/plugin-sdk

TypeScript contract for finance-tracker scraper plugins. Zero runtime dependencies.

## What it is

This package provides the `BankScraper` interface and supporting types that every
scraper plugin must implement. It is the single source of truth for the plugin
contract — the backend loader, built-in scrapers, and external plugins all derive
from these types.

## Install

Within the monorepo workspace, add it as a dependency:

```json
"dependencies": {
  "@finance-tracker/plugin-sdk": "*"
}
```

For a standalone external plugin:

```bash
npm install @finance-tracker/plugin-sdk
```

## Minimal plugin example

```typescript
import type {BankScraper, RawTransaction, ScrapeOptions, PluginInputs} from '@finance-tracker/plugin-sdk';

const plugin: BankScraper = {
    bankId: 'my-bank',
    displayName: 'My Bank',
    requiresMfaOnEveryRun: false,
    maxLookbackDays: 90,
    pendingTransactionsIncluded: false,
    inputSchema: [
        {key: 'username', label: 'Username', type: 'text',     required: true},
        {key: 'password', label: 'Password', type: 'password', required: true}
    ],
    async login(inputs: PluginInputs): Promise<void> {
        // navigate to login page and authenticate
    },
    async scrapeTransactions(inputs: PluginInputs, options: ScrapeOptions): Promise<RawTransaction[]> {
        // navigate to transactions, filter by options.startDate / endDate
        return [];
    },
    async cleanup(): Promise<void> {
        // close browser / release resources
    }
};

export default plugin;
```

## BankScraper interface reference

| Field | Type | Description |
|-------|------|-------------|
| `bankId` | `string` | Unique lowercase key (e.g. `"cibc"`, `"td"`) |
| `displayName` | `string` | Human-readable name shown in the UI |
| `requiresMfaOnEveryRun` | `boolean` | `true` if MFA is needed on every scrape |
| `maxLookbackDays` | `number` | Max days of history the bank UI shows |
| `pendingTransactionsIncluded` | `boolean` | Whether the bank shows pending transactions |
| `inputSchema` | `PluginFieldDescriptor[]` | Fields to collect from the user |
| `login(inputs, resolveMfa?)` | `Promise<void>` | Authenticate with the bank |
| `scrapeTransactions(inputs, options)` | `Promise<RawTransaction[]>` | Scrape and return transactions |
| `cleanup?()` | `Promise<void>` | Release resources (browser, etc.) |

### PluginFieldDescriptor

```typescript
interface PluginFieldDescriptor {
    key: string;
    label: string;
    type: 'text' | 'password' | 'number' | 'select';
    required: boolean;
    hint?: string;
    options?: {value: string, label: string}[];  // only for type: 'select'
}
```

### RawTransaction

```typescript
interface RawTransaction {
    date: string;          // ISO 8601
    description: string;
    amount: number;        // negative = debit, positive = credit
    pending: boolean;
    syntheticId: string;   // sha256(bankId + accountId + date + description + amount)
}
```

## Testing your plugin

Import test helpers from the `/testing` subpath (kept separate so they are not
bundled into production plugin output):

```typescript
import {describe, it, expect} from 'vitest';
import {validatePlugin, makeScrapeOptions, makeInputs} from '@finance-tracker/plugin-sdk/testing';
import plugin from './index.js';

describe('my-bank plugin', () => {
    it('satisfies the BankScraper contract', () => {
        expect(validatePlugin(plugin)).toBe(true);
    });

    it('scrapeTransactions returns an array', async () => {
        const result = await plugin.scrapeTransactions(makeInputs(), makeScrapeOptions());
        expect(Array.isArray(result)).toBe(true);
    });
});
```

## Plugin directory structure

The loader expects each plugin to live in its own subdirectory of `SCRAPER_PLUGIN_DIR`:

```
SCRAPER_PLUGIN_DIR/
  my-bank/
    package.json        ← optional; if present, "main" points to entry file
    index.js            ← default entry if no package.json#main
    node_modules/       ← plugin's own dependencies (isolated)
```

If `package.json` is present with a `"main"` field, that path is used as the entry.
Otherwise `index.js` is assumed.

## Packaging for upload

Use the `pack` npm script (if present) to create a distributable `.zip`:

```bash
npm run build
npm run pack
# produces: my-bank-0.1.0.zip  (dist/ + package.json, no node_modules)
```

Upload the zip to `POST /admin/scrapers/install`. The server extracts it, runs
`npm install`, and registers the plugin immediately.

## How to submit / register a plugin

1. Build and pack: `npm run build && npm run pack`
2. Upload via admin API: `POST /admin/scrapers/install` with the `.zip` file
3. Confirm registration: `POST /admin/scrapers/reload` if needed
4. Run a dry-run test: `POST /admin/scrapers/<bankId>/test`
