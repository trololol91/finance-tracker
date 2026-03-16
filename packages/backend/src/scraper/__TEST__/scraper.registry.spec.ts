import {
    describe,
    it,
    expect
} from 'vitest';
import {ScraperRegistry} from '#scraper/scraper.registry.js';
import type {BankScraper} from '#scraper/interfaces/bank-scraper.interface.js';

const makeScraper = (bankId: string): BankScraper => ({
    bankId,
    displayName: `${bankId} Bank`,
    requiresMfaOnEveryRun: false,
    maxLookbackDays: 90,
    pendingTransactionsIncluded: true,
    inputSchema: [],
    login: (): Promise<void> => Promise.resolve(),
    scrapeTransactions: (): Promise<never[]> => Promise.resolve([])
});

describe('ScraperRegistry', () => {
    it('should initialise an empty registry when no scrapers are provided', () => {
        const registry = new ScraperRegistry(undefined);

        expect(registry.listAll()).toHaveLength(0);
        expect(registry.has('cibc')).toBe(false);
        expect(registry.findByBankId('cibc')).toBeUndefined();
    });

    it('should initialise with an empty array', () => {
        const registry = new ScraperRegistry([]);

        expect(registry.listAll()).toHaveLength(0);
    });

    it('should register provided scrapers and find them by bankId', () => {
        const cibc = makeScraper('cibc');
        const td = makeScraper('td');
        const registry = new ScraperRegistry([cibc, td]);

        expect(registry.has('cibc')).toBe(true);
        expect(registry.has('td')).toBe(true);
        expect(registry.has('rbc')).toBe(false);
        expect(registry.findByBankId('cibc')).toBe(cibc);
        expect(registry.findByBankId('td')).toBe(td);
        expect(registry.findByBankId('rbc')).toBeUndefined();
    });

    it('should return serialisable ScraperInfo objects from listAll()', () => {
        const scraper = makeScraper('cibc');
        const registry = new ScraperRegistry([scraper]);
        const list = registry.listAll();

        expect(list).toHaveLength(1);
        expect(list[0]).toEqual({
            bankId: 'cibc',
            displayName: 'cibc Bank',
            requiresMfaOnEveryRun: false,
            maxLookbackDays: 90,
            pendingTransactionsIncluded: true,
            inputSchema: []
        });
    });

    it('listAll() passes through non-empty inputSchema from the plugin', () => {
        const scraper: BankScraper = {
            ...makeScraper('rbc'),
            inputSchema: [
                {
                    key: 'username',
                    label: 'Username',
                    type: 'text',
                    required: true,
                    hint: 'Your online banking username'
                },
                {
                    key: 'password',
                    label: 'Password',
                    type: 'password',
                    required: true
                }
            ]
        };
        const registry = new ScraperRegistry([scraper]);
        const list = registry.listAll();

        expect(list).toHaveLength(1);
        expect(list[0].inputSchema).toHaveLength(2);
        expect(list[0].inputSchema[0]).toEqual({
            key: 'username',
            label: 'Username',
            type: 'text',
            required: true,
            hint: 'Your online banking username'
        });
        expect(list[0].inputSchema[1]).toEqual({
            key: 'password',
            label: 'Password',
            type: 'password',
            required: true
        });
    });

    it('should handle multiple scrapers in listAll()', () => {
        const scrapers = ['cibc', 'td', 'rbc'].map(makeScraper);
        const registry = new ScraperRegistry(scrapers);

        expect(registry.listAll()).toHaveLength(3);
    });
});

describe('ScraperRegistry.register', () => {
    it('should make a dynamically registered scraper findable by bankId', () => {
        const registry = new ScraperRegistry([]);
        const rbc = makeScraper('rbc');

        registry.register(rbc);

        expect(registry.has('rbc')).toBe(true);
        expect(registry.findByBankId('rbc')).toBe(rbc);
    });

    it('should include dynamically registered scrapers in listAll()', () => {
        const registry = new ScraperRegistry([makeScraper('cibc')]);
        registry.register(makeScraper('rbc'));

        expect(registry.listAll()).toHaveLength(2);
    });

    it('should overwrite an existing scraper when registering the same bankId', () => {
        const original = makeScraper('cibc');
        const replacement = makeScraper('cibc');
        const registry = new ScraperRegistry([original]);

        registry.register(replacement);

        expect(registry.findByBankId('cibc')).toBe(replacement);
        expect(registry.findByBankId('cibc')).not.toBe(original);
    });
});
