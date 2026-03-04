/* v8 ignore file */
/**
 * Phase 7 stub: Real Playwright automation deferred to Phase 8.
 * This module makes `bankId: 'cibc'` available in the ScraperRegistry
 * so the `GET /scrapers` endpoint and CreateSyncScheduleDto validation work.
 *
 * ─── MFA flow overview ────────────────────────────────────────────────────────
 *
 *  scraper.worker.ts (worker thread)
 *    │
 *    ├─ 1. calls scraper.login(page, credentials)
 *    │        └─ navigates CIBC login, fills card + password, submits
 *    │           if MFA prompt appears → throws MfaRequiredError(prompt)
 *    │
 *    ├─ 2. worker catches MfaRequiredError
 *    │        └─ parentPort.postMessage({ type: 'mfa_required', prompt })
 *    │           worker suspends: await new Promise(r => parentPort.once('message', r))
 *    │
 *    │  [main thread stores resolver; SSE pushes mfa_required to browser]
 *    │  [user enters code in MfaModal; POST /sync-schedules/:id/mfa-response]
 *    │  [main thread calls resolver → worker.postMessage({ type: 'mfa_code', code })]
 *    │
 *    ├─ 3. worker unblocks with { code }
 *    │        └─ calls scraper.submitMfa(page, code)
 *    │           fills the OTP input and clicks Submit
 *    │
 *    └─ 4. calls scraper.scrapeTransactions(page, options)
 *             └─ navigates to Activity, sets date range, parses rows, returns[]
 *
 * ─── Phase 8 implementation notes ────────────────────────────────────────────
 *
 * `login()` should throw `MfaRequiredError` (see below) when the bank UI shows
 * an OTP / security-question page after credentials are submitted.
 * `submitMfa()` is a Phase 8 addition to BankScraper — it receives the page
 * that login() left on the MFA screen and the code the user supplied.
 *
 * Approximate CIBC selectors (verify against live portal before shipping):
 *   Login page:      https://www.cibc.com/en/personal-banking/sign-on.html
 *   Card field:      input[name="card"]     (or #regularSignOnName)
 *   Password field:  input[name="password"] (or #onlinePassword)
 *   Submit button:   button[type="submit"]
 *   MFA prompt text: .mfa-challenge-message  (confirm in DevTools)
 *   MFA code input:  input[name="otp"]
 *   Transactions:    https://www.cibc.com/en/personal-banking/accounts/activity.html
 *   Date from:       input#activityStartDate
 *   Date to:         input#activityEndDate
 *   Row selector:    table.account-activity tbody tr
 *   Date cell:       td:nth-child(1)
 *   Desc cell:       td:nth-child(2)
 *   Amount cell:     td:nth-child(3)   (negative string = debit, e.g. "-$42.00")
 */
import {Injectable} from '@nestjs/common';
import type {
    BankScraper,
    BankCredentials,
    ScrapeOptions,
    RawTransaction
} from '#scraper/interfaces/bank-scraper.interface.js';

// ---------------------------------------------------------------------------
// Typed error thrown by login() when CIBC presents an MFA / OTP challenge.
// scraper.worker.ts catches this, posts { type: 'mfa_required' } to the main
// thread, awaits the code, then calls scraper.submitMfa(page, code).
// ---------------------------------------------------------------------------
export class MfaRequiredError extends Error {
    constructor(public readonly prompt: string) {
        super(`MFA required: ${prompt}`);
        this.name = 'MfaRequiredError';
    }
}

@Injectable()
export class CibcScraper implements BankScraper {
    public readonly bankId = 'cibc';
    public readonly displayName = 'CIBC';
    public readonly requiresMfaOnEveryRun = true;
    public readonly maxLookbackDays = 90;
    public readonly pendingTransactionsIncluded = true;

