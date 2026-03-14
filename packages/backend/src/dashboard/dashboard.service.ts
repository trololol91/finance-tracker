import {Injectable} from '@nestjs/common';
import {PrismaService} from '#database/prisma.service.js';
import {
    DashboardSummaryDto,
    AccountBalanceSummaryItemDto,
    TransactionSummaryItemDto
} from './dto/dashboard-summary.dto.js';
import {
    SpendingByCategoryDto, SpendingByCategoryItemDto
} from './dto/spending-by-category.dto.js';

@Injectable()
export class DashboardService {
    constructor(private readonly prisma: PrismaService) {}

    private parseMonth(month?: string): {start: Date, end: Date, label: string} {
        const now = new Date();
        const label = month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const [year, mon] = label.split('-').map(Number);
        const start = new Date(Date.UTC(year, mon - 1, 1));
        const end = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999));
        return {start, end, label};
    }

    public async getSummary(userId: string, month?: string): Promise<DashboardSummaryDto> {
        const {start, end, label} = this.parseMonth(month);

        // Monthly income and expenses in parallel
        const [incomeResult, expenseResult] = await Promise.all([
            this.prisma.transaction.aggregate({
                where: {userId, isActive: true, transactionType: 'income', date: {gte: start, lte: end}},
                _sum: {amount: true}
            }),
            this.prisma.transaction.aggregate({
                where: {userId, isActive: true, transactionType: 'expense', date: {gte: start, lte: end}},
                _sum: {amount: true}
            })
        ]);

        const totalIncome = Number(incomeResult._sum.amount ?? 0);
        const totalExpenses = Number(expenseResult._sum.amount ?? 0);
        const netBalance = totalIncome - totalExpenses;

        const savingsRate = totalIncome > 0
            ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 10000) / 100
            : null;

        // Count of non-transfer transactions in the period
        const transactionCount = await this.prisma.transaction.count({
            where: {
                userId,
                isActive: true,
                date: {gte: start, lte: end},
                transactionType: {not: 'transfer'}
            }
        });

        // Account balances: openingBalance + net of all-time active non-transfer transactions
        // Uses aggregate _sum per account to avoid loading all transactions into memory (no N+1).
        const rawAccounts = await this.prisma.account.findMany({
            where: {userId, isActive: true},
            select: {id: true, name: true, currency: true, openingBalance: true}
        });

        const [incomeByAccount, expenseByAccount] = await Promise.all([
            this.prisma.transaction.groupBy({
                by: ['accountId'],
                where: {userId, isActive: true, transactionType: 'income'},
                _sum: {amount: true}
            }),
            this.prisma.transaction.groupBy({
                by: ['accountId'],
                where: {userId, isActive: true, transactionType: 'expense'},
                _sum: {amount: true}
            })
        ]);

        const incomeMap = new Map(
            incomeByAccount.map(r => [r.accountId, Number(r._sum.amount ?? 0)])
        );
        const expenseMap = new Map(
            expenseByAccount.map(r => [r.accountId, Number(r._sum.amount ?? 0)])
        );

        const accounts: AccountBalanceSummaryItemDto[] = rawAccounts.map(a => {
            const balance = Number(a.openingBalance)
                + (incomeMap.get(a.id) ?? 0)
                - (expenseMap.get(a.id) ?? 0);
            return {id: a.id, name: a.name, currency: a.currency, balance};
        });

        // Recent transactions (last 5)
        const recent = await this.prisma.transaction.findMany({
            where: {userId, isActive: true},
            orderBy: {date: 'desc'},
            take: 5,
            include: {
                category: {select: {name: true}},
                account: {select: {name: true}}
            }
        });

        const recentTransactions: TransactionSummaryItemDto[] = recent.map(t => ({
            id: t.id,
            date: t.date.toISOString(),
            description: t.description,
            amount: Number(t.amount),
            transactionType: t.transactionType,
            categoryName: t.category?.name ?? null,
            accountName: t.account?.name ?? null
        }));

        return {
            month: label,
            totalIncome,
            totalExpenses,
            netBalance,
            transactionCount,
            savingsRate,
            accounts,
            recentTransactions
        };
    }

    public async getSpendingByCategory(
        userId: string,
        month?: string
    ): Promise<SpendingByCategoryDto> {
        const {start, end, label} = this.parseMonth(month);

        // BUG-02 fix: removed categoryId: { not: null } to include uncategorised expenses
        const grouped = await this.prisma.transaction.groupBy({
            by: ['categoryId'],
            where: {
                userId,
                isActive: true,
                transactionType: 'expense',
                date: {gte: start, lte: end}
            },
            _sum: {amount: true},
            orderBy: {_sum: {amount: 'desc'}}
        });

        const totalExpenses = grouped.reduce((sum, g) => sum + Number(g._sum.amount ?? 0), 0);

        const categoryIds = grouped
            .map(g => g.categoryId)
            .filter((id): id is string => id !== null);
        const categoryMap = new Map<string, {name: string, color: string | null}>();

        if (categoryIds.length > 0) {
            const cats = await this.prisma.category.findMany({
                where: {id: {in: categoryIds}},
                select: {id: true, name: true, color: true}
            });
            for (const c of cats) {
                categoryMap.set(c.id, {name: c.name, color: c.color});
            }
        }

        // BUG-04 fix: return `items` instead of `categories`
        const items: SpendingByCategoryItemDto[] = grouped.map(g => {
            const total = Number(g._sum.amount ?? 0);
            // BUG-02 fix: handle null categoryId → "Uncategorised"
            const cat = g.categoryId ? categoryMap.get(g.categoryId) : undefined;
            return {
                categoryId: g.categoryId ?? null,
                categoryName: cat?.name ?? 'Uncategorised',
                color: cat?.color ?? null,
                total,
                percentage: totalExpenses > 0
                    ? Math.round((total / totalExpenses) * 10000) / 100
                    : 0
            };
        });

        return {items, month: label};
    }
}
