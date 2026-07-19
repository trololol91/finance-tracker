import {Injectable} from '@nestjs/common';
import {PrismaService} from '#database/prisma.service.js';
import type {OAuthClient} from '#generated/prisma/client.js';

const arraysEqual = (a: string[], b: string[]): boolean =>
    a.length === b.length && a.every((value, i) => value === b[i]);

@Injectable()
export class OAuthClientsService {
    constructor(private readonly prisma: PrismaService) {}

    public async findByClientId(clientId: string): Promise<OAuthClient | null> {
        return this.prisma.oAuthClient.findFirst({where: {clientId, deletedAt: null}});
    }

    /**
     * Idempotent upsert of the Phase 1 static client, run once at module
     * bootstrap (see OAuthModule.onModuleInit). Keeps the DB row in sync with
     * OAUTH_STATIC_CLIENT_ID/OAUTH_STATIC_REDIRECT_URIS on every restart —
     * findByClientId always reads from this table regardless of phase, so
     * Phase 2's dynamic registration endpoint needs no changes here later.
     * Reads first and skips the write when nothing changed, so a routine
     * restart (dev reload, container restart) with unchanged config doesn't
     * churn an UPDATE against this table every single time.
     */
    public async ensureStaticClient(clientId: string, redirectUris: string[]): Promise<void> {
        const existing = await this.prisma.oAuthClient.findUnique({where: {clientId}});
        if (existing && arraysEqual(existing.redirectUris, redirectUris)) return;

        await this.prisma.oAuthClient.upsert({
            where: {clientId},
            update: {redirectUris},
            create: {
                clientId,
                clientName: 'Claude (static)',
                redirectUris,
                tokenEndpointAuthMethod: 'none',
                grantTypes: ['authorization_code']
            }
        });
    }
}
