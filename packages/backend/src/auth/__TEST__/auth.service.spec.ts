import {
    describe,
    it,
    expect,
    beforeEach,
    vi
} from 'vitest';
import {
    UnauthorizedException, ConflictException
} from '@nestjs/common';
import type {JwtService} from '@nestjs/jwt';
import {AuthService} from '#auth/auth.service.js';
import type {UsersService} from '#users/users.service.js';
import type {User} from '#generated/prisma/client.js';
import type {CreateUserDto} from '#users/dto/create-user.dto.js';
import type {
    AuthResponse, JwtPayload
} from '#auth/dto/auth-response.dto.js';
import * as bcrypt from 'bcrypt';

vi.mock('bcrypt');

describe('AuthService', () => {
    let service: AuthService;
    let usersService: UsersService;
    let jwtService: JwtService;

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
        usersService = {
            create: vi.fn(),
            findOne: vi.fn(),
            findByEmail: vi.fn(),
            hasUsers: vi.fn(),
            promoteToAdmin: vi.fn()
        } as unknown as UsersService;

        jwtService = {
            sign: vi.fn()
        } as unknown as JwtService;

        service = new AuthService(usersService, jwtService);
        vi.clearAllMocks();
    });

    describe('register', () => {
        const createUserDto: CreateUserDto = {
            email: 'newuser@example.com',
            password: 'password123',
            firstName: 'Jane',
            lastName: 'Smith'
        };

        it('should register a new user and return auth response with token', async () => {
            const mockToken = 'jwt.token.here';
            vi.mocked(usersService.create).mockResolvedValue(mockUser);
            vi.mocked(jwtService.sign).mockReturnValue(mockToken);

            const result: AuthResponse = await service.register(createUserDto);

            expect(usersService.create).toHaveBeenCalledWith(createUserDto);
            expect(jwtService.sign).toHaveBeenCalledWith({
                sub: mockUser.id,
                email: mockUser.email
            });
            expect(result).toEqual({
                accessToken: mockToken,
                user: {
                    id: mockUser.id,
                    email: mockUser.email,
                    firstName: mockUser.firstName,
                    lastName: mockUser.lastName
                }
            });
        });

        it('should not include sensitive fields in response', async () => {
            const mockToken = 'jwt.token.here';
            vi.mocked(usersService.create).mockResolvedValue(mockUser);
            vi.mocked(jwtService.sign).mockReturnValue(mockToken);

            const result: AuthResponse = await service.register(createUserDto);

            expect(result.user).not.toHaveProperty('passwordHash');
            expect(result.user).not.toHaveProperty('deletedAt');
            expect(result.user).not.toHaveProperty('isActive');
        });
    });

    describe('login', () => {
        const email = 'test@example.com';
        const password = 'password123';

        it('should authenticate user and return auth response with token', async () => {
            const mockToken = 'jwt.token.here';
            vi.mocked(usersService.findByEmail).mockResolvedValue(mockUser);
            vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
            vi.mocked(jwtService.sign).mockReturnValue(mockToken);

            const result: AuthResponse = await service.login(email, password);

            expect(usersService.findByEmail).toHaveBeenCalledWith(email);
            expect(bcrypt.compare).toHaveBeenCalledWith(password, mockUser.passwordHash);
            expect(jwtService.sign).toHaveBeenCalledWith({
                sub: mockUser.id,
                email: mockUser.email
            });
            expect(result).toEqual({
                accessToken: mockToken,
                user: {
                    id: mockUser.id,
                    email: mockUser.email,
                    firstName: mockUser.firstName,
                    lastName: mockUser.lastName
                }
            });
        });

        it('should throw UnauthorizedException if user not found', async () => {
            vi.mocked(usersService.findByEmail).mockResolvedValue(null);

            await expect(service.login(email, password)).rejects.toThrow(
                UnauthorizedException
            );
            await expect(service.login(email, password)).rejects.toThrow(
                'Invalid credentials'
            );
            expect(usersService.findByEmail).toHaveBeenCalledWith(email);
        });

        it('should throw UnauthorizedException if password is invalid', async () => {
            vi.mocked(usersService.findByEmail).mockResolvedValue(mockUser);
            vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

            await expect(service.login(email, password)).rejects.toThrow(
                UnauthorizedException
            );
            await expect(service.login(email, password)).rejects.toThrow(
                'Invalid credentials'
            );
            expect(bcrypt.compare).toHaveBeenCalledWith(password, mockUser.passwordHash);
        });

        it('should not include sensitive fields in response', async () => {
            const mockToken = 'jwt.token.here';
            vi.mocked(usersService.findByEmail).mockResolvedValue(mockUser);
            vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
            vi.mocked(jwtService.sign).mockReturnValue(mockToken);

            const result: AuthResponse = await service.login(email, password);

            expect(result.user).not.toHaveProperty('passwordHash');
            expect(result.user).not.toHaveProperty('deletedAt');
        });
    });

    describe('validateUser', () => {
        const email = 'test@example.com';
        const password = 'password123';

        it('should return user if credentials are valid', async () => {
            vi.mocked(usersService.findByEmail).mockResolvedValue(mockUser);
            vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

            const result: User = await service.validateUser(email, password);

            expect(usersService.findByEmail).toHaveBeenCalledWith(email);
            expect(bcrypt.compare).toHaveBeenCalledWith(password, mockUser.passwordHash);
            expect(result).toEqual(mockUser);
        });

        it('should throw UnauthorizedException if user not found', async () => {
            vi.mocked(usersService.findByEmail).mockResolvedValue(null);

            await expect(service.validateUser(email, password)).rejects.toThrow(
                UnauthorizedException
            );
            await expect(service.validateUser(email, password)).rejects.toThrow(
                'Invalid credentials'
            );
        });

        it('should throw UnauthorizedException if password is incorrect', async () => {
            vi.mocked(usersService.findByEmail).mockResolvedValue(mockUser);
            vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

            await expect(service.validateUser(email, password)).rejects.toThrow(
                UnauthorizedException
            );
            await expect(service.validateUser(email, password)).rejects.toThrow(
                'Invalid credentials'
            );
        });
    });

    describe('generateToken', () => {
        it('should generate JWT token with correct payload', () => {
            const mockToken = 'jwt.token.here';
            vi.mocked(jwtService.sign).mockReturnValue(mockToken);

            const result: string = service.generateToken(mockUser);

            expect(jwtService.sign).toHaveBeenCalledWith({
                sub: mockUser.id,
                email: mockUser.email
            });
            expect(result).toBe(mockToken);
        });

        it('should include user id as sub in payload', () => {
            vi.mocked(jwtService.sign).mockReturnValue('token');

            service.generateToken(mockUser);

            expect(jwtService.sign).toHaveBeenCalledWith(
                expect.objectContaining({
                    sub: mockUser.id
                })
            );
        });

        it('should include user email in payload', () => {
            vi.mocked(jwtService.sign).mockReturnValue('token');

            service.generateToken(mockUser);

            expect(jwtService.sign).toHaveBeenCalledWith(
                expect.objectContaining({
                    email: mockUser.email
                })
            );
        });
    });

    describe('getSetupStatus', () => {
        it('should return required: true when no users exist', async () => {
            vi.mocked(usersService.hasUsers).mockResolvedValue(false);

            const result = await service.getSetupStatus();

            expect(result).toEqual({required: true});
        });

        it('should return required: false when users exist', async () => {
            vi.mocked(usersService.hasUsers).mockResolvedValue(true);

            const result = await service.getSetupStatus();

            expect(result).toEqual({required: false});
        });
    });

    describe('setupAdmin', () => {
        const createUserDto: CreateUserDto = {
            email: 'admin@example.com',
            password: 'password123',
            firstName: 'Admin',
            lastName: 'User'
        };

        it('should create admin and return auth response when no users exist', async () => {
            const mockToken = 'jwt.token.here';
            vi.mocked(usersService.hasUsers).mockResolvedValue(false);
            vi.mocked(usersService.create).mockResolvedValue(mockUser);
            vi.mocked(usersService.promoteToAdmin).mockResolvedValue(undefined);
            vi.mocked(jwtService.sign).mockReturnValue(mockToken);

            const result = await service.setupAdmin(createUserDto);

            expect(usersService.hasUsers).toHaveBeenCalled();
            expect(usersService.create).toHaveBeenCalledWith(createUserDto);
            expect(usersService.promoteToAdmin).toHaveBeenCalledWith(mockUser.id);
            expect(result).toEqual({
                accessToken: mockToken,
                user: {
                    id: mockUser.id,
                    email: mockUser.email,
                    firstName: mockUser.firstName,
                    lastName: mockUser.lastName
                }
            });
        });

        it('should throw ConflictException when users already exist', async () => {
            vi.mocked(usersService.hasUsers).mockResolvedValue(true);

            await expect(service.setupAdmin(createUserDto)).rejects.toThrow(ConflictException);
            await expect(service.setupAdmin(createUserDto)).rejects.toThrow('Setup already complete');
            expect(usersService.create).not.toHaveBeenCalled();
        });
    });

    describe('validateJwtPayload', () => {
        const mockPayload: JwtPayload = {
            sub: mockUser.id,
            email: mockUser.email
        };

        it('should return user if payload is valid', async () => {
            vi.mocked(usersService.findByEmail).mockResolvedValue(mockUser);

            const result: User | null = await service.validateJwtPayload(mockPayload);

            expect(usersService.findByEmail).toHaveBeenCalledWith(mockPayload.email);
            expect(result).toEqual(mockUser);
        });

        it('should return null if user not found', async () => {
            vi.mocked(usersService.findByEmail).mockResolvedValue(null);

            const result: User | null = await service.validateJwtPayload(mockPayload);

            expect(usersService.findByEmail).toHaveBeenCalledWith(mockPayload.email);
            expect(result).toBeNull();
        });
    });
});
