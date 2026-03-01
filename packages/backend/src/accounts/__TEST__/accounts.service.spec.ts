import {
    describe,
    it,
    expect,
    beforeEach,
    vi
} from 'vitest';
import {
    NotFoundException, ConflictException
} from '@nestjs/common';
import {AccountsService} from '#accounts/accounts.service.js';
import {AccountResponseDto} from '#accounts/dto/account-response.dto.js';
import type {PrismaService} from '#database/prisma.service.js';
import type {Account} from '#generated/prisma/client.js';
import {
    AccountType, TransactionType
} from '#generated/prisma/client.js';
import {PrismaClientKnownRequestError} from '#generated/prisma/internal/prismaNamespace.js';
import type {CreateAccountDto} from '#accounts/dto/create-account.dto.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeAccount = (overrides: Partial<Account> = {}): Account => ({
    id: 'acc-uuid-1',
    userId: 'user-uuid-1',
    name: 'Chequing',
    type: AccountType.checking,
    institution: 'TD Bank',
    currency: 'CAD',
    openingBalance: 1000 as unknown as Account['openingBalance'],
    color: '#4CAF50',
    notes: null,
    isActive: true,
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    updatedAt: new Date('2026-01-15T10:00:00.000Z'),
    ...overrides
});

type AccountWithCount = Account & {_count: {transactions: number}};

const makeWithCount = (overrides: Partial<Account> = {}, txCount = 0): AccountWithCount => ({
    ...makeAccount(overrides),
    _count: {transactions: txCount}
});

const makeP2002 = (): PrismaClientKnownRequestError =>
    new PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.0.0'
    });

/** Default groupBy result: 0 income, 0 expense */
const emptyGroupBy: {transactionType: string, _sum: {amount: number | null}}[] = [];

/** groupBy result with income only */
const groupByIncome = (amount: number) => [
    {transactionType: TransactionType.income, _sum: {amount}}
];

