import {Injectable} from '@nestjs/common';
import * as crypto from 'crypto';
import {PrismaService} from '#database/prisma.service.js';
import type {OAuthClient} from '#generated/prisma/client.js';
import type {RegisterClientDto} from './dto/register-client.dto.js';

const arraysEqual = (a: string[], b: string[]): boolean =>
    a.length === b.length && a.every((value, i) => value === b[i]);

// Displayed verbatim on the consent screen (oauth.controller.ts's authorize())
// — must be the real user-facing name, not an internal disambiguation label
// (this used to be 'Claude (static)', which leaked to every real user; see
// oauth-clients.service.spec.ts for the regression test).
const STATIC_CLIENT_NAME = 'Claude';

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
     * churn an UPDATE against this table every single time. clientName is
     * part of that comparison (not just redirectUris) so an already-deployed
     * row stamped with a stale name self-heals on the next restart instead of
     * being frozen forever by the skip-write optimization.
     */
    public async ensureStaticClient(clientId: string, redirectUris: string[]): Promise<void> {
        const existing = await this.prisma.oAuthClient.findUnique({where: {clientId}});
        const nameMatches = existing?.clientName === STATIC_CLIENT_NAME;
        const urisMatch = existing && arraysEqual(existing.redirectUris, redirectUris);
        if (nameMatches && urisMatch) return;

        await this.prisma.oAuthClient.upsert({
            where: {clientId},
            update: {clientName: STATIC_CLIENT_NAME, redirectUris},
            create: {
                clientId,
                clientName: STATIC_CLIENT_NAME,
                redirectUris,
                tokenEndpointAuthMethod: 'none',
                grantTypes: ['authorization_code']
            }
        });
    }

    /**
     * RFC 7591 dynamic client registration — always creates a new row (no
     * upsert-on-existing-clientId like ensureStaticClient: each registration
     * is a fresh credential by design, there's no "same client re-registering"
     * concept). Gated by IatGuard at the controller level, not here.
     */
    public async register(dto: RegisterClientDto): Promise<OAuthClient> {
        const clientId = crypto.randomBytes(16).toString('hex');

        return this.prisma.oAuthClient.create({
            data: {
                clientId,
                clientName: dto.client_name,
                redirectUris: dto.redirect_uris,
                tokenEndpointAuthMethod: 'none',
                grantTypes: ['authorization_code']
            }
        });
    }
}
