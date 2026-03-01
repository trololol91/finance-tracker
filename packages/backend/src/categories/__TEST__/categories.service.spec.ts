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
    ConflictException
} from '@nestjs/common';
import {CategoriesService} from '#categories/categories.service.js';
import {CategoryResponseDto} from '#categories/dto/category-response.dto.js';
import type {PrismaService} from '#database/prisma.service.js';
import type {Category} from '#generated/prisma/client.js';
import {PrismaClientKnownRequestError} from '#generated/prisma/internal/prismaNamespace.js';
import type {CreateCategoryDto} from '#categories/dto/create-category.dto.js';
import type {UpdateCategoryDto} from '#categories/dto/update-category.dto.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeCategory = (overrides: Partial<Category> = {}): Category => ({
    id: 'cat-uuid-1',
    userId: 'user-uuid-1',
    name: 'Food',
    description: null,
    color: '#FF5733',
    icon: '🍔',
    parentId: null,
    isActive: true,
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    updatedAt: new Date('2026-01-15T10:00:00.000Z'),
    ...overrides
});

/** Adds the _count shape Prisma include returns */
type CategoryWithCount = Category & {_count: {transactions: number, children?: number}};

const makeWithCount = (
    overrides: Partial<Category> = {},
    txCount = 0,
    childCount = 0
): CategoryWithCount => ({
    ...makeCategory(overrides),
    _count: {transactions: txCount, children: childCount}
});

