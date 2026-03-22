import {
    Injectable, NotFoundException, ConflictException
} from '@nestjs/common';
import {PrismaService} from '#database/prisma.service.js';
import type {CreateCategoryRuleDto} from './dto/create-category-rule.dto.js';
import type {CategoryRuleResponseDto} from './dto/category-rule-response.dto.js';
import type {CategoryRule} from '#generated/prisma/client.js';

type RuleWithCategory = CategoryRule & {category: {name: string}};

const toDto = (rule: RuleWithCategory): CategoryRuleResponseDto => ({
    id: rule.id,
    userId: rule.userId,
    pattern: rule.pattern,
    categoryId: rule.categoryId,
    categoryName: rule.category.name,
    createdAt: rule.createdAt.toISOString()
});

@Injectable()
export class CategoryRulesService {
    constructor(private readonly prisma: PrismaService) {}

    public async findAll(userId: string): Promise<CategoryRuleResponseDto[]> {
        const rules = await this.prisma.categoryRule.findMany({
            where: {userId},
            include: {category: {select: {name: true}}},
            orderBy: {createdAt: 'asc'}
        });
        return rules.map(toDto);
    }

    public async create(
        userId: string,
        dto: CreateCategoryRuleDto
    ): Promise<CategoryRuleResponseDto> {
        const category = await this.prisma.category.findFirst({
            where: {id: dto.categoryId, userId, isActive: true}
        });
        if (!category) {
            throw new NotFoundException('Category not found');
        }

        const pattern = dto.pattern.trim();

        try {
            const rule = await this.prisma.categoryRule.create({
                data: {userId, pattern, categoryId: dto.categoryId},
                include: {category: {select: {name: true}}}
            });

            if (dto.applyToExisting === true) {
                await this.applyRuleToExisting(userId, pattern, dto.categoryId);
            }

            return toDto(rule);
        } catch (err: unknown) {
            const e = err as {code?: string};
            if (e.code === 'P2002') {
                throw new ConflictException(`A rule for pattern "${pattern}" already exists`);
            }
            throw err;
        }
    }

    public async remove(userId: string, id: string): Promise<void> {
        const rule = await this.prisma.categoryRule.findFirst({where: {id, userId}});
        if (!rule) {
            throw new NotFoundException('Rule not found');
        }
        await this.prisma.categoryRule.delete({where: {id}});
    }

    /**
     * Return the categoryId of the first rule whose pattern is a
     * case-insensitive substring of the given description, or null if none match.
     */
    public async matchRule(
        userId: string,
        description: string
    ): Promise<string | null> {
        const rules = await this.prisma.categoryRule.findMany({
            where: {userId},
            orderBy: {createdAt: 'asc'}
        });
        const lower = description.toLowerCase();
        for (const rule of rules) {
            if (lower.includes(rule.pattern.toLowerCase())) {
                return rule.categoryId;
            }
        }
        return null;
    }

    /**
     * Fetch all rules for a user at once and return a lookup function.
     * Used by bulk operations to avoid N DB queries.
     */
    public async buildMatcher(
        userId: string
    ): Promise<(description: string) => string | null> {
        const rules = await this.prisma.categoryRule.findMany({
            where: {userId},
            orderBy: {createdAt: 'asc'}
        });
        return (description: string): string | null => {
            const lower = description.toLowerCase();
            for (const rule of rules) {
                if (lower.includes(rule.pattern.toLowerCase())) {
                    return rule.categoryId;
                }
            }
            return null;
        };
    }

    private async applyRuleToExisting(
        userId: string,
        pattern: string,
        categoryId: string
    ): Promise<void> {
        const transactions = await this.prisma.transaction.findMany({
            where: {userId, categoryId: null, isActive: true},
            select: {id: true, description: true}
        });
        const lower = pattern.toLowerCase();
        const matching = transactions
            .filter(tx => tx.description.toLowerCase().includes(lower))
            .map(tx => tx.id);

        if (matching.length > 0) {
            await this.prisma.transaction.updateMany({
                where: {id: {in: matching}},
                data: {categoryId}
            });
        }
    }
}
