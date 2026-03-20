import type {
    BankScraper,
    PluginInputs,
    ScrapeOptions
} from './bank-scraper.interface.js';

/**
 * Runtime type guard — returns true only when the value satisfies every field
 * of the BankScraper interface. Used by the plugin loader to validate dynamic
 * plugin exports at runtime, and by plugin tests via validatePlugin().
 */
export const validatePlugin = (value: unknown): value is BankScraper => {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const v = value as Record<string, unknown>;
    return (
        typeof v.bankId === 'string' &&
        typeof v.displayName === 'string' &&
        typeof v.requiresMfaOnEveryRun === 'boolean' &&
        typeof v.maxLookbackDays === 'number' &&
        typeof v.pendingTransactionsIncluded === 'boolean' &&
        Array.isArray(v.inputSchema) &&
        typeof v.login === 'function' &&
        typeof v.scrapeTransactions === 'function'
    );
};

/** Returns a ScrapeOptions fixture for plugin unit tests. */
export const makeScrapeOptions = (overrides?: Partial<ScrapeOptions>): ScrapeOptions => ({
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-01-31'),
    includePending: false,
    ...overrides
});

/** Returns a PluginInputs map for plugin unit tests. */
export const makeInputs = (overrides?: PluginInputs): PluginInputs => ({
    username: 'test-user',
    password: 'test-pass',
    ...overrides
});
