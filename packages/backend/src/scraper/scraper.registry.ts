import {
    Injectable,
    Inject,
    Optional
} from '@nestjs/common';
import type {BankScraper} from '#scraper/interfaces/bank-scraper.interface.js';
import type {ScraperInfoDto} from '#scraper/scraper-info.dto.js';

/** NestJS multi-provider injection token for BankScraper implementations. */
export const BANK_SCRAPER = 'BANK_SCRAPER';

/**
 * Registry that holds all registered BankScraper instances.
 * Scrapers are provided at module level using the BANK_SCRAPER multi-provider token.
 */
@Injectable()
export class ScraperRegistry {
    private readonly scraperMap: Map<string, {scraper: BankScraper, pluginPath: string}>;

    constructor(
        @Optional() @Inject(BANK_SCRAPER) scrapers: BankScraper[] | undefined
    ) {
        const list = scrapers ?? [];
        this.scraperMap = new Map(
            list.map(s => [s.bankId, {scraper: s, pluginPath: ''}])
        );
    }

    /** Returns the BankScraper for the given bankId, or undefined if not registered. */
    public findByBankId(bankId: string): BankScraper | undefined {
        return this.scraperMap.get(bankId)?.scraper;
    }

    /** Returns true if the bankId is registered. */
    public has(bankId: string): boolean {
        return this.scraperMap.has(bankId);
    }

    /** Returns all registered scrapers as serialisable info objects. */
    public listAll(): ScraperInfoDto[] {
        return Array.from(this.scraperMap.values()).map(({scraper: s}) => ({
            bankId: s.bankId,
            displayName: s.displayName,
            requiresMfaOnEveryRun: s.requiresMfaOnEveryRun,
            maxLookbackDays: s.maxLookbackDays,
            pendingTransactionsIncluded: s.pendingTransactionsIncluded,
            inputSchema: s.inputSchema
        }));
    }

    /**
     * Dynamically register a BankScraper instance.
     * Called by ScraperPluginLoader after loading external plugin files.
     * Overwrites any existing registration for the same bankId.
     * @param scraper - The BankScraper instance to register.
     * @param pluginPath - Absolute file:// URL of the compiled plugin. Defaults to '' for DI-injected scrapers.
     */
    public register(scraper: BankScraper, pluginPath = ''): void {
        this.scraperMap.set(scraper.bankId, {scraper, pluginPath});
    }

    /**
     * Returns the absolute file:// URL of the compiled plugin for the given bankId,
     * or undefined if the bankId is not registered or the plugin was registered via
     * NestJS DI (no file path available).
     */
    public getPluginPath(bankId: string): string | undefined {
        const entry = this.scraperMap.get(bankId);
        if (!entry?.pluginPath) return undefined;
        return entry.pluginPath;
    }
}
