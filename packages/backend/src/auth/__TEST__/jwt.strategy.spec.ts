import {
    describe,
    it,
    expect,
    beforeEach,
    vi
} from 'vitest';
import {UnauthorizedException} from '@nestjs/common';
import type {ConfigService} from '@nestjs/config';
import {JwtStrategy} from '#auth/strategies/jwt.strategy.js';
import type {AuthService} from '#auth/auth.service.js';
import type {User} from '#generated/prisma/client.js';
import type {JwtPayload} from '#auth/dto/auth-response.dto.js';

describe('JwtStrategy', () => {
    let strategy: JwtStrategy;
    let authService: AuthService;
    let configService: ConfigService;

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

    const mockPayload: JwtPayload = {
        sub: mockUser.id,
        email: mockUser.email
    };

    beforeEach(() => {
        authService = {
            validateJwtPayload: vi.fn()
        } as unknown as AuthService;

        configService = {
            get: vi.fn().mockReturnValue('test-secret')
        } as unknown as ConfigService;

        strategy = new JwtStrategy(authService, configService);
        vi.clearAllMocks();
    });

    describe('validate', () => {
        it('should return user if payload is valid', async () => {
            vi.mocked(authService.validateJwtPayload).mockResolvedValue(mockUser);

            const result: User = await strategy.validate(mockPayload);

            expect(authService.validateJwtPayload).toHaveBeenCalledWith(mockPayload);
            expect(result).toEqual(mockUser);
        });

        it('should throw UnauthorizedException if user not found', async () => {
            vi.mocked(authService.validateJwtPayload).mockResolvedValue(null);

            await expect(strategy.validate(mockPayload)).rejects.toThrow(
                UnauthorizedException
            );
            expect(authService.validateJwtPayload).toHaveBeenCalledWith(mockPayload);
        });

        it('should call validateJwtPayload with correct payload', async () => {
            vi.mocked(authService.validateJwtPayload).mockResolvedValue(mockUser);

            await strategy.validate(mockPayload);

            expect(authService.validateJwtPayload).toHaveBeenCalledWith({
                sub: mockUser.id,
                email: mockUser.email
            });
        });

        it('should validate payload with sub field', async () => {
            vi.mocked(authService.validateJwtPayload).mockResolvedValue(mockUser);

            await strategy.validate(mockPayload);

            expect(authService.validateJwtPayload).toHaveBeenCalledWith(
                expect.objectContaining({
                    sub: mockUser.id
                })
            );
        });

        it('should validate payload with email field', async () => {
            vi.mocked(authService.validateJwtPayload).mockResolvedValue(mockUser);

            await strategy.validate(mockPayload);

            expect(authService.validateJwtPayload).toHaveBeenCalledWith(
                expect.objectContaining({
                    email: mockUser.email
                })
            );
        });
    });
});
