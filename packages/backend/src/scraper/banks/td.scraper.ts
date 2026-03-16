/* v8 ignore file */
/**
 * Phase 7 stub: Real Playwright automation deferred to Phase 8.
 * This module makes `bankId: 'td'` available in the ScraperRegistry
 * so the `GET /scrapers` endpoint and CreateSyncScheduleDto validation work.
 */
import type {
    BankScraper,
    BankCredentials,
    ScrapeOptions,
    RawTransaction
} from '#scraper/interfaces/bank-scraper.interface.js';

const tdScraper: BankScraper = {
    bankId: 'td',
    displayName: 'TD Canada Trust',
    requiresMfaOnEveryRun: false,
    maxLookbackDays: 365,
    pendingTransactionsIncluded: false,

    /**
     * Phase 7 stub — navigate to TD login page and authenticate.
     * Real implementation uses Playwright; deferred to Phase 8.
     */
    login(_page: unknown, _credentials: BankCredentials): Promise<void> {
        return Promise.resolve();
    },

    /**
     * Phase 7 stub — scrape transaction rows from TD portal.
     * Real implementation uses Playwright; deferred to Phase 8.
     * Returns an empty array for all Phase 7 sync runs.
     */
    scrapeTransactions(_page: unknown, _options: ScrapeOptions): Promise<RawTransaction[]> {
        return Promise.resolve([]);
    }
};

export default tdScraper;
