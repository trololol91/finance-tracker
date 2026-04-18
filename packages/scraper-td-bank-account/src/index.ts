import type {
    BankScraper,
    PluginFieldDescriptor,
    PluginInputs,
    RawTransaction,
    ScrapeOptions
} from '@finance-tracker/plugin-sdk';
import type {Browser, BrowserContext, Page} from 'playwright';

let browser: Browser | undefined;
let context: BrowserContext | undefined;
let page: Page | undefined;

const resolveCdpWsUrl = async (cdpUrl: string): Promise<string> => {
    if (cdpUrl.startsWith('ws://') || cdpUrl.startsWith('wss://')) {
        return cdpUrl;
    }
    const {get} = await import('node:http');
    const parsed = new URL(cdpUrl);
    return new Promise((resolve, reject) => {
        get(
            {
                hostname: parsed.hostname,
                port: parsed.port,
                path: '/json/version',
                headers: {Host: 'localhost'}
            },
            res => {
                let data = '';
                res.on('data', chunk => (data += chunk));
                res.on('end', () => {
                    try {
                        const {webSocketDebuggerUrl} = JSON.parse(data) as {webSocketDebuggerUrl: string};
                        const wsUrl = new URL(webSocketDebuggerUrl);
                        wsUrl.hostname = parsed.hostname;
                        wsUrl.port = parsed.port;
                        resolve(wsUrl.toString());
                    } catch {
                        reject(new Error(`Failed to parse CDP response: ${data}`));
                    }
                });
            }
        ).on('error', reject);
    });
};

const TRANSACTIONS_API_BASE = 'https://easyweb.td.com/ms/uainq/v1/accounts';

interface TdBankTransaction {
    transactionId: string;
    date: string;
    postedOnDate: string;
    description: string;
    withdrawalAmt?: number;
    depositAmt?: number;
    accountBalance: number;
    transactionType: string;
    transactionSubType: string;
    foreignCurrencyExchangeRate: number;
    eventDttm: string;
}

interface TdBankTransactionsResponse {
    transactionList?: {
        transactions?: TdBankTransaction[];
    };
}

const generateSyntheticId = async (
    date: string,
    description: string,
    amount: number
): Promise<string> => {
    const crypto = await import('node:crypto');
    const key = `td-bank-account|${date}|${description}|${amount}`;
    return crypto.createHash('sha256').update(key).digest('hex');
};

const mapTransaction = async (t: TdBankTransaction): Promise<RawTransaction> => {
    // withdrawalAmt = money out (negative), depositAmt = money in (positive)
    const amount = t.withdrawalAmt != null
        ? -Math.abs(t.withdrawalAmt)
        : Math.abs(t.depositAmt ?? 0);
    return {
        date: t.date,
        description: t.description,
        amount,
        pending: false,
        syntheticId: await generateSyntheticId(t.date, t.description, amount)
    };
};

