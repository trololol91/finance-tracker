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

        it('throws NotFoundException when category is not found or belongs to another user', async () => {
            vi.mocked(prisma.category.findFirst).mockResolvedValue(null);

            await expect(service.findOne(userId, 'nonexistent')).rejects.toThrow(NotFoundException);
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
            vi.mocked(prisma.category.findFirst).mockResolvedValueOnce(null); // no conflict
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
            vi.mocked(prisma.category.findFirst)
                .mockResolvedValueOnce(parent) // validateParent
                .mockResolvedValueOnce(null);  // no conflict

            const childDto: CreateCategoryDto = {...dto, parentId: 'parent-uuid'};
            const created = makeWithCount({name: 'Groceries', parentId: 'parent-uuid'});
            vi.mocked(prisma.category.create).mockResolvedValue(created as unknown as Category);

            const result = await service.create(userId, childDto);

            expect(result.parentId).toBe('parent-uuid');
        });

        it('throws NotFoundException when parentId does not exist or belongs to another user', async () => {
            vi.mocked(prisma.category.findFirst).mockResolvedValue(null);

            const childDto: CreateCategoryDto = {...dto, parentId: 'nonexistent-uuid'};

            await expect(service.create(userId, childDto)).rejects.toThrow(NotFoundException);
        });

        it('throws BadRequestException when parent is itself a child (depth > 1)', async () => {
            const parent = makeCategory({id: 'parent-uuid', parentId: 'cat-uuid-1'});
            vi.mocked(prisma.category.findFirst).mockResolvedValue(parent);

            const childDto: CreateCategoryDto = {...dto, parentId: 'parent-uuid'};

            await expect(service.create(userId, childDto)).rejects.toThrow(BadRequestException);
        });

        it('throws ConflictException on P2002 unique constraint (duplicate name at level)', async () => {
            vi.mocked(prisma.category.findFirst).mockResolvedValueOnce(null); // no conflict
            vi.mocked(prisma.category.create).mockRejectedValue(makeP2002());

            await expect(service.create(userId, dto)).rejects.toThrow(ConflictException);
        });

        it('throws ConflictException for duplicate top-level name (null=null gap)', async () => {
            // ConflictException thrown before DB insert; DB unique constraint cannot catch this
            const conflict = makeCategory({name: 'Groceries', parentId: null, isActive: true});
            vi.mocked(prisma.category.findFirst).mockResolvedValueOnce(conflict);

            await expect(service.create(userId, dto)).rejects.toThrow(ConflictException);
            expect(prisma.category.create).not.toHaveBeenCalled();
        });

        it('allows reuse of a soft-deleted category name', async () => {
            // checkNameUnique only checks isActive:true rows — soft-deleted name is fair game
            vi.mocked(prisma.category.findFirst).mockResolvedValueOnce(null); // no active conflict
            const created = makeWithCount({name: 'Groceries'});
            vi.mocked(prisma.category.create).mockResolvedValue(created as unknown as Category);

            const result = await service.create(userId, dto);

            expect(result.name).toBe('Groceries');
            // Verify the uniqueness check includes isActive:true
            expect(prisma.category.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({isActive: true})
                })
            );
        });

        it('throws ConflictException when sub-category name already exists under same parent', async () => {
            const parent = makeCategory({id: 'parent-uuid', parentId: null});
            const conflict = makeCategory({name: 'Groceries', parentId: 'parent-uuid'});
            vi.mocked(prisma.category.findFirst)
                .mockResolvedValueOnce(parent)   // validateParent
                .mockResolvedValueOnce(conflict); // checkNameUnique: conflict found

            const childDto: CreateCategoryDto = {...dto, parentId: 'parent-uuid'};

            await expect(service.create(userId, childDto)).rejects.toThrow(ConflictException);
            expect(prisma.category.create).not.toHaveBeenCalled();
        });

        it('rethrows non-P2002 database errors and does not wrap them', async () => {
            const dbError = new Error('Connection timeout');
            vi.mocked(prisma.category.findFirst).mockResolvedValueOnce(null); // no conflict
            vi.mocked(prisma.category.create).mockRejectedValue(dbError);

            await expect(service.create(userId, dto)).rejects.toThrow('Connection timeout');
        });

        it('rethrows PrismaClientKnownRequestError with a non-P2002 code', async () => {
            const p2003 = new PrismaClientKnownRequestError('Foreign key constraint failed', {
                code: 'P2003',
                clientVersion: '7.0.0'
            });
            vi.mocked(prisma.category.findFirst).mockResolvedValueOnce(null); // no conflict
            vi.mocked(prisma.category.create).mockRejectedValue(p2003);

            await expect(service.create(userId, dto)).rejects.toThrow(
                PrismaClientKnownRequestError
            );
        });

        it('sets nullable fields to null when not provided', async () => {
            const minDto: CreateCategoryDto = {name: 'Bare'};
            const created = makeWithCount({name: 'Bare', color: null, icon: null, description: null});
            vi.mocked(prisma.category.findFirst).mockResolvedValueOnce(null); // no conflict
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
        interface UpdateCallArg {data: Record<string, unknown>}
        it('updates category fields and returns updated DTO', async () => {
            vi.mocked(prisma.category.findFirst)
                .mockResolvedValueOnce(existing) // ownership check
                .mockResolvedValueOnce(null);    // no conflict
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

        it('throws NotFoundException when category is not found or belongs to another user', async () => {
            vi.mocked(prisma.category.findFirst).mockResolvedValue(null);

            await expect(service.update(userId, 'nonexistent', {name: 'X'})).rejects.toThrow(
                NotFoundException
            );
        });

        it('validates new parentId when it changes', async () => {
            const newParent = makeCategory({id: 'new-parent-uuid', parentId: null});
            vi.mocked(prisma.category.findFirst)
                .mockResolvedValueOnce(existing)    // ownership check
                .mockResolvedValueOnce(newParent)   // validateParent
                .mockResolvedValueOnce(null);       // no conflict

            const updated = makeWithCount({parentId: 'new-parent-uuid'});
            vi.mocked(prisma.category.update).mockResolvedValue(updated as unknown as Category);

            await service.update(userId, catId, {parentId: 'new-parent-uuid'});

            // ownership + validateParent + checkNameUnique
            expect(prisma.category.findFirst).toHaveBeenCalledTimes(3);
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
            vi.mocked(prisma.category.findFirst)
                .mockResolvedValueOnce(existing) // ownership check
                .mockResolvedValueOnce(null);    // no conflict
            vi.mocked(prisma.category.update).mockRejectedValue(makeP2002());

            await expect(service.update(userId, catId, {name: 'Duplicate'})).rejects.toThrow(
                ConflictException
            );
        });

        it('throws ConflictException when name already exists at target level (pre-insert guard)', async () => {
            const conflict = makeCategory({name: 'Duplicate', parentId: null});
            vi.mocked(prisma.category.findFirst)
                .mockResolvedValueOnce(existing)  // ownership check
                .mockResolvedValueOnce(conflict); // checkNameUnique: conflict found

            await expect(service.update(userId, catId, {name: 'Duplicate'})).rejects.toThrow(
                ConflictException
            );
            expect(prisma.category.update).not.toHaveBeenCalled();
        });

        it('rethrows non-P2002 database errors and does not wrap them', async () => {
            vi.mocked(prisma.category.findFirst)
                .mockResolvedValueOnce(existing) // ownership check
                .mockResolvedValueOnce(null);    // no conflict
            const dbError = new Error('Connection timeout');
            vi.mocked(prisma.category.update).mockRejectedValue(dbError);

            await expect(service.update(userId, catId, {name: 'X'})).rejects.toThrow(
                'Connection timeout'
            );
        });

        it('rethrows PrismaClientKnownRequestError with a non-P2002 code', async () => {
            vi.mocked(prisma.category.findFirst)
                .mockResolvedValueOnce(existing) // ownership check
                .mockResolvedValueOnce(null);    // no conflict
            const p2003 = new PrismaClientKnownRequestError('Foreign key constraint failed', {
                code: 'P2003',
                clientVersion: '7.0.0'
            });
            vi.mocked(prisma.category.update).mockRejectedValue(p2003);

            await expect(service.update(userId, catId, {name: 'X'})).rejects.toThrow(
                PrismaClientKnownRequestError
            );
        });

        it('does not call validateParent when parentId is explicitly null (clearing parent)', async () => {
            const existingChild = makeCategory({parentId: 'parent-uuid'});
            vi.mocked(prisma.category.findFirst)
                .mockResolvedValueOnce(existingChild) // ownership check
                .mockResolvedValueOnce(null);         // no conflict
            const updated = makeWithCount({parentId: null});
            vi.mocked(prisma.category.update).mockResolvedValue(updated as unknown as Category);

            await service.update(userId, catId, {parentId: null});

            // ownership + checkNameUnique only; validateParent NOT called
            expect(prisma.category.findFirst).toHaveBeenCalledTimes(2);
        });

        it('does not call validateParent when parentId is same as existing', async () => {
            const existingChild = makeCategory({parentId: 'parent-uuid'});
            vi.mocked(prisma.category.findFirst)
                .mockResolvedValueOnce(existingChild) // ownership check
                .mockResolvedValueOnce(null);         // no conflict
            const updated = makeWithCount({parentId: 'parent-uuid'});
            vi.mocked(prisma.category.update).mockResolvedValue(updated as unknown as Category);

            await service.update(userId, catId, {parentId: 'parent-uuid'});

            // ownership + checkNameUnique only; validateParent NOT called (parentId unchanged)
            expect(prisma.category.findFirst).toHaveBeenCalledTimes(2);
        });

        it('omits undefined fields from the update data payload', async () => {
            vi.mocked(prisma.category.findFirst).mockResolvedValue(existing);
            const updated = makeWithCount({isActive: false});
            vi.mocked(prisma.category.update).mockResolvedValue(updated as unknown as Category);

            await service.update(userId, catId, {isActive: false});

            const callData = (
                vi.mocked(prisma.category.update).mock.calls[0][0] as UpdateCallArg
            ).data;
            expect(callData).not.toHaveProperty('name');
            expect(callData).not.toHaveProperty('description');
            expect(callData).not.toHaveProperty('color');
            expect(callData).not.toHaveProperty('icon');
            expect(callData).not.toHaveProperty('parentId');
            expect(callData).toEqual({isActive: false});
        });

        it('sets description, color and icon to null when explicitly provided as null', async () => {
            vi.mocked(prisma.category.findFirst).mockResolvedValue(existing);
            const updated = makeWithCount({description: null, color: null, icon: null});
            vi.mocked(prisma.category.update).mockResolvedValue(updated as unknown as Category);

            const dto: UpdateCategoryDto = {description: null, color: null, icon: null};
            await service.update(userId, catId, dto);

            const callData = (
                vi.mocked(prisma.category.update).mock.calls[0][0] as UpdateCallArg
            ).data;
            expect(callData).toMatchObject({description: null, color: null, icon: null});
        });

        it('sets parentId to null when explicitly provided as null (removes parent)', async () => {
            const existingChild = makeCategory({parentId: 'parent-uuid'});
            vi.mocked(prisma.category.findFirst)
                .mockResolvedValueOnce(existingChild) // ownership check
                .mockResolvedValueOnce(null);         // no conflict
            const updated = makeWithCount({parentId: null});
            vi.mocked(prisma.category.update).mockResolvedValue(updated as unknown as Category);

            await service.update(userId, catId, {parentId: null});

            const callData = (
                vi.mocked(prisma.category.update).mock.calls[0][0] as UpdateCallArg
            ).data;
            expect(callData).toMatchObject({parentId: null});
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
            vi.mocked(prisma.category.findFirst)
                .mockResolvedValueOnce(existingChild) // ownership check
                .mockResolvedValueOnce(null);         // no conflict
            const updated = makeWithCount({parentId: 'parent-uuid'});
            vi.mocked(prisma.category.update).mockResolvedValue(updated as unknown as Category);

            // Updating only name — validateParent NOT called; checkNameUnique IS called
            await service.update(userId, catId, {name: 'New Name'});

            expect(prisma.category.findFirst).toHaveBeenCalledTimes(2);
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

        it('throws NotFoundException when category is not found or belongs to another user', async () => {
            vi.mocked(prisma.category.findFirst).mockResolvedValue(null);

            await expect(service.remove(userId, 'nonexistent')).rejects.toThrow(NotFoundException);
        });
    });
});
