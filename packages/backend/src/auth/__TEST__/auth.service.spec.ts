import {
    describe,
    it,
    expect,
    beforeEach,
    vi
} from 'vitest';
import {UnauthorizedException} from '@nestjs/common';
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
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
    };

    beforeEach(() => {
        usersService = {
            create: vi.fn(),
            findOne: vi.fn(),
            findByEmail: vi.fn()
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
