import {
    describe, it, expect, beforeEach, afterEach, vi
} from 'vitest';
import {OAuthInitialAccessTokensService} from '#oauth/oauth-initial-access-tokens.service.js';
import {hashToken} from '#common/hash-token.js';
import type {PrismaService} from '#database/prisma.service.js';

const mockPrisma = {
    oAuthInitialAccessToken: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn()
    }
} as unknown as PrismaService;

describe('OAuthInitialAccessTokensService', () => {
    let service: OAuthInitialAccessTokensService;
    const now = new Date('2026-01-01T00:00:00.000Z');

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(now);
        service = new OAuthInitialAccessTokensService(mockPrisma);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('issue', () => {
        it('stores a SHA-256 hash of the raw token, not the token itself, defaulting to a 24h expiry', async () => {
            vi.mocked(mockPrisma.oAuthInitialAccessToken.create).mockResolvedValue({} as never);

            const result = await service.issue('GitHub Copilot setup');

            expect(result.token).toMatch(/^iat_[0-9a-f]{64}$/);
            expect(result.expiresAt).toEqual(new Date('2026-01-02T00:00:00.000Z'));
            expect(mockPrisma.oAuthInitialAccessToken.create).toHaveBeenCalledWith({
                data: {
                    tokenHash: hashToken(result.token),
                    label: 'GitHub Copilot setup',
                    expiresAt: new Date('2026-01-02T00:00:00.000Z')
                }
            });
        });

        it('honors a custom expiresInHours', async () => {
            vi.mocked(mockPrisma.oAuthInitialAccessToken.create).mockResolvedValue({} as never);

            const result = await service.issue('Short-lived', 1);

            expect(result.expiresAt).toEqual(new Date('2026-01-01T01:00:00.000Z'));
        });
    });

    describe('validate', () => {
        const rawToken = 'iat_' + 'a'.repeat(64);
        const tokenHash = hashToken(rawToken);

        it('returns false for an unknown token', async () => {
            vi.mocked(mockPrisma.oAuthInitialAccessToken.findUnique).mockResolvedValue(null);

            const result = await service.validate(rawToken);

            expect(result).toBe(false);
            expect(mockPrisma.oAuthInitialAccessToken.update).not.toHaveBeenCalled();
        });

        it('returns false for an expired token, without updating lastUsedAt', async () => {
            vi.mocked(mockPrisma.oAuthInitialAccessToken.findUnique).mockResolvedValue({
                id: 'iat-1',
                tokenHash,
                label: 'Expired',
                expiresAt: new Date('2025-12-31T23:59:00.000Z'),
                lastUsedAt: null,
                createdAt: new Date('2025-12-30T00:00:00.000Z')
            } as never);

            const result = await service.validate(rawToken);

            expect(result).toBe(false);
            expect(mockPrisma.oAuthInitialAccessToken.update).not.toHaveBeenCalled();
        });

        it('returns true and updates lastUsedAt for a valid, unexpired token', async () => {
            vi.mocked(mockPrisma.oAuthInitialAccessToken.findUnique).mockResolvedValue({
                id: 'iat-1',
                tokenHash,
                label: 'Valid',
                expiresAt: new Date('2026-01-02T00:00:00.000Z'),
                lastUsedAt: null,
                createdAt: now
            } as never);
            vi.mocked(mockPrisma.oAuthInitialAccessToken.update).mockResolvedValue({} as never);

            const result = await service.validate(rawToken);

            expect(result).toBe(true);
            expect(mockPrisma.oAuthInitialAccessToken.update).toHaveBeenCalledWith({
                where: {tokenHash},
                data: {lastUsedAt: now}
            });
        });

        it('is not single-use: a second validate() for the same token still succeeds', async () => {
            vi.mocked(mockPrisma.oAuthInitialAccessToken.findUnique).mockResolvedValue({
                id: 'iat-1',
                tokenHash,
                label: 'Reusable',
                expiresAt: new Date('2026-01-02T00:00:00.000Z'),
                lastUsedAt: null,
                createdAt: now
            } as never);
            vi.mocked(mockPrisma.oAuthInitialAccessToken.update).mockResolvedValue({} as never);

            const first = await service.validate(rawToken);
            const second = await service.validate(rawToken);

            expect(first).toBe(true);
            expect(second).toBe(true);
            expect(mockPrisma.oAuthInitialAccessToken.findUnique).toHaveBeenCalledTimes(2);
        });
    });
});
