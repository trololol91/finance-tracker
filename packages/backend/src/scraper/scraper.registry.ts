import {
    Injectable,
    Inject,
    Optional
} from '@nestjs/common';
import type {BankScraper} from '#scraper/interfaces/bank-scraper.interface.js';
import {ScraperInfoDto} from '#scraper/scraper-info.dto.js';

/** NestJS multi-provider injection token for BankScraper implementations. */
export const BANK_SCRAPER = 'BANK_SCRAPER';

/**
 * Registry that holds all registered BankScraper instances.
 * Scrapers are provided at module level using the BANK_SCRAPER multi-provider token.
 */
@Injectable()
export class ScraperRegistry {
    private readonly scraperMap: Map<string, BankScraper>;

    constructor(
        @Optional() @Inject(BANK_SCRAPER) scrapers: BankScraper[] | undefined
    ) {
        const list = scrapers ?? [];
        this.scraperMap = new Map(list.map(s => [s.bankId, s]));
    }

    /** Returns the BankScraper for the given bankId, or undefined if not registered. */
    public findByBankId(bankId: string): BankScraper | undefined {
        return this.scraperMap.get(bankId);
    }

    /** Returns true if the bankId is registered. */
    public has(bankId: string): boolean {
        return this.scraperMap.has(bankId);
    }

    /** Returns all registered scrapers as serialisable info objects. */
    public listAll(): ScraperInfoDto[] {
        return Array.from(this.scraperMap.values()).map(s => ({
            bankId: s.bankId,
            displayName: s.displayName,
            requiresMfaOnEveryRun: s.requiresMfaOnEveryRun,
            maxLookbackDays: s.maxLookbackDays,
            pendingTransactionsIncluded: s.pendingTransactionsIncluded
        }));
    }
}
