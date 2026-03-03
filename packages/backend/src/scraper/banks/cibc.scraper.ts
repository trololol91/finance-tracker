/* v8 ignore file */
/**
 * Phase 7 stub: Real Playwright automation deferred to Phase 8.
 * This module makes `bankId: 'cibc'` available in the ScraperRegistry
 * so the `GET /scrapers` endpoint and CreateSyncScheduleDto validation work.
 */
import {Injectable} from '@nestjs/common';
import type {
    BankScraper,
    BankCredentials,
    ScrapeOptions,
    RawTransaction
} from '#scraper/interfaces/bank-scraper.interface.js';

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
     */
    public login(_page: unknown, _credentials: BankCredentials): Promise<void> {
        return Promise.resolve();
    }

    /**
     * Phase 7 stub — scrape transaction rows from CIBC portal.
     * Real implementation uses Playwright; deferred to Phase 8.
     * Returns an empty array for all Phase 7 sync runs.
     */
    public scrapeTransactions(_page: unknown, _options: ScrapeOptions): Promise<RawTransaction[]> {
        return Promise.resolve([]);
    }
}
