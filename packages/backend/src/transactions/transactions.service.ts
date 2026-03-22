import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ServiceUnavailableException
} from '@nestjs/common';
import {PrismaService} from '#database/prisma.service.js';
import type {
    Transaction,
    Prisma
} from '#generated/prisma/client.js';
import {TransactionType} from '#generated/prisma/client.js';
import type {CreateTransactionDto} from './dto/create-transaction.dto.js';
import type {UpdateTransactionDto} from './dto/update-transaction.dto.js';
import type {TransactionFilterDto} from './dto/transaction-filter.dto.js';
import type {CategorizeSuggestionRequestDto} from './dto/categorize-suggestion-request.dto.js';
import type {CategorizeSuggestionResponseDto} from './dto/categorize-suggestion-response.dto.js';
import type {BulkCategorizeResponseDto} from './dto/bulk-categorize-response.dto.js';
import type {BulkCategorizeQueryDto} from './dto/bulk-categorize-query.dto.js';
import {CategoriesService} from '#categories/categories.service.js';
import {AiCategorizationService} from '#ai-categorization/ai-categorization.service.js';
import {CategoryRulesService} from '#category-rules/category-rules.service.js';

export interface PaginatedTransactions {
    data: Transaction[];
    total: number;
    page: number;
    limit: number;
}

export interface TransactionTotals {
    totalIncome: number;
    totalExpense: number;
    netTotal: number;
    startDate: string;
    endDate: string;
}

