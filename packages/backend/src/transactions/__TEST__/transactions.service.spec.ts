import {
    describe,
    it,
    expect,
    beforeEach,
    vi
} from 'vitest';
import {
    NotFoundException,
    BadRequestException,
    ServiceUnavailableException
} from '@nestjs/common';
import {TransactionsService} from '#transactions/transactions.service.js';
import type {PrismaService} from '#database/prisma.service.js';
import type {Transaction} from '#generated/prisma/client.js';
import {
    TransactionType, TransferDirection
} from '#generated/prisma/client.js';
import type {CreateTransactionDto} from '#transactions/dto/create-transaction.dto.js';
import type {UpdateTransactionDto} from '#transactions/dto/update-transaction.dto.js';
import type {TransactionFilterDto} from '#transactions/dto/transaction-filter.dto.js';
import type {CategoriesService} from '#categories/categories.service.js';
import type {AiCategorizationService} from '#ai-categorization/ai-categorization.service.js';
import type {CategoryRulesService} from '#category-rules/category-rules.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a minimal Prisma Decimal-like mock whose .toNumber() returns value.
 */
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TransactionsService', () => {
    let service: TransactionsService;
    let prisma: PrismaService;
    let categoriesService: CategoriesService;
    let aiCategorizationService: AiCategorizationService;

    const userId = 'user-uuid-1';
    const txnId = 'txn-uuid-1';
    /** A transaction ID that does not exist in the mock store — tests not-found paths. */
    const nonExistentTxnId = 'txn-uuid-nonexistent';

    beforeEach(() => {
        prisma = {
            transaction: {
                create: vi.fn(),
                findMany: vi.fn(),
                count: vi.fn(),
                findFirst: vi.fn(),
                update: vi.fn(),
                delete: vi.fn(),
                aggregate: vi.fn()
            },
            $transaction: vi.fn().mockResolvedValue([])
        } as unknown as PrismaService;

        categoriesService =
            {findAll: vi.fn().mockResolvedValue([])} as unknown as CategoriesService;
        aiCategorizationService =
            {
                available: true,
                suggestCategory: vi.fn().mockResolvedValue('Other'),
                suggestCategories: vi.fn().mockResolvedValue(new Map())
            } as unknown as AiCategorizationService;

        const categoryRulesService = {
            buildMatcher: vi.fn().mockResolvedValue(() => null)
        } as unknown as CategoryRulesService;
        service = new TransactionsService(
            prisma, categoriesService, aiCategorizationService, categoryRulesService
        );
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // create
    // -------------------------------------------------------------------------

    describe('create', () => {
        const dto: CreateTransactionDto = {
            amount: 42.50,
            description: 'Starbucks Coffee',
            transactionType: TransactionType.expense,
            date: '2026-02-15T10:00:00.000Z'
        };

        it('should create a transaction and pass correct data to Prisma', async () => {
            const mockTxn = makeTransaction();
            vi.mocked(prisma.transaction.create).mockResolvedValue(mockTxn);

            const result = await service.create(userId, dto);

            expect(prisma.transaction.create).toHaveBeenCalledWith({
                data: {
                    userId,
                    amount: dto.amount,
                    description: dto.description,
                    notes: null,
                    categoryId: null,
                    accountId: null,
                    transactionType: dto.transactionType,
                    transferDirection: null,
                    date: new Date(dto.date),
                    originalDate: new Date(dto.date),
                    isActive: true
                }
            });
            expect(result).toEqual(mockTxn);
        });

        it('should set originalDate equal to date', async () => {
            vi.mocked(prisma.transaction.create).mockResolvedValue(makeTransaction());

            await service.create(userId, dto);

            const callArg = vi.mocked(prisma.transaction.create).mock.calls[0][0];
            expect(callArg.data.date).toEqual(callArg.data.originalDate);
        });

        it('should default isActive to true', async () => {
            vi.mocked(prisma.transaction.create).mockResolvedValue(makeTransaction());

            await service.create(userId, dto);

            const callArg = vi.mocked(prisma.transaction.create).mock.calls[0][0];
            expect(callArg.data.isActive).toBe(true);
        });

        it('should pass optional notes, categoryId, accountId when provided', async () => {
            const dtoWithOptionals: CreateTransactionDto = {
                ...dto,
                notes: 'Team outing',
                categoryId: 'cat-uuid',
                accountId: 'acc-uuid'
            };
            vi.mocked(prisma.transaction.create).mockResolvedValue(makeTransaction());

            await service.create(userId, dtoWithOptionals);

            expect(prisma.transaction.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    notes: 'Team outing',
                    categoryId: 'cat-uuid',
                    accountId: 'acc-uuid'
                })
            });
        });

        it('should set notes/categoryId/accountId to null when omitted', async () => {
            vi.mocked(prisma.transaction.create).mockResolvedValue(makeTransaction());

            await service.create(userId, dto);

            expect(prisma.transaction.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    notes: null,
                    categoryId: null,
                    accountId: null
                })
            });
        });
    });

    // -------------------------------------------------------------------------
    // findAll
    // -------------------------------------------------------------------------

    describe('findAll', () => {
        it('should return paginated results with defaults', async () => {
            const mockTxns = [makeTransaction()];
            vi.mocked(prisma.transaction.findMany).mockResolvedValue(mockTxns);
            vi.mocked(prisma.transaction.count).mockResolvedValue(1);

            const filters: TransactionFilterDto = {};
            const result = await service.findAll(userId, filters);

            expect(result).toEqual({data: mockTxns, total: 1, page: 1, limit: 50});
        });

        it('should default to isActive=true filter', async () => {
            vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
            vi.mocked(prisma.transaction.count).mockResolvedValue(0);

            await service.findAll(userId, {});

            expect(prisma.transaction.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({isActive: true})
                })
            );
        });

        it('should filter by isActive=false when specified', async () => {
            vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
            vi.mocked(prisma.transaction.count).mockResolvedValue(0);

            await service.findAll(userId, {isActive: 'false'});

            expect(prisma.transaction.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({isActive: false})
                })
            );
        });

        it('should omit isActive filter when isActive=all', async () => {
            vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
            vi.mocked(prisma.transaction.count).mockResolvedValue(0);

            await service.findAll(userId, {isActive: 'all'});

            expect(prisma.transaction.findMany).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({isActive: expect.anything()})
                })
            );
        });

        it('should apply date range filter', async () => {
            vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
            vi.mocked(prisma.transaction.count).mockResolvedValue(0);

            await service.findAll(userId, {
                startDate: '2026-01-01T00:00:00.000Z',
                endDate: '2026-01-31T23:59:59.999Z'
            });

            expect(prisma.transaction.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        date: {
                            gte: new Date('2026-01-01T00:00:00.000Z'),
                            lte: new Date('2026-01-31T23:59:59.999Z')
                        }
                    })
                })
            );
        });

        it('should apply transactionType filter', async () => {
            vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
            vi.mocked(prisma.transaction.count).mockResolvedValue(0);

            await service.findAll(userId, {transactionType: [TransactionType.income]});

            expect(prisma.transaction.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        transactionType: {in: [TransactionType.income]}
                    })
                })
            );
        });

        it('should apply multiple transactionType values as an in filter', async () => {
            vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
            vi.mocked(prisma.transaction.count).mockResolvedValue(0);

            await service.findAll(userId, {
                transactionType: [TransactionType.income, TransactionType.expense]
            });

            expect(prisma.transaction.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        transactionType: {in: [TransactionType.income, TransactionType.expense]}
                    })
                })
            );
        });

        it('should apply categoryId filter', async () => {
            vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
            vi.mocked(prisma.transaction.count).mockResolvedValue(0);

            await service.findAll(userId, {categoryId: ['cat-uuid']});

            expect(prisma.transaction.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({categoryId: {in: ['cat-uuid']}})
                })
            );
        });

        it('should apply multiple categoryId values as an in filter', async () => {
            vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
            vi.mocked(prisma.transaction.count).mockResolvedValue(0);

            await service.findAll(userId, {categoryId: ['cat-uuid-1', 'cat-uuid-2']});

            expect(prisma.transaction.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({categoryId: {in: ['cat-uuid-1', 'cat-uuid-2']}})
                })
            );
        });

        it('should apply accountId filter', async () => {
            vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
            vi.mocked(prisma.transaction.count).mockResolvedValue(0);

            await service.findAll(userId, {accountId: ['acc-uuid']});

            expect(prisma.transaction.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({accountId: {in: ['acc-uuid']}})
                })
            );
        });

        it('should apply multiple accountId values as an in filter', async () => {
            vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
            vi.mocked(prisma.transaction.count).mockResolvedValue(0);

            await service.findAll(userId, {accountId: ['acc-uuid-1', 'acc-uuid-2']});

            expect(prisma.transaction.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({accountId: {in: ['acc-uuid-1', 'acc-uuid-2']}})
                })
            );
        });

        it('should apply transactionType, categoryId, and accountId simultaneously', async () => {
            vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
            vi.mocked(prisma.transaction.count).mockResolvedValue(0);

            await service.findAll(userId, {
                transactionType: [TransactionType.income, TransactionType.expense],
                categoryId: ['cat-uuid-1', 'cat-uuid-2'],
                accountId: ['acc-uuid-1', 'acc-uuid-2']
            });

            expect(prisma.transaction.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        transactionType: {in: [TransactionType.income, TransactionType.expense]},
                        categoryId: {in: ['cat-uuid-1', 'cat-uuid-2']},
                        accountId: {in: ['acc-uuid-1', 'acc-uuid-2']}
                    })
                })
            );
        });

        it('should apply only startDate (no endDate) as gte filter', async () => {
            vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
            vi.mocked(prisma.transaction.count).mockResolvedValue(0);

            await service.findAll(userId, {startDate: '2026-03-01T00:00:00.000Z'});

            expect(prisma.transaction.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        date: {gte: new Date('2026-03-01T00:00:00.000Z')}
                    })
                })
            );
        });

        it('should apply only endDate (no startDate) as lte filter', async () => {
            vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
            vi.mocked(prisma.transaction.count).mockResolvedValue(0);

            await service.findAll(userId, {endDate: '2026-03-31T23:59:59.999Z'});

            expect(prisma.transaction.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        date: {lte: new Date('2026-03-31T23:59:59.999Z')}
                    })
                })
            );
        });

        it('should apply case-insensitive search filter on description', async () => {
            vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
            vi.mocked(prisma.transaction.count).mockResolvedValue(0);

            await service.findAll(userId, {search: 'Starbucks'});

            expect(prisma.transaction.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        description: {contains: 'Starbucks', mode: 'insensitive'}
                    })
                })
            );
        });

        it('should calculate correct skip for page 2', async () => {
            vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
            vi.mocked(prisma.transaction.count).mockResolvedValue(100);

            await service.findAll(userId, {page: 2, limit: 25});

            expect(prisma.transaction.findMany).toHaveBeenCalledWith(
                expect.objectContaining({skip: 25, take: 25})
            );
            expect(await service.findAll(userId, {page: 2, limit: 25})).toMatchObject({
                page: 2,
                limit: 25
            });
        });

        it('should always scope to the given userId', async () => {
            vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
            vi.mocked(prisma.transaction.count).mockResolvedValue(0);

            await service.findAll(userId, {});

            expect(prisma.transaction.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({userId})
                })
            );
        });

        it('should order results by date descending', async () => {
            vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
            vi.mocked(prisma.transaction.count).mockResolvedValue(0);

            await service.findAll(userId, {});

            expect(prisma.transaction.findMany).toHaveBeenCalledWith(
                expect.objectContaining({orderBy: {date: 'desc'}})
            );
        });
    });

    // -------------------------------------------------------------------------
    // findOne
    // -------------------------------------------------------------------------

    describe('findOne', () => {
        it('should return the transaction when found', async () => {
            const mockTxn = makeTransaction();
            vi.mocked(prisma.transaction.findFirst).mockResolvedValue(mockTxn);

            const result = await service.findOne(userId, txnId);

            expect(prisma.transaction.findFirst).toHaveBeenCalledWith({
                where: {id: txnId, userId}
            });
            expect(result).toEqual(mockTxn);
        });

        it('should throw NotFoundException when transaction not found', async () => {
            vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null);

            await expect(service.findOne(userId, txnId))
                .rejects
                .toThrow(NotFoundException);
            await expect(service.findOne(userId, txnId))
                .rejects
                .toThrow(`Transaction with ID ${txnId} not found`);
        });

        it('should throw NotFoundException for another user\'s transaction', async () => {
            // findFirst returns null because userId doesn't match
            vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null);

            await expect(service.findOne('other-user-id', txnId))
                .rejects
                .toThrow(NotFoundException);
        });

        it('should scope the query with both id and userId', async () => {
            vi.mocked(prisma.transaction.findFirst).mockResolvedValue(makeTransaction());

            await service.findOne(userId, txnId);

            expect(prisma.transaction.findFirst).toHaveBeenCalledWith({
                where: {id: txnId, userId}
            });
        });
    });

    // -------------------------------------------------------------------------
    // update
    // -------------------------------------------------------------------------

    describe('update', () => {
        it('should update only the provided fields', async () => {
            const existing = makeTransaction();
            const updated = makeTransaction({description: 'Updated desc'});
            vi.mocked(prisma.transaction.findFirst).mockResolvedValue(existing);
            vi.mocked(prisma.transaction.update).mockResolvedValue(updated);

            const dto: UpdateTransactionDto = {description: 'Updated desc'};
            const result = await service.update(userId, txnId, dto);

            expect(prisma.transaction.update).toHaveBeenCalledWith({
                where: {id: txnId},
                data: {description: 'Updated desc'}
            });
            expect(result).toEqual(updated);
        });

        it('should not include originalDate in the update', async () => {
            vi.mocked(prisma.transaction.findFirst).mockResolvedValue(makeTransaction());
            vi.mocked(prisma.transaction.update).mockResolvedValue(makeTransaction());

            await service.update(userId, txnId, {date: '2026-03-01T00:00:00.000Z'});

            const callData = vi.mocked(prisma.transaction.update).mock.calls[0][0].data;
            expect(callData).not.toHaveProperty('originalDate');
        });

        it('should convert date string to Date object', async () => {
            vi.mocked(prisma.transaction.findFirst).mockResolvedValue(makeTransaction());
            vi.mocked(prisma.transaction.update).mockResolvedValue(makeTransaction());

            await service.update(userId, txnId, {date: '2026-03-01T00:00:00.000Z'});

            expect(prisma.transaction.update).toHaveBeenCalledWith({
                where: {id: txnId},
                data: {date: new Date('2026-03-01T00:00:00.000Z')}
            });
        });

        it('should throw NotFoundException if transaction does not exist', async () => {
            vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null);

            await expect(service.update(userId, nonExistentTxnId, {description: 'x'}))
                .rejects
                .toThrow(NotFoundException);
        });

        it('should not include undefined fields in the update data', async () => {
            vi.mocked(prisma.transaction.findFirst).mockResolvedValue(makeTransaction());
            vi.mocked(prisma.transaction.update).mockResolvedValue(makeTransaction());

            await service.update(userId, txnId, {amount: 99.99});

            const callData = vi.mocked(prisma.transaction.update).mock.calls[0][0].data;
            expect(Object.keys(callData)).toEqual(['amount']);
        });

        it('should include categoryId in update data when provided', async () => {
            vi.mocked(prisma.transaction.findFirst).mockResolvedValue(makeTransaction());
            vi.mocked(prisma.transaction.update).mockResolvedValue(
                makeTransaction({categoryId: 'cat-uuid'})
            );

            await service.update(userId, txnId, {categoryId: 'cat-uuid'});

            const callData = vi.mocked(prisma.transaction.update).mock.calls[0][0].data;
            expect(callData).toHaveProperty('categoryId', 'cat-uuid');
        });

        it('should include accountId in update data when provided', async () => {
            vi.mocked(prisma.transaction.findFirst).mockResolvedValue(makeTransaction());
            vi.mocked(prisma.transaction.update).mockResolvedValue(
                makeTransaction({accountId: 'acc-uuid'})
            );

            await service.update(userId, txnId, {accountId: 'acc-uuid'});

            const callData = vi.mocked(prisma.transaction.update).mock.calls[0][0].data;
            expect(callData).toHaveProperty('accountId', 'acc-uuid');
        });

        it('should include isActive when flipping to false via update', async () => {
            vi.mocked(prisma.transaction.findFirst).mockResolvedValue(makeTransaction());
            vi.mocked(prisma.transaction.update).mockResolvedValue(
                makeTransaction({isActive: false})
            );

            await service.update(userId, txnId, {isActive: false});

            const callData = vi.mocked(prisma.transaction.update).mock.calls[0][0].data;
            expect(callData).toHaveProperty('isActive', false);
        });

        it('should update multiple optional fields simultaneously', async () => {
            vi.mocked(prisma.transaction.findFirst).mockResolvedValue(makeTransaction());
            vi.mocked(prisma.transaction.update).mockResolvedValue(makeTransaction());

            await service.update(userId, txnId, {
                categoryId: 'cat-uuid',
                accountId: 'acc-uuid',
                notes: 'updated notes'
            });

            const callData = vi.mocked(prisma.transaction.update).mock.calls[0][0].data;
            expect(callData).toMatchObject({
                categoryId: 'cat-uuid',
                accountId: 'acc-uuid',
                notes: 'updated notes'
            });
        });

        it('should throw BadRequestException when transactionType is transfer but transferDirection is undefined', async () => {
            await expect(
                service.update(userId, txnId, {transactionType: TransactionType.transfer})
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException when transactionType is transfer but transferDirection is null', async () => {
            await expect(
                service.update(userId, txnId, {
                    transactionType: TransactionType.transfer,
                    transferDirection: null
                })
            ).rejects.toThrow(BadRequestException);
        });

        it('should allow update when transactionType is transfer and transferDirection is provided', async () => {
            vi.mocked(prisma.transaction.findFirst).mockResolvedValue(makeTransaction());
            vi.mocked(prisma.transaction.update).mockResolvedValue(makeTransaction());

            await service.update(userId, txnId, {
                transactionType: TransactionType.transfer,
                transferDirection: TransferDirection.in
            });

            expect(prisma.transaction.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        transactionType: TransactionType.transfer,
                        transferDirection: TransferDirection.in
                    })
                })
            );
        });
    });

    // -------------------------------------------------------------------------
    // toggleActive
    // -------------------------------------------------------------------------

    describe('toggleActive', () => {
        it('should set isActive to false when currently true', async () => {
            const activeTxn = makeTransaction({isActive: true});
            vi.mocked(prisma.transaction.findFirst).mockResolvedValue(activeTxn);
            vi.mocked(prisma.transaction.update).mockResolvedValue(
                makeTransaction({isActive: false})
            );

            const result = await service.toggleActive(userId, txnId);

            expect(prisma.transaction.update).toHaveBeenCalledWith({
                where: {id: txnId},
                data: {isActive: false}
            });
            expect(result.isActive).toBe(false);
        });

        it('should set isActive to true when currently false', async () => {
            const inactiveTxn = makeTransaction({isActive: false});
            vi.mocked(prisma.transaction.findFirst).mockResolvedValue(inactiveTxn);
            vi.mocked(prisma.transaction.update).mockResolvedValue(
                makeTransaction({isActive: true})
            );

            const result = await service.toggleActive(userId, txnId);

            expect(prisma.transaction.update).toHaveBeenCalledWith({
                where: {id: txnId},
                data: {isActive: true}
            });
            expect(result.isActive).toBe(true);
        });

        it('should throw NotFoundException if transaction not found', async () => {
            vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null);

            await expect(service.toggleActive(userId, txnId))
                .rejects
                .toThrow(NotFoundException);
        });
    });

    // -------------------------------------------------------------------------
    // remove
    // -------------------------------------------------------------------------

    describe('remove', () => {
        it('should delete the transaction permanently', async () => {
            vi.mocked(prisma.transaction.findFirst).mockResolvedValue(makeTransaction());
            vi.mocked(prisma.transaction.delete).mockResolvedValue(makeTransaction());

            await service.remove(userId, txnId);

            expect(prisma.transaction.delete).toHaveBeenCalledWith({
                where: {id: txnId}
            });
        });

        it('should return void on success', async () => {
            vi.mocked(prisma.transaction.findFirst).mockResolvedValue(makeTransaction());
            vi.mocked(prisma.transaction.delete).mockResolvedValue(makeTransaction());

            await expect(service.remove(userId, txnId)).resolves.toBeUndefined();
        });

        it('should throw NotFoundException if transaction not found', async () => {
            vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null);

            await expect(service.remove(userId, txnId))
                .rejects
                .toThrow(NotFoundException);

            expect(prisma.transaction.delete).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // getTotals
    // -------------------------------------------------------------------------

    describe('getTotals', () => {
        const startDate = '2026-01-01T00:00:00.000Z';
        const endDate = '2026-01-31T23:59:59.999Z';

        it('should return correct income, expense, and net totals', async () => {
            vi.mocked(prisma.transaction.aggregate)
                .mockResolvedValueOnce({_sum: {amount: mockDecimal(3000)}} as never)
                .mockResolvedValueOnce({_sum: {amount: mockDecimal(1200.50)}} as never);

            const result = await service.getTotals(userId, startDate, endDate);

            expect(result.totalIncome).toBe(3000);
            expect(result.totalExpense).toBe(1200.50);
            expect(result.netTotal).toBe(1799.50);
            expect(result.startDate).toBe(startDate);
            expect(result.endDate).toBe(endDate);
        });

        it('should return 0 totals when no transactions exist', async () => {
            vi.mocked(prisma.transaction.aggregate)
                .mockResolvedValueOnce({_sum: {amount: null}} as never)
                .mockResolvedValueOnce({_sum: {amount: null}} as never);

            const result = await service.getTotals(userId, startDate, endDate);

            expect(result.totalIncome).toBe(0);
            expect(result.totalExpense).toBe(0);
            expect(result.netTotal).toBe(0);
        });

        it('should only include active transactions (isActive: true)', async () => {
            vi.mocked(prisma.transaction.aggregate).mockResolvedValue(
                {_sum: {amount: null}} as never
            );

            await service.getTotals(userId, startDate, endDate);

            const calls = vi.mocked(prisma.transaction.aggregate).mock.calls;
            expect(calls[0][0].where).toMatchObject({isActive: true});
            expect(calls[1][0].where).toMatchObject({isActive: true});
        });

        it('should aggregate income and expense separately, excluding transfers', async () => {
            vi.mocked(prisma.transaction.aggregate).mockResolvedValue(
                {_sum: {amount: null}} as never
            );

            await service.getTotals(userId, startDate, endDate);

            const calls = vi.mocked(prisma.transaction.aggregate).mock.calls;
            expect(calls[0][0].where).toMatchObject({transactionType: TransactionType.income});
            expect(calls[1][0].where).toMatchObject({transactionType: TransactionType.expense});
        });

        it('should apply the date range filter to both aggregate calls', async () => {
            vi.mocked(prisma.transaction.aggregate).mockResolvedValue(
                {_sum: {amount: null}} as never
            );

            await service.getTotals(userId, startDate, endDate);

            const calls = vi.mocked(prisma.transaction.aggregate).mock.calls;
            const expectedDate = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
            expect(calls[0][0].where).toMatchObject({date: expectedDate});
            expect(calls[1][0].where).toMatchObject({date: expectedDate});
        });

        it('should handle decimal income and expense amounts', async () => {
            vi.mocked(prisma.transaction.aggregate)
                .mockResolvedValueOnce({_sum: {amount: mockDecimal(4567.89)}} as never)
                .mockResolvedValueOnce({_sum: {amount: mockDecimal(2345.67)}} as never);

            const result = await service.getTotals(userId, startDate, endDate);

            expect(result.totalIncome).toBe(4567.89);
            expect(result.totalExpense).toBe(2345.67);
            expect(result.netTotal).toBeCloseTo(2222.22, 2);
        });

        it('should return negative net when expenses exceed income', async () => {
            vi.mocked(prisma.transaction.aggregate)
                .mockResolvedValueOnce({_sum: {amount: mockDecimal(500.25)}} as never)
                .mockResolvedValueOnce({_sum: {amount: mockDecimal(1875.50)}} as never);

            const result = await service.getTotals(userId, startDate, endDate);

            expect(result.totalIncome).toBe(500.25);
            expect(result.totalExpense).toBe(1875.50);
            expect(result.netTotal).toBeCloseTo(-1375.25, 2);
        });

        it('should return zero net when income equals expense', async () => {
            vi.mocked(prisma.transaction.aggregate)
                .mockResolvedValueOnce({_sum: {amount: mockDecimal(1234.56)}} as never)
                .mockResolvedValueOnce({_sum: {amount: mockDecimal(1234.56)}} as never);

            const result = await service.getTotals(userId, startDate, endDate);

            expect(result.totalIncome).toBe(1234.56);
            expect(result.totalExpense).toBe(1234.56);
            expect(result.netTotal).toBe(0);
        });

        it('should handle income only with no expenses', async () => {
            vi.mocked(prisma.transaction.aggregate)
                .mockResolvedValueOnce({_sum: {amount: mockDecimal(6000.00)}} as never)
                .mockResolvedValueOnce({_sum: {amount: null}} as never);

            const result = await service.getTotals(userId, startDate, endDate);

            expect(result.totalIncome).toBe(6000.00);
            expect(result.totalExpense).toBe(0);
            expect(result.netTotal).toBe(6000.00);
        });

        it('should handle expenses only with no income', async () => {
            vi.mocked(prisma.transaction.aggregate)
                .mockResolvedValueOnce({_sum: {amount: null}} as never)
                .mockResolvedValueOnce({_sum: {amount: mockDecimal(99.99)}} as never);

            const result = await service.getTotals(userId, startDate, endDate);

            expect(result.totalIncome).toBe(0);
            expect(result.totalExpense).toBe(99.99);
            expect(result.netTotal).toBeCloseTo(-99.99, 2);
        });

        it('should return startDate and endDate unchanged in the result', async () => {
            vi.mocked(prisma.transaction.aggregate)
                .mockResolvedValueOnce({_sum: {amount: null}} as never)
                .mockResolvedValueOnce({_sum: {amount: null}} as never);

            const result = await service.getTotals(userId, startDate, endDate);

            expect(result.startDate).toBe(startDate);
            expect(result.endDate).toBe(endDate);
        });

        describe('input validation', () => {
            it('should throw BadRequestException when startDate is not a valid date string', async () => {
                await expect(service.getTotals(userId, 'not-a-date', endDate))
                    .rejects
                    .toThrow(BadRequestException);
            });

            it('should throw BadRequestException when endDate is not a valid date string', async () => {
                await expect(service.getTotals(userId, startDate, 'not-a-date'))
                    .rejects
                    .toThrow(BadRequestException);
            });

            it('should not call Prisma when startDate is invalid', async () => {
                await expect(service.getTotals(userId, 'bad', endDate))
                    .rejects
                    .toThrow(BadRequestException);
                expect(prisma.transaction.aggregate).not.toHaveBeenCalled();
            });

            it('should not call Prisma when endDate is invalid', async () => {
                await expect(service.getTotals(userId, startDate, 'bad'))
                    .rejects
                    .toThrow(BadRequestException);
                expect(prisma.transaction.aggregate).not.toHaveBeenCalled();
            });
        });

        describe('optional filters', () => {
            beforeEach(() => {
                vi.mocked(prisma.transaction.aggregate).mockResolvedValue(
                    {_sum: {amount: null}} as never
                );
            });

            it('should apply accountId to both aggregate where clauses', async () => {
                await service.getTotals(userId, startDate, endDate, {accountId: ['acc-uuid']});

                const calls = vi.mocked(prisma.transaction.aggregate).mock.calls;
                expect(calls).toHaveLength(2);
                expect(calls[0][0].where).toMatchObject({accountId: {in: ['acc-uuid']}});
                expect(calls[1][0].where).toMatchObject({accountId: {in: ['acc-uuid']}});
            });

            it('should apply categoryId to both aggregate where clauses', async () => {
                await service.getTotals(userId, startDate, endDate, {categoryId: ['cat-uuid']});

                const calls = vi.mocked(prisma.transaction.aggregate).mock.calls;
                expect(calls).toHaveLength(2);
                expect(calls[0][0].where).toMatchObject({categoryId: {in: ['cat-uuid']}});
                expect(calls[1][0].where).toMatchObject({categoryId: {in: ['cat-uuid']}});
            });

            it('should apply search as case-insensitive description contains filter', async () => {
                await service.getTotals(userId, startDate, endDate, {search: 'coffee'});

                const calls = vi.mocked(prisma.transaction.aggregate).mock.calls;
                expect(calls).toHaveLength(2);
                const expectedDescription = {contains: 'coffee', mode: 'insensitive'};
                expect(calls[0][0].where).toMatchObject({description: expectedDescription});
                expect(calls[1][0].where).toMatchObject({description: expectedDescription});
            });

            it('should skip the expense aggregate and return 0 expense when transactionType is income', async () => {
                vi.mocked(prisma.transaction.aggregate).mockResolvedValueOnce(
                    {_sum: {amount: mockDecimal(500)}} as never
                );

                const result = await service.getTotals(
                    userId, startDate, endDate, {transactionType: [TransactionType.income]}
                );

                expect(prisma.transaction.aggregate).toHaveBeenCalledTimes(1);
                expect(prisma.transaction.aggregate).toHaveBeenCalledWith(
                    expect.objectContaining({
                        where: expect.objectContaining({transactionType: TransactionType.income})
                    })
                );
                expect(result.totalIncome).toBe(500);
                expect(result.totalExpense).toBe(0);
                expect(result.netTotal).toBe(500);
            });

            it('should skip the income aggregate and return 0 income when transactionType is expense', async () => {
                vi.mocked(prisma.transaction.aggregate).mockResolvedValueOnce(
                    {_sum: {amount: mockDecimal(300)}} as never
                );

                const result = await service.getTotals(
                    userId, startDate, endDate, {transactionType: [TransactionType.expense]}
                );

                expect(prisma.transaction.aggregate).toHaveBeenCalledTimes(1);
                expect(prisma.transaction.aggregate).toHaveBeenCalledWith(
                    expect.objectContaining({
                        where: expect.objectContaining({transactionType: TransactionType.expense})
                    })
                );
                expect(result.totalIncome).toBe(0);
                expect(result.totalExpense).toBe(300);
                expect(result.netTotal).toBe(-300);
            });

            it('should skip both aggregates and return all zeros when transactionType is transfer', async () => {
                const result = await service.getTotals(
                    userId, startDate, endDate, {transactionType: [TransactionType.transfer]}
                );

                expect(prisma.transaction.aggregate).not.toHaveBeenCalled();
                expect(result.totalIncome).toBe(0);
                expect(result.totalExpense).toBe(0);
                expect(result.netTotal).toBe(0);
            });

            it('should combine multiple filters in both aggregate where clauses', async () => {
                await service.getTotals(userId, startDate, endDate, {
                    accountId: ['acc-uuid'],
                    categoryId: ['cat-uuid'],
                    search: 'groceries'
                });

                const calls = vi.mocked(prisma.transaction.aggregate).mock.calls;
                expect(calls).toHaveLength(2);
                const expectedPartial = {
                    accountId: {in: ['acc-uuid']},
                    categoryId: {in: ['cat-uuid']},
                    description: {contains: 'groceries', mode: 'insensitive'}
                };
                expect(calls[0][0].where).toMatchObject(expectedPartial);
                expect(calls[1][0].where).toMatchObject(expectedPartial);
            });

            it('should combine transactionType with categoryId and accountId in both aggregate clauses', async () => {
                await service.getTotals(userId, startDate, endDate, {
                    transactionType: [TransactionType.income, TransactionType.expense],
                    categoryId: ['cat-uuid'],
                    accountId: ['acc-uuid']
                });

                const calls = vi.mocked(prisma.transaction.aggregate).mock.calls;
                // Both income and expense types present — both aggregates run
                expect(calls).toHaveLength(2);
                const expectedPartial = {
                    categoryId: {in: ['cat-uuid']},
                    accountId: {in: ['acc-uuid']}
                };
                expect(calls[0][0].where).toMatchObject({
                    ...expectedPartial,
                    transactionType: TransactionType.income
                });
                expect(calls[1][0].where).toMatchObject({
                    ...expectedPartial,
                    transactionType: TransactionType.expense
                });
            });
        });
    });

    // -------------------------------------------------------------------------
    // getMonthlyTotals
    // -------------------------------------------------------------------------

    describe('getMonthlyTotals', () => {
        it('should call getTotals with correct start/end of month boundaries', async () => {
            vi.mocked(prisma.transaction.aggregate).mockResolvedValue(
                {_sum: {amount: null}} as never
            );

            await service.getMonthlyTotals(userId, 2026, 2);

            const calls = vi.mocked(prisma.transaction.aggregate).mock.calls;
            const dateFilter = calls[0][0].where!.date as {gte?: Date, lte?: Date};
            const start = new Date(dateFilter.gte!);
            const end = new Date(dateFilter.lte!);

            expect(start.getUTCFullYear()).toBe(2026);
            expect(start.getUTCMonth()).toBe(1); // 0-indexed February
            expect(start.getUTCDate()).toBe(1);

            // End of February 2026 (non-leap year)
            expect(end.getUTCFullYear()).toBe(2026);
            expect(end.getUTCMonth()).toBe(1);
            expect(end.getUTCDate()).toBe(28);
        });

        it('should handle December (month 12) correctly', async () => {
            vi.mocked(prisma.transaction.aggregate).mockResolvedValue(
                {_sum: {amount: null}} as never
            );

            await service.getMonthlyTotals(userId, 2026, 12);

            const calls = vi.mocked(prisma.transaction.aggregate).mock.calls;
            const dateFilter = calls[0][0].where!.date as {gte?: Date, lte?: Date};
            const end = new Date(dateFilter.lte!);
            expect(end.getUTCMonth()).toBe(11); // December
            expect(end.getUTCDate()).toBe(31);
        });

        describe('input validation', () => {
            it('should throw BadRequestException when month is 0', async () => {
                await expect(service.getMonthlyTotals(userId, 2026, 0))
                    .rejects
                    .toThrow(BadRequestException);
            });

            it('should throw BadRequestException when month is 13', async () => {
                await expect(service.getMonthlyTotals(userId, 2026, 13))
                    .rejects
                    .toThrow(BadRequestException);
            });

            it('should throw BadRequestException when month is negative', async () => {
                await expect(service.getMonthlyTotals(userId, 2026, -1))
                    .rejects
                    .toThrow(BadRequestException);
            });

            it('should throw BadRequestException when year is 0', async () => {
                await expect(service.getMonthlyTotals(userId, 0, 6))
                    .rejects
                    .toThrow(BadRequestException);
            });

            it('should throw BadRequestException when year is 10000', async () => {
                await expect(service.getMonthlyTotals(userId, 10000, 6))
                    .rejects
                    .toThrow(BadRequestException);
            });

            it('should not call Prisma when month is out of range', async () => {
                await expect(service.getMonthlyTotals(userId, 2026, 13))
                    .rejects
                    .toThrow(BadRequestException);
                expect(prisma.transaction.aggregate).not.toHaveBeenCalled();
            });
        });

        it('should return income/expense/net from getTotals with whole numbers', async () => {
            vi.mocked(prisma.transaction.aggregate)
                .mockResolvedValueOnce({_sum: {amount: mockDecimal(500)}} as never)
                .mockResolvedValueOnce({_sum: {amount: mockDecimal(200)}} as never);

            const result = await service.getMonthlyTotals(userId, 2026, 1);

            expect(result.totalIncome).toBe(500);
            expect(result.totalExpense).toBe(200);
            expect(result.netTotal).toBe(300);
        });

        it('should handle decimal income and expense amounts', async () => {
            vi.mocked(prisma.transaction.aggregate)
                .mockResolvedValueOnce({_sum: {amount: mockDecimal(1234.56)}} as never)
                .mockResolvedValueOnce({_sum: {amount: mockDecimal(789.99)}} as never);

            const result = await service.getMonthlyTotals(userId, 2026, 1);

            expect(result.totalIncome).toBe(1234.56);
            expect(result.totalExpense).toBe(789.99);
            expect(result.netTotal).toBeCloseTo(444.57, 2);
        });

        it('should return negative net when expenses exceed income', async () => {
            vi.mocked(prisma.transaction.aggregate)
                .mockResolvedValueOnce({_sum: {amount: mockDecimal(320.75)}} as never)
                .mockResolvedValueOnce({_sum: {amount: mockDecimal(1050.25)}} as never);

            const result = await service.getMonthlyTotals(userId, 2026, 1);

            expect(result.totalIncome).toBe(320.75);
            expect(result.totalExpense).toBe(1050.25);
            expect(result.netTotal).toBeCloseTo(-729.50, 2);
        });

        it('should return zero net when income equals expense', async () => {
            vi.mocked(prisma.transaction.aggregate)
                .mockResolvedValueOnce({_sum: {amount: mockDecimal(999.99)}} as never)
                .mockResolvedValueOnce({_sum: {amount: mockDecimal(999.99)}} as never);

            const result = await service.getMonthlyTotals(userId, 2026, 1);

            expect(result.totalIncome).toBe(999.99);
            expect(result.totalExpense).toBe(999.99);
            expect(result.netTotal).toBe(0);
        });

        it('should return 0 for all totals when no transactions exist', async () => {
            vi.mocked(prisma.transaction.aggregate)
                .mockResolvedValueOnce({_sum: {amount: null}} as never)
                .mockResolvedValueOnce({_sum: {amount: null}} as never);

            const result = await service.getMonthlyTotals(userId, 2026, 1);

            expect(result.totalIncome).toBe(0);
            expect(result.totalExpense).toBe(0);
            expect(result.netTotal).toBe(0);
        });

        it('should handle income with no expenses', async () => {
            vi.mocked(prisma.transaction.aggregate)
                .mockResolvedValueOnce({_sum: {amount: mockDecimal(4500.00)}} as never)
                .mockResolvedValueOnce({_sum: {amount: null}} as never);

            const result = await service.getMonthlyTotals(userId, 2026, 1);

            expect(result.totalIncome).toBe(4500.00);
            expect(result.totalExpense).toBe(0);
            expect(result.netTotal).toBe(4500.00);
        });

        it('should handle expenses with no income', async () => {
            vi.mocked(prisma.transaction.aggregate)
                .mockResolvedValueOnce({_sum: {amount: null}} as never)
                .mockResolvedValueOnce({_sum: {amount: mockDecimal(63.47)}} as never);

            const result = await service.getMonthlyTotals(userId, 2026, 1);

            expect(result.totalIncome).toBe(0);
            expect(result.totalExpense).toBe(63.47);
            expect(result.netTotal).toBeCloseTo(-63.47, 2);
        });

        // -------------------------------------------------------------------
        // UTC boundary correctness (BUG-01)
        // All date boundaries must use Date.UTC — not local-time constructors.
        // On a UTC+ machine a local-time constructor produces a timestamp
        // *earlier* than UTC midnight, which excludes midnight-UTC transactions.
        // -------------------------------------------------------------------

        describe('UTC boundary (BUG-01)', () => {
            const getDateFilter = (callIndex = 0): {gte?: Date, lte?: Date} => {
                const calls = vi.mocked(prisma.transaction.aggregate).mock.calls;
                return calls[callIndex][0].where!.date as {gte?: Date, lte?: Date};
            };

            beforeEach(() => {
                vi.mocked(prisma.transaction.aggregate).mockResolvedValue(
                    {_sum: {amount: null}} as never
                );
            });

            it('start boundary for Feb 2026 is exactly 2026-02-01T00:00:00.000Z', async () => {
                await service.getMonthlyTotals(userId, 2026, 2);
                const {gte} = getDateFilter();
                expect(gte!.toISOString()).toBe('2026-02-01T00:00:00.000Z');
            });

            it('end boundary for Feb 2026 is exactly 2026-02-28T23:59:59.999Z', async () => {
                await service.getMonthlyTotals(userId, 2026, 2);
                const {lte} = getDateFilter();
                expect(lte!.toISOString()).toBe('2026-02-28T23:59:59.999Z');
            });

            it('start boundary for Jan 2026 is exactly 2026-01-01T00:00:00.000Z', async () => {
                await service.getMonthlyTotals(userId, 2026, 1);
                const {gte} = getDateFilter();
                expect(gte!.toISOString()).toBe('2026-01-01T00:00:00.000Z');
            });

            it('end boundary for Dec 2026 is exactly 2026-12-31T23:59:59.999Z', async () => {
                await service.getMonthlyTotals(userId, 2026, 12);
                const {lte} = getDateFilter();
                expect(lte!.toISOString()).toBe('2026-12-31T23:59:59.999Z');
            });

            it('start boundary equals Date.UTC(year, month-1, 1) — not local midnight', async () => {
                const year = 2026, month = 3; // March
                await service.getMonthlyTotals(userId, year, month);
                const {gte} = getDateFilter();
                const expectedUtcMidnight = new Date(Date.UTC(year, month - 1, 1));
                expect(gte!.getTime()).toBe(expectedUtcMidnight.getTime());
            });

            it('end boundary equals Date.UTC(year, month, 0, 23, 59, 59, 999) — not local end-of-day', async () => {
                const year = 2026, month = 3; // March
                await service.getMonthlyTotals(userId, year, month);
                const {lte} = getDateFilter();
                const expectedUtcEndOfDay = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
                expect(lte!.getTime()).toBe(expectedUtcEndOfDay.getTime());
            });

            it('the gte filter would include a transaction at exact UTC month-start midnight', async () => {
                // A transaction at 2026-02-01T00:00:00.000Z must equal gte exactly.
                // Prisma >= semantics: the boundary timestamp itself is included.
                await service.getMonthlyTotals(userId, 2026, 2);
                const {gte} = getDateFilter();
                const txAtMidnightUtc = new Date(Date.UTC(2026, 1, 1, 0, 0, 0, 0));
                expect(txAtMidnightUtc.getTime()).toBe(gte!.getTime());
            });

            it('the gte filter would exclude a transaction 1 ms before UTC month-start', async () => {
                await service.getMonthlyTotals(userId, 2026, 2);
                const {gte} = getDateFilter();
                const txOneMillisBeforeStart = new Date(Date.UTC(2026, 1, 1, 0, 0, 0, 0) - 1);
                expect(txOneMillisBeforeStart.getTime()).toBeLessThan(gte!.getTime());
            });

            it('the lte filter would include a transaction at exact UTC month-end', async () => {
                // A transaction at 2026-02-28T23:59:59.999Z must equal lte exactly.
                // Prisma <= semantics: the boundary timestamp itself is included.
                await service.getMonthlyTotals(userId, 2026, 2);
                const {lte} = getDateFilter();
                const txAtMonthEnd = new Date(Date.UTC(2026, 1, 28, 23, 59, 59, 999));
                expect(txAtMonthEnd.getTime()).toBe(lte!.getTime());
            });

            it('the lte filter would exclude a transaction 1 ms into the following month', async () => {
                await service.getMonthlyTotals(userId, 2026, 2);
                const {lte} = getDateFilter();
                const txInNextMonth = new Date(Date.UTC(2026, 2, 1, 0, 0, 0, 0));
                expect(txInNextMonth.getTime()).toBeGreaterThan(lte!.getTime());
            });

            it('handles a leap-year February: end boundary is 2024-02-29T23:59:59.999Z', async () => {
                await service.getMonthlyTotals(userId, 2024, 2);
                const {gte, lte} = getDateFilter();
                expect(gte!.toISOString()).toBe('2024-02-01T00:00:00.000Z');
                expect(lte!.toISOString()).toBe('2024-02-29T23:59:59.999Z');
            });
        });
    });

    // -------------------------------------------------------------------------
    // categorizeSuggestion
    // -------------------------------------------------------------------------

    describe('categorizeSuggestion', () => {
        const makeCategory = (id: string, name: string, isActive = true) => ({
            id,
            name,
            isActive,
            userId,
            description: null,
            color: null,
            icon: null,
            parentId: null,
            transactionCount: 0,
            children: []
        });

        const activeCategories = [
            makeCategory('cat-food', 'Food & Dining'),
            makeCategory('cat-other', 'Other'),
            makeCategory('cat-transport', 'Transport')
        ];

        it('should return matching categoryId and name when AI returns a known category name', async () => {
            const cats = categoriesService; const ai = aiCategorizationService;
            vi.mocked(cats.findAll).mockResolvedValue(activeCategories as never);
            vi.mocked(ai.suggestCategory).mockResolvedValue('Food & Dining');

            const result = await service.categorizeSuggestion(userId, {
                description: 'Starbucks',
                amount: 5.50,
                transactionType: TransactionType.expense
            });

            expect(result.categoryId).toBe('cat-food');
            expect(result.categoryName).toBe('Food & Dining');
        });

        it('should fall back to Other category when AI returns unknown name', async () => {
            const cats = categoriesService; const ai = aiCategorizationService;
            vi.mocked(cats.findAll).mockResolvedValue(activeCategories as never);
            vi.mocked(ai.suggestCategory).mockResolvedValue('Nonexistent Category');

            const result = await service.categorizeSuggestion(userId, {
                description: 'Mystery charge',
                amount: 9.99,
                transactionType: TransactionType.expense
            });

            expect(result.categoryId).toBe('cat-other');
            expect(result.categoryName).toBe('Other');
        });

        it('should throw BadRequestException when user has no active categories', async () => {
            const cats = categoriesService;
            vi.mocked(cats.findAll).mockResolvedValue([
                makeCategory('cat-x', 'Archived', false)
            ] as never);

            await expect(
                service.categorizeSuggestion(userId, {
                    description: 'test',
                    amount: 1.00,
                    transactionType: TransactionType.expense
                })
            ).rejects.toThrow(BadRequestException);
        });

        it('should match category case-insensitively', async () => {
            const cats = categoriesService; const ai = aiCategorizationService;
            vi.mocked(cats.findAll).mockResolvedValue(activeCategories as never);
            vi.mocked(ai.suggestCategory).mockResolvedValue('food & dining');

            const result = await service.categorizeSuggestion(userId, {
                description: 'Pizza',
                amount: 22.00,
                transactionType: TransactionType.expense
            });

            expect(result.categoryId).toBe('cat-food');
            expect(result.categoryName).toBe('Food & Dining');
        });

        // Issue 4: ServiceUnavailableException when AI is disabled
        it('should throw ServiceUnavailableException when aiCategorization.available is false', async () => {
            Object.defineProperty(aiCategorizationService, 'available', {value: false, configurable: true});

            await expect(
                service.categorizeSuggestion(userId, {
                    description: 'test',
                    amount: 5.00,
                    transactionType: TransactionType.expense
                })
            ).rejects.toThrow(ServiceUnavailableException);
        });

        it('should fall back to first active category when Other is not present and AI returns null', async () => {
            const categoriesNoOther = [
                makeCategory('cat-food', 'Food & Dining'),
                makeCategory('cat-transport', 'Transport')
            ];
            const cats = categoriesService; const ai = aiCategorizationService;
            vi.mocked(cats.findAll).mockResolvedValue(categoriesNoOther as never);
            vi.mocked(ai.suggestCategory).mockResolvedValue(null);

            const result = await service.categorizeSuggestion(userId, {
                description: 'Something',
                amount: 10.00,
                transactionType: TransactionType.expense
            });

            // Should fall back to first active category
            expect(result.categoryId).toBe('cat-food');
        });
    });

    // -------------------------------------------------------------------------
    // bulkCategorize
    // -------------------------------------------------------------------------

    describe('bulkCategorize', () => {
        const makeCategory = (id: string, name: string, isActive = true) => ({
            id,
            name,
            isActive,
            userId,
            description: null,
            color: null,
            icon: null,
            parentId: null,
            transactionCount: 0,
            children: []
        });

        const activeCategories = [
            makeCategory('cat-food', 'Food & Dining'),
            makeCategory('cat-other', 'Other')
        ];

        it('should return { categorized: 0, skipped: 0, total: 0, processed: 0 } when no uncategorized transactions', async () => {
            const cats = categoriesService;
            vi.mocked(cats.findAll).mockResolvedValue(activeCategories as never);
            vi.mocked(prisma.transaction.count).mockResolvedValue(0);
            vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);

            const result = await service.bulkCategorize(userId, {});

            expect(result).toEqual({categorized: 0, skipped: 0, total: 0, processed: 0});
        });

        it('should categorize transactions and return correct counts', async () => {
            const cats = categoriesService; const ai = aiCategorizationService;
            vi.mocked(cats.findAll).mockResolvedValue(activeCategories as never);
            vi.mocked(prisma.transaction.count).mockResolvedValue(2);
            vi.mocked(prisma.transaction.findMany).mockResolvedValue([
                makeTransaction({id: 'txn-1', categoryId: null}),
                makeTransaction({id: 'txn-2', categoryId: null})
            ]);
            vi.mocked(ai.suggestCategories).mockResolvedValue(
                new Map([['txn-1', 'Food & Dining'], ['txn-2', 'Food & Dining']])
            );
            vi.mocked(prisma.transaction.update).mockResolvedValue(makeTransaction());

            const result = await service.bulkCategorize(userId, {});

            expect(result.categorized).toBe(2);
            expect(result.skipped).toBe(0);
            expect(result.total).toBe(2);
        });

        it('should fall back to Other when AI returns null (no skipping)', async () => {
            const cats = categoriesService; const ai = aiCategorizationService;
            vi.mocked(cats.findAll).mockResolvedValue(activeCategories as never);
            vi.mocked(prisma.transaction.count).mockResolvedValue(3);
            vi.mocked(prisma.transaction.findMany).mockResolvedValue([
                makeTransaction({id: 'txn-1', categoryId: null}),
                makeTransaction({id: 'txn-2', categoryId: null}),
                makeTransaction({id: 'txn-3', categoryId: null})
            ]);
            vi.mocked(ai.suggestCategories).mockResolvedValue(
                new Map<string, string | null>([
                    ['txn-1', 'Food & Dining'],
                    ['txn-2', null],
                    ['txn-3', null]
                ])
            );

            const result = await service.bulkCategorize(userId, {});

            expect(result.categorized).toBe(3);
            expect(result.skipped).toBe(0);
            expect(result.total).toBe(3);
        });

        it('should apply accountId filter when provided', async () => {
            const cats = categoriesService;
            vi.mocked(cats.findAll).mockResolvedValue(activeCategories as never);
            vi.mocked(prisma.transaction.count).mockResolvedValue(0);
            vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);

            await service.bulkCategorize(userId, {accountId: 'acc-uuid'});

            expect(prisma.transaction.count).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({accountId: 'acc-uuid'})
                })
            );
            expect(prisma.transaction.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({accountId: 'acc-uuid'})
                })
            );
        });

        it('should throw BadRequestException when no active categories', async () => {
            const cats = categoriesService;
            vi.mocked(cats.findAll).mockResolvedValue([
                makeCategory('cat-x', 'Archived', false)
            ] as never);

            await expect(service.bulkCategorize(userId, {})).rejects.toThrow(BadRequestException);
        });

        it('should cap findMany at 200 records but report full total', async () => {
            const cats = categoriesService; const ai = aiCategorizationService;
            vi.mocked(cats.findAll).mockResolvedValue(activeCategories as never);
            vi.mocked(prisma.transaction.count).mockResolvedValue(500);
            vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
            vi.mocked(ai.suggestCategories).mockResolvedValue(new Map());

            const result = await service.bulkCategorize(userId, {});

            expect(result.total).toBe(500);
            expect(prisma.transaction.findMany).toHaveBeenCalledWith(
                expect.objectContaining({take: 200})
            );
        });

        it('should include processed count equal to number of transactions fetched', async () => {
            const cats = categoriesService; const ai = aiCategorizationService;
            vi.mocked(cats.findAll).mockResolvedValue(activeCategories as never);
            vi.mocked(prisma.transaction.count).mockResolvedValue(500);
            vi.mocked(prisma.transaction.findMany).mockResolvedValue([
                makeTransaction({id: 'txn-1', categoryId: null}),
                makeTransaction({id: 'txn-2', categoryId: null})
            ]);
            vi.mocked(ai.suggestCategories).mockResolvedValue(
                new Map([['txn-1', 'Food & Dining'], ['txn-2', 'Food & Dining']])
            );
            vi.mocked(prisma.transaction.update).mockResolvedValue(makeTransaction());

            const result = await service.bulkCategorize(userId, {});

            expect(result.processed).toBe(2);
            expect(result.total).toBe(500);
        });

        // Issue 1: date filter correctness when both startDate and endDate are provided
        it('should include both gte and lte on the date field when both startDate and endDate are provided', async () => {
            const cats = categoriesService;
            vi.mocked(cats.findAll).mockResolvedValue(activeCategories as never);
            vi.mocked(prisma.transaction.count).mockResolvedValue(0);
            vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);

            await service.bulkCategorize(userId, {
                startDate: '2026-01-01T00:00:00.000Z',
                endDate: '2026-01-31T23:59:59.999Z'
            });

            const expectedWhere = expect.objectContaining({
                date: {
                    gte: new Date('2026-01-01T00:00:00.000Z'),
                    lte: new Date('2026-01-31T23:59:59.999Z')
                }
            });
            expect(prisma.transaction.findMany).toHaveBeenCalledWith(
                expect.objectContaining({where: expectedWhere})
            );
            expect(prisma.transaction.count).toHaveBeenCalledWith(
                expect.objectContaining({where: expectedWhere})
            );
        });

        it('should apply only startDate as gte when endDate is omitted', async () => {
            const cats = categoriesService;
            vi.mocked(cats.findAll).mockResolvedValue(activeCategories as never);
            vi.mocked(prisma.transaction.count).mockResolvedValue(0);
            vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);

            await service.bulkCategorize(userId, {startDate: '2026-01-01T00:00:00.000Z'});

            expect(prisma.transaction.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        date: {gte: new Date('2026-01-01T00:00:00.000Z')}
                    })
                })
            );
        });

        it('should apply only endDate as lte when startDate is omitted', async () => {
            const cats = categoriesService;
            vi.mocked(cats.findAll).mockResolvedValue(activeCategories as never);
            vi.mocked(prisma.transaction.count).mockResolvedValue(0);
            vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);

            await service.bulkCategorize(userId, {endDate: '2026-01-31T23:59:59.999Z'});

            expect(prisma.transaction.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        date: {lte: new Date('2026-01-31T23:59:59.999Z')}
                    })
                })
            );
        });
    });
});

