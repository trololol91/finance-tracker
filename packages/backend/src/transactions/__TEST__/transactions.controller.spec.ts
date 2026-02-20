import {
    describe,
    it,
    expect,
    beforeEach,
    vi
} from 'vitest';
import {TransactionsController} from '#transactions/transactions.controller.js';
import type {TransactionsService} from '#transactions/transactions.service.js';

describe('TransactionsController', () => {
    let controller: TransactionsController;
    let service: TransactionsService;

    beforeEach(() => {
        service = {
            getAll: vi.fn()
        } as unknown as TransactionsService;

        controller = new TransactionsController(service);
        vi.clearAllMocks();
    });

    describe('getAll', () => {
        it('should return a string from service', () => {
            const result = 'List of all transactions';
            vi.mocked(service.getAll).mockReturnValue(result);

            const actual = controller.getAll();
            
            expect(actual).toBe(result);
            expect(service.getAll).toHaveBeenCalled();
        });

        it('should call service.getAll method', () => {
            vi.mocked(service.getAll).mockReturnValue('List of all transactions');
            
            controller.getAll();

            expect(service.getAll).toHaveBeenCalledTimes(1);
        });
    });

    describe('definition', () => {
        it('should be defined', () => {
            expect(controller).toBeDefined();
        });

        it('should have getAll method', () => {
            expect(controller.getAll).toBeDefined();
            expect(typeof controller.getAll).toBe('function');
        });
    });
});
