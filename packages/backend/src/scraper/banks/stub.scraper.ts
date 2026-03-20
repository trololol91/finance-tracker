/* v8 ignore file */
import type {
    BankScraper,
    PluginInputs,
    PluginFieldDescriptor,
    ScrapeOptions,
    RawTransaction
} from '#scraper/interfaces/bank-scraper.interface.js';

const stubScraper: BankScraper = {
    bankId: 'stub',
    displayName: 'Stub Bank (test only)',
    requiresMfaOnEveryRun: false,
    maxLookbackDays: 90,
    pendingTransactionsIncluded: true,

    inputSchema: [
        {
            key: 'username',
            label: 'Username',
            type: 'text',
            required: true,
            hint: 'Any value — this scraper is a test stub'
        }
    ] satisfies PluginFieldDescriptor[],

    login(_inputs: PluginInputs): Promise<void> {
        return Promise.resolve();
    },

    scrapeTransactions(_input: PluginInputs, _options: ScrapeOptions): Promise<RawTransaction[]> {
        return Promise.resolve([
            {
                date: '2026-01-01',
                description: 'Stub Transaction A',
                amount: -42.00,
                pending: false,
                syntheticId: 'stub-aaa-0001'
            },
            {
                date: '2026-01-15',
                description: 'Stub Transaction B',
                amount: 100.00,
                pending: false,
                syntheticId: 'stub-bbb-0002'
            },
            {
                date: '2026-01-20',
                description: 'Stub Transaction C',
                amount: -7.50,
                pending: true,
                syntheticId: 'stub-ccc-0003'
            }
        ]);
    }
};

export default stubScraper;
