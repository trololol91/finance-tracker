import {
    type BankScraper,
    type PluginInputs,
    type PluginFieldDescriptor,
    type ScrapeOptions,
    type RawTransaction,
    MfaRequiredError
} from '../interfaces/bank-scraper.interface.js';
import type {
    Browser,
    ElementHandle, Page
} from 'playwright';

export {MfaRequiredError} from '../interfaces/bank-scraper.interface.js';

let page: Page | undefined;
let browser: Browser | undefined;

const findAccountElement = async (
    accountName: string
): Promise<ElementHandle<SVGElement | HTMLElement>> => {
    if (!page) {
        throw new Error('Page not initialized in findAccountElement');
    }

    const targetName = accountName;
    let attempt = 0;
    while (attempt < 15) {
        const accountHeaders = await page.$$('.account-name-header span');
        for (const header of accountHeaders) {
            const text = await header.textContent();
            if (text && text.trim() === targetName) {
                return header;
            }
        }
        attempt++;
        // Wait 1000ms before retrying
        await new Promise(res => setTimeout(res, 1000));
    }

    throw new Error(`${targetName} account not found after 15 retries`);
};

/**
 * Generates a syntheticId for a transaction using SHA-256 hash.
 * @param bankId - The bank identifier
 * @param accountId - The account identifier (cardText)
 * @param date - ISO date string
 * @param description - Transaction description
 * @param amount - Transaction amount
 * @param pending - Pending status
 * @returns SHA-256 hex string
 */
interface SyntheticIdParams {
    bankId: string;
    accountId: string;
    date: string;
    description: string;
    amount: number;
    pending: boolean;
}

const generateSyntheticId = async (params: SyntheticIdParams): Promise<string> => {
    const crypto = await import('node:crypto');
    const hashInput = [
        params.bankId,
        params.accountId,
        params.date,
        params.description,
        params.amount.toString(),
        params.pending.toString()
    ].join('|');
    return crypto.createHash('sha256').update(hashInput).digest('hex');
};

const selectDateFromElement = async (
    dateContainer: ElementHandle<SVGElement | HTMLElement>,
    date: Date
): Promise<void> => {
    if (!page) {
        throw new Error('Page not initialized in selectDateFromElement');
    }

    const startMonth = date.getMonth() + 1; // JS months are 0-based
    const startDay = date.getDate();
    const startYear = date.getFullYear();

    // Select month
    const monthSelect = await dateContainer.waitForSelector('select[aria-label="Month"]', {timeout: 15000});
    // Pad startMonth to 2 digits (e.g. 01, 02)
    const monthValue = startMonth.toString().padStart(2, '0');
    await monthSelect.selectOption({value: monthValue});

    // Select day
    const daySelect = await dateContainer.waitForSelector('select[aria-label="Day"]', {timeout: 15000});
    const dayValue = startDay.toString().padStart(2, '0');
    await daySelect.selectOption({value: dayValue});

    // Select year
    const yearSelect = await dateContainer.waitForSelector('select[aria-label="Year"]', {timeout: 15000});
    const yearValue = startYear.toString();
    await yearSelect.selectOption({value: yearValue});
};

const scrapeTransactionsFromSection = async (
    section: ElementHandle<SVGElement | HTMLElement>,
    flipAmounts: boolean
): Promise<RawTransaction[]> => {
    if (!page) throw new Error('Page not initialized');

    // Find all transaction rows
    const rows = await section.$$('tr.transaction-row');
    const transactions: RawTransaction[] = [];

    for (const row of rows) {
        // Date
        const dateCell = await row.$('td.transactionDate span');
        const dateText = dateCell ? (await dateCell.textContent())?.trim() : undefined;

        // Description
        const descCell = await row.$('td.transactions .transactionDescription');
        const descText = descCell ? (await descCell.textContent())?.trim() : undefined;

        // Card number (optional)
        const cardCell = await row.$('td.transactions .transactionCardNo');
        const cardText = cardCell ? (await cardCell.textContent())?.trim() : undefined;

        // Amount
        const amountCell = await row.$('td.amount span');
        let amountText = amountCell ? (await amountCell.textContent())?.trim() : undefined;
        // Some credits have a span.negative, so check for that
        const negativeSpan = await row.$('td.amount span.negative');
        if (negativeSpan) {
            amountText = amountText?.replace(/[−-]/, '-'); // Replace unicode minus with ASCII
        }

        // Parse amount as number
        let amount: number | undefined = undefined;
        if (amountText) {
            // Remove $ and commas, handle negative
            const cleaned = amountText.replace(/[$,]/g, '');
            amount = parseFloat(cleaned);
            // Flip amount if requested
            if (flipAmounts && typeof amount === 'number' && !isNaN(amount)) {
                amount = -amount;
            }
        }

        // Parse date (format: Mar 16, 2026)
        let date: Date | undefined = undefined;
        if (dateText) {
            date = new Date(dateText);
        }

        // Detect pending transactions: look for span.pending-indicator inside the amount cell
        let pending = false;
        const pendingIndicator = await row.$('td.amount .pending-indicator');
        if (pendingIndicator) {
            const pendingText = await pendingIndicator.textContent();
            if (pendingText && pendingText.trim().toLowerCase() === 'pending') {
                pending = true;
            }
        }

        // Only add if required fields are present
        if (date && descText && typeof amount === 'number' && !isNaN(amount)) {
            const syntheticId = await generateSyntheticId({
                bankId: 'cibc',
                accountId: cardText ?? '',
                date: date.toISOString(),
                description: descText,
                amount,
                pending
            });

            transactions.push({
                date: date.toISOString(),
                description: descText,
                amount,
                pending,
                syntheticId
            });
        }
    }

    return transactions;
};

