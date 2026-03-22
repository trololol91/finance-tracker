import type {BankScraper, PluginFieldDescriptor, PluginInputs, RawTransaction, ScrapeOptions} from '@finance-tracker/plugin-sdk';
import type {Browser, Page} from 'playwright';

// Module-level browser/page — initialised in login(), released in cleanup().
let browser: Browser | undefined;
let page: Page | undefined;

const plugin: BankScraper = {
    bankId: 'my-bank',          // TODO: unique lowercase identifier (e.g. 'td', 'rbc')
    displayName: 'My Bank',     // TODO: human-readable name shown in the UI
    requiresMfaOnEveryRun: false,
    maxLookbackDays: 90,
    pendingTransactionsIncluded: false,

    inputSchema: [
        {key: 'username', label: 'Username', type: 'text',     required: true},
        {key: 'password', label: 'Password', type: 'password', required: true}
    ] satisfies PluginFieldDescriptor[],

    async login(inputs: PluginInputs, _resolveMfa?: (prompt: string) => Promise<string>): Promise<void> {
        const {chromium} = await import('playwright');
        // launchOrConnect: uses PLAYWRIGHT_SERVER_URL env var when set (Docker),
        // otherwise launches a local browser (local dev). No code change needed.
        const serverUrl = process.env.PLAYWRIGHT_SERVER_URL;
        browser = await (serverUrl
            ? chromium.connect(serverUrl)
            : chromium.launch({headless: false}));
        page = await browser.newPage();

        // TODO: navigate to login page
        await page.goto('https://www.my-bank.com/login');

        // TODO: fill credentials
        await page.fill('input[name="username"]', inputs.username);
        await page.fill('input[name="password"]', inputs.password);
        await page.click('button[type="submit"]');

        // TODO: handle MFA if needed
        // const mfaField = await page.waitForSelector('input[name="otp"]', {timeout: 10000}).catch(() => null);
        // if (mfaField) {
        //     if (!_resolveMfa) throw new Error('MFA required but no resolver was provided');
        //     const code = await _resolveMfa('Enter the code sent to your device');
        //     await mfaField.fill(code);
        //     await page.click('button[type="submit"]');
        // }

        // TODO: wait for the dashboard to confirm login succeeded
        await page.waitForSelector('#dashboard', {timeout: 15000});
    },

    async scrapeTransactions(_inputs: PluginInputs, _options: ScrapeOptions): Promise<RawTransaction[]> {
        if (!page) throw new Error('Page not initialised — call login() first');

        // TODO: navigate to the transactions page
        await page.goto('https://www.my-bank.com/transactions');

        // TODO: apply date range using options.startDate / options.endDate
        // TODO: extract rows and map them to RawTransaction[]

        return [
            // Example shape — replace with real scraping logic:
            // {
            //     date: '2026-01-15',           // ISO 8601
            //     description: 'Coffee Shop',
            //     amount: -4.50,                // negative = debit, positive = credit
            //     pending: false,
            //     syntheticId: await sha256('my-bank|account-id|2026-01-15|Coffee Shop|-4.5')
            // }
        ];
    },

    async cleanup(): Promise<void> {
        await page?.close();
        await browser?.close();
        page = undefined;
        browser = undefined;
    }
};

export default plugin;
