/* v8 ignore file */
import type {
    BankScraper,
    PluginInputs,
    PluginFieldDescriptor,
    ScrapeOptions,
    RawTransaction
} from '@finance-tracker/plugin-sdk';

const MFA_KEY = 'mfa';

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
        },
        {
            key: MFA_KEY,
            label: 'Trigger MFA',
            type: 'select',
            required: false,
            hint: 'Set to "yes" to simulate an MFA challenge during login',
            options: [
                {value: 'no', label: 'No MFA'},
                {value: 'yes', label: 'Trigger MFA (30s delay)'}
            ]
        }
    ] satisfies PluginFieldDescriptor[],

    async login(inputs: PluginInputs, resolveMfa?: (prompt: string) => Promise<string>): Promise<void> {
        if (inputs[MFA_KEY] === 'yes') {
            if (!resolveMfa) throw new Error('MFA required but no resolver provided');
            await new Promise<void>(r => { setTimeout(r, 30_000); });
            await resolveMfa('Enter the 6-digit code sent to your stub device');
        }
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
