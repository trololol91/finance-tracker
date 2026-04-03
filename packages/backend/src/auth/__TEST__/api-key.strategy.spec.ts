import {
    describe, it, expect, beforeEach, vi
} from 'vitest';
import {UnauthorizedException} from '@nestjs/common';
import {ApiKeyStrategy} from '#auth/strategies/api-key.strategy.js';
import type {PrismaService} from '#database/prisma.service.js';

const mockPrisma = {
    apiToken: {
        findFirst: vi.fn(),
        update: vi.fn()
    }
} as unknown as PrismaService;

const baseUser = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hash',
    firstName: 'Test',
    lastName: 'User',
    emailVerified: true,
    isActive: true,
    deletedAt: null,
    timezone: 'UTC',
    currency: 'USD',
    role: 'USER',
    notifyEmail: true,
    createdAt: new Date(),
    updatedAt: new Date()
};

describe('ApiKeyStrategy', () => {
    let strategy: ApiKeyStrategy;

    beforeEach(() => {
        vi.clearAllMocks();
        strategy = new ApiKeyStrategy(mockPrisma);
    });

    describe('validate', () => {
        it('throws UnauthorizedException when token not found', async () => {
            vi.mocked(mockPrisma.apiToken.findFirst).mockResolvedValue(null);

            await expect(
                strategy.validate(undefined, 'ft_invalidtoken')
            ).rejects.toThrow(UnauthorizedException);
        });

        it('returns user with apiTokenScopes and isApiKeyAuth flag on valid token', async () => {
            vi.mocked(mockPrisma.apiToken.findFirst).mockResolvedValue({
                id: 'tok-1',
                scopes: ['transactions:read'],
                user: baseUser
            } as never);
            vi.mocked(mockPrisma.apiToken.update).mockResolvedValue({} as never);

            const result = await strategy.validate(undefined, 'ft_validtoken') as typeof baseUser & {
                apiTokenScopes: string[];
                isApiKeyAuth: boolean;
            };

            expect(result.apiTokenScopes).toEqual(['transactions:read']);
            expect(result.isApiKeyAuth).toBe(true);
            expect(result.email).toBe('test@example.com');
        });

        it('fires lastUsedAt update without awaiting', async () => {
            vi.mocked(mockPrisma.apiToken.findFirst).mockResolvedValue({
                id: 'tok-1',
                scopes: ['accounts:read'],
                user: baseUser
            } as never);
            vi.mocked(mockPrisma.apiToken.update).mockResolvedValue({} as never);

            await strategy.validate(undefined, 'ft_sometoken');

            expect(mockPrisma.apiToken.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {id: 'tok-1'},
                    data: expect.objectContaining({lastUsedAt: expect.any(Date)})
                })
            );
        });

        it('hashes the raw token before querying', async () => {
            vi.mocked(mockPrisma.apiToken.findFirst).mockResolvedValue(null);

            await expect(
                strategy.validate(undefined, 'ft_rawtoken')
            ).rejects.toThrow(UnauthorizedException);

            const query = vi.mocked(mockPrisma.apiToken.findFirst).mock.calls[0][0];
            expect((query as {where: {tokenHash: string}}).where.tokenHash).toHaveLength(64);
            expect((query as {where: {tokenHash: string}}).where.tokenHash).not.toBe('ft_rawtoken');
        });
    });
});
