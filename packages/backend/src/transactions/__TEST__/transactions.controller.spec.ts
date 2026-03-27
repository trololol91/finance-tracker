import {
    describe,
    it,
    expect,
    beforeEach,
    vi
} from 'vitest';
import {
    NotFoundException,
    BadRequestException
} from '@nestjs/common';
import {
    TransactionsController,
    PaginatedTransactionsResponseDto
} from '#transactions/transactions.controller.js';
import type {TransactionsService} from '#transactions/transactions.service.js';
import type {
    PaginatedTransactions,
    TransactionTotals
} from '#transactions/transactions.service.js';
import type {
    Transaction,
    User
} from '#generated/prisma/client.js';
import {TransactionType} from '#generated/prisma/client.js';
import type {CreateTransactionDto} from '#transactions/dto/create-transaction.dto.js';
import type {UpdateTransactionDto} from '#transactions/dto/update-transaction.dto.js';
import type {TransactionFilterDto} from '#transactions/dto/transaction-filter.dto.js';
import type {GetTotalsQueryDto} from '#transactions/dto/get-totals-query.dto.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockDecimal = (value: number): {toNumber: () => number} => ({toNumber: () => value});

const makeTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
    id: 'txn-uuid-1',
    userId: 'user-uuid-1',
    amount: mockDecimal(42.50) as unknown as Transaction['amount'],
    description: 'Starbucks Coffee',
    notes: null,
    categoryId: null,
    accountId: null,
    transactionType: TransactionType.expense,
    date: new Date('2026-02-15T10:00:00.000Z'),
    originalDate: new Date('2026-02-15T10:00:00.000Z'),
    isActive: true,
    isPending: false,
    fitid: null,
    transferDirection: null,
    createdAt: new Date('2026-02-15T10:00:00.000Z'),
    updatedAt: new Date('2026-02-15T10:00:00.000Z'),
    ...overrides
});

