import {describe, it, expect} from 'vitest';
import {validatePlugin, makeScrapeOptions, makeInputs} from '@finance-tracker/plugin-sdk/testing';
import plugin from './index.js';

describe('my-bank plugin', () => {
    it('satisfies the BankScraper contract', () => {
        expect(validatePlugin(plugin)).toBe(true);
    });

    it('scrapeTransactions returns an array', async () => {
        const result = await plugin.scrapeTransactions(makeInputs(), makeScrapeOptions());
        expect(Array.isArray(result)).toBe(true);
    });
});
