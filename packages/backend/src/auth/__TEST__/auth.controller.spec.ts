import {
    describe,
    it,
    expect,
    beforeEach,
    vi
} from 'vitest';
import type {
    Request, Response
} from 'express';
import {AuthController} from '#auth/auth.controller.js';
import type {
    AuthService, AuthResult
} from '#auth/auth.service.js';
import type {ConfigService} from '@nestjs/config';
import type {User} from '#generated/prisma/client.js';
import type {CreateUserDto} from '#users/dto/create-user.dto.js';
import type {UserResponseDto} from '#users/dto/user-response.dto.js';
import type {AuthResponse} from '#auth/dto/auth-response.dto.js';
import type {LoginDto} from '#auth/dto/login.dto.js';

describe('AuthController', () => {
    let controller: AuthController;
    let service: AuthService;
    let config: ConfigService;
    let res: Response;

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
        notifyEmail: true,
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

    const mockAuthResult: AuthResult = {
        authResponse: mockAuthResponse,
        refreshToken: {
            rawToken: 'raw-refresh-token',
            expiresAt: new Date('2024-02-01'),
            rememberMe: false
        }
    };

    const mockRequest = (cookies: Record<string, string> = {}): Request =>
        ({cookies} as unknown as Request);

    beforeEach(() => {
        service = {
            register: vi.fn(),
            login: vi.fn(),
            getSetupStatus: vi.fn(),
            setupAdmin: vi.fn(),
            refresh: vi.fn(),
            logout: vi.fn()
        } as unknown as AuthService;

        config = {
            get: vi.fn().mockReturnValue('development')
        } as unknown as ConfigService;

        res = {
            cookie: vi.fn(),
            clearCookie: vi.fn()
        } as unknown as Response;

        controller = new AuthController(service, config);
        vi.clearAllMocks();
    });

    describe('register', () => {
        const createUserDto: CreateUserDto = {
            email: 'newuser@example.com',
            password: 'password123',
            firstName: 'Jane',
            lastName: 'Smith'
        };

        it('should register a new user, set the refresh cookie, and return auth response', async () => {
            vi.mocked(service.register).mockResolvedValue(mockAuthResult);

            const result: AuthResponse = await controller.register(createUserDto, res);

            expect(service.register).toHaveBeenCalledWith(createUserDto);
            expect(result).toEqual(mockAuthResponse);
            expect(res.cookie).toHaveBeenCalledWith(
                'refresh_token',
                'raw-refresh-token',
                expect.objectContaining({httpOnly: true, path: '/api/auth'})
            );
        });

        it('should return user info in response', async () => {
            vi.mocked(service.register).mockResolvedValue(mockAuthResult);

            const result: AuthResponse = await controller.register(createUserDto, res);

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

        it('should authenticate user, default rememberMe to false, and return auth response', async () => {
            vi.mocked(service.login).mockResolvedValue(mockAuthResult);

            const result: AuthResponse = await controller.login(loginDto, res);

            expect(service.login).toHaveBeenCalledWith(loginDto.email, loginDto.password, false);
            expect(result).toEqual(mockAuthResponse);
        });

        it('should pass rememberMe through to the service', async () => {
            vi.mocked(service.login).mockResolvedValue(mockAuthResult);

            await controller.login({...loginDto, rememberMe: true}, res);

            expect(service.login).toHaveBeenCalledWith(loginDto.email, loginDto.password, true);
        });

        it('should set a persistent cookie (with expires) when rememberMe is true', async () => {
            vi.mocked(service.login).mockResolvedValue({
                ...mockAuthResult,
                refreshToken: {...mockAuthResult.refreshToken, rememberMe: true}
            });

            await controller.login({...loginDto, rememberMe: true}, res);

            expect(res.cookie).toHaveBeenCalledWith(
                'refresh_token',
                'raw-refresh-token',
                expect.objectContaining({expires: mockAuthResult.refreshToken.expiresAt})
            );
        });

        it('should set a session cookie (no expires) when rememberMe is false', async () => {
            vi.mocked(service.login).mockResolvedValue(mockAuthResult);

            await controller.login(loginDto, res);

            expect(res.cookie).toHaveBeenCalledWith(
                'refresh_token',
                'raw-refresh-token',
                expect.not.objectContaining({expires: expect.anything()})
            );
        });

        it('should return user info in response', async () => {
            vi.mocked(service.login).mockResolvedValue(mockAuthResult);

            const result: AuthResponse = await controller.login(loginDto, res);

            expect(result.user).toEqual({
                id: mockUser.id,
                email: mockUser.email,
                firstName: mockUser.firstName,
                lastName: mockUser.lastName
            });
        });
    });

    describe('getSetupStatus', () => {
        it('returns setup status from service', async () => {
            vi.mocked(service.getSetupStatus).mockResolvedValue({required: true});

            const result = await controller.getSetupStatus();

            expect(service.getSetupStatus).toHaveBeenCalled();
            expect(result).toEqual({required: true});
        });
    });

    describe('setupAdmin', () => {
        it('calls service.setupAdmin, sets the refresh cookie, and returns auth response', async () => {
            vi.mocked(service.setupAdmin).mockResolvedValue(mockAuthResult);
            const dto = {email: 'admin@example.com', password: 'secure', firstName: 'Admin', lastName: 'User'};

            const result = await controller.setupAdmin(dto as never, res);

            expect(service.setupAdmin).toHaveBeenCalledWith(dto);
            expect(result).toBe(mockAuthResponse);
            expect(res.cookie).toHaveBeenCalled();
        });
    });

    describe('refresh', () => {
        it('should read the refresh_token cookie, rotate it, and return a new access token', async () => {
            vi.mocked(service.refresh).mockResolvedValue(mockAuthResult);
            const req = mockRequest({refresh_token: 'old-raw-token'});

            const result = await controller.refresh(req, res);

            expect(service.refresh).toHaveBeenCalledWith('old-raw-token');
            expect(result).toEqual(mockAuthResponse);
            expect(res.cookie).toHaveBeenCalledWith(
                'refresh_token',
                'raw-refresh-token',
                expect.objectContaining({httpOnly: true, path: '/api/auth'})
            );
        });

        it('should pass undefined to the service when no cookie is present', async () => {
            vi.mocked(service.refresh).mockResolvedValue(mockAuthResult);
            const req = mockRequest();

            await controller.refresh(req, res);

            expect(service.refresh).toHaveBeenCalledWith(undefined);
        });
    });

    describe('logout', () => {
        it('should revoke the refresh token and clear the cookie', async () => {
            const req = mockRequest({refresh_token: 'raw-token'});

            await controller.logout(req, res);

            expect(service.logout).toHaveBeenCalledWith('raw-token');
            expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', {path: '/api/auth'});
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
            notifyEmail: mockUser.notifyEmail,
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