    /**
     * Phase 7 stub — navigate to CIBC login page and authenticate.
     * Real implementation uses Playwright; deferred to Phase 8.
     *
     * Phase 8 implementation example:
     * ─────────────────────────────────────────────────────────────────────────
     * public async login(page: unknown, credentials: BankCredentials): Promise<void> {
     *     const p = page as import('playwright').Page;
     *
     *     await p.goto('https://www.cibc.com/en/personal-banking/sign-on.html');
     *     await p.fill('input[name="card"]', credentials.username);
     *     await p.fill('input[name="password"]', credentials.password);
     *     await p.click('button[type="submit"]');
     *
     *     // Wait for either the dashboard or an MFA challenge to appear.
     *     await p.waitForSelector('.account-summary, .mfa-challenge-message', { timeout: 15_000 });
     *
     *     if (await p.isVisible('.mfa-challenge-message')) {
     *         const prompt = (await p.textContent('.mfa-challenge-message')) ?? 'Enter your security code';
     *         // Leave the page on the MFA screen; the worker will call submitMfa()
     *         // once it receives the code from the main thread.
     *         throw new MfaRequiredError(prompt.trim());
     *     }
     *     // If we reach here the session is authenticated with no MFA — done.
     * }
     * ─────────────────────────────────────────────────────────────────────────
     */
    public login(_page: unknown, _credentials: BankCredentials): Promise<void> {
        return Promise.resolve();
    }

    /**
     * Phase 8 addition — submit the OTP code after login() threw MfaRequiredError.
     * The page is still on the MFA screen when this is called.
     *
     * Phase 8 implementation example:
     * ─────────────────────────────────────────────────────────────────────────
     * public async submitMfa(page: unknown, code: string): Promise<void> {
     *     const p = page as import('playwright').Page;
     *     await p.fill('input[name="otp"]', code);
     *     await p.click('button[type="submit"]');
     *     await p.waitForSelector('.account-summary', { timeout: 15_000 });
     * }
     * ─────────────────────────────────────────────────────────────────────────
     */

    /**
     * Phase 7 stub — scrape transaction rows from CIBC portal.
     * Real implementation uses Playwright; deferred to Phase 8.
     * Returns an empty array for all Phase 7 sync runs.
     *
     * Phase 8 implementation example:
     * ─────────────────────────────────────────────────────────────────────────
     * public async scrapeTransactions(page: unknown, options: ScrapeOptions): Promise<RawTransaction[]> {
     *     const p = page as import('playwright').Page;
     *
     *     await p.goto('https://www.cibc.com/en/personal-banking/accounts/activity.html');
     *     await p.fill('input#activityStartDate', options.startDate.toISOString().split('T')[0]);
     *     await p.fill('input#activityEndDate',   options.endDate.toISOString().split('T')[0]);
     *     await p.click('button.apply-date-range');
     *     await p.waitForSelector('table.account-activity tbody tr');
     *
     *     const rows = await p.$$('table.account-activity tbody tr');
     *     const transactions: RawTransaction[] = [];
     *
     *     for (const row of rows) {
     *         const date    = (await row.$eval('td:nth-child(1)', el => el.textContent ?? '')).trim();
     *         const desc    = (await row.$eval('td:nth-child(2)', el => el.textContent ?? '')).trim();
     *         const rawAmt  = (await row.$eval('td:nth-child(3)', el => el.textContent ?? '')).trim();
     *         const pending = (await row.getAttribute('class') ?? '').includes('pending');
     *
     *         if (!options.includePending && pending) continue;
     *
     *         // Parse "$1,234.56" or "-$42.00" → signed number
     *         const amount = parseFloat(rawAmt.replace(/[^0-9.\-]/g, ''));
     *
     *         const syntheticId = await this.buildSyntheticId(date, desc, amount, pending);
     *         transactions.push({ date, description: desc, amount, pending, syntheticId });
     *     }
     *
     *     return transactions;
     * }
     * ─────────────────────────────────────────────────────────────────────────
     */
    public scrapeTransactions(_page: unknown, _options: ScrapeOptions): Promise<RawTransaction[]> {
        return Promise.resolve([]);
    }
}
