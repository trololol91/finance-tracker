import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ConflictException,
    Logger
} from '@nestjs/common';
import {PrismaService} from '#database/prisma.service.js';
import {PrismaClientKnownRequestError} from '#generated/prisma/internal/prismaNamespace.js';
import type {Category} from '#generated/prisma/client.js';
import type {CreateCategoryDto} from './dto/create-category.dto.js';
import type {UpdateCategoryDto} from './dto/update-category.dto.js';
import {CategoryResponseDto} from './dto/category-response.dto.js';

@Injectable()
export class CategoriesService {
    private readonly logger = new Logger(CategoriesService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * List all categories for the given user.
     * Returns flat list ordered by (parentId nulls first, name).
     * Includes transactionCount for each category.
     * Does NOT filter by isActive — the UI decides whether to show inactive.
     */
    public async findAll(userId: string): Promise<CategoryResponseDto[]> {
        const categories = await this.prisma.category.findMany({
            where: {userId},
            include: {
                _count: {select: {transactions: true}}
            },
            orderBy: [
                {parentId: {sort: 'asc', nulls: 'first'}},
                {name: 'asc'}
            ]
        });

        return categories.map(c =>
            CategoryResponseDto.fromEntity(c, c._count.transactions, [])
        );
    }

    /**
     * Get a single category belonging to the given user.
     * Throws NotFoundException if not found or belongs to another user.
     */
    public async findOne(userId: string, id: string): Promise<CategoryResponseDto> {
        const category = await this.prisma.category.findFirst({
            where: {id, userId},
            include: {
                _count: {select: {transactions: true}}
            }
        });

        if (!category) {
            throw new NotFoundException(`Category with ID ${id} not found`);
        }

        return CategoryResponseDto.fromEntity(category, category._count.transactions, []);
    }

    /**
     * Create a category for the given user.
     * Validates parentId (if provided):
     *   - must exist and belong to the same user
     *   - parent must itself be a top-level category (depth limit = 1)
     * Throws ConflictException on duplicate name within same parent.
     */
    public async create(userId: string, dto: CreateCategoryDto): Promise<CategoryResponseDto> {
        if (dto.parentId) {
            await this.validateParent(userId, dto.parentId);
        }

        try {
            const category = await this.prisma.category.create({
                data: {
                    userId,
                    name: dto.name,
                    description: dto.description ?? null,
                    color: dto.color ?? null,
                    icon: dto.icon ?? null,
                    parentId: dto.parentId ?? null,
                    isActive: true
                },
                include: {
                    _count: {select: {transactions: true}}
                }
            });

            return CategoryResponseDto.fromEntity(category, category._count.transactions, []);
        } catch (err) {
            if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
                throw new ConflictException(
                    'A category with this name already exists at this level'
                );
            }
            this.logger.error('Failed to create category', (err as Error).stack);
            throw err;
        }
    }

    /**
     * Partially update a category.
     * Re-validates parentId if it is being changed.
     * Throws ConflictException on duplicate name.
     */
    public async update(
        userId: string,
        id: string,
        dto: UpdateCategoryDto
    ): Promise<CategoryResponseDto> {
        // Ensure category exists and belongs to the user
        const existing = await this.prisma.category.findFirst({
            where: {id, userId}
        });
        if (!existing) {
            throw new NotFoundException(`Category with ID ${id} not found`);
        }

        // Validate new parentId if provided and changed
        const parentChanging =
            dto.parentId !== undefined &&
            dto.parentId !== null &&
            dto.parentId !== existing.parentId;
        if (parentChanging) {
            await this.validateParent(userId, dto.parentId!);
        }

        try {
            const updated = await this.prisma.category.update({
                where: {id},
                data: {
                    ...(dto.name !== undefined && {name: dto.name}),
                    ...(dto.description !== undefined && {description: dto.description ?? null}),
                    ...(dto.color !== undefined && {color: dto.color ?? null}),
                    ...(dto.icon !== undefined && {icon: dto.icon ?? null}),
                    ...(dto.parentId !== undefined && {parentId: dto.parentId ?? null}),
                    ...(dto.isActive !== undefined && {isActive: dto.isActive})
                },
                include: {
                    _count: {select: {transactions: true}}
                }
            });

            return CategoryResponseDto.fromEntity(updated, updated._count.transactions, []);
        } catch (err) {
            if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
                throw new ConflictException(
                    'A category with this name already exists at this level'
                );
            }
            this.logger.error('Failed to update category', (err as Error).stack);
            throw err;
        }
    }

    /**
     * Delete a category.
     * - Hard-deletes if transactionCount === 0 AND no children.
     * - Soft-deletes (isActive = false) if referenced by transactions.
     * - Throws BadRequestException if the category has children
     *   (user must delete or reassign children first).
     */
    public async remove(userId: string, id: string): Promise<CategoryResponseDto | null> {
        const category = await this.prisma.category.findFirst({
            where: {id, userId},
            include: {
                _count: {
                    select: {
                        transactions: true,
                        children: true
                    }
                }
            }
        });

        if (!category) {
            throw new NotFoundException(`Category with ID ${id} not found`);
        }

        if (category._count.children > 0) {
            throw new BadRequestException(
                'Delete or reassign child categories before deleting this category'
            );
        }

        if (category._count.transactions > 0) {
            // Soft-delete: keep record but mark inactive
            const updated = await this.prisma.category.update({
                where: {id},
                data: {isActive: false},
                include: {
                    _count: {select: {transactions: true}}
                }
            });
            return CategoryResponseDto.fromEntity(updated, updated._count.transactions, []);
        }

        // Hard-delete: no transactions and no children
        await this.prisma.category.delete({where: {id}});
        return null;
    }

    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------

    /**
     * Validate that a parentId:
     *   1. Exists and belongs to the given user.
     *   2. Is itself a top-level category (parentId === null) — depth limit = 1.
     */
    private async validateParent(userId: string, parentId: string): Promise<Category> {
        const parent = await this.prisma.category.findFirst({
            where: {id: parentId, userId}
        });

        if (!parent) {
            throw new NotFoundException(`Parent category with ID ${parentId} not found`);
        }

        if (parent.parentId !== null) {
            throw new BadRequestException(
                'Nesting is limited to one level. The specified parent is already a child category.'
            );
        }

        return parent;
    }
}
