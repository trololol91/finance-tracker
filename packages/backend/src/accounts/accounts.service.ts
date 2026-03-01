import {
    Injectable,
    NotFoundException,
    ConflictException,
    Logger
} from '@nestjs/common';
import {PrismaService} from '#database/prisma.service.js';
import {PrismaClientKnownRequestError} from '#generated/prisma/internal/prismaNamespace.js';
import type {Account} from '#generated/prisma/client.js';
import {TransactionType} from '#generated/prisma/client.js';
import type {CreateAccountDto} from './dto/create-account.dto.js';
import type {UpdateAccountDto} from './dto/update-account.dto.js';
import {AccountResponseDto} from './dto/account-response.dto.js';

@Injectable()
export class AccountsService {
    private readonly logger = new Logger(AccountsService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * List all accounts for the given user.
     * Returns accounts ordered by name with computed currentBalance and transactionCount.
     */
    public async findAll(userId: string): Promise<AccountResponseDto[]> {
        const accounts = await this.prisma.account.findMany({
            where: {userId},
            orderBy: {name: 'asc'}
        });

        return Promise.all(accounts.map(a => this.toDto(a)));
    }

    /**
     * Get a single account belonging to the given user.
     * Throws NotFoundException if not found or belongs to another user.
     */
    public async findOne(userId: string, id: string): Promise<AccountResponseDto> {
        const account = await this.prisma.account.findFirst({
            where: {id, userId}
        });

        if (!account) {
            throw new NotFoundException(`Account with ID ${id} not found`);
        }

        return this.toDto(account);
    }

    /**
     * Create an account for the given user.
     * Throws ConflictException on duplicate name for the same user.
     */
    public async create(userId: string, dto: CreateAccountDto): Promise<AccountResponseDto> {
        await this.checkNameUnique(userId, dto.name);

        try {
            const account = await this.prisma.account.create({
                data: {
                    userId,
                    name: dto.name,
                    type: dto.type,
                    institution: dto.institution ?? null,
                    currency: dto.currency ?? 'CAD',
                    openingBalance: dto.openingBalance ?? 0,
                    color: dto.color ?? null,
                    notes: dto.notes ?? null,
                    isActive: dto.isActive ?? true
                }
            });

            return this.toDto(account);
        } catch (err) {
            if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
                throw new ConflictException('An account with this name already exists');
            }
            this.logger.error('Failed to create account', (err as Error).stack);
            throw err;
        }
    }

    /**
     * Partially update an account.
     * Throws ConflictException on duplicate name.
     */
    public async update(
        userId: string,
        id: string,
        dto: UpdateAccountDto
    ): Promise<AccountResponseDto> {
        const existing = await this.prisma.account.findFirst({
            where: {id, userId}
        });

        if (!existing) {
            throw new NotFoundException(`Account with ID ${id} not found`);
        }

        if (dto.name !== undefined && dto.name !== existing.name) {
            await this.checkNameUnique(userId, dto.name, id);
        }

        try {
            const updated = await this.prisma.account.update({
                where: {id},
                data: {
                    ...(dto.name !== undefined && {name: dto.name}),
                    ...(dto.type !== undefined && {type: dto.type}),
                    ...(dto.institution !== undefined && {institution: dto.institution ?? null}),
                    ...(dto.currency !== undefined && {currency: dto.currency}),
                    ...(dto.openingBalance !== undefined && {openingBalance: dto.openingBalance}),
                    ...(dto.color !== undefined && {color: dto.color ?? null}),
                    ...(dto.notes !== undefined && {notes: dto.notes ?? null}),
                    ...(dto.isActive !== undefined && {isActive: dto.isActive})
                }
            });

            return this.toDto(updated);
        } catch (err) {
            if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
                throw new ConflictException('An account with this name already exists');
            }
            this.logger.error('Failed to update account', (err as Error).stack);
            throw err;
        }
    }

    /**
     * Delete an account.
     * - Hard-deletes if no transactions are linked.
     * - Soft-deletes (isActive=false) if transactions exist.
     * Returns null on hard-delete (204); DTO on soft-delete (200).
     */
    public async remove(userId: string, id: string): Promise<AccountResponseDto | null> {
        const account = await this.prisma.account.findFirst({
            where: {id, userId},
            include: {
                _count: {select: {transactions: true}}
            }
        });

        if (!account) {
            throw new NotFoundException(`Account with ID ${id} not found`);
        }

        if (account._count.transactions > 0) {
            // Soft-delete: keep record but mark inactive
            const updated = await this.prisma.account.update({
                where: {id},
                data: {isActive: false}
            });
            return this.toDto(updated);
        }

        // Hard-delete: no transactions linked
        await this.prisma.account.delete({where: {id}});
        return null;
    }

    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------

    /**
     * Compute currentBalance and transactionCount for an account and return DTO.
     * currentBalance = openingBalance + Σ(active income) − Σ(active expense).
     * Transfers are excluded from balance calculation.
     */
    private async toDto(account: Account): Promise<AccountResponseDto> {
        const [sums, transactionCount] = await Promise.all([
            this.prisma.transaction.groupBy({
                by: ['transactionType'],
                where: {
                    accountId: account.id,
                    isActive: true,
                    transactionType: {in: [TransactionType.income, TransactionType.expense]}
                },
                _sum: {amount: true}
            }),
            this.prisma.transaction.count({
                where: {accountId: account.id}
            })
        ]);

        const incomeRec = sums.find(s => s.transactionType === TransactionType.income);
        const expenseRec = sums.find(s => s.transactionType === TransactionType.expense);
        const incomeSum = incomeRec?._sum.amount ?? 0;
        const expenseSum = expenseRec?._sum.amount ?? 0;
        const currentBalance =
            Number(account.openingBalance) + Number(incomeSum) - Number(expenseSum);

        return AccountResponseDto.fromEntity(account, currentBalance, transactionCount);
    }

    /**
     * Ensure no active account with the same name exists for this user.
     * @param excludeId - When updating, skip the row being updated.
     */
    private async checkNameUnique(
        userId: string,
        name: string,
        excludeId?: string
    ): Promise<void> {
        const conflict = await this.prisma.account.findFirst({
            where: {
                userId,
                name,
                isActive: true,
                ...(excludeId !== undefined && {id: {not: excludeId}})
            }
        });

        if (conflict) {
            throw new ConflictException('An account with this name already exists');
        }
    }
}
