import {
    describe, it, expect, beforeEach, vi
} from 'vitest';
import {OAuthClientsService} from '#oauth/oauth-clients.service.js';
import type {PrismaService} from '#database/prisma.service.js';

const mockPrisma = {
    oAuthClient: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        upsert: vi.fn()
    }
} as unknown as PrismaService;

describe('OAuthClientsService', () => {
    let service: OAuthClientsService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new OAuthClientsService(mockPrisma);
    });

    describe('findByClientId', () => {
        it('looks up a non-deleted client by clientId', async () => {
            vi.mocked(mockPrisma.oAuthClient.findFirst).mockResolvedValue({
                id: 'oc-1',
                clientId: 'claude-ai',
                clientName: 'Claude (static)',
                redirectUris: ['https://claude.ai/callback'],
                tokenEndpointAuthMethod: 'none',
                grantTypes: ['authorization_code'],
                deletedAt: null,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            const result = await service.findByClientId('claude-ai');

            expect(mockPrisma.oAuthClient.findFirst).toHaveBeenCalledWith({
                where: {clientId: 'claude-ai', deletedAt: null}
            });
            expect(result?.clientId).toBe('claude-ai');
        });

        it('returns null when no matching client exists', async () => {
            vi.mocked(mockPrisma.oAuthClient.findFirst).mockResolvedValue(null);

            const result = await service.findByClientId('unknown');

            expect(result).toBeNull();
        });
    });

    describe('ensureStaticClient', () => {
        it('upserts when no row exists yet, creating one', async () => {
            vi.mocked(mockPrisma.oAuthClient.findUnique).mockResolvedValue(null);
            vi.mocked(mockPrisma.oAuthClient.upsert).mockResolvedValue({} as never);

            await service.ensureStaticClient('claude-ai', ['https://claude.ai/callback']);

            expect(mockPrisma.oAuthClient.upsert).toHaveBeenCalledWith({
                where: {clientId: 'claude-ai'},
                update: {redirectUris: ['https://claude.ai/callback']},
                create: {
                    clientId: 'claude-ai',
                    clientName: 'Claude (static)',
                    redirectUris: ['https://claude.ai/callback'],
                    tokenEndpointAuthMethod: 'none',
                    grantTypes: ['authorization_code']
                }
            });
        });

        it('upserts when the stored redirectUris differ from the configured value', async () => {
            vi.mocked(mockPrisma.oAuthClient.findUnique).mockResolvedValue({
                redirectUris: ['https://old.example.com/callback']
            } as never);
            vi.mocked(mockPrisma.oAuthClient.upsert).mockResolvedValue({} as never);

            await service.ensureStaticClient('claude-ai', ['https://claude.ai/callback']);

            expect(mockPrisma.oAuthClient.upsert).toHaveBeenCalledWith(expect.objectContaining({
                update: {redirectUris: ['https://claude.ai/callback']}
            }));
        });

        it('skips the write entirely when the stored redirectUris already match — avoids an UPDATE on every routine restart', async () => {
            vi.mocked(mockPrisma.oAuthClient.findUnique).mockResolvedValue({
                redirectUris: ['https://claude.ai/callback']
            } as never);

            await service.ensureStaticClient('claude-ai', ['https://claude.ai/callback']);

            expect(mockPrisma.oAuthClient.upsert).not.toHaveBeenCalled();
        });
    });
});