/** Built P2002 unique constraint error */
const makeP2002 = (): PrismaClientKnownRequestError =>
    new PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.0.0'
    });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CategoriesService', () => {
    let service: CategoriesService;
    let prisma: PrismaService;

    const userId = 'user-uuid-1';
    const otherUserId = 'user-uuid-other';
    const catId = 'cat-uuid-1';

    beforeEach(() => {
        prisma = {
            category: {
                findMany: vi.fn(),
                findFirst: vi.fn(),
                create: vi.fn(),
                update: vi.fn(),
                delete: vi.fn()
            }
        } as unknown as PrismaService;

        service = new CategoriesService(prisma);
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // findAll
    // -------------------------------------------------------------------------

    describe('findAll', () => {
        it('returns empty array when the user has no categories', async () => {
            vi.mocked(prisma.category.findMany).mockResolvedValue([]);

            const result = await service.findAll(userId);

            expect(result).toEqual([]);
            expect(prisma.category.findMany).toHaveBeenCalledWith(
                expect.objectContaining({where: {userId}})
            );
        });

        it('returns categories as CategoryResponseDto array with transactionCount', async () => {
            const cat = makeWithCount({}, 5);
            vi.mocked(prisma.category.findMany).mockResolvedValue([cat] as unknown as Category[]);

            const result = await service.findAll(userId);

            expect(result).toHaveLength(1);
            expect(result[0]).toBeInstanceOf(CategoryResponseDto);
            expect(result[0].transactionCount).toBe(5);
            expect(result[0].name).toBe('Food');
        });

        it('orders by parentId nulls first, then name', async () => {
            vi.mocked(prisma.category.findMany).mockResolvedValue([]);

            await service.findAll(userId);

            expect(prisma.category.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    orderBy: [
                        {parentId: {sort: 'asc', nulls: 'first'}},
                        {name: 'asc'}
                    ]
                })
            );
        });

        it('includes _count.transactions in query', async () => {
            vi.mocked(prisma.category.findMany).mockResolvedValue([]);

            await service.findAll(userId);

            expect(prisma.category.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    include: {_count: {select: {transactions: true}}}
                })
            );
        });

        it('does NOT filter by isActive (returns all)', async () => {
            vi.mocked(prisma.category.findMany).mockResolvedValue([]);

            await service.findAll(userId);

            interface FindManyArg {where: Record<string, unknown>}
            const call = vi.mocked(prisma.category.findMany).mock.calls[0][0] as FindManyArg;
            expect(call.where).not.toHaveProperty('isActive');
        });
    });

    // -------------------------------------------------------------------------
    // findOne
    // -------------------------------------------------------------------------

    describe('findOne', () => {
        it('returns a CategoryResponseDto for an existing owned category', async () => {
            const cat = makeWithCount({}, 3);
            vi.mocked(prisma.category.findFirst).mockResolvedValue(cat as unknown as Category);

            const result = await service.findOne(userId, catId);

            expect(result).toBeInstanceOf(CategoryResponseDto);
            expect(result.id).toBe(catId);
            expect(result.transactionCount).toBe(3);
        });

        it('throws NotFoundException when category does not exist', async () => {
            vi.mocked(prisma.category.findFirst).mockResolvedValue(null);

            await expect(service.findOne(userId, 'nonexistent')).rejects.toThrow(NotFoundException);
        });

        it('throws NotFoundException for a category belonging to another user', async () => {
            // findFirst with {id, userId} returns null for other user's category
            vi.mocked(prisma.category.findFirst).mockResolvedValue(null);

            await expect(service.findOne(otherUserId, catId)).rejects.toThrow(NotFoundException);
        });

        it('queries with both id and userId', async () => {
            vi.mocked(prisma.category.findFirst).mockResolvedValue(
                makeWithCount({}, 0) as unknown as Category
            );

            await service.findOne(userId, catId);

            expect(prisma.category.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({where: {id: catId, userId}})
            );
        });
    });

    // -------------------------------------------------------------------------
    // create
    // -------------------------------------------------------------------------

    describe('create', () => {
        const dto: CreateCategoryDto = {
            name: 'Groceries',
            color: '#4CAF50',
            icon: '🛒'
        };

        it('creates a top-level category and returns CategoryResponseDto', async () => {
            const created = makeWithCount({name: 'Groceries', color: '#4CAF50', icon: '🛒'});
            vi.mocked(prisma.category.create).mockResolvedValue(created as unknown as Category);

            const result = await service.create(userId, dto);

            expect(result).toBeInstanceOf(CategoryResponseDto);
            expect(result.name).toBe('Groceries');
            expect(prisma.category.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({userId, name: 'Groceries', isActive: true})
                })
            );
        });

        it('creates a child category when valid parentId is supplied', async () => {
            const parent = makeCategory({id: 'parent-uuid', parentId: null});
            vi.mocked(prisma.category.findFirst).mockResolvedValueOnce(parent);

            const childDto: CreateCategoryDto = {...dto, parentId: 'parent-uuid'};
            const created = makeWithCount({name: 'Groceries', parentId: 'parent-uuid'});
            vi.mocked(prisma.category.create).mockResolvedValue(created as unknown as Category);

            const result = await service.create(userId, childDto);

            expect(result.parentId).toBe('parent-uuid');
        });

        it('throws NotFoundException when parentId does not exist', async () => {
            vi.mocked(prisma.category.findFirst).mockResolvedValue(null);

            const childDto: CreateCategoryDto = {...dto, parentId: 'nonexistent-uuid'};

            await expect(service.create(userId, childDto)).rejects.toThrow(NotFoundException);
        });

        it('throws NotFoundException when parentId belongs to another user', async () => {
            vi.mocked(prisma.category.findFirst).mockResolvedValue(null);

            const childDto: CreateCategoryDto = {...dto, parentId: 'other-user-cat'};

            await expect(service.create(userId, childDto)).rejects.toThrow(NotFoundException);
        });

        it('throws BadRequestException when parent is itself a child (depth > 1)', async () => {
            const grandparent = makeCategory({id: 'grandparent-uuid', parentId: null});
            const parent = makeCategory({id: 'parent-uuid', parentId: grandparent.id});
            vi.mocked(prisma.category.findFirst).mockResolvedValue(parent);

            const childDto: CreateCategoryDto = {...dto, parentId: 'parent-uuid'};

            await expect(service.create(userId, childDto)).rejects.toThrow(BadRequestException);
        });

        it('throws ConflictException on P2002 unique constraint (duplicate name at level)', async () => {
            vi.mocked(prisma.category.create).mockRejectedValue(makeP2002());

            await expect(service.create(userId, dto)).rejects.toThrow(ConflictException);
        });

        it('sets nullable fields to null when not provided', async () => {
            const minDto: CreateCategoryDto = {name: 'Bare'};
            const created = makeWithCount({name: 'Bare', color: null, icon: null, description: null});
            vi.mocked(prisma.category.create).mockResolvedValue(created as unknown as Category);

            await service.create(userId, minDto);

            expect(prisma.category.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        color: null,
                        icon: null,
                        description: null,
                        parentId: null
                    })
                })
            );
        });
    });

    // -------------------------------------------------------------------------
    // update
    // -------------------------------------------------------------------------

    describe('update', () => {
        const existing = makeCategory();

        it('updates category fields and returns updated DTO', async () => {
            vi.mocked(prisma.category.findFirst).mockResolvedValue(existing);
            const updated = makeWithCount({name: 'Renamed Food'});
            vi.mocked(prisma.category.update).mockResolvedValue(updated as unknown as Category);

            const result = await service.update(userId, catId, {name: 'Renamed Food'});

            expect(result.name).toBe('Renamed Food');
            expect(prisma.category.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {id: catId},
                    data: expect.objectContaining({name: 'Renamed Food'})
                })
            );
        });

        it('throws NotFoundException when category does not exist', async () => {
            vi.mocked(prisma.category.findFirst).mockResolvedValue(null);

            await expect(service.update(userId, 'nonexistent', {name: 'X'})).rejects.toThrow(
                NotFoundException
            );
        });

        it('throws NotFoundException when category belongs to another user', async () => {
            vi.mocked(prisma.category.findFirst).mockResolvedValue(null);

            await expect(service.update(otherUserId, catId, {name: 'X'})).rejects.toThrow(
                NotFoundException
            );
        });

        it('validates new parentId when it changes', async () => {
            const newParent = makeCategory({id: 'new-parent-uuid', parentId: null});
            vi.mocked(prisma.category.findFirst)
                .mockResolvedValueOnce(existing) // findFirst for ownership check
                .mockResolvedValueOnce(newParent); // findFirst for parent validation

            const updated = makeWithCount({parentId: 'new-parent-uuid'});
            vi.mocked(prisma.category.update).mockResolvedValue(updated as unknown as Category);

            await service.update(userId, catId, {parentId: 'new-parent-uuid'});

            // validateParent called → prisma.category.findFirst called twice
            expect(prisma.category.findFirst).toHaveBeenCalledTimes(2);
        });

        it('throws BadRequestException when new parent is itself a child', async () => {
            const childParent = makeCategory({id: 'child-uuid', parentId: 'grandparent-uuid'});
            vi.mocked(prisma.category.findFirst)
                .mockResolvedValueOnce(existing)
                .mockResolvedValueOnce(childParent);

            await expect(
                service.update(userId, catId, {parentId: 'child-uuid'})
            ).rejects.toThrow(BadRequestException);
        });

        it('throws ConflictException on P2002 (duplicate name at level)', async () => {
            vi.mocked(prisma.category.findFirst).mockResolvedValue(existing);
            vi.mocked(prisma.category.update).mockRejectedValue(makeP2002());

            await expect(service.update(userId, catId, {name: 'Duplicate'})).rejects.toThrow(
                ConflictException
            );
        });

        it('can set isActive to false via update', async () => {
            vi.mocked(prisma.category.findFirst).mockResolvedValue(existing);
            const updated = makeWithCount({isActive: false});
            vi.mocked(prisma.category.update).mockResolvedValue(updated as unknown as Category);

            const dto: UpdateCategoryDto = {isActive: false};
            const result = await service.update(userId, catId, dto);

            expect(result.isActive).toBe(false);
        });

        it('does not re-validate parentId when it is not changing', async () => {
            const existingChild = makeCategory({parentId: 'parent-uuid'});
            vi.mocked(prisma.category.findFirst).mockResolvedValue(existingChild);
            const updated = makeWithCount({parentId: 'parent-uuid'});
            vi.mocked(prisma.category.update).mockResolvedValue(updated as unknown as Category);

            // Updating only name — parentId unchanged, no second findFirst call
            await service.update(userId, catId, {name: 'New Name'});

            expect(prisma.category.findFirst).toHaveBeenCalledTimes(1);
        });
    });

    // -------------------------------------------------------------------------
    // remove
    // -------------------------------------------------------------------------

    describe('remove', () => {
        it('hard-deletes when there are no transactions and no children, returns null', async () => {
            vi.mocked(prisma.category.findFirst).mockResolvedValue(
                makeWithCount({}, 0, 0) as unknown as Category
            );
            vi.mocked(prisma.category.delete).mockResolvedValue(makeCategory());

            const result = await service.remove(userId, catId);

            expect(result).toBeNull();
            expect(prisma.category.delete).toHaveBeenCalledWith({where: {id: catId}});
            expect(prisma.category.update).not.toHaveBeenCalled();
        });

        it('soft-deletes when transactions exist, returns DTO with isActive false', async () => {
            vi.mocked(prisma.category.findFirst).mockResolvedValue(
                makeWithCount({}, 3, 0) as unknown as Category
            );
            const softDeleted = makeWithCount({isActive: false}, 3);
            vi.mocked(prisma.category.update).mockResolvedValue(
                softDeleted as unknown as Category
            );

            const result = await service.remove(userId, catId);

            expect(result).not.toBeNull();
            expect(result!.isActive).toBe(false);
            expect(prisma.category.delete).not.toHaveBeenCalled();
            expect(prisma.category.update).toHaveBeenCalledWith(
                expect.objectContaining({where: {id: catId}, data: {isActive: false}})
            );
        });

        it('throws BadRequestException when category has children', async () => {
            vi.mocked(prisma.category.findFirst).mockResolvedValue(
                makeWithCount({}, 0, 2) as unknown as Category
            );

            await expect(service.remove(userId, catId)).rejects.toThrow(BadRequestException);
            expect(prisma.category.delete).not.toHaveBeenCalled();
            expect(prisma.category.update).not.toHaveBeenCalled();
        });

        it('throws NotFoundException when category does not exist', async () => {
            vi.mocked(prisma.category.findFirst).mockResolvedValue(null);

            await expect(service.remove(userId, 'nonexistent')).rejects.toThrow(NotFoundException);
        });

        it('throws NotFoundException for another user\'s category', async () => {
            vi.mocked(prisma.category.findFirst).mockResolvedValue(null);

            await expect(service.remove(otherUserId, catId)).rejects.toThrow(NotFoundException);
        });
    });
});
