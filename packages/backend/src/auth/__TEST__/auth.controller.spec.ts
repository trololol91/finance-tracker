import {
    describe,
    it,
    expect,
    beforeEach,
    vi
} from 'vitest';
import {AuthController} from '#auth/auth.controller.js';
import type {AuthService} from '#auth/auth.service.js';
import type {User} from '#generated/prisma/client.js';
import type {CreateUserDto} from '#users/dto/create-user.dto.js';
import type {UserResponseDto} from '#users/dto/user-response.dto.js';
import type {AuthResponse} from '#auth/dto/index.js';
import type {LoginDto} from '#auth/dto/index.js';

describe('AuthController', () => {
    let controller: AuthController;
    let service: AuthService;

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
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
    };

    const mockAuthResponse: AuthResponse = {
        accessToken: 'jwt.token.here',
        user: {
            id: mockUser.id,
            email: mockUser.email,
            firstName: mockUser.firstName,
            lastName: mockUser.lastName
        }
    };

    beforeEach(() => {
        service = {
            register: vi.fn(),
            login: vi.fn()
        } as unknown as AuthService;

        controller = new AuthController(service);
        vi.clearAllMocks();
    });

    describe('register', () => {
        const createUserDto: CreateUserDto = {
            email: 'newuser@example.com',
            password: 'password123',
            firstName: 'Jane',
            lastName: 'Smith'
        };

        it('should register a new user and return auth response', async () => {
            vi.mocked(service.register).mockResolvedValue(mockAuthResponse);

            const result: AuthResponse = await controller.register(createUserDto);

            expect(service.register).toHaveBeenCalledWith(createUserDto);
            expect(result).toEqual(mockAuthResponse);
        });

        it('should return access token in response', async () => {
            vi.mocked(service.register).mockResolvedValue(mockAuthResponse);

            const result: AuthResponse = await controller.register(createUserDto);

            expect(result).toHaveProperty('accessToken');
            expect(result.accessToken).toBe('jwt.token.here');
        });

        it('should return user info in response', async () => {
            vi.mocked(service.register).mockResolvedValue(mockAuthResponse);

            const result: AuthResponse = await controller.register(createUserDto);

            expect(result).toHaveProperty('user');
            expect(result.user).toEqual({
                id: mockUser.id,
                email: mockUser.email,
                firstName: mockUser.firstName,
                lastName: mockUser.lastName
            });
        });
    });

    describe('login', () => {
        const loginDto: LoginDto = {
            email: 'test@example.com',
            password: 'password123'
        };

        it('should authenticate user and return auth response', async () => {
            vi.mocked(service.login).mockResolvedValue(mockAuthResponse);

            const result: AuthResponse = await controller.login(loginDto);

            expect(service.login).toHaveBeenCalledWith(loginDto.email, loginDto.password);
            expect(result).toEqual(mockAuthResponse);
        });

        it('should return access token in response', async () => {
            vi.mocked(service.login).mockResolvedValue(mockAuthResponse);

            const result: AuthResponse = await controller.login(loginDto);

            expect(result).toHaveProperty('accessToken');
            expect(result.accessToken).toBe('jwt.token.here');
        });

        it('should return user info in response', async () => {
            vi.mocked(service.login).mockResolvedValue(mockAuthResponse);

            const result: AuthResponse = await controller.login(loginDto);

            expect(result).toHaveProperty('user');
            expect(result.user).toEqual({
                id: mockUser.id,
                email: mockUser.email,
                firstName: mockUser.firstName,
                lastName: mockUser.lastName
            });
        });
    });

    describe('getProfile', () => {
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
            createdAt: mockUser.createdAt,
            updatedAt: mockUser.updatedAt
        };

        it('should return user profile', () => {
            const result: UserResponseDto = controller.getProfile(mockUser);

            expect(result).toEqual(mockUserResponse);
        });

        it('should exclude password hash from response', () => {
            const result: UserResponseDto = controller.getProfile(mockUser);

            expect(result).not.toHaveProperty('passwordHash');
        });

        it('should exclude deleted at from response', () => {
            const result: UserResponseDto = controller.getProfile(mockUser);

            expect(result).not.toHaveProperty('deletedAt');
        });

        it('should include all user fields in response', () => {
            const result: UserResponseDto = controller.getProfile(mockUser);

            expect(result).toHaveProperty('id');
            expect(result).toHaveProperty('email');
            expect(result).toHaveProperty('firstName');
            expect(result).toHaveProperty('lastName');
            expect(result).toHaveProperty('emailVerified');
            expect(result).toHaveProperty('isActive');
            expect(result).toHaveProperty('timezone');
            expect(result).toHaveProperty('currency');
            expect(result).toHaveProperty('role');
            expect(result).toHaveProperty('createdAt');
            expect(result).toHaveProperty('updatedAt');
        });
    });
});
