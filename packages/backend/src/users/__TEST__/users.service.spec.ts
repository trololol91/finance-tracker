import {
    describe,
    it,
    expect,
    beforeEach,
    vi
} from 'vitest';
import {
    ConflictException, NotFoundException, ForbiddenException, BadRequestException
} from '@nestjs/common';
import {UsersService} from '#users/users.service.js';
import type {PrismaService} from '#database/prisma.service.js';
import type {User} from '#generated/prisma/client.js';
import type {CreateUserDto} from '#users/dto/create-user.dto.js';
import type {UpdateUserDto} from '#users/dto/update-user.dto.js';
import type {AdminUserListItemDto} from '#users/dto/admin-user-list-item.dto.js';
import {UserRole} from '#generated/prisma/enums.js';
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
        role: UserRole.USER,
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
                findMany: vi.fn(),
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

    describe('findAllForAdmin', () => {
        const mockAdminUserList: AdminUserListItemDto[] = [
            {
                id: '123e4567-e89b-12d3-a456-426614174000',
                email: 'alice@example.com',
                firstName: 'Alice',
                lastName: 'Smith',
                role: UserRole.USER,
                isActive: true,
                createdAt: new Date('2024-01-01')
            },
            {
                id: '456e7890-e89b-12d3-a456-426614174001',
                email: 'bob@example.com',
                firstName: 'Bob',
                lastName: 'Jones',
                role: UserRole.ADMIN,
                isActive: true,
                createdAt: new Date('2024-02-01')
            }
        ];

        /**
         * USV-01: findAllForAdmin() returns all non-deleted users
         */
        it('USV-01: returns all non-deleted users', async () => {
            vi.mocked(prismaService.user.findMany).mockResolvedValue(
                mockAdminUserList as unknown as User[]
            );

            const result = await service.findAllForAdmin();

            expect(prismaService.user.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {deletedAt: null}
                })
            );
            expect(result).toHaveLength(2);
            expect(result[0].email).toBe('alice@example.com');
            expect(result[1].email).toBe('bob@example.com');
        });

        /**
         * USV-02: findAllForAdmin() excludes soft-deleted users (has deletedAt set)
         */
        it('USV-02: excludes soft-deleted users by filtering deletedAt: null', async () => {
            // Only the non-deleted user is returned from the mock (Prisma handles the filter)
            const activeOnly: AdminUserListItemDto[] = [mockAdminUserList[0]];
            vi.mocked(prismaService.user.findMany).mockResolvedValue(
                activeOnly as unknown as User[]
            );

            const result = await service.findAllForAdmin();

            // Confirm the where clause filters out deleted users
            expect(prismaService.user.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {deletedAt: null}
                })
            );
            expect(result).toHaveLength(1);
            expect(result[0].email).toBe('alice@example.com');
        });
    });

    describe('updateRole', () => {
        const requestingUserId = '999e4567-e89b-12d3-a456-426614174999';
        const targetUserId = '123e4567-e89b-12d3-a456-426614174000';
        const mockAdminItem: AdminUserListItemDto = {
            id: targetUserId,
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
            role: UserRole.ADMIN,
            isActive: true,
            createdAt: new Date('2024-01-01')
        };

        /**
         * USV-03: updateRole() updates role to ADMIN successfully
         */
        it('USV-03: updates role to ADMIN successfully', async () => {
            vi.mocked(prismaService.user.findFirst).mockResolvedValue(mockUser);
            vi.mocked(prismaService.user.update).mockResolvedValue(
                mockAdminItem as unknown as User
            );

            const result = await service.updateRole(
                requestingUserId, targetUserId, UserRole.ADMIN
            );

            expect(prismaService.user.findFirst).toHaveBeenCalledWith({
                where: {id: targetUserId, deletedAt: null}
            });
            expect(prismaService.user.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {id: targetUserId},
                    data: {role: UserRole.ADMIN}
                })
            );
            expect(result.role).toBe('ADMIN');
        });

        /**
         * USV-04: updateRole() updates role to USER successfully
         */
        it('USV-04: updates role to USER successfully', async () => {
            const userItem: AdminUserListItemDto = {...mockAdminItem, role: UserRole.USER};
            vi.mocked(prismaService.user.findFirst).mockResolvedValue(mockUser);
            vi.mocked(prismaService.user.update).mockResolvedValue(
                userItem as unknown as User
            );

            const result = await service.updateRole(
                requestingUserId, targetUserId, UserRole.USER
            );

            expect(prismaService.user.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: {role: UserRole.USER}
                })
            );
            expect(result.role).toBe('USER');
        });

        /**
         * USV-05: updateRole() throws BadRequestException when admin tries to change their own role
         */
        it('USV-05: throws BadRequestException when requestingUserId === targetUserId', async () => {
            await expect(
                service.updateRole(targetUserId, targetUserId, UserRole.ADMIN)
            )
                .rejects
                .toThrow(BadRequestException);
            await expect(
                service.updateRole(targetUserId, targetUserId, UserRole.ADMIN)
            )
                .rejects
                .toThrow('You cannot change your own role');

            expect(prismaService.user.findFirst).not.toHaveBeenCalled();
            expect(prismaService.user.update).not.toHaveBeenCalled();
        });

        /**
         * USV-06: updateRole() throws NotFoundException when target user not found
         */
        it('USV-06: throws NotFoundException when target user not found', async () => {
            vi.mocked(prismaService.user.findFirst).mockResolvedValue(null);

            await expect(service.updateRole(requestingUserId, targetUserId, UserRole.ADMIN))
                .rejects
                .toThrow(NotFoundException);
            await expect(service.updateRole(requestingUserId, targetUserId, UserRole.ADMIN))
                .rejects
                .toThrow(`User with ID ${targetUserId} not found`);

            expect(prismaService.user.update).not.toHaveBeenCalled();
        });
    });
});
