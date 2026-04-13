import {describe, it, expect} from 'vitest';
import {validatePlugin} from '@finance-tracker/plugin-sdk/testing';
import plugin from './index.js';

describe('td-bank-account plugin', () => {
    it('satisfies the BankScraper contract', () => {
        expect(validatePlugin(plugin)).toBe(true);
    });

    it('has the correct bankId', () => {
        expect(plugin.bankId).toBe('td-bank-account');
    });
});
