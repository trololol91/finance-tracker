import {
    describe, it, expect, beforeEach, vi
} from 'vitest';
import {
    NotFoundException, ConflictException
} from '@nestjs/common';
import {CategoryRulesService} from '#category-rules/category-rules.service.js';
import type {PrismaService} from '#database/prisma.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeRule = (overrides: Record<string, unknown> = {}) => ({
    id: 'rule-uuid-1',
    userId: 'user-uuid-1',
    pattern: 'tim hortons',
    categoryId: 'cat-uuid-food',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    category: {name: 'Food & Dining'},
    ...overrides
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CategoryRulesService', () => {
    let service: CategoryRulesService;
    let prisma: {
        categoryRule: {
            findMany: ReturnType<typeof vi.fn>;
            findFirst: ReturnType<typeof vi.fn>;
            create: ReturnType<typeof vi.fn>;
            delete: ReturnType<typeof vi.fn>;
        };
        category: {
            findFirst: ReturnType<typeof vi.fn>;
        };
        transaction: {
            findMany: ReturnType<typeof vi.fn>;
            updateMany: ReturnType<typeof vi.fn>;
        };
    };

    const userId = 'user-uuid-1';

    beforeEach(() => {
        prisma = {
            categoryRule: {
                findMany: vi.fn(),
                findFirst: vi.fn(),
                create: vi.fn(),
                delete: vi.fn()
            },
            category: {
                findFirst: vi.fn()
            },
            transaction: {
                findMany: vi.fn(),
                updateMany: vi.fn()
            }
        };
        service = new CategoryRulesService(prisma as unknown as PrismaService);
    });

    // -----------------------------------------------------------------------
    // findAll
    // -----------------------------------------------------------------------
    describe('findAll', () => {
        it('should return mapped DTOs for user rules', async () => {
            prisma.categoryRule.findMany.mockResolvedValue([makeRule()]);

            const result = await service.findAll(userId);

            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                id: 'rule-uuid-1',
                pattern: 'tim hortons',
                categoryName: 'Food & Dining',
                createdAt: '2026-01-01T00:00:00.000Z'
            });
        });

        it('should return empty array when user has no rules', async () => {
            prisma.categoryRule.findMany.mockResolvedValue([]);
            const result = await service.findAll(userId);
            expect(result).toEqual([]);
        });
    });

    // -----------------------------------------------------------------------
    // create
    // -----------------------------------------------------------------------
    describe('create', () => {
        const dto = {pattern: '  Tim Hortons  ', categoryId: 'cat-uuid-food', applyToExisting: false};

        it('should throw NotFoundException when category does not exist', async () => {
            prisma.category.findFirst.mockResolvedValue(null);
            await expect(service.create(userId, dto)).rejects.toBeInstanceOf(NotFoundException);
        });

        it('should create rule and return DTO', async () => {
            prisma.category.findFirst.mockResolvedValue({id: 'cat-uuid-food', name: 'Food & Dining'});
            prisma.categoryRule.create.mockResolvedValue(makeRule({pattern: 'Tim Hortons'}));

            const result = await service.create(userId, dto);

            expect(prisma.categoryRule.create).toHaveBeenCalledWith(
                expect.objectContaining({data: {userId, pattern: 'Tim Hortons', categoryId: 'cat-uuid-food'}})
            );
            expect(result.pattern).toBe('Tim Hortons');
        });

        it('should throw ConflictException on P2002 duplicate', async () => {
            prisma.category.findFirst.mockResolvedValue({id: 'cat-uuid-food'});
            prisma.categoryRule.create.mockRejectedValue({code: 'P2002'});

            await expect(service.create(userId, dto)).rejects.toBeInstanceOf(ConflictException);
        });

        it('should re-throw non-P2002 errors', async () => {
            prisma.category.findFirst.mockResolvedValue({id: 'cat-uuid-food'});
            prisma.categoryRule.create.mockRejectedValue(new Error('DB down'));

            await expect(service.create(userId, dto)).rejects.toThrow('DB down');
        });

        it('should apply rule to existing uncategorized transactions when applyToExisting=true', async () => {
            prisma.category.findFirst.mockResolvedValue({id: 'cat-uuid-food'});
            prisma.categoryRule.create.mockResolvedValue(makeRule());
            prisma.transaction.findMany.mockResolvedValue([
                {id: 'tx-1', description: 'TIM HORTONS #042'},
                {id: 'tx-2', description: 'SHOPPERS DRUG MART'}
            ]);
            prisma.transaction.updateMany.mockResolvedValue({count: 1});

            await service.create(userId, {...dto, pattern: 'tim hortons', applyToExisting: true});

            expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
                where: {id: {in: ['tx-1']}},
                data: {categoryId: 'cat-uuid-food'}
            });
        });

        it('should not call updateMany when no transactions match', async () => {
            prisma.category.findFirst.mockResolvedValue({id: 'cat-uuid-food'});
            prisma.categoryRule.create.mockResolvedValue(makeRule());
            prisma.transaction.findMany.mockResolvedValue([
                {id: 'tx-1', description: 'SHOPPERS DRUG MART'}
            ]);

            await service.create(userId, {...dto, applyToExisting: true});

            expect(prisma.transaction.updateMany).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // remove
    // -----------------------------------------------------------------------
    describe('remove', () => {
        it('should throw NotFoundException when rule not found', async () => {
            prisma.categoryRule.findFirst.mockResolvedValue(null);
            await expect(service.remove(userId, 'rule-uuid-1')).rejects.toBeInstanceOf(NotFoundException);
        });

        it('should delete the rule when found', async () => {
            prisma.categoryRule.findFirst.mockResolvedValue(makeRule());
            prisma.categoryRule.delete.mockResolvedValue(makeRule());

            await service.remove(userId, 'rule-uuid-1');

            expect(prisma.categoryRule.delete).toHaveBeenCalledWith({where: {id: 'rule-uuid-1'}});
        });
    });

    // -----------------------------------------------------------------------
    // matchRule
    // -----------------------------------------------------------------------
    describe('matchRule', () => {
        it('should return categoryId when description contains pattern (case-insensitive)', async () => {
            prisma.categoryRule.findMany.mockResolvedValue([makeRule()]);

            const result = await service.matchRule(userId, 'TIM HORTONS #042 MAIN ST');

            expect(result).toBe('cat-uuid-food');
        });

        it('should return null when no rule matches', async () => {
            prisma.categoryRule.findMany.mockResolvedValue([makeRule()]);

            const result = await service.matchRule(userId, 'SHOPPERS DRUG MART');

            expect(result).toBeNull();
        });

        it('should return null when user has no rules', async () => {
            prisma.categoryRule.findMany.mockResolvedValue([]);
            const result = await service.matchRule(userId, 'anything');
            expect(result).toBeNull();
        });

        it('should match first rule when multiple rules match', async () => {
            prisma.categoryRule.findMany.mockResolvedValue([
                makeRule({pattern: 'tim', categoryId: 'cat-first'}),
                makeRule({pattern: 'hortons', categoryId: 'cat-second'})
            ]);

            const result = await service.matchRule(userId, 'TIM HORTONS');

            expect(result).toBe('cat-first');
        });
    });

    // -----------------------------------------------------------------------
    // buildMatcher
    // -----------------------------------------------------------------------
    describe('buildMatcher', () => {
        it('should return a function that matches case-insensitively', async () => {
            prisma.categoryRule.findMany.mockResolvedValue([makeRule()]);

            const matcher = await service.buildMatcher(userId);

            expect(matcher('TIM HORTONS ON MAIN')).toBe('cat-uuid-food');
        });

        it('should return null for non-matching description', async () => {
            prisma.categoryRule.findMany.mockResolvedValue([makeRule()]);

            const matcher = await service.buildMatcher(userId);

            expect(matcher('AMAZON MARKETPLACE')).toBeNull();
        });

        it('should only query DB once regardless of how many times matcher is called', async () => {
            prisma.categoryRule.findMany.mockResolvedValue([makeRule()]);

            const matcher = await service.buildMatcher(userId);
            matcher('TIM HORTONS A');
            matcher('TIM HORTONS B');
            matcher('OTHER');

            expect(prisma.categoryRule.findMany).toHaveBeenCalledTimes(1);
        });

        it('should return null from matcher when user has no rules', async () => {
            prisma.categoryRule.findMany.mockResolvedValue([]);

            const matcher = await service.buildMatcher(userId);

            expect(matcher('anything')).toBeNull();
        });
    });
});
