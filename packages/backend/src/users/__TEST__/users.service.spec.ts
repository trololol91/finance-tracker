import {
    describe,
    it,
    expect,
    beforeEach,
    vi
} from 'vitest';
import {
    ConflictException, NotFoundException, ForbiddenException
} from '@nestjs/common';
import {UsersService} from '#users/users.service.js';
import type {PrismaService} from '#database/prisma.service.js';
import type {User} from '#generated/prisma/client.js';
import type {CreateUserDto} from '#users/dto/create-user.dto.js';
import type {UpdateUserDto} from '#users/dto/update-user.dto.js';
import * as bcrypt from 'bcrypt';

vi.mock('bcrypt');

describe('UsersService', () => {
    let service: UsersService;
    let prismaService: PrismaService;

    const mockUser: User = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        passwordHash: '$2b$10$hashedpassword',
        firstName: 'John',
        lastName: 'Doe',
        emailVerified: false,
        isActive: true,
        deletedAt: null,
        timezone: 'UTC',
        currency: 'USD',
        role: 'USER',
        notifyPush: true,
        notifyEmail: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
    };

    beforeEach(() => {
        prismaService = {
            user: {
                findUnique: vi.fn(),
                findFirst: vi.fn(),
                create: vi.fn(),
                update: vi.fn()
            }
        } as unknown as PrismaService;

        service = new UsersService(prismaService);
        vi.clearAllMocks();
    });

    describe('create', () => {
        const createUserDto: CreateUserDto = {
            email: 'newuser@example.com',
            password: 'password123',
            firstName: 'Jane',
            lastName: 'Smith'
        };

        it('should create a new user with hashed password', async () => {
            vi.mocked(prismaService.user.findUnique).mockResolvedValue(null);
            vi.mocked(bcrypt.hash).mockResolvedValue('$2b$10$hashedpassword' as never);
            vi.mocked(prismaService.user.create).mockResolvedValue(mockUser);

            const result: User = await service.create(createUserDto);

            expect(prismaService.user.findUnique).toHaveBeenCalledWith({
                where: {email: createUserDto.email}
            });
            expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
            expect(prismaService.user.create).toHaveBeenCalledWith({
                data: {
                    email: createUserDto.email,
                    passwordHash: '$2b$10$hashedpassword',
                    firstName: createUserDto.firstName,
                    lastName: createUserDto.lastName,
                    timezone: 'UTC',
                    currency: 'USD'
                }
            });
            expect(result).toEqual(mockUser);
        });

        it('should use default timezone and currency if not provided', async () => {
            const dtoWithoutDefaults: CreateUserDto = {
                email: 'test@example.com',
                password: 'password123'
            };

            vi.mocked(prismaService.user.findUnique).mockResolvedValue(null);
            vi.mocked(bcrypt.hash).mockResolvedValue('$2b$10$hashedpassword' as never);
            vi.mocked(prismaService.user.create).mockResolvedValue(mockUser);

            await service.create(dtoWithoutDefaults);

            expect(prismaService.user.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    timezone: 'UTC',
                    currency: 'USD'
                })
            });
        });

        it('should throw ConflictException if email already exists', async () => {
            vi.mocked(prismaService.user.findUnique).mockResolvedValue(mockUser);

            await expect(service.create(createUserDto))
                .rejects
                .toThrow(ConflictException);
            await expect(service.create(createUserDto))
                .rejects
                .toThrow('Email already exists');
        });

        it('should use custom timezone and currency if provided', async () => {
            const dtoWithCustom: CreateUserDto = {
                email: 'test@example.com',
                password: 'password123',
                timezone: 'America/New_York',
                currency: 'CAD'
            };

            vi.mocked(prismaService.user.findUnique).mockResolvedValue(null);
            vi.mocked(bcrypt.hash).mockResolvedValue('$2b$10$hashedpassword' as never);
            vi.mocked(prismaService.user.create).mockResolvedValue(mockUser);

            await service.create(dtoWithCustom);

            expect(prismaService.user.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    timezone: 'America/New_York',
                    currency: 'CAD'
                })
            });
        });
    });

    describe('findOne', () => {
        const authenticatedUserId = mockUser.id;
        const targetUserId = mockUser.id;

        it('should return a user by id when user accesses own profile', async () => {
            vi.mocked(prismaService.user.findFirst).mockResolvedValue(mockUser);

            const result: User = await service.findOne(authenticatedUserId, targetUserId);

            expect(prismaService.user.findFirst).toHaveBeenCalledWith({
                where: {
                    id: targetUserId,
                    deletedAt: null
                }
            });
            expect(result).toEqual(mockUser);
        });

        it('should throw ForbiddenException when user tries to access another user\'s profile', async () => {
            const otherUserId = '999e4567-e89b-12d3-a456-426614174999';

            await expect(service.findOne(authenticatedUserId, otherUserId))
                .rejects
                .toThrow(ForbiddenException);
            await expect(service.findOne(authenticatedUserId, otherUserId))
                .rejects
                .toThrow('You can only access your own profile');

            expect(prismaService.user.findFirst).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException if user not found', async () => {
            vi.mocked(prismaService.user.findFirst).mockResolvedValue(null);

            await expect(service.findOne(authenticatedUserId, targetUserId))
                .rejects
                .toThrow(NotFoundException);
            await expect(service.findOne(authenticatedUserId, targetUserId))
                .rejects
                .toThrow(`User with ID ${targetUserId} not found`);
        });

        it('should exclude soft-deleted users', async () => {
            vi.mocked(prismaService.user.findFirst).mockResolvedValue(null);

            await expect(service.findOne(authenticatedUserId, targetUserId))
                .rejects
                .toThrow(NotFoundException);

            expect(prismaService.user.findFirst).toHaveBeenCalledWith({
                where: {
                    id: targetUserId,
                    deletedAt: null
                }
            });
        });
    });

    describe('findByEmail', () => {
        it('should return a user by email', async () => {
            vi.mocked(prismaService.user.findFirst).mockResolvedValue(mockUser);

            const result: User | null = await service.findByEmail(mockUser.email);

            expect(prismaService.user.findFirst).toHaveBeenCalledWith({
                where: {
                    email: mockUser.email,
                    deletedAt: null
                }
            });
            expect(result).toEqual(mockUser);
        });

        it('should return null if user not found', async () => {
            vi.mocked(prismaService.user.findFirst).mockResolvedValue(null);

            const result: User | null = await service.findByEmail('nonexistent@example.com');

            expect(result).toBeNull();
        });

        it('should exclude soft-deleted users', async () => {
            vi.mocked(prismaService.user.findFirst).mockResolvedValue(null);

            const result: User | null = await service.findByEmail(mockUser.email);

            expect(prismaService.user.findFirst).toHaveBeenCalledWith({
                where: {
                    email: mockUser.email,
                    deletedAt: null
                }
            });
            expect(result).toBeNull();
        });
    });

    describe('update', () => {
        const authenticatedUserId = mockUser.id;
        const targetUserId = mockUser.id;
        const updateUserDto: UpdateUserDto = {
            firstName: 'UpdatedName',
            timezone: 'America/New_York'
        };

        it('should update user information when user updates own profile', async () => {
            const updatedUser: User = {...mockUser, ...updateUserDto};

            vi.mocked(prismaService.user.findFirst).mockResolvedValue(mockUser);
            vi.mocked(prismaService.user.update).mockResolvedValue(updatedUser);

            const result: User = await service.update(
                authenticatedUserId, targetUserId, updateUserDto
            );

            expect(prismaService.user.findFirst).toHaveBeenCalledWith({
                where: {
                    id: targetUserId,
                    deletedAt: null
                }
            });
            expect(prismaService.user.update).toHaveBeenCalledWith({
                where: {id: targetUserId},
                data: {
                    firstName: updateUserDto.firstName,
                    lastName: undefined,
                    timezone: updateUserDto.timezone,
                    currency: undefined,
                    isActive: undefined
                }
            });
            expect(result).toEqual(updatedUser);
        });

        it('should throw ForbiddenException when user tries to update another user\'s profile', async () => {
            const otherUserId = '999e4567-e89b-12d3-a456-426614174999';

            await expect(service.update(authenticatedUserId, otherUserId, updateUserDto))
                .rejects
                .toThrow(ForbiddenException);
            await expect(service.update(authenticatedUserId, otherUserId, updateUserDto))
                .rejects
                .toThrow('You can only update your own profile');

            expect(prismaService.user.findFirst).not.toHaveBeenCalled();
            expect(prismaService.user.update).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException if user does not exist', async () => {
            vi.mocked(prismaService.user.findFirst).mockResolvedValue(null);

            await expect(service.update(authenticatedUserId, targetUserId, updateUserDto))
                .rejects
                .toThrow(NotFoundException);

            expect(prismaService.user.update).not.toHaveBeenCalled();
        });

        it('should allow updating isActive status', async () => {
            const updateDto: UpdateUserDto = {isActive: false};
            const updatedUser: User = {...mockUser, isActive: false};

            vi.mocked(prismaService.user.findFirst).mockResolvedValue(mockUser);
            vi.mocked(prismaService.user.update).mockResolvedValue(updatedUser);

            await service.update(authenticatedUserId, targetUserId, updateDto);

            expect(prismaService.user.update).toHaveBeenCalledWith({
                where: {id: targetUserId},
                data: expect.objectContaining({
                    isActive: false
                })
            });
        });
    });

    describe('remove', () => {
        const authenticatedUserId = mockUser.id;
        const targetUserId = mockUser.id;

        it('should soft delete a user when user deletes own account', async () => {
            const deletedUser: User = {
                ...mockUser,
                deletedAt: new Date(),
                isActive: false
            };

            vi.mocked(prismaService.user.findFirst).mockResolvedValue(mockUser);
            vi.mocked(prismaService.user.update).mockResolvedValue(deletedUser);

            const result: User = await service.remove(authenticatedUserId, targetUserId);

            expect(prismaService.user.findFirst).toHaveBeenCalledWith({
                where: {
                    id: targetUserId,
                    deletedAt: null
                }
            });
            expect(prismaService.user.update).toHaveBeenCalledWith({
                where: {id: targetUserId},
                data: {
                    deletedAt: expect.any(Date),
                    isActive: false
                }
            });
            expect(result.deletedAt).toBeDefined();
            expect(result.isActive).toBe(false);
        });

        it('should throw ForbiddenException when user tries to delete another user\'s account', async () => {
            const otherUserId = '999e4567-e89b-12d3-a456-426614174999';

            await expect(service.remove(authenticatedUserId, otherUserId))
                .rejects
                .toThrow(ForbiddenException);
            await expect(service.remove(authenticatedUserId, otherUserId))
                .rejects
                .toThrow('You can only delete your own account');

            expect(prismaService.user.findFirst).not.toHaveBeenCalled();
            expect(prismaService.user.update).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException if user does not exist', async () => {
            vi.mocked(prismaService.user.findFirst).mockResolvedValue(null);

            await expect(service.remove(authenticatedUserId, targetUserId))
                .rejects
                .toThrow(NotFoundException);

            expect(prismaService.user.update).not.toHaveBeenCalled();
        });
    });
});
