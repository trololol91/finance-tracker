import {
    describe, it, expect, beforeEach, vi
} from 'vitest';
import {
    ForbiddenException, NotFoundException
} from '@nestjs/common';
import {ApiTokensService} from '#api-tokens/api-tokens.service.js';
import type {PrismaService} from '#database/prisma.service.js';

const mockPrisma = {
    apiToken: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn()
    }
} as unknown as PrismaService;

describe('ApiTokensService', () => {
    let service: ApiTokensService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new ApiTokensService(mockPrisma);
    });

    describe('create', () => {
        const baseDto = {name: 'Test Token', scopes: ['transactions:read' as const]};
        const now = new Date('2026-01-01');

        it('returns a token prefixed with ft_', async () => {
            vi.mocked(mockPrisma.apiToken.create).mockResolvedValue({
                id: 'tok-1',
                name: 'Test Token',
                scopes: ['transactions:read'],
                lastUsedAt: null,
                expiresAt: null,
                createdAt: now,
                updatedAt: now,
                userId: 'user-1',
                tokenHash: 'hash',
                deletedAt: null
            });

            const result = await service.create('user-1', 'USER', baseDto);

            expect(result.token).toMatch(/^ft_[0-9a-f]{64}$/);
            expect(result.id).toBe('tok-1');
        });

        it('stores SHA-256 hash of the raw token, not the token itself', async () => {
            vi.mocked(mockPrisma.apiToken.create).mockResolvedValue({
                id: 'tok-1',
                name: 'Test Token',
                scopes: ['transactions:read'],
                lastUsedAt: null,
                expiresAt: null,
                createdAt: now,
                updatedAt: now,
                userId: 'user-1',
                tokenHash: 'hash',
                deletedAt: null
            });

            const result = await service.create('user-1', 'USER', baseDto);
            const {tokenHash} = vi.mocked(mockPrisma.apiToken.create).mock.calls[0][0].data;

            expect(tokenHash).not.toBe(result.token);
            expect(tokenHash).toHaveLength(64);
        });

        it('throws ForbiddenException when USER role requests admin scope', async () => {
            await expect(
                service.create('user-1', 'USER', {name: 'Admin', scopes: ['admin'] as const})
            ).rejects.toThrow(ForbiddenException);
        });

        it('throws ForbiddenException when USER role requests admin alongside other scopes', async () => {
            await expect(
                service.create('user-1', 'USER', {
                    name: 'Mixed',
                    scopes: ['transactions:read', 'admin'] as never
                })
            ).rejects.toThrow(ForbiddenException);
        });

        it('allows ADMIN role to create admin-scoped token', async () => {
            vi.mocked(mockPrisma.apiToken.create).mockResolvedValue({
                id: 'tok-2',
                name: 'Admin Token',
                scopes: ['admin'],
                lastUsedAt: null,
                expiresAt: null,
                createdAt: now,
                updatedAt: now,
                userId: 'user-1',
                tokenHash: 'hash',
                deletedAt: null
            });

            const result = await service.create('user-1', 'ADMIN', {
                name: 'Admin Token',
                scopes: ['admin'] as const
            });
            expect(result.id).toBe('tok-2');
        });

        it('parses expiresAt YYYY-MM-DD as UTC midnight', async () => {
            vi.mocked(mockPrisma.apiToken.create).mockResolvedValue({
                id: 'tok-3',
                name: 'Expiring',
                scopes: ['accounts:read'],
                lastUsedAt: null,
                expiresAt: new Date('2027-01-01'),
                createdAt: now,
                updatedAt: now,
                userId: 'user-1',
                tokenHash: 'hash',
                deletedAt: null
            });

            await service.create('user-1', 'USER', {
                name: 'Expiring',
                scopes: ['accounts:read'] as const,
                expiresAt: '2027-01-01'
            });

            const createCall = vi.mocked(mockPrisma.apiToken.create).mock.calls[0][0];
            const expiresAt = createCall.data.expiresAt as Date;
            expect(expiresAt).toBeInstanceOf(Date);
            expect(expiresAt.getTime()).toBe(Date.UTC(2027, 0, 1));
        });

        it('parses expiresAt ISO timestamp using only the date portion', async () => {
            vi.mocked(mockPrisma.apiToken.create).mockResolvedValue({
                id: 'tok-4',
                name: 'Expiring ISO',
                scopes: ['accounts:read'],
                lastUsedAt: null,
                expiresAt: new Date('2027-06-15'),
                createdAt: now,
                updatedAt: now,
                userId: 'user-1',
                tokenHash: 'hash',
                deletedAt: null
            });

            await service.create('user-1', 'USER', {
                name: 'Expiring ISO',
                scopes: ['accounts:read'] as const,
                expiresAt: '2027-06-15T00:00:00.000Z'
            });

            const createCall = vi.mocked(mockPrisma.apiToken.create).mock.calls[0][0];
            const expiresAt = createCall.data.expiresAt as Date;
            expect(expiresAt).toBeInstanceOf(Date);
            // Must use Date.UTC — not affected by local timezone of the test runner
            expect(expiresAt.getTime()).toBe(Date.UTC(2027, 5, 15));
        });
    });

    describe('findAll', () => {
        it('returns tokens with only the safe fields selected', async () => {
            const mockToken = {
                id: 'tok-1',
                name: 'My Token',
                scopes: ['transactions:read'],
                lastUsedAt: null,
                expiresAt: null,
                createdAt: new Date()
            };
            vi.mocked(mockPrisma.apiToken.findMany).mockResolvedValue(
                [mockToken] as never
            );

            const result = await service.findAll('user-1');

            expect(result).toHaveLength(1);
            expect(result[0]).toHaveProperty('id', 'tok-1');
            expect(result[0]).toHaveProperty('name', 'My Token');

            // Verify the Prisma query uses select (not include) to exclude sensitive fields
            const findManyCall = vi.mocked(mockPrisma.apiToken.findMany).mock.calls[0]?.[0];
            expect(findManyCall).toHaveProperty('select');
            expect(findManyCall?.select).not.toHaveProperty('tokenHash');
            expect(findManyCall?.select).not.toHaveProperty('userId');
            expect(findManyCall?.select).not.toHaveProperty('deletedAt');
        });

        it('includes expired tokens so the UI can show their expired state', async () => {
            vi.mocked(mockPrisma.apiToken.findMany).mockResolvedValue([] as never);

            await service.findAll('user-1');

            const findManyCall = vi.mocked(mockPrisma.apiToken.findMany).mock.calls[0]?.[0];
            // The where clause should NOT filter by expiresAt — expired tokens are shown
            expect(findManyCall?.where).not.toHaveProperty('OR');
        });
    });

    describe('remove', () => {
        it('soft-deletes the token by setting deletedAt', async () => {
            vi.mocked(mockPrisma.apiToken.findFirst).mockResolvedValue({
                id: 'tok-1',
                name: 'My Token',
                scopes: [],
                lastUsedAt: null,
                expiresAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                userId: 'user-1',
                tokenHash: 'hash',
                deletedAt: null
            });
            vi.mocked(mockPrisma.apiToken.update).mockResolvedValue({} as never);

            await service.remove('user-1', 'tok-1');

            const updateCall = vi.mocked(mockPrisma.apiToken.update).mock.calls[0][0];
            expect(updateCall.data.deletedAt).toBeInstanceOf(Date);
        });

        it('throws NotFoundException when token does not belong to user', async () => {
            vi.mocked(mockPrisma.apiToken.findFirst).mockResolvedValue(null);

            await expect(service.remove('user-1', 'other-token')).rejects.toThrow(NotFoundException);
        });
    });
});