@Injectable()
export class TransactionsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly categoriesService: CategoriesService,
        private readonly aiCategorizationService: AiCategorizationService,
        private readonly categoryRulesService: CategoryRulesService
    ) {}

    /**
     * Create a transaction for the given user.
     * originalDate is set from date on creation and never changes.
     */
    public async create(userId: string, createDto: CreateTransactionDto): Promise<Transaction> {
        const date = new Date(createDto.date);

        return this.prisma.transaction.create({
            data: {
                userId,
                amount: Math.abs(createDto.amount),
                description: createDto.description,
                notes: createDto.notes ?? null,
                categoryId: createDto.categoryId ?? null,
                accountId: createDto.accountId ?? null,
                transactionType: createDto.transactionType,
                date,
                originalDate: date,
                isActive: true
            }
        });
    }

    /**
     * List all transactions for the given user with optional filters and pagination.
     * Defaults to active transactions only (isActive='true').
     */
    public async findAll(
        userId: string,
        filters: TransactionFilterDto
    ): Promise<PaginatedTransactions> {
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 50;
        const skip = (page - 1) * limit;

        const where = this.buildWhereClause(userId, filters);

        const [data, total] = await Promise.all([
            this.prisma.transaction.findMany({
                where,
                orderBy: {date: 'desc'},
                skip,
                take: limit
            }),
            this.prisma.transaction.count({where})
        ]);

        return {data, total, page, limit};
    }

    /**
     * Get a single transaction belonging to the given user.
     * Throws NotFoundException if not found or belongs to another user.
     */
    public async findOne(userId: string, transactionId: string): Promise<Transaction> {
        const transaction = await this.prisma.transaction.findFirst({
            where: {id: transactionId, userId}
        });

        if (!transaction) {
            throw new NotFoundException(`Transaction with ID ${transactionId} not found`);
        }

        return transaction;
    }

    /**
     * Update a transaction. originalDate is never modified.
     * transactionType is not updatable.
     */
    public async update(
        userId: string,
        transactionId: string,
        updateDto: UpdateTransactionDto
    ): Promise<Transaction> {
        await this.findOne(userId, transactionId);

        return this.prisma.transaction.update({
            where: {id: transactionId},
            data: {
                ...(updateDto.amount !== undefined && {amount: Math.abs(updateDto.amount)}),
                ...(updateDto.description !== undefined && {description: updateDto.description}),
                ...(updateDto.notes !== undefined && {notes: updateDto.notes}),
                ...(updateDto.categoryId !== undefined && {categoryId: updateDto.categoryId}),
                ...(updateDto.accountId !== undefined && {accountId: updateDto.accountId}),
                ...(updateDto.date !== undefined && {date: new Date(updateDto.date)}),
                ...(updateDto.isActive !== undefined && {isActive: updateDto.isActive})
            }
        });
    }

    /**
     * Toggle the isActive status of a transaction.
     */
    public async toggleActive(userId: string, transactionId: string): Promise<Transaction> {
        const transaction = await this.findOne(userId, transactionId);

        return this.prisma.transaction.update({
            where: {id: transactionId},
            data: {isActive: !transaction.isActive}
        });
    }

    /**
     * Permanently delete a transaction.
     */
    public async remove(userId: string, transactionId: string): Promise<void> {
        await this.findOne(userId, transactionId);

        await this.prisma.transaction.delete({
            where: {id: transactionId}
        });
    }

    /**
     * Get income/expense totals for a date range (active transactions only).
     * Transfers are excluded from both totals.
     */
    public async getTotals(
        userId: string,
        startDate: string,
        endDate: string
    ): Promise<TransactionTotals> {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime())) {
            throw new BadRequestException(`Invalid startDate: "${startDate}"`);
        }
        if (isNaN(end.getTime())) {
            throw new BadRequestException(`Invalid endDate: "${endDate}"`);
        }

        const dateFilter = {
            gte: start,
            lte: end
        };

        const baseWhere = {userId, isActive: true, date: dateFilter};

        const [incomeResult, expenseResult] = await Promise.all([
            this.prisma.transaction.aggregate({
                where: {...baseWhere, transactionType: TransactionType.income},
                _sum: {amount: true}
            }),
            this.prisma.transaction.aggregate({
                where: {...baseWhere, transactionType: TransactionType.expense},
                _sum: {amount: true}
            })
        ]);

        const totalIncome = incomeResult._sum.amount?.toNumber() ?? 0;
        const totalExpense = expenseResult._sum.amount?.toNumber() ?? 0;

        return {
            totalIncome,
            totalExpense,
            netTotal: totalIncome - totalExpense,
            startDate,
            endDate
        };
    }

    /**
     * Convenience method: get totals for a full calendar month.
     * Month is 1-based (1 = January, 12 = December).
     */
    public async getMonthlyTotals(
        userId: string,
        year: number,
        month: number
    ): Promise<TransactionTotals> {
        if (month < 1 || month > 12) {
            throw new BadRequestException('Month must be between 1 and 12');
        }
        if (year < 1 || year > 9999) {
            throw new BadRequestException('Year must be between 1 and 9999');
        }

        const start = new Date(Date.UTC(year, month - 1, 1));
        const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

        return this.getTotals(userId, start.toISOString(), end.toISOString());
    }

    /**
     * Get an AI-suggested category for a transaction description/amount/type.
     * Falls back to the 'Other' category (or first active category) if no match.
     */
    public async categorizeSuggestion(
        userId: string,
        dto: CategorizeSuggestionRequestDto
    ): Promise<CategorizeSuggestionResponseDto> {
        if (!this.aiCategorizationService.available) {
            throw new ServiceUnavailableException('AI categorization is not configured');
        }

        const categories = await this.categoriesService.findAll(userId);
        const active = categories.filter(c => c.isActive);

        if (active.length === 0) {
            throw new BadRequestException('No active categories available for suggestion');
        }

        const categoryNames = active.map(c => c.name);

        const suggestedName = await this.aiCategorizationService.suggestCategory(
            dto.description,
            dto.amount,
            dto.transactionType,
            categoryNames
        );

        const fallback = active.find(c => c.name === 'Other') ?? active[0];

        const match = suggestedName !== null
            ? (active.find(c => c.name.toLowerCase() === suggestedName.toLowerCase()) ?? fallback)
            : fallback;

        return {categoryId: match.id, categoryName: match.name};
    }

    /**
     * Auto-categorize all uncategorized active transactions for the given user.
     * Optionally filtered by accountId, startDate, endDate.
     */
    public async bulkCategorize(
        userId: string,
        filters: BulkCategorizeQueryDto
    ): Promise<BulkCategorizeResponseDto> {
        if (filters.startDate !== undefined) {
            if (isNaN(new Date(filters.startDate).getTime())) {
                throw new BadRequestException('Invalid date format');
            }
        }
        if (filters.endDate !== undefined) {
            if (isNaN(new Date(filters.endDate).getTime())) {
                throw new BadRequestException('Invalid date format');
            }
        }

        const categories = await this.categoriesService.findAll(userId);
        const active = categories.filter(c => c.isActive);

        if (active.length === 0) {
            throw new BadRequestException('No active categories found. Add categories before bulk categorizing.');
        }

        const categoryNames = active.map(c => c.name);
        const otherCat = active.find(c => c.name === 'Other') ?? active[0];

        const where: Prisma.TransactionWhereInput = {
            userId,
            categoryId: null,
            isActive: true,
            ...(filters.accountId && {accountId: filters.accountId}),
            ...((filters.startDate ?? filters.endDate) && {
                date: {
                    ...(filters.startDate && {gte: new Date(filters.startDate)}),
                    ...(filters.endDate && {lte: new Date(filters.endDate)})
                }
            })
        };

        const total = await this.prisma.transaction.count({where});
        const transactions = await this.prisma.transaction.findMany({where, take: 200});

        const matchRule = await this.categoryRulesService.buildMatcher(userId);

        const needsAi: typeof transactions = [];
        const updates: {id: string, categoryId: string}[] = [];

        for (const tx of transactions) {
            const ruleMatch = matchRule(tx.description);
            if (ruleMatch !== null) {
                updates.push({id: tx.id, categoryId: ruleMatch});
            } else {
                needsAi.push(tx);
            }
        }

        const suggestionMap = await this.aiCategorizationService.suggestCategories(
            needsAi.map(tx => ({
                id: tx.id,
                description: tx.description,
                amount: Number(tx.amount),
                transactionType: tx.transactionType
            })),
            categoryNames
        );

        for (const tx of needsAi) {
            const suggestedName = suggestionMap.get(tx.id) ?? null;
            const found = active.find(c => c.name.toLowerCase() === suggestedName?.toLowerCase());
            const match = suggestedName !== null ? (found ?? otherCat) : otherCat;
            updates.push({id: tx.id, categoryId: match.id});
        }

        if (updates.length > 0) {
            await this.prisma.$transaction(
                updates.map(u =>
                    this.prisma.transaction.update({
                        where: {id: u.id},
                        data: {categoryId: u.categoryId}
                    })
                )
            );
        }

        return {categorized: updates.length, skipped: 0, total, processed: transactions.length};
    }

    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------

    private buildWhereClause(
        userId: string,
        filters: TransactionFilterDto
    ): Prisma.TransactionWhereInput {
        const where: Prisma.TransactionWhereInput = {userId};

        // isActive filter — default 'true'
        const isActiveParam = filters.isActive ?? 'true';
        if (isActiveParam === 'true') {
            where.isActive = true;
        } else if (isActiveParam === 'false') {
            where.isActive = false;
        }
        // 'all' → no isActive filter added

        if (filters.startDate || filters.endDate) {
            where.date = {};
            if (filters.startDate) {
                where.date.gte = new Date(filters.startDate);
            }
            if (filters.endDate) {
                where.date.lte = new Date(filters.endDate);
            }
        }

        if (filters.categoryId) {
            where.categoryId = filters.categoryId;
        }

        if (filters.accountId) {
            where.accountId = filters.accountId;
        }

        if (filters.transactionType) {
            where.transactionType = filters.transactionType;
        }

        if (filters.search) {
            where.description = {contains: filters.search, mode: 'insensitive'};
        }

        return where;
    }
}
