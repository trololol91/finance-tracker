import type {
    BankScraper,
    PluginFieldDescriptor,
    PluginInputs,
    RawTransaction,
    ScrapeOptions
} from '@finance-tracker/plugin-sdk';
import type {Browser, Page} from 'playwright';

let browser: Browser | undefined;
let page: Page | undefined;

const TRANSACTIONS_API = 'https://easyweb.td.com/waw/api/account/creditcard/transactions';

interface TdTransaction {
    transactionId: string;
    postedDt: string;
    transactionDt: string;
    transactionDesc: string;
    activeTransactionDescription: string;
    cardNo: string;
    pendingPaymentTransaction: boolean;
    debit?: {amt: number};
    credit?: {amt: number};
}

interface TdTransactionsResponse {
    status: {statusCode: string};
    transactions?: {
        authorized?: TdTransaction[];
        posted?: TdTransaction[];
    };
}

const generateSyntheticId = async (
    transactionDt: string,
    description: string,
    amount: number
): Promise<string> => {
    const crypto = await import('node:crypto');
    // Keyed on transactionDt + description + amount — all stable across the
    // pending (authorized) → settled (posted) transition.
    // transactionId is excluded: its format changes between the two states,
    // which would produce two different syntheticIds for the same transaction.
    const key = `td-credit-card|${transactionDt}|${description}|${amount}`;
    return crypto.createHash('sha256').update(key).digest('hex');
};

const mapTransaction = async (t: TdTransaction, pending: boolean): Promise<RawTransaction> => {
    // debit = money out (negative), credit = money in (positive)
    const amount = t.debit ? -Math.abs(t.debit.amt) : Math.abs(t.credit?.amt ?? 0);
    const description = t.activeTransactionDescription || t.transactionDesc;
    return {
        date: t.transactionDt,
        description,
        amount,
        pending,
        syntheticId: await generateSyntheticId(t.transactionDt, description, amount)
    };
};

const tdCreditCardScraper: BankScraper = {
    bankId: 'td-credit-card',
    displayName: 'TD Credit Card',
    requiresMfaOnEveryRun: true,
    maxLookbackDays: 180,
    pendingTransactionsIncluded: true,

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
            hint: 'Account to scrape (e.g. "TD CASH BACK VISA INFINITE*")'
        }
    ] satisfies PluginFieldDescriptor[],

    async login(
        inputs: PluginInputs,
        resolveMfa?: (prompt: string) => Promise<string>
    ): Promise<void> {
        const {chromium} = await import('playwright');
        const serverUrl = process.env.PLAYWRIGHT_SERVER_URL;
        browser = await (serverUrl
            ? chromium.connect(serverUrl)
            : chromium.launch({headless: false}));
        page = await browser.newPage();

        await page.goto('https://www.td.com/ca/en/personal-banking');
        await page.getByRole('link', { name: 'Login' }).first().click();
        await page.getByRole('textbox', { name: 'Username or Access Card' }).fill(inputs.username);
        await page.getByRole('textbox', { name: 'Password' }).fill(inputs.password);
        await page.getByRole('button', { name: ' Login' }).click();

        const mfaTextButton = await page.getByRole('button', { name: 'Text me' })

        try {
            await mfaTextButton.waitFor({ state: 'visible', timeout: 10000 })
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

        await page.getByRole('link', { name: inputs.accountName }).click();

        const startDateStr = options.startDate.toISOString().slice(0, 10);
        const endDateStr   = options.endDate.toISOString().slice(0, 10);

        // Intercept the auto-fired cycleId=0 request that TD makes when the
        // account page loads, to extract the accountKey from the URL.
        const firstResponse = await page.waitForResponse(
            r => r.url().includes('/waw/api/account/creditcard/transactions'),
            {timeout: 15000}
        );
        const firstUrl = new URL(firstResponse.url());
        const accountKey = firstUrl.searchParams.get('accountKey');
        if (!accountKey) throw new Error('Could not extract accountKey from TD API response');

        const allTransactions: RawTransaction[] = [];

        for (let cycleId = 0; ; cycleId++) {
            const response = await page.request.get(
                `${TRANSACTIONS_API}?accountKey=${accountKey}&cycleId=${cycleId}`
            );

            // 400 means no more cycles exist
            if (!response.ok()) break;

            const data: TdTransactionsResponse = await response.json();
            if (data.status.statusCode !== '200') break;

            const posted     = data.transactions?.posted     ?? [];
            const authorized = data.transactions?.authorized ?? [];
            const rows: {t: TdTransaction; pending: boolean}[] = [
                ...authorized.map(t => ({t, pending: true})),
                ...posted.map(t => ({t, pending: false}))
            ];

            if (rows.length === 0) break;

            // Stop fetching older cycles once all rows predate our window
            const oldestDate = rows.map(r => r.t.postedDt).sort()[0];
            if (oldestDate && oldestDate < startDateStr) {
                // Still process rows in this cycle that fall within the window
                for (const {t, pending} of rows) {
                    if (t.postedDt >= startDateStr && t.postedDt <= endDateStr) {
                        allTransactions.push(await mapTransaction(t, pending));
                    }
                }
                break;
            }

            for (const {t, pending} of rows) {
                if (t.postedDt >= startDateStr && t.postedDt <= endDateStr) {
                    allTransactions.push(await mapTransaction(t, pending));
                }
            }
        }

        return allTransactions;
    },

    async cleanup(): Promise<void> {
        await page?.close();
        await browser?.close();
        page = undefined;
        browser = undefined;
    }
};

export default tdCreditCardScraper;