/** groupBy result with income + expense */
const groupByBoth = (income: number, expense: number) => [
    {transactionType: TransactionType.income, _sum: {amount: income}},
    {transactionType: TransactionType.expense, _sum: {amount: expense}}
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AccountsService', () => {
    let service: AccountsService;
    let prisma: PrismaService;

    const userId = 'user-uuid-1';
    const accId = 'acc-uuid-1';

    beforeEach(() => {
        prisma = {
            account: {
                findMany: vi.fn(),
                findFirst: vi.fn(),
                create: vi.fn(),
                update: vi.fn(),
                delete: vi.fn()
            },
            transaction: {
                groupBy: vi.fn(),
                count: vi.fn()
            }
        } as unknown as PrismaService;

        service = new AccountsService(prisma);
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // findAll
    // -------------------------------------------------------------------------

    describe('findAll', () => {
        it('returns empty array when user has no accounts', async () => {
            vi.mocked(prisma.account.findMany).mockResolvedValue([]);

            const result = await service.findAll(userId);

            expect(result).toEqual([]);
            expect(prisma.account.findMany).toHaveBeenCalledWith({
                where: {userId},
                orderBy: {name: 'asc'}
            });
        });

        it('returns AccountResponseDto array ordered by name', async () => {
            const accounts = [makeAccount({name: 'Savings'}), makeAccount({id: 'acc-2', name: 'Chequing'})];
            vi.mocked(prisma.account.findMany).mockResolvedValue(accounts);
            vi.mocked(prisma.transaction.groupBy).mockResolvedValue(emptyGroupBy as never);
            vi.mocked(prisma.transaction.count).mockResolvedValue(0);

            const result = await service.findAll(userId);

            expect(result).toHaveLength(2);
            expect(result[0]).toBeInstanceOf(AccountResponseDto);
            expect(result[0].name).toBe('Savings');
        });

        it('computes currentBalance from openingBalance + income - expense', async () => {
            const accs = [makeAccount({openingBalance: 1000 as never})];
            vi.mocked(prisma.account.findMany).mockResolvedValue(accs);
            vi.mocked(prisma.transaction.groupBy).mockResolvedValue(groupByBoth(500, 200) as never);
            vi.mocked(prisma.transaction.count).mockResolvedValue(5);

            const result = await service.findAll(userId);

            // 1000 + 500 - 200 = 1300
            expect(result[0].currentBalance).toBe(1300);
            expect(result[0].transactionCount).toBe(5);
        });
    });

    // -------------------------------------------------------------------------
    // findOne
    // -------------------------------------------------------------------------

    describe('findOne', () => {
        it('returns dto when account exists', async () => {
            vi.mocked(prisma.account.findFirst).mockResolvedValue(makeAccount());
            vi.mocked(prisma.transaction.groupBy).mockResolvedValue(emptyGroupBy as never);
            vi.mocked(prisma.transaction.count).mockResolvedValue(0);

            const result = await service.findOne(userId, accId);

            expect(result).toBeInstanceOf(AccountResponseDto);
            expect(result.id).toBe(accId);
        });

        it('throws NotFoundException when account not found', async () => {
            vi.mocked(prisma.account.findFirst).mockResolvedValue(null);

            await expect(service.findOne(userId, accId)).rejects.toThrow(NotFoundException);
        });

        it('scopes findFirst to userId so cross-user access is denied', async () => {
            vi.mocked(prisma.account.findFirst).mockResolvedValue(null);

            await expect(service.findOne('other-user', accId)).rejects.toThrow(NotFoundException);
            expect(prisma.account.findFirst).toHaveBeenCalledWith({where: {id: accId, userId: 'other-user'}});
        });
    });

    // -------------------------------------------------------------------------
    // create
    // -------------------------------------------------------------------------

    describe('create', () => {
        const dto: CreateAccountDto = {
            name: 'New Account',
            type: AccountType.savings,
            currency: 'CAD'
        };

        it('creates and returns account dto', async () => {
            // checkNameUnique returns no conflict
            vi.mocked(prisma.account.findFirst).mockResolvedValue(null);
            vi.mocked(prisma.account.create).mockResolvedValue(makeAccount({name: dto.name}));
            vi.mocked(prisma.transaction.groupBy).mockResolvedValue(emptyGroupBy as never);
            vi.mocked(prisma.transaction.count).mockResolvedValue(0);

            const result = await service.create(userId, dto);

            expect(result).toBeInstanceOf(AccountResponseDto);
            expect(prisma.account.create).toHaveBeenCalledOnce();
        });

        it('defaults currency to CAD when not provided', async () => {
            const dtoNoCurrency: CreateAccountDto = {name: 'Test', type: AccountType.checking};
            vi.mocked(prisma.account.findFirst).mockResolvedValue(null);
            vi.mocked(prisma.account.create).mockResolvedValue(makeAccount());
            vi.mocked(prisma.transaction.groupBy).mockResolvedValue(emptyGroupBy as never);
            vi.mocked(prisma.transaction.count).mockResolvedValue(0);

            await service.create(userId, dtoNoCurrency);

            const callData = vi.mocked(prisma.account.create).mock.calls[0][0].data;
            expect(callData.currency).toBe('CAD');
        });

        it('throws ConflictException when name already exists (checkNameUnique)', async () => {
            // checkNameUnique finds a conflict
            vi.mocked(prisma.account.findFirst).mockResolvedValue(makeAccount());

            await expect(service.create(userId, dto)).rejects.toThrow(ConflictException);
        });

        it('catches P2002 and throws ConflictException', async () => {
            vi.mocked(prisma.account.findFirst).mockResolvedValue(null); // checkNameUnique passes
            vi.mocked(prisma.account.create).mockRejectedValue(makeP2002());

            await expect(service.create(userId, dto)).rejects.toThrow(ConflictException);
        });

        it('rethrows unknown errors from create', async () => {
            vi.mocked(prisma.account.findFirst).mockResolvedValue(null);
            vi.mocked(prisma.account.create).mockRejectedValue(new Error('DB down'));

            await expect(service.create(userId, dto)).rejects.toThrow('DB down');
        });
    });

    // -------------------------------------------------------------------------
    // update
    // -------------------------------------------------------------------------

    describe('update', () => {
        it('throws NotFoundException when account not found', async () => {
            vi.mocked(prisma.account.findFirst).mockResolvedValue(null);

            await expect(service.update(userId, accId, {})).rejects.toThrow(NotFoundException);
        });

        it('updates without calling checkNameUnique when name is unchanged', async () => {
            const existing = makeAccount({name: 'Chequing'});
            vi.mocked(prisma.account.findFirst)
                .mockResolvedValueOnce(existing) // findFirst for lookup
                .mockResolvedValueOnce(null);     // should NOT be called
            vi.mocked(prisma.account.update).mockResolvedValue(existing);
            vi.mocked(prisma.transaction.groupBy).mockResolvedValue(emptyGroupBy as never);
            vi.mocked(prisma.transaction.count).mockResolvedValue(0);

            await service.update(userId, accId, {name: 'Chequing'});

            // findFirst only called once (the lookup, NOT checkNameUnique)
            expect(prisma.account.findFirst).toHaveBeenCalledOnce();
        });

        it('calls checkNameUnique with excludeId when name changes', async () => {
            const existing = makeAccount({name: 'Old Name'});
            vi.mocked(prisma.account.findFirst)
                .mockResolvedValueOnce(existing)   // lookup
                .mockResolvedValueOnce(null);       // checkNameUnique — no conflict
            vi.mocked(prisma.account.update).mockResolvedValue(makeAccount({name: 'New Name'}));
            vi.mocked(prisma.transaction.groupBy).mockResolvedValue(emptyGroupBy as never);
            vi.mocked(prisma.transaction.count).mockResolvedValue(0);

            const result = await service.update(userId, accId, {name: 'New Name'});

            expect(prisma.account.findFirst).toHaveBeenCalledTimes(2);
            // Second call is checkNameUnique — must pass excludeId so the row being
            // updated is not flagged as its own duplicate.
            expect(prisma.account.findFirst).toHaveBeenNthCalledWith(2, {
                where: {
                    userId,
                    name: 'New Name',
                    isActive: true,
                    id: {not: accId}
                }
            });
            expect(result).toBeInstanceOf(AccountResponseDto);
        });

        it('empty DTO is a no-op and succeeds', async () => {
            const existing = makeAccount();
            vi.mocked(prisma.account.findFirst).mockResolvedValue(existing);
            vi.mocked(prisma.account.update).mockResolvedValue(existing);
            vi.mocked(prisma.transaction.groupBy).mockResolvedValue(emptyGroupBy as never);
            vi.mocked(prisma.transaction.count).mockResolvedValue(0);

            const result = await service.update(userId, accId, {});

            expect(result).toBeInstanceOf(AccountResponseDto);
            // update called with empty data object — Prisma accepts this as a no-op
            expect(prisma.account.update).toHaveBeenCalledWith(
                expect.objectContaining({data: {}})
            );
        });

        it('throws ConflictException when new name conflicts', async () => {
            vi.mocked(prisma.account.findFirst)
                .mockResolvedValueOnce(makeAccount({name: 'Old Name'})) // lookup
                .mockResolvedValueOnce(makeAccount({name: 'Taken Name'})); // checkNameUnique conflict

            await expect(service.update(userId, accId, {name: 'Taken Name'})).rejects.toThrow(ConflictException);
        });

        it('catches P2002 from update and throws ConflictException', async () => {
            vi.mocked(prisma.account.findFirst).mockResolvedValue(makeAccount());
            vi.mocked(prisma.account.update).mockRejectedValue(makeP2002());

            await expect(service.update(userId, accId, {currency: 'USD'})).rejects.toThrow(ConflictException);
        });
    });

    // -------------------------------------------------------------------------
    // remove — hard delete vs soft delete
    // -------------------------------------------------------------------------

    describe('remove', () => {
        it('throws NotFoundException when account not found', async () => {
            vi.mocked(prisma.account.findFirst).mockResolvedValue(null);

            await expect(service.remove(userId, accId)).rejects.toThrow(NotFoundException);
        });

        it('hard-deletes account when no transactions are linked (returns null)', async () => {
            vi.mocked(prisma.account.findFirst).mockResolvedValue(makeWithCount({}, 0) as never);
            vi.mocked(prisma.account.delete).mockResolvedValue(makeAccount() as never);

            const result = await service.remove(userId, accId);

            expect(prisma.account.delete).toHaveBeenCalledWith({where: {id: accId}});
            expect(result).toBeNull();
        });

        it('soft-deletes account when transactions exist (returns dto)', async () => {
            vi.mocked(prisma.account.findFirst).mockResolvedValue(makeWithCount({}, 3) as never);
            vi.mocked(prisma.account.update).mockResolvedValue(makeAccount({isActive: false}));
            vi.mocked(prisma.transaction.groupBy).mockResolvedValue(emptyGroupBy as never);
            vi.mocked(prisma.transaction.count).mockResolvedValue(3);

            const result = await service.remove(userId, accId);

            expect(prisma.account.update).toHaveBeenCalledWith({
                where: {id: accId},
                data: {isActive: false}
            });
            expect(result).toBeInstanceOf(AccountResponseDto);
            expect(result?.isActive).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // currentBalance computation (via toDto called from findOne)
    // -------------------------------------------------------------------------

    describe('currentBalance computation', () => {
        it('is openingBalance when no transactions', async () => {
            const acc = makeAccount({openingBalance: 500 as never});
            vi.mocked(prisma.account.findFirst).mockResolvedValue(acc);
            vi.mocked(prisma.transaction.groupBy).mockResolvedValue(emptyGroupBy as never);
            vi.mocked(prisma.transaction.count).mockResolvedValue(0);

            const result = await service.findOne(userId, accId);

            expect(result.currentBalance).toBe(500);
        });

        it('adds income sum to openingBalance', async () => {
            vi.mocked(prisma.account.findFirst).mockResolvedValue(
                makeAccount({openingBalance: 0 as never})
            );
            vi.mocked(prisma.transaction.groupBy).mockResolvedValue(groupByIncome(750) as never);
            vi.mocked(prisma.transaction.count).mockResolvedValue(1);

            const result = await service.findOne(userId, accId);

            expect(result.currentBalance).toBe(750);
        });

        it('subtracts expense sum from openingBalance + income', async () => {
            vi.mocked(prisma.account.findFirst).mockResolvedValue(
                makeAccount({openingBalance: 200 as never})
            );
            vi.mocked(prisma.transaction.groupBy).mockResolvedValue(groupByBoth(300, 100) as never);
            vi.mocked(prisma.transaction.count).mockResolvedValue(4);

            const result = await service.findOne(userId, accId);

            // 200 + 300 - 100 = 400
            expect(result.currentBalance).toBe(400);
        });

        it('handles null _sum.amount (no income transactions)', async () => {
            vi.mocked(prisma.account.findFirst).mockResolvedValue(
                makeAccount({openingBalance: 100 as never})
            );
            vi.mocked(prisma.transaction.groupBy).mockResolvedValue([
                {transactionType: TransactionType.expense, _sum: {amount: null}}
            ] as never);
            vi.mocked(prisma.transaction.count).mockResolvedValue(0);

            const result = await service.findOne(userId, accId);

            // null amount treated as 0; 100 + 0 - 0 = 100
            expect(result.currentBalance).toBe(100);
        });
    });
});
