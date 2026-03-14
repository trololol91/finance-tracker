import {
    describe,
    it,
    expect,
    beforeEach,
    vi
} from 'vitest';
import {DashboardService} from '#dashboard/dashboard.service.js';
import type {PrismaService} from '#database/prisma.service.js';

describe('DashboardService', () => {
    let service: DashboardService;
    let prisma: {
        account: {findMany: ReturnType<typeof vi.fn>};
        transaction: {
            aggregate: ReturnType<typeof vi.fn>;
            groupBy: ReturnType<typeof vi.fn>;
            findMany: ReturnType<typeof vi.fn>;
            count: ReturnType<typeof vi.fn>;
        };
        category: {findMany: ReturnType<typeof vi.fn>};
    };

    const userId = 'user-123';

    beforeEach(() => {
        prisma = {
            account: {
                findMany: vi.fn()
            },
            transaction: {
                aggregate: vi.fn(),
                groupBy: vi.fn(),
                findMany: vi.fn(),
                count: vi.fn()
            },
            category: {
                findMany: vi.fn()
            }
        };

        service = new DashboardService(prisma as unknown as PrismaService);
        vi.clearAllMocks();
    });

    interface AccountMockOpts {
        openingBalance: number;
        id?: string;
        name?: string;
        currency?: string;
        /** Per-account income/expense used to set up groupBy mocks */
        incomeAmount?: number;
        expenseAmount?: number;
    }

    interface SummaryMockOpts {
        accounts?: AccountMockOpts[];
        income?: number | null;
        expense?: number | null;
        count?: number;
        recent?: object[];
    }

    describe('getSummary', () => {
        /**
         * Sets up all Prisma mocks for getSummary.
         *
         * Call order inside getSummary:
         *   1. Promise.all([aggregate(income), aggregate(expense)])  — two aggregate calls
         *   2. transaction.count
         *   3. account.findMany
         *   4. Promise.all([groupBy(income-by-acct), groupBy(expense-by-acct)])
         *   5. transaction.findMany (recent)
         */
        const setupSummaryMocks = (opts: SummaryMockOpts): void => {
            const accounts = opts.accounts ?? [];

            // account.findMany — no transactions field in the new implementation
            prisma.account.findMany.mockResolvedValue(
                accounts.map(a => ({
                    id: a.id ?? 'acct-1',
                    name: a.name ?? 'Checking',
                    currency: a.currency ?? 'USD',
                    openingBalance: a.openingBalance
                }))
            );

            // transaction.aggregate: first call = income, second = expense
            prisma.transaction.aggregate
                .mockResolvedValueOnce({_sum: {amount: opts.income ?? null}})
                .mockResolvedValueOnce({_sum: {amount: opts.expense ?? null}});

            prisma.transaction.count.mockResolvedValue(opts.count ?? 0);

            // transaction.groupBy: first call = income-by-account, second = expense-by-account
            const incomeByAcct = accounts
                .filter(a => (a.incomeAmount ?? 0) > 0)
                .map(a => ({accountId: a.id ?? 'acct-1', _sum: {amount: a.incomeAmount ?? 0}}));
            const expenseByAcct = accounts
                .filter(a => (a.expenseAmount ?? 0) > 0)
                .map(a => ({accountId: a.id ?? 'acct-1', _sum: {amount: a.expenseAmount ?? 0}}));

            prisma.transaction.groupBy
                .mockResolvedValueOnce(incomeByAcct)
                .mockResolvedValueOnce(expenseByAcct);

            prisma.transaction.findMany.mockResolvedValue(opts.recent ?? []);
        };

        /**
         * DSV-01: getSummary() with income and expense transactions returns correct totals
         */
        it('DSV-01: returns correct totalIncome, totalExpenses, and netBalance', async () => {
            setupSummaryMocks({
                accounts: [{openingBalance: 1000, incomeAmount: 3000, expenseAmount: 1500}],
                income: 3000,
                expense: 1500,
                count: 5
            });

            const result = await service.getSummary(userId, '2026-03');

            expect(result.totalIncome).toBe(3000);
            expect(result.totalExpenses).toBe(1500);
            expect(result.netBalance).toBe(1500);
            expect(result.month).toBe('2026-03');
        });

        /**
         * DSV-02: getSummary() — netBalance is totalIncome - totalExpenses for the period
         */
        it('DSV-02: netBalance equals totalIncome minus totalExpenses for the period',
            async () => {
                setupSummaryMocks({
                    accounts: [],
                    income: 2000,
                    expense: 800,
                    count: 3
                });

                const result = await service.getSummary(userId, '2026-03');

                expect(result.netBalance).toBe(1200);
                expect(result.totalIncome).toBe(2000);
                expect(result.totalExpenses).toBe(800);
            });

        /**
         * DSV-03: getSummary() with no transactions returns all zeros
         */
        it('DSV-03: returns all zeros when there are no transactions', async () => {
            setupSummaryMocks({accounts: [], income: null, expense: null, count: 0});

            const result = await service.getSummary(userId, '2026-03');

            expect(result.totalIncome).toBe(0);
            expect(result.totalExpenses).toBe(0);
            expect(result.netBalance).toBe(0);
            expect(result.savingsRate).toBeNull();
            expect(result.transactionCount).toBe(0);
        });

        /**
         * DSV-04: getSummary() with invalid month string — parseMonth produces NaN dates.
         * The service does not throw; it passes NaN-based dates to Prisma.
         */
        it('DSV-04: handles an invalid month string without throwing (validation is at DTO layer)', async () => {
            setupSummaryMocks({accounts: [], income: null, expense: null, count: 0});

            const result = await service.getSummary(userId, 'invalid');

            expect(result).toBeDefined();
            expect(result.month).toBe('invalid');
        });

        /**
         * DSV-05: getSummary() computes savingsRate correctly when income > 0
         */
        it('DSV-05: computes savingsRate correctly when income > 0', async () => {
            setupSummaryMocks({accounts: [], income: 5000, expense: 3200, count: 10});

            const result = await service.getSummary(userId, '2026-03');

            // savingsRate = round(((5000 - 3200) / 5000) * 10000) / 100 = 36
            expect(result.savingsRate).toBe(36);
        });

        /**
         * DSV-06: getSummary() returns savingsRate = null when totalIncome = 0
         */
        it('DSV-06: returns savingsRate = null when totalIncome is zero', async () => {
            setupSummaryMocks({accounts: [], income: null, expense: 500, count: 2});

            const result = await service.getSummary(userId, '2026-03');

            expect(result.savingsRate).toBeNull();
        });

        /**
         * DSV-07: getSummary() response includes all required fields
         */
        it('DSV-07: response includes month, totalIncome, totalExpenses, netBalance, transactionCount, savingsRate, accounts, recentTransactions', async () => {
            setupSummaryMocks({accounts: [], income: 1000, expense: 200, count: 4});

            const result = await service.getSummary(userId, '2026-03');

            expect(result).toHaveProperty('month', '2026-03');
            expect(result).toHaveProperty('totalIncome');
            expect(result).toHaveProperty('totalExpenses');
            expect(result).toHaveProperty('netBalance');
            expect(result).toHaveProperty('transactionCount');
            expect(result).toHaveProperty('savingsRate');
            expect(result).toHaveProperty('accounts');
            expect(result).toHaveProperty('recentTransactions');
        });

        /**
         * DSV-08: getSummary() includes transactionCount
         */
        it('DSV-08: includes transactionCount from prisma.transaction.count', async () => {
            setupSummaryMocks({accounts: [], income: 1000, expense: 200, count: 7});

            const result = await service.getSummary(userId, '2026-03');

            expect(result.transactionCount).toBe(7);
        });

        /**
         * DSV-09: getSummary() includes account balances computed via aggregate groupBy
         * balance = openingBalance + income - expense = 500 + 1000 - 200 = 1300
         */
        it('DSV-09: includes account balances computed from openingBalance + aggregated transactions', async () => {
            setupSummaryMocks({
                accounts: [{
                    id: 'acct-1',
                    name: 'Savings',
                    currency: 'GBP',
                    openingBalance: 500,
                    incomeAmount: 1000,
                    expenseAmount: 200
                }],
                income: 1000,
                expense: 200,
                count: 1
            });

            const result = await service.getSummary(userId, '2026-03');

            expect(result.accounts).toHaveLength(1);
            expect(result.accounts[0].id).toBe('acct-1');
            expect(result.accounts[0].name).toBe('Savings');
            expect(result.accounts[0].currency).toBe('GBP');
            // balance = 500 + 1000 - 200 = 1300
            expect(result.accounts[0].balance).toBe(1300);
        });

        /**
         * DSV-10: getSummary() includes recentTransactions (last 5)
         */
        it('DSV-10: includes recentTransactions mapped from prisma.transaction.findMany', async () => {
            const mockTx = {
                id: 'tx-1',
                date: new Date('2026-03-10T00:00:00Z'),
                description: 'Supermarket',
                amount: 75.50,
                transactionType: 'expense',
                category: {name: 'Groceries'},
                account: {name: 'Checking'}
            };
            setupSummaryMocks({
                accounts: [], income: null, expense: null, count: 0, recent: [mockTx]
            });

            const result = await service.getSummary(userId, '2026-03');

            expect(result.recentTransactions).toHaveLength(1);
            expect(result.recentTransactions[0].id).toBe('tx-1');
            expect(result.recentTransactions[0].description).toBe('Supermarket');
            expect(result.recentTransactions[0].amount).toBe(75.5);
            expect(result.recentTransactions[0].categoryName).toBe('Groceries');
            expect(result.recentTransactions[0].accountName).toBe('Checking');
        });

        /**
         * DSV-11: getSummary() defaults to current month when month is undefined
         */
        it('DSV-11: defaults to current month label when month is undefined', async () => {
            setupSummaryMocks({accounts: [], income: null, expense: null, count: 0});

            const result = await service.getSummary(userId, undefined);

            const now = new Date();
            const expectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            expect(result.month).toBe(expectedMonth);
        });

        /**
         * DSV-12: getSummary() uses UTC boundaries for month range (not local time)
         */
        it('DSV-12: uses UTC boundaries when building the month date range', async () => {
            setupSummaryMocks({accounts: [], income: null, expense: null, count: 0});

            await service.getSummary(userId, '2026-03');

            // Aggregate calls should use UTC start (March 1) and UTC end (March 31 23:59:59.999)
            const incomeCall = prisma.transaction.aggregate.mock.calls[0][0];
            expect(incomeCall.where.date.gte).toEqual(new Date(Date.UTC(2026, 2, 1)));
            const expectedEnd = new Date(Date.UTC(2026, 2, 31, 23, 59, 59, 999));
            expect(incomeCall.where.date.lte).toEqual(expectedEnd);
        });
    });

    describe('getSpendingByCategory', () => {
        /**
         * DSV-13: getSpendingByCategory() groups expense transactions by categoryId
         */
        it('DSV-13: groups expense transactions by categoryId', async () => {
            const categoryId1 = 'cat-food';
            const categoryId2 = 'cat-transport';

            prisma.transaction.groupBy.mockResolvedValue([
                {categoryId: categoryId1, _sum: {amount: 400}},
                {categoryId: categoryId2, _sum: {amount: 100}}
            ]);
            prisma.category.findMany.mockResolvedValue([
                {id: categoryId1, name: 'Food', color: '#FF0000'},
                {id: categoryId2, name: 'Transport', color: '#00FF00'}
            ]);

            const result = await service.getSpendingByCategory(userId, '2026-03');

            expect(result.items).toHaveLength(2);
            expect(result.items[0].categoryId).toBe(categoryId1);
            expect(result.items[0].categoryName).toBe('Food');
            expect(result.items[0].total).toBe(400);
            expect(result.items[1].categoryId).toBe(categoryId2);
            expect(result.items[1].categoryName).toBe('Transport');
            expect(result.items[1].total).toBe(100);
        });

        /**
         * DSV-14: getSpendingByCategory() — the groupBy query does NOT filter out null categoryIds
         * (BUG-02 fix): uncategorised expenses must be included
         */
        it('DSV-14: groupBy query does NOT filter out null categoryId entries', async () => {
            prisma.transaction.groupBy.mockResolvedValue([]);
            prisma.category.findMany.mockResolvedValue([]);

            await service.getSpendingByCategory(userId, '2026-03');

            const call = prisma.transaction.groupBy.mock.calls[0][0];
            expect(call.where).not.toHaveProperty('categoryId');
        });

        /**
         * DSV-15: getSpendingByCategory() handles null categoryId as "Uncategorised"
         */
        it('DSV-15: maps null categoryId to "Uncategorised" category name', async () => {
            prisma.transaction.groupBy.mockResolvedValue([
                {categoryId: null, _sum: {amount: 200}},
                {categoryId: 'cat-food', _sum: {amount: 300}}
            ]);
            prisma.category.findMany.mockResolvedValue([
                {id: 'cat-food', name: 'Food', color: null}
            ]);

            const result = await service.getSpendingByCategory(userId, '2026-03');

            const uncategorised = result.items.find(i => i.categoryId === null);
            expect(uncategorised).toBeDefined();
            expect(uncategorised?.categoryName).toBe('Uncategorised');
            expect(uncategorised?.total).toBe(200);
        });

        /**
         * DSV-16: getSpendingByCategory() computes percentages summing to ~100
         */
        it('DSV-16: computes percentages that sum to approximately 100', async () => {
            const categoryId1 = 'cat-a';
            const categoryId2 = 'cat-b';
            const categoryId3 = 'cat-c';

            prisma.transaction.groupBy.mockResolvedValue([
                {categoryId: categoryId1, _sum: {amount: 500}},
                {categoryId: categoryId2, _sum: {amount: 300}},
                {categoryId: categoryId3, _sum: {amount: 200}}
            ]);
            prisma.category.findMany.mockResolvedValue([
                {id: categoryId1, name: 'A', color: null},
                {id: categoryId2, name: 'B', color: null},
                {id: categoryId3, name: 'C', color: null}
            ]);

            const result = await service.getSpendingByCategory(userId, '2026-03');

            const totalPercentage = result.items.reduce((sum, c) => sum + c.percentage, 0);
            // Percentages: 50 + 30 + 20 = 100
            expect(totalPercentage).toBeCloseTo(100, 1);
            expect(result.items[0].percentage).toBe(50);
            expect(result.items[1].percentage).toBe(30);
            expect(result.items[2].percentage).toBe(20);
        });

        /**
         * DSV-17: getSpendingByCategory() with no expenses returns empty items array
         */
        it('DSV-17: returns empty items array when there are no expenses', async () => {
            prisma.transaction.groupBy.mockResolvedValue([]);

            const result = await service.getSpendingByCategory(userId, '2026-03');

            expect(result.items).toEqual([]);
            expect(result.month).toBe('2026-03');
            // category.findMany should not be called when there are no categories
            expect(prisma.category.findMany).not.toHaveBeenCalled();
        });

        /**
         * DSV-18: getSpendingByCategory() response uses `items` key not `categories`
         */
        it('DSV-18: response object has an `items` key (not `categories`)', async () => {
            prisma.transaction.groupBy.mockResolvedValue([]);

            const result = await service.getSpendingByCategory(userId, '2026-03');

            expect(result).toHaveProperty('items');
            expect(result).not.toHaveProperty('categories');
        });
    });
});