const tdBankAccountScraper: BankScraper = {
    bankId: 'td-bank-account',
    displayName: 'TD Chequing / Savings',
    requiresMfaOnEveryRun: true,
    maxLookbackDays: 180,
    pendingTransactionsIncluded: false,

    inputSchema: [
        {
            key: 'username',
            label: 'TD Username',
            type: 'text',
            required: true,
            hint: 'Your EasyWeb username'
        },
        {
            key: 'password',
            label: 'Password',
            type: 'password',
            required: true
        },
        {
            key: 'accountName',
            label: 'Account Name',
            type: 'text',
            required: true,
            hint: 'Account to scrape (e.g. "TD EVERY DAY CHEQUING")'
        },
        {
            key: 'playwrightCdpUrl',
            label: 'Chrome CDP URL',
            type: 'text',
            required: false,
            hint: 'CDP endpoint of an existing Chrome instance (e.g. http://localhost:9222). Leave blank to use the configured Playwright server.'
        }
    ] satisfies PluginFieldDescriptor[],

    async login(
        inputs: PluginInputs,
        resolveMfa?: (prompt: string) => Promise<string>
    ): Promise<void> {
        const {chromium} = await import('playwright');
        const cdpUrl = inputs.playwrightCdpUrl || process.env.PLAYWRIGHT_CDP_URL;
        const serverUrl = process.env.PLAYWRIGHT_SERVER_URL;
        browser = await (cdpUrl
            ? chromium.connectOverCDP(await resolveCdpWsUrl(cdpUrl))
            : serverUrl
              ? chromium.connect(serverUrl)
              : chromium.launch({headless: false}));
        // When connecting over CDP, use the existing profile context (with saved cookies/sessions).
        // browser.newPage() would open a new incognito context and lose all profile data.
        context = cdpUrl ? browser.contexts()[0] : await browser.newContext();
        page = await context.newPage();

        await page.goto('https://www.td.com/ca/en/personal-banking');
        await page.getByRole('link', { name: 'Login' }).first().click();
        await page.getByRole('textbox', { name: 'Username or Access Card' }).fill(inputs.username);
        await page.getByRole('textbox', { name: 'Password' }).fill(inputs.password);
        await page.locator('button.td-button-secondary').click();

        const mfaTextButton = await page.getByRole('button', { name: 'Text me' });

        try {
            await mfaTextButton.waitFor({ state: 'visible', timeout: 10000 });
        } catch {
            return; // MFA not required
        }

        // MFA screen is visible
        if (!resolveMfa) {
            throw new Error('MFA required but no resolver was provided');
        }

        await page.getByRole('button', { name: 'Text me' }).click();

        const code = await resolveMfa('Enter the verification code sent to your device');
        await page.getByRole('textbox', { name: 'Enter Security Code' }).click();
        await page.getByRole('textbox', { name: 'Enter Security Code' }).fill(code);
        await page.getByRole('button', { name: 'Enter' }).click();
    },

    async scrapeTransactions(
        inputs: PluginInputs,
        options: ScrapeOptions
    ): Promise<RawTransaction[]> {
        if (!page) throw new Error('Page not initialised — call login() first');

        // TD sometimes shows a "Welcome back!" interstitial if it detects frequent logins, even with correct credentials. If so, close it to proceed to the dashboard.
        const closeBtn = page.getByRole('link', { name: 'Close' });

        try {
            await closeBtn.waitFor({ state: 'visible', timeout: 5000 });
            await closeBtn.click();
        } catch {
            console.log('No interstitial detected, proceeding to account page');
        }

        const startDateStr = options.startDate.toISOString().slice(0, 10);
        const endDateStr   = options.endDate.toISOString().slice(0, 10);

        await page.getByRole('link', { name: inputs.accountName }).click();

        // Intercept the auto-fired initial request that TD makes when the
        // account page loads, to extract the accountId from the URL path.
        // URL pattern: /ms/uainq/v1/accounts/{accountId}/transactions
        const firstResponse = await page.waitForResponse(
            r => r.url().includes('/ms/uainq/v1/accounts/') && r.url().endsWith('/transactions'),
            {timeout: 15000}
        );
        const firstUrl = new URL(firstResponse.url());
        const accountId = firstUrl.pathname.split('/').at(-2);
        if (!accountId) throw new Error('Could not extract accountId from TD API response');

        // Reuse the headers TD's frontend JS set on the initial request
        // (TraceabilityID, MessageID, TimeStamp, Originating-* etc.)
        const tdHeaders = firstResponse.request().headers();

        const response = await page.request.post(
            `${TRANSACTIONS_API_BASE}/${accountId}/transactions`,
            {
                data: {startDt: startDateStr, endDt: endDateStr, description: ''},
                headers: tdHeaders
            }
        );

        if (!response.ok()) {
            throw new Error(`TD bank account API returned ${response.status()}`);
        }

        const data: TdBankTransactionsResponse = await response.json();
        const transactions = data.transactionList?.transactions ?? [];

        return Promise.all(transactions.map(t => mapTransaction(t)));
    },

    async cleanup(): Promise<void> {
        await page?.close();
        if (browser?.contexts().includes(context!)) {
            // CDP-attached context — don't close it, just release our reference
        } else {
            await context?.close();
        }
        await browser?.close();
        page = undefined;
        context = undefined;
        browser = undefined;
    }
};

export default tdBankAccountScraper;
