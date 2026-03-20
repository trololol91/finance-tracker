import type {BankScraper, RawTransaction, ScrapeOptions, PluginInputs} from '@finance-tracker/plugin-sdk';

const plugin: BankScraper = {
    bankId: 'my-bank',          // TODO: unique lowercase id
    displayName: 'My Bank',     // TODO: human-readable name
    requiresMfaOnEveryRun: false,
    maxLookbackDays: 90,
    pendingTransactionsIncluded: false,
    inputSchema: [
        {key: 'username', label: 'Username', type: 'text',     required: true},
        {key: 'password', label: 'Password', type: 'password', required: true}
    ],
    async login(_inputs: PluginInputs): Promise<void> {
        // TODO: navigate to login page and authenticate
    },
    async scrapeTransactions(_inputs: PluginInputs, _options: ScrapeOptions): Promise<RawTransaction[]> {
        // TODO: navigate to transactions, filter by _options.startDate / endDate
        return [];
    },
    async cleanup(): Promise<void> {
        // TODO: close browser / release resources (optional)
    }
};

export default plugin;