const mockCurrentUser: User = {
    id: 'user-uuid-1',
    email: 'test@example.com',
    passwordHash: '$2b$10$hashed',
    firstName: 'Jane',
    lastName: 'Smith',
    emailVerified: true,
    isActive: true,
    deletedAt: null,
    timezone: 'UTC',
    currency: 'USD',
    role: 'USER',
    notifyEmail: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01')
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TransactionsController', () => {
    let controller: TransactionsController;
    let service: TransactionsService;

    beforeEach(() => {
        service = {
            create: vi.fn(),
            findAll: vi.fn(),
            findOne: vi.fn(),
            update: vi.fn(),
            toggleActive: vi.fn(),
            remove: vi.fn(),
            getTotals: vi.fn(),
            getMonthlyTotals: vi.fn(),
            categorizeSuggestion: vi.fn(),
            bulkCategorize: vi.fn()
        } as unknown as TransactionsService;

        controller = new TransactionsController(service);
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // create
    // -------------------------------------------------------------------------

    describe('create', () => {
        const createDto: CreateTransactionDto = {
            amount: 42.50,
            description: 'Starbucks Coffee',
            transactionType: TransactionType.expense,
            date: '2026-02-15T10:00:00.000Z'
        };

        it('should call service.create with userId and dto', async () => {
            vi.mocked(service.create).mockResolvedValue(makeTransaction());

            await controller.create(createDto, mockCurrentUser);

            expect(service.create).toHaveBeenCalledWith(mockCurrentUser.id, createDto);
        });

        it('should return a TransactionResponseDto with amount as number', async () => {
            vi.mocked(service.create).mockResolvedValue(makeTransaction());

            const result = await controller.create(createDto, mockCurrentUser);

            expect(result.amount).toBe(42.50);
            expect(typeof result.amount).toBe('number');
        });

        it('should include all expected response fields', async () => {
            const txn = makeTransaction();
            vi.mocked(service.create).mockResolvedValue(txn);

            const result = await controller.create(createDto, mockCurrentUser);

            expect(result.id).toBe(txn.id);
            expect(result.userId).toBe(txn.userId);
            expect(result.description).toBe(txn.description);
            expect(result.transactionType).toBe(TransactionType.expense);
            expect(result.isActive).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // findAll
    // -------------------------------------------------------------------------

    describe('findAll', () => {
        it('should call service.findAll with userId and filters', async () => {
            const paginated: PaginatedTransactions = {
                data: [], total: 0, page: 1, limit: 50
            };
            vi.mocked(service.findAll).mockResolvedValue(paginated);

            const filters: TransactionFilterDto = {isActive: 'true'};
            await controller.findAll(filters, mockCurrentUser);

            expect(service.findAll).toHaveBeenCalledWith(mockCurrentUser.id, filters);
        });

        it('should return paginated response with data mapped through fromEntity', async () => {
            const txn = makeTransaction();
            const paginated: PaginatedTransactions = {
                data: [txn], total: 1, page: 1, limit: 50
            };
            vi.mocked(service.findAll).mockResolvedValue(paginated);

            const result = await controller.findAll({}, mockCurrentUser);

            expect(result.total).toBe(1);
            expect(result.page).toBe(1);
            expect(result.limit).toBe(50);
            expect(result.data).toHaveLength(1);
            expect(result.data[0].amount).toBe(42.50);
        });

        it('should return empty data array when no transactions', async () => {
            vi.mocked(service.findAll).mockResolvedValue({data: [], total: 0, page: 1, limit: 50});

            const result = await controller.findAll({}, mockCurrentUser);

            expect(result.data).toEqual([]);
            expect(result.total).toBe(0);
        });

        it('should map all transactions through fromEntity', async () => {
            const txns = [
                makeTransaction({id: 'txn-1', amount: mockDecimal(10) as unknown as Transaction['amount']}),
                makeTransaction({id: 'txn-2', amount: mockDecimal(20) as unknown as Transaction['amount']}),
                makeTransaction({id: 'txn-3', amount: mockDecimal(30) as unknown as Transaction['amount']})
            ];
            vi.mocked(service.findAll).mockResolvedValue(
                {data: txns, total: 3, page: 1, limit: 50}
            );

            const result = await controller.findAll({}, mockCurrentUser);

            expect(result.data).toHaveLength(3);
            expect(result.data.map(t => t.amount)).toEqual([10, 20, 30]);
        });
    });

    // -------------------------------------------------------------------------
    // findOne
    // -------------------------------------------------------------------------

    describe('findOne', () => {
        it('should call service.findOne with userId and transactionId', async () => {
            vi.mocked(service.findOne).mockResolvedValue(makeTransaction());

            await controller.findOne('txn-uuid-1', mockCurrentUser);

            expect(service.findOne).toHaveBeenCalledWith(mockCurrentUser.id, 'txn-uuid-1');
        });

        it('should return TransactionResponseDto mapped from entity', async () => {
            const txn = makeTransaction({notes: 'team lunch'});
            vi.mocked(service.findOne).mockResolvedValue(txn);

            const result = await controller.findOne('txn-uuid-1', mockCurrentUser);

            expect(result.id).toBe(txn.id);
            expect(result.notes).toBe('team lunch');
            expect(result.amount).toBe(42.50);
        });

        it('should propagate NotFoundException when transaction is not found', async () => {
            vi.mocked(service.findOne).mockRejectedValue(
                new NotFoundException('Transaction not found')
            );

            await expect(
                controller.findOne('nonexistent-id', mockCurrentUser)
            ).rejects.toThrow(NotFoundException);
        });
    });

    // -------------------------------------------------------------------------
    // update
    // -------------------------------------------------------------------------

    describe('update', () => {
        it('should call service.update with userId, transactionId, and dto', async () => {
            const updateDto: UpdateTransactionDto = {description: 'Updated desc', isActive: false};
            vi.mocked(service.update).mockResolvedValue(makeTransaction({description: 'Updated desc', isActive: false}));

            await controller.update('txn-uuid-1', updateDto, mockCurrentUser);

            expect(service.update).toHaveBeenCalledWith(mockCurrentUser.id, 'txn-uuid-1', updateDto);
        });

        it('should return updated TransactionResponseDto', async () => {
            const updateDto: UpdateTransactionDto = {description: 'New description'};
            vi.mocked(service.update).mockResolvedValue(makeTransaction({description: 'New description'}));

            const result = await controller.update('txn-uuid-1', updateDto, mockCurrentUser);

            expect(result.description).toBe('New description');
        });

        it('should propagate NotFoundException when transaction is not found', async () => {
            vi.mocked(service.update).mockRejectedValue(
                new NotFoundException('Transaction not found')
            );

            await expect(
                controller.update('nonexistent-id', {description: 'x'}, mockCurrentUser)
            ).rejects.toThrow(NotFoundException);
        });
    });

    // -------------------------------------------------------------------------
    // toggleActive
    // -------------------------------------------------------------------------

    describe('toggleActive', () => {
        it('should call service.toggleActive with userId and transactionId', async () => {
            vi.mocked(service.toggleActive).mockResolvedValue(makeTransaction({isActive: false}));

            await controller.toggleActive('txn-uuid-1', mockCurrentUser);

            expect(service.toggleActive).toHaveBeenCalledWith(mockCurrentUser.id, 'txn-uuid-1');
        });

        it('should return TransactionResponseDto with toggled isActive', async () => {
            vi.mocked(service.toggleActive).mockResolvedValue(makeTransaction({isActive: false}));

            const result = await controller.toggleActive('txn-uuid-1', mockCurrentUser);

            expect(result.isActive).toBe(false);
        });

        it('should propagate NotFoundException when transaction is not found', async () => {
            vi.mocked(service.toggleActive).mockRejectedValue(
                new NotFoundException('Transaction not found')
            );

            await expect(
                controller.toggleActive('nonexistent-id', mockCurrentUser)
            ).rejects.toThrow(NotFoundException);
        });
    });

    // -------------------------------------------------------------------------
    // remove
    // -------------------------------------------------------------------------

    describe('remove', () => {
        it('should call service.remove with userId and transactionId', async () => {
            vi.mocked(service.remove).mockResolvedValue(undefined);

            await controller.remove('txn-uuid-1', mockCurrentUser);

            expect(service.remove).toHaveBeenCalledWith(mockCurrentUser.id, 'txn-uuid-1');
        });

        it('should return void', async () => {
            vi.mocked(service.remove).mockResolvedValue(undefined);

            await expect(controller.remove('txn-uuid-1', mockCurrentUser)).resolves.toBeUndefined();
        });

        it('should propagate NotFoundException when transaction is not found', async () => {
            vi.mocked(service.remove).mockRejectedValue(
                new NotFoundException('Transaction not found')
            );

            await expect(
                controller.remove('nonexistent-id', mockCurrentUser)
            ).rejects.toThrow(NotFoundException);
        });
    });

    // -------------------------------------------------------------------------
    // getTotals
    // -------------------------------------------------------------------------

    describe('getTotals', () => {
        const startDate = '2026-01-01T00:00:00.000Z';
        const endDate = '2026-01-31T23:59:59.999Z';
        const baseQuery = {startDate, endDate} as GetTotalsQueryDto;

        it('should call service.getTotals with userId, startDate, endDate and no filters', async () => {
            const totals: TransactionTotals = {
                totalIncome: 3000, totalExpense: 1200, netTotal: 1800, startDate, endDate
            };
            vi.mocked(service.getTotals).mockResolvedValue(totals);

            await controller.getTotals(baseQuery, mockCurrentUser);

            expect(service.getTotals).toHaveBeenCalledWith(
                mockCurrentUser.id, startDate, endDate,
                {
                    accountId: undefined,
                    categoryId: undefined,
                    transactionType: undefined,
                    search: undefined
                }
            );
        });

        it('should forward optional filters to service.getTotals', async () => {
            const totals: TransactionTotals = {
                totalIncome: 500, totalExpense: 0, netTotal: 500, startDate, endDate
            };
            vi.mocked(service.getTotals).mockResolvedValue(totals);
            const query = {
                ...baseQuery,
                accountId: 'acc-1',
                categoryId: 'cat-1',
                transactionType: TransactionType.income,
                search: 'coffee'
            } as GetTotalsQueryDto;

            await controller.getTotals(query, mockCurrentUser);

            expect(service.getTotals).toHaveBeenCalledWith(
                mockCurrentUser.id, startDate, endDate,
                {
                    accountId: 'acc-1',
                    categoryId: 'cat-1',
                    transactionType: TransactionType.income,
                    search: 'coffee'
                }
            );
        });

        it('should return totals directly from service', async () => {
            const totals: TransactionTotals = {
                totalIncome: 3000, totalExpense: 1200, netTotal: 1800, startDate, endDate
            };
            vi.mocked(service.getTotals).mockResolvedValue(totals);

            const result = await controller.getTotals(baseQuery, mockCurrentUser);

            expect(result.totalIncome).toBe(3000);
            expect(result.totalExpense).toBe(1200);
            expect(result.netTotal).toBe(1800);
            expect(result.startDate).toBe(startDate);
            expect(result.endDate).toBe(endDate);
        });

        it('should propagate BadRequestException for an invalid startDate', async () => {
            vi.mocked(service.getTotals).mockRejectedValue(
                new BadRequestException('Invalid startDate: "not-a-date"')
            );

            await expect(
                controller.getTotals({startDate: 'not-a-date', endDate} as GetTotalsQueryDto, mockCurrentUser)
            ).rejects.toThrow(BadRequestException);
        });

        it('should propagate BadRequestException for an invalid endDate', async () => {
            vi.mocked(service.getTotals).mockRejectedValue(
                new BadRequestException('Invalid endDate: "not-a-date"')
            );

            await expect(
                controller.getTotals({startDate, endDate: 'not-a-date'} as GetTotalsQueryDto, mockCurrentUser)
            ).rejects.toThrow(BadRequestException);
        });
    });

    // -------------------------------------------------------------------------
    // getMonthlyTotals
    // -------------------------------------------------------------------------

    describe('getMonthlyTotals', () => {
        it('should call service.getMonthlyTotals with userId, year, month', async () => {
            const totals: TransactionTotals = {
                totalIncome: 500, totalExpense: 200, netTotal: 300,
                startDate: '2026-02-01T00:00:00.000Z',
                endDate: '2026-02-28T23:59:59.999Z'
            };
            vi.mocked(service.getMonthlyTotals).mockResolvedValue(totals);

            await controller.getMonthlyTotals(2026, 2, mockCurrentUser);

            expect(service.getMonthlyTotals).toHaveBeenCalledWith(mockCurrentUser.id, 2026, 2);
        });

        it('should return monthly totals directly from service', async () => {
            const totals: TransactionTotals = {
                totalIncome: 500, totalExpense: 200, netTotal: 300,
                startDate: '2026-02-01T00:00:00.000Z',
                endDate: '2026-02-28T23:59:59.999Z'
            };
            vi.mocked(service.getMonthlyTotals).mockResolvedValue(totals);

            const result = await controller.getMonthlyTotals(2026, 2, mockCurrentUser);

            expect(result.totalIncome).toBe(500);
            expect(result.totalExpense).toBe(200);
            expect(result.netTotal).toBe(300);
        });

        it('should propagate BadRequestException for an out-of-range month', async () => {
            vi.mocked(service.getMonthlyTotals).mockRejectedValue(
                new BadRequestException('Month must be between 1 and 12')
            );

            await expect(
                controller.getMonthlyTotals(2026, 13, mockCurrentUser)
            ).rejects.toThrow(BadRequestException);
        });

        it('should propagate BadRequestException for an out-of-range year', async () => {
            vi.mocked(service.getMonthlyTotals).mockRejectedValue(
                new BadRequestException('Year must be between 1 and 9999')
            );

            await expect(
                controller.getMonthlyTotals(0, 6, mockCurrentUser)
            ).rejects.toThrow(BadRequestException);
        });
    });

    // -------------------------------------------------------------------------
    // PaginatedTransactionsResponseDto shape
    // -------------------------------------------------------------------------

    describe('PaginatedTransactionsResponseDto', () => {
        it('can be constructed and assigned properties', () => {
            const dto = new PaginatedTransactionsResponseDto();
            dto.data = [];
            dto.total = 0;
            dto.page = 1;
            dto.limit = 50;

            expect(dto.data).toEqual([]);
            expect(dto.total).toBe(0);
            expect(dto.page).toBe(1);
            expect(dto.limit).toBe(50);
        });
    });
});
