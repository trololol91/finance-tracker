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
    role: 'USER',
    isActive: true,
    deletedAt: null
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
            expect(result.id).toBe('user-1');
        });

        it('throws UnauthorizedException when database throws', async () => {
            vi.mocked(mockPrisma.apiToken.findFirst).mockRejectedValue(
                new Error('Connection refused')
            );

            await expect(
                strategy.validate(undefined, 'ft_sometoken')
            ).rejects.toThrow(UnauthorizedException);
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

        it('throws UnauthorizedException when token is expired (findFirst returns null due to expiresAt filter)', async () => {
            // Simulate the DB returning null because the expiresAt clause filtered out the token
            vi.mocked(mockPrisma.apiToken.findFirst).mockResolvedValue(null);

            await expect(
                strategy.validate(undefined, 'ft_expiredtoken')
            ).rejects.toThrow(UnauthorizedException);

            // Confirm the query includes the expiresAt guard
            const query = vi.mocked(mockPrisma.apiToken.findFirst).mock.calls[0][0];
            expect((query as {where: {OR: unknown[]}}).where.OR).toBeDefined();
        });

        it('throws UnauthorizedException when user is deactivated (isActive: false)', async () => {
            vi.mocked(mockPrisma.apiToken.findFirst).mockResolvedValue({
                id: 'tok-1',
                scopes: ['transactions:read'],
                user: {...baseUser, isActive: false}
            } as never);

            await expect(
                strategy.validate(undefined, 'ft_sometoken')
            ).rejects.toThrow(UnauthorizedException);
        });

        it('throws UnauthorizedException when user is soft-deleted (deletedAt set)', async () => {
            vi.mocked(mockPrisma.apiToken.findFirst).mockResolvedValue({
                id: 'tok-1',
                scopes: ['transactions:read'],
                user: {...baseUser, deletedAt: new Date('2025-01-01')}
            } as never);

            await expect(
                strategy.validate(undefined, 'ft_sometoken')
            ).rejects.toThrow(UnauthorizedException);
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
