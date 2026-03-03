import {
    describe,
    it,
    expect,
    beforeEach,
    vi
} from 'vitest';
import {UsersController} from '#users/users.controller.js';
import type {UsersService} from '#users/users.service.js';
import type {User} from '#generated/prisma/client.js';
import type {CreateUserDto} from '#users/dto/create-user.dto.js';
import type {UpdateUserDto} from '#users/dto/update-user.dto.js';
import type {UserResponseDto} from '#users/dto/user-response.dto.js';

describe('UsersController', () => {
    let controller: UsersController;
    let service: UsersService;

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

    const mockUserResponse: UserResponseDto = {
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        emailVerified: mockUser.emailVerified,
        isActive: mockUser.isActive,
        timezone: mockUser.timezone,
        currency: mockUser.currency,
        role: mockUser.role,
        notifyPush: mockUser.notifyPush,
        notifyEmail: mockUser.notifyEmail,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt
    };

    beforeEach(() => {
        service = {
            create: vi.fn(),
            findOne: vi.fn(),
            update: vi.fn(),
            remove: vi.fn()
        } as unknown as UsersService;

        controller = new UsersController(service);
        vi.clearAllMocks();
    });

    describe('create', () => {
        const createUserDto: CreateUserDto = {
            email: 'newuser@example.com',
            password: 'password123',
            firstName: 'Jane',
            lastName: 'Smith'
        };

        it('should create a new user and return UserResponseDto', async () => {
            vi.mocked(service.create).mockResolvedValue(mockUser);

            const result: UserResponseDto = await controller.create(createUserDto);

            expect(service.create).toHaveBeenCalledWith(createUserDto);
            expect(result).toEqual(mockUserResponse);
            expect(result).not.toHaveProperty('passwordHash');
            expect(result).not.toHaveProperty('deletedAt');
        });

        it('should exclude sensitive fields from response', async () => {
            vi.mocked(service.create).mockResolvedValue(mockUser);

            const result: UserResponseDto = await controller.create(createUserDto);

            expect(result).not.toHaveProperty('passwordHash');
            expect(result).not.toHaveProperty('deletedAt');
        });
    });

    describe('findOne', () => {
        it('should return a user by id', async () => {
            vi.mocked(service.findOne).mockResolvedValue(mockUser);

            const result: UserResponseDto = await controller.findOne(mockUser.id, mockUser);

            expect(service.findOne).toHaveBeenCalledWith(mockUser.id, mockUser.id);
            expect(result).toEqual(mockUserResponse);
        });

        it('should exclude sensitive fields from response', async () => {
            vi.mocked(service.findOne).mockResolvedValue(mockUser);

            const result: UserResponseDto = await controller.findOne(mockUser.id, mockUser);

            expect(result).not.toHaveProperty('passwordHash');
            expect(result).not.toHaveProperty('deletedAt');
        });
    });

    describe('update', () => {
        const updateUserDto: UpdateUserDto = {
            firstName: 'UpdatedName',
            timezone: 'America/New_York'
        };

        it('should update a user and return UserResponseDto', async () => {
            const updatedUser: User = {...mockUser, ...updateUserDto};
            vi.mocked(service.update).mockResolvedValue(updatedUser);

            const result: UserResponseDto = await controller.update(
                mockUser.id, updateUserDto, mockUser
            );

            expect(service.update).toHaveBeenCalledWith(mockUser.id, mockUser.id, updateUserDto);
            expect(result.firstName).toBe(updateUserDto.firstName);
            expect(result.timezone).toBe(updateUserDto.timezone);
        });

        it('should exclude sensitive fields from response', async () => {
            const updatedUser: User = {...mockUser, ...updateUserDto};
            vi.mocked(service.update).mockResolvedValue(updatedUser);

            const result: UserResponseDto = await controller.update(
                mockUser.id, updateUserDto, mockUser
            );

            expect(result).not.toHaveProperty('passwordHash');
            expect(result).not.toHaveProperty('deletedAt');
        });
    });

    describe('remove', () => {
        it('should soft delete a user and return void', async () => {
            const deletedUser: User = {
                ...mockUser,
                deletedAt: new Date(),
                isActive: false
            };
            vi.mocked(service.remove).mockResolvedValue(deletedUser);

            await controller.remove(mockUser.id, mockUser);

            expect(service.remove).toHaveBeenCalledWith(mockUser.id, mockUser.id);
        });
    });
});
