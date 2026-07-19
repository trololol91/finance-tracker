import {
    describe, it, expect, beforeEach, afterEach, vi
} from 'vitest';
import {OAuthCodesService} from '#oauth/oauth-codes.service.js';
import {hashToken} from '#common/hash-token.js';
import {PrismaClientKnownRequestError} from '#generated/prisma/internal/prismaNamespace.js';
import type {PrismaService} from '#database/prisma.service.js';

const p2025 = (): PrismaClientKnownRequestError =>
    new PrismaClientKnownRequestError('Record not found', {code: 'P2025', clientVersion: '7.0.0'});

const mockPrisma = {
    oAuthAuthorizationCode: {
        create: vi.fn(),
        delete: vi.fn()
    }
} as unknown as PrismaService;

describe('OAuthCodesService', () => {
    let service: OAuthCodesService;
    const now = new Date('2026-01-01T00:00:00.000Z');

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(now);
        service = new OAuthCodesService(mockPrisma);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('issue', () => {
        it('stores a SHA-256 hash of the raw code, not the code itself, with a 1-minute expiry', async () => {
            vi.mocked(mockPrisma.oAuthAuthorizationCode.create).mockResolvedValue({} as never);

            const rawCode = await service.issue({
                userId: 'user-1',
                clientId: 'claude-ai',
                redirectUri: 'https://claude.ai/callback',
                scopes: ['transactions:read'],
                codeChallenge: 'challenge-value',
                codeChallengeMethod: 'S256'
            });

            expect(rawCode).toMatch(/^oac_[0-9a-f]{64}$/);
            expect(mockPrisma.oAuthAuthorizationCode.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    codeHash: hashToken(rawCode),
                    clientId: 'claude-ai',
                    userId: 'user-1',
                    redirectUri: 'https://claude.ai/callback',
                    scopes: ['transactions:read'],
                    codeChallenge: 'challenge-value',
                    codeChallengeMethod: 'S256',
                    expiresAt: new Date('2026-01-01T00:01:00.000Z')
                })
            });
        });
    });

    describe('consume', () => {
        const rawCode = 'oac_' + 'a'.repeat(64);
        const codeHash = hashToken(rawCode);

        it('returns null when the code is unknown (delete throws P2025)', async () => {
            vi.mocked(mockPrisma.oAuthAuthorizationCode.delete).mockRejectedValue(p2025());

            const result = await service.consume(rawCode);

            expect(result).toBeNull();
            expect(mockPrisma.oAuthAuthorizationCode.delete).toHaveBeenCalledWith({
                where: {codeHash},
                include: {user: {select: {role: true}}}
            });
        });

        it('rethrows a non-P2025 error instead of misreporting it as an invalid code', async () => {
            const dbError = new Error('Connection terminated unexpectedly');
            vi.mocked(mockPrisma.oAuthAuthorizationCode.delete).mockRejectedValue(dbError);

            await expect(service.consume(rawCode)).rejects.toThrow(dbError);
        });

        it('returns null when the code has already expired', async () => {
            vi.mocked(mockPrisma.oAuthAuthorizationCode.delete).mockResolvedValue({
                id: 'oac-1',
                codeHash,
                clientId: 'claude-ai',
                userId: 'user-1',
                redirectUri: 'https://claude.ai/callback',
                scopes: ['transactions:read'],
                codeChallenge: 'challenge-value',
                codeChallengeMethod: 'S256',
                expiresAt: new Date('2025-12-31T23:59:00.000Z'),
                createdAt: new Date('2025-12-31T23:58:00.000Z'),
                user: {role: 'USER'}
            } as never);

            const result = await service.consume(rawCode);

            expect(result).toBeNull();
        });

        it('returns the consumed code with the joined user role on success', async () => {
            vi.mocked(mockPrisma.oAuthAuthorizationCode.delete).mockResolvedValue({
                id: 'oac-1',
                codeHash,
                clientId: 'claude-ai',
                userId: 'user-1',
                redirectUri: 'https://claude.ai/callback',
                scopes: ['transactions:read', 'dashboard:read'],
                codeChallenge: 'challenge-value',
                codeChallengeMethod: 'S256',
                expiresAt: new Date('2026-01-01T00:01:00.000Z'),
                createdAt: now,
                user: {role: 'ADMIN'}
            } as never);

            const result = await service.consume(rawCode);

            expect(result).toEqual({
                userId: 'user-1',
                userRole: 'ADMIN',
                clientId: 'claude-ai',
                redirectUri: 'https://claude.ai/callback',
                scopes: ['transactions:read', 'dashboard:read'],
                codeChallenge: 'challenge-value',
                codeChallengeMethod: 'S256'
            });
        });

        it('is single-use: a second consume() for the same code fails (delete rejects, since the row is gone)', async () => {
            vi.mocked(mockPrisma.oAuthAuthorizationCode.delete)
                .mockResolvedValueOnce({
                    id: 'oac-1',
                    codeHash,
                    clientId: 'claude-ai',
                    userId: 'user-1',
                    redirectUri: 'https://claude.ai/callback',
                    scopes: ['transactions:read'],
                    codeChallenge: 'challenge-value',
                    codeChallengeMethod: 'S256',
                    expiresAt: new Date('2026-01-01T00:01:00.000Z'),
                    createdAt: now,
                    user: {role: 'USER'}
                } as never)
                .mockRejectedValueOnce(p2025());

            const first = await service.consume(rawCode);
            const second = await service.consume(rawCode);

            expect(first).not.toBeNull();
            expect(second).toBeNull();
        });
    });
});
