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
import {CategoriesController} from '#categories/categories.controller.js';
import type {CategoriesService} from '#categories/categories.service.js';
import {CategoryResponseDto} from '#categories/dto/category-response.dto.js';
import type {User} from '#generated/prisma/client.js';
import type {CreateCategoryDto} from '#categories/dto/create-category.dto.js';
import type {UpdateCategoryDto} from '#categories/dto/update-category.dto.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeDto = (overrides: Partial<CategoryResponseDto> = {}): CategoryResponseDto => {
    const dto = new CategoryResponseDto();
    dto.id = 'cat-uuid-1';
    dto.userId = 'user-uuid-1';
    dto.name = 'Food';
    dto.description = null;
    dto.color = '#FF5733';
    dto.icon = '🍔';
    dto.parentId = null;
    dto.isActive = true;
    dto.transactionCount = 0;
    dto.children = [];
    dto.createdAt = new Date('2026-01-15T10:00:00.000Z');
    dto.updatedAt = new Date('2026-01-15T10:00:00.000Z');
    return Object.assign(dto, overrides);
};

const mockCurrentUser: User = {
    id: 'user-uuid-1',
    email: 'test@example.com',
    passwordHash: '$2b$10$hashed',
    firstName: 'Jane',
    lastName: 'Smith',
    emailVerified: true,
    isActive: true,
    deletedAt: null,
    timezone: 'UTC',
    currency: 'USD',
    role: 'USER',
    notifyEmail: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01')
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CategoriesController', () => {
    let controller: CategoriesController;
    let service: CategoriesService;

    beforeEach(() => {
        service = {
            findAll: vi.fn(),
            findOne: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn()
        } as unknown as CategoriesService;

        controller = new CategoriesController(service);
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // findAll GET /categories
    // -------------------------------------------------------------------------

    describe('findAll', () => {
        it('returns array from service.findAll', async () => {
            const dtos = [makeDto(), makeDto({id: 'cat-uuid-2', name: 'Transport'})];
            vi.mocked(service.findAll).mockResolvedValue(dtos);

            const result = await controller.findAll(mockCurrentUser);

            expect(result).toBe(dtos);
            expect(service.findAll).toHaveBeenCalledWith(mockCurrentUser.id);
        });

        it('returns empty array when user has no categories', async () => {
            vi.mocked(service.findAll).mockResolvedValue([]);

            const result = await controller.findAll(mockCurrentUser);

            expect(result).toEqual([]);
        });
    });

    // -------------------------------------------------------------------------
    // findOne GET /categories/:id
    // -------------------------------------------------------------------------

    describe('findOne', () => {
        it('returns CategoryResponseDto for a valid id', async () => {
            const dto = makeDto();
            vi.mocked(service.findOne).mockResolvedValue(dto);

            const result = await controller.findOne('cat-uuid-1', mockCurrentUser);

            expect(result).toBe(dto);
            expect(service.findOne).toHaveBeenCalledWith('user-uuid-1', 'cat-uuid-1');
        });

        it('propagates NotFoundException from service', async () => {
            vi.mocked(service.findOne).mockRejectedValue(
                new NotFoundException('Category with ID nonexistent not found')
            );

            await expect(controller.findOne('nonexistent', mockCurrentUser)).rejects.toThrow(
                NotFoundException
            );
        });
    });

    // -------------------------------------------------------------------------
    // create POST /categories
    // -------------------------------------------------------------------------

    describe('create', () => {
        const createDto: CreateCategoryDto = {
            name: 'Groceries',
            color: '#4CAF50',
            icon: '🛒'
        };

        it('returns created CategoryResponseDto', async () => {
            const dto = makeDto({name: 'Groceries'});
            vi.mocked(service.create).mockResolvedValue(dto);

            const result = await controller.create(createDto, mockCurrentUser);

            expect(result).toBe(dto);
            expect(service.create).toHaveBeenCalledWith('user-uuid-1', createDto);
        });

        it('propagates ConflictException on duplicate name', async () => {
            vi.mocked(service.create).mockRejectedValue(
                new ConflictException('A category with this name already exists at this level')
            );

            await expect(controller.create(createDto, mockCurrentUser)).rejects.toThrow(
                ConflictException
            );
        });

        it('propagates NotFoundException when parentId not found', async () => {
            vi.mocked(service.create).mockRejectedValue(
                new NotFoundException('Parent category with ID nonexistent not found')
            );

            await expect(
                controller.create({...createDto, parentId: 'nonexistent'}, mockCurrentUser)
            ).rejects.toThrow(NotFoundException);
        });

        it('propagates BadRequestException when depth limit exceeded', async () => {
            vi.mocked(service.create).mockRejectedValue(
                new BadRequestException('Nesting is limited to one level.')
            );

            await expect(
                controller.create({...createDto, parentId: 'child-cat'}, mockCurrentUser)
            ).rejects.toThrow(BadRequestException);
        });
    });

    // -------------------------------------------------------------------------
    // update PATCH /categories/:id
    // -------------------------------------------------------------------------

    describe('update', () => {
        const updateDto: UpdateCategoryDto = {name: 'Renamed Food'};

        it('returns updated CategoryResponseDto', async () => {
            const dto = makeDto({name: 'Renamed Food'});
            vi.mocked(service.update).mockResolvedValue(dto);

            const result = await controller.update('cat-uuid-1', updateDto, mockCurrentUser);

            expect(result).toBe(dto);
            expect(service.update).toHaveBeenCalledWith('user-uuid-1', 'cat-uuid-1', updateDto);
        });

        it('propagates NotFoundException for unknown category', async () => {
            vi.mocked(service.update).mockRejectedValue(new NotFoundException('Category not found'));

            await expect(
                controller.update('nonexistent', updateDto, mockCurrentUser)
            ).rejects.toThrow(NotFoundException);
        });

        it('propagates ConflictException on duplicate name conflict', async () => {
            vi.mocked(service.update).mockRejectedValue(
                new ConflictException('A category with this name already exists at this level')
            );

            await expect(
                controller.update('cat-uuid-1', updateDto, mockCurrentUser)
            ).rejects.toThrow(ConflictException);
        });
    });

    // -------------------------------------------------------------------------
    // remove DELETE /categories/:id
    // -------------------------------------------------------------------------

    describe('remove', () => {
        const makeMockRes = (): {status: ReturnType<typeof vi.fn>} => ({
            status: vi.fn().mockReturnThis()
        });

        it('returns undefined (void) for a hard-deleted category (null from service)', async () => {
            vi.mocked(service.remove).mockResolvedValue(null);
            const mockRes = makeMockRes();

            const result = await controller.remove('cat-uuid-1', mockCurrentUser, mockRes as never);

            expect(result).toBeUndefined();
            expect(service.remove).toHaveBeenCalledWith('user-uuid-1', 'cat-uuid-1');
            expect(mockRes.status).toHaveBeenCalledWith(204);
        });

        it('returns CategoryResponseDto with isActive=false for a soft-deleted category', async () => {
            const dto = makeDto({isActive: false, transactionCount: 3});
            vi.mocked(service.remove).mockResolvedValue(dto);
            const mockRes = makeMockRes();

            const result = await controller.remove('cat-uuid-1', mockCurrentUser, mockRes as never);

            expect(result).toBe(dto);
            expect((result as CategoryResponseDto).isActive).toBe(false);
            expect(mockRes.status).not.toHaveBeenCalled();
        });

        it('propagates NotFoundException for unknown category', async () => {
            vi.mocked(service.remove).mockRejectedValue(new NotFoundException('Category not found'));
            const mockRes = makeMockRes();

            await expect(
                controller.remove('nonexistent', mockCurrentUser, mockRes as never)
            ).rejects.toThrow(NotFoundException);
        });

        it('propagates BadRequestException when category has children', async () => {
            vi.mocked(service.remove).mockRejectedValue(
                new BadRequestException(
                    'Delete or reassign child categories before deleting this category'
                )
            );
            const mockRes = makeMockRes();

            await expect(
                controller.remove('parent-with-children', mockCurrentUser, mockRes as never)
            ).rejects.toThrow(BadRequestException);
        });
    });
});