const cibcScraper: BankScraper = {
    bankId: 'cibc',
    displayName: 'CIBC',
    requiresMfaOnEveryRun: true,
    maxLookbackDays: 90,
    pendingTransactionsIncluded: true,

    inputSchema: [
        {
            key: 'cardNumber',
            label: 'Card Number',
            type: 'text',
            required: true,
            hint: 'Your CIBC online banking card number or username'
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
            required: false,
            hint: 'Optional nickname for this account (e.g. "My CIBC Visa")'
        },
        {
            key: 'flipTransactions',
            label: 'Flip transaction amounts from positive to negative (and vice versa)',
            type: 'select',
            required: true,
            options: [
                {label: 'Yes', value: 'yes'},
                {label: 'No', value: 'no'}
            ]
        }
    ] satisfies PluginFieldDescriptor[],

    async login(inputs: PluginInputs): Promise<void> {
        // Launch Chrome using Playwright
        const {chromium} = await import('playwright');
        browser = await chromium.launch({headless: false, channel: 'chrome'});
        page = await browser.newPage();
        // Go to CIBC website
        await page.goto('https://www.cibc.com/');
        
        // Click on "Sign On" and wait for navigation to login page
        const signonButton = await page.waitForSelector('.centralized-signon', {timeout: 15000});
        await signonButton.click();
        
        // Input Card number
        const cardField = await page.waitForSelector('input[data-test-id="card-number-input"]', {timeout: 15000});
        await cardField.fill(inputs.cardNumber);

        // Click Continue and wait for password field to appear
        const continueButton = await page.waitForSelector('button[data-test-id="action-bar-primary-button"]', {timeout: 15000});
        await continueButton.click();

        // Input Password
        const passwordField = await page.waitForSelector('input[data-test-id="password-input"]', {timeout: 15000});
        await passwordField.fill(inputs.password);

        // Click Sign On and wait for either the dashboard or an MFA challenge to appear
        const signOnButton = await page.waitForSelector('button[data-test-id="sign-on-form-primary-button"]', {timeout: 15000});
        await signOnButton.click();

        try {
            // Check if MFA prompt appears, if so throw MfaRequiredError with the prompt text
            await page.waitForSelector('input[data-test-id="verification-code-input"]', {timeout: 15000});
        } catch {
            console.log('No MFA prompt detected');
            
            // Wait for dashboard indicator (e.g., sign-out button)
            await page.waitForSelector('button[data-test-id="sign-out-btn"]', {timeout: 15000});
            return;
        }
            
        throw new MfaRequiredError('Enter the verification code sent to your device');
    },
    async submitMfa(code: string): Promise<void> {

        if (!page) {
            throw new Error('Page not initialized in submitMfa');
        }
        
        // Wait for the MFA code input to appear, fill it with the provided code, and submit
        const mfaInput = await page.waitForSelector('input[data-test-id="verification-code-input"]', {timeout: 15000});
        await mfaInput.fill(code);

        // Click continue/submit button after entering MFA code
        const submitButton = await page.waitForSelector('button[data-test-id="action-bar-primary-button"]', {timeout: 15000});
        await submitButton.click();

        // Wait for the dashboard to load and return
        // Wait for dashboard indicator (e.g., sign-out button)
        await page.waitForSelector('button[data-test-id="sign-out-btn"]', {timeout: 15000});
    },
    async scrapeTransactions(
        input: PluginInputs,
        options: ScrapeOptions
    ): Promise<RawTransaction[]> {
        if (!browser || !page) {
            throw new Error('Browser or page not initialized in scrapeTransactions');
        }
        
        const accountTile = await findAccountElement(input.accountName);
        await accountTile.click();

        // Wait for transactions to load
        const transactionsContainer = await page.waitForSelector('div.transactions', {timeout: 15000});
        await transactionsContainer.scrollIntoViewIfNeeded();

        // Click on custom search
        const customSearchButton = await page.waitForSelector('ui-button.custom-search', {timeout: 15000});
        await customSearchButton.click();

        // Select from date element
        const fromDateContainer = await page.waitForSelector('div.from', {timeout: 15000});
        await selectDateFromElement(fromDateContainer, options.startDate);

        // Select to date element
        const toDateContainer = await page.waitForSelector('div.to', {timeout: 15000});
        await selectDateFromElement(toDateContainer, options.endDate);

        // Click on Get Details
        const getDetailsButton = await transactionsContainer.waitForSelector('ui-button.custom-search-button', {timeout: 15000});
        await getDetailsButton.click();

        // Wait for loading to be visible then invisible again (indicates transactions have loaded)
        try {
            const loadingIndicator = await transactionsContainer.waitForSelector('div.ui-indicator', {timeout: 10000, state: 'visible'});
            await loadingIndicator.waitForElementState('hidden', {timeout: 5000});
        } catch {
            console.log('No loading indicator detected, proceeding to scrape transactions');
        }

        // Proceed to scrape transactions from the page and return them as structured data
        const transactionListSection = await transactionsContainer.waitForSelector('section.transaction-list', {timeout: 15000});
        const transactions = await scrapeTransactionsFromSection(transactionListSection, input.flipTransactions === 'yes');

        await page.close();
        await browser.close();
        return transactions;
    }
};

export default cibcScraper;
