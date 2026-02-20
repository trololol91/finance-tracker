import {
    describe,
    it,
    expect,
    beforeEach
} from 'vitest';
import {TransactionsService} from '#transactions/transactions.service.js';

describe('TransactionsService', () => {
    let service: TransactionsService;

    beforeEach(() => {
        service = new TransactionsService();
    });

    describe('getAll', () => {
        it('should return a string message', () => {
            const result = service.getAll();
            expect(result).toBe('List of all transactions');
            expect(typeof result).toBe('string');
        });

        it('should be defined', () => {
            expect(service.getAll).toBeDefined();
        });
    });
});
