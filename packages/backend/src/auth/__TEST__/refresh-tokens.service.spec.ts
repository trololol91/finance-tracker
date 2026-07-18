import {
    describe, it, expect, beforeEach, afterEach, vi
} from 'vitest';
import {RefreshTokensService} from '#auth/refresh-tokens.service.js';
import {hashToken as hashOf} from '#common/hash-token.js';
import type {PrismaService} from '#database/prisma.service.js';
import type {ConfigService} from '@nestjs/config';

const mockPrisma = {
    refreshToken: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn()
    }
} as unknown as PrismaService;

describe('RefreshTokensService', () => {
    let service: RefreshTokensService;
    let config: ConfigService;
    const now = new Date('2026-01-01T00:00:00.000Z');

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(now);
        config = {get: vi.fn().mockReturnValue('30d')} as unknown as ConfigService;
        service = new RefreshTokensService(mockPrisma, config);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('issue', () => {
        it('stores a SHA-256 hash of the raw token, not the token itself', async () => {
            vi.mocked(mockPrisma.refreshToken.create).mockResolvedValue({} as never);

            const result = await service.issue('user-1', false);

            expect(result.rawToken).toMatch(/^[0-9a-f]{64}$/);
            expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    userId: 'user-1',
                    tokenHash: hashOf(result.rawToken),
                    rememberMe: false
                })
            });
        });

        it('sets a 1-day expiry when rememberMe is false, regardless of JWT_REFRESH_EXPIRES_IN', async () => {
            vi.mocked(mockPrisma.refreshToken.create).mockResolvedValue({} as never);

            const result = await service.issue('user-1', false);

            expect(result.expiresAt).toEqual(new Date('2026-01-02T00:00:00.000Z'));
        });

        it('sets expiry from JWT_REFRESH_EXPIRES_IN when rememberMe is true', async () => {
            vi.mocked(mockPrisma.refreshToken.create).mockResolvedValue({} as never);
            vi.mocked(config.get).mockReturnValue('30d');

            const result = await service.issue('user-1', true);

            expect(result.expiresAt).toEqual(new Date('2026-01-31T00:00:00.000Z'));
        });
    });

    describe('validateAndRotate', () => {
        const rawToken = 'a'.repeat(64);
        const tokenHash = hashOf(rawToken);

        it('returns null when the token is unknown', async () => {
            vi.mocked(mockPrisma.refreshToken.findUnique).mockResolvedValue(null);

            const result = await service.validateAndRotate(rawToken);

            expect(result).toBeNull();
        });

        it('returns null when the token has expired', async () => {
            vi.mocked(mockPrisma.refreshToken.findUnique).mockResolvedValue({
                userId: 'user-1',
                tokenHash,
                rememberMe: false,
                expiresAt: new Date('2025-12-31T00:00:00.000Z'),
                revokedAt: null
            } as never);

            const result = await service.validateAndRotate(rawToken);

            expect(result).toBeNull();
        });

        it('revokes the token and issues a rotated one on first (fresh) use', async () => {
            vi.mocked(mockPrisma.refreshToken.findUnique).mockResolvedValue({
                userId: 'user-1',
                tokenHash,
                rememberMe: true,
                expiresAt: new Date('2026-02-01T00:00:00.000Z'),
                revokedAt: null
            } as never);
            vi.mocked(mockPrisma.refreshToken.update).mockResolvedValue({} as never);
            vi.mocked(mockPrisma.refreshToken.create).mockResolvedValue({} as never);

            const result = await service.validateAndRotate(rawToken);

            expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith({
                where: {tokenHash},
                data: {revokedAt: now}
            });
            expect(result).not.toBeNull();
            expect(result?.userId).toBe('user-1');
            expect(result?.rawToken).not.toBe(rawToken);
        });

        it('returns the SAME rotated token on replay within the grace period, without a second DB rotation', async () => {
            vi.mocked(mockPrisma.refreshToken.findUnique).mockResolvedValue({
                userId: 'user-1',
                tokenHash,
                rememberMe: true,
                expiresAt: new Date('2026-02-01T00:00:00.000Z'),
                revokedAt: null
            } as never);
            vi.mocked(mockPrisma.refreshToken.update).mockResolvedValue({} as never);
            vi.mocked(mockPrisma.refreshToken.create).mockResolvedValue({} as never);

            const first = await service.validateAndRotate(rawToken);

            vi.setSystemTime(new Date(now.getTime() + 10 * 1000)); // 10s later, within grace
            const second = await service.validateAndRotate(rawToken);

            // Same tab-race token, not a second independently-minted one — this is
            // what prevents N racing tabs from ending up with N valid sessions.
            expect(second).toEqual(first);
            expect(mockPrisma.refreshToken.findUnique).toHaveBeenCalledTimes(1);
            expect(mockPrisma.refreshToken.create).toHaveBeenCalledTimes(1);
        });

        it('rejects reuse outside the rotation grace period', async () => {
            vi.mocked(mockPrisma.refreshToken.findUnique).mockResolvedValue({
                userId: 'user-1',
                tokenHash,
                rememberMe: true,
                expiresAt: new Date('2026-02-01T00:00:00.000Z'),
                revokedAt: null
            } as never);
            vi.mocked(mockPrisma.refreshToken.update).mockResolvedValue({} as never);
            vi.mocked(mockPrisma.refreshToken.create).mockResolvedValue({} as never);

            await service.validateAndRotate(rawToken); // fresh use, populates the cache

            // 60s later, past the 30s grace window
            vi.setSystemTime(new Date(now.getTime() + 60 * 1000));

            // Cache entry has expired, so this falls through to the DB, which by
            // now reflects the earlier rotation as revoked.
            vi.mocked(mockPrisma.refreshToken.findUnique).mockResolvedValue({
                userId: 'user-1',
                tokenHash,
                rememberMe: true,
                expiresAt: new Date('2026-02-01T00:00:00.000Z'),
                revokedAt: now
            } as never);

            const result = await service.validateAndRotate(rawToken);

            expect(result).toBeNull();
        });
    });

    describe('revoke', () => {
        it('permanently deletes the matching token rather than soft-revoking it', async () => {
            const rawToken = 'b'.repeat(64);
            vi.mocked(mockPrisma.refreshToken.deleteMany).mockResolvedValue({count: 1} as never);

            await service.revoke(rawToken);

            expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
                where: {tokenHash: hashOf(rawToken)}
            });
        });
    });
});
