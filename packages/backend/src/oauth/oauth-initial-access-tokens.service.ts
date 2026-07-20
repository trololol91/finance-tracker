import {
    Injectable, Logger
} from '@nestjs/common';
import * as crypto from 'crypto';
import {PrismaService} from '#database/prisma.service.js';
import {hashToken} from '#common/hash-token.js';

const DEFAULT_EXPIRES_IN_HOURS = 24;

export interface IssuedInitialAccessToken {
    token: string;
    label: string;
    expiresAt: Date;
}

/**
 * Initial Access Tokens (RFC 7591 §3) gate POST /oauth/register — without
 * one, an attacker could self-register an OAuth client named "Claude" and
 * phish an already-logged-in user into approving it on the consent screen
 * (see test-plan/oauth-connector/implementation-plan.md §11.2 for the full
 * attack walkthrough this defends against). Admin-issued only.
 */
@Injectable()
export class OAuthInitialAccessTokensService {
    private readonly logger = new Logger(OAuthInitialAccessTokensService.name);

    constructor(private readonly prisma: PrismaService) {}

    public async issue(
        label: string, expiresInHours = DEFAULT_EXPIRES_IN_HOURS
    ): Promise<IssuedInitialAccessToken> {
        const rawToken = 'iat_' + crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(rawToken);
        const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

        await this.prisma.oAuthInitialAccessToken.create({
            data: {tokenHash, label, expiresAt}
        });

        return {token: rawToken, label, expiresAt};
    }

    /**
     * Not single-use — a token remains valid for repeat registrations until
     * expiresAt (see implementation plan §11.3 for why: a strictly one-shot
     * token would make a client's reinstall/re-registration fail confusingly).
     * `lastUsedAt` is bookkeeping only, not a consumption marker — fired
     * without awaiting (same pattern as ApiKeyStrategy's lastUsedAt update)
     * so a transient DB error writing this timestamp can't fail an otherwise
     * valid registration attempt.
     */
    public async validate(rawToken: string): Promise<boolean> {
        const tokenHash = hashToken(rawToken);
        const record = await this.prisma.oAuthInitialAccessToken.findUnique({where: {tokenHash}});
        if (!record || record.expiresAt < new Date()) return false;

        void this.prisma.oAuthInitialAccessToken.update({
            where: {tokenHash},
            data: {lastUsedAt: new Date()}
        }).catch((err: unknown) => {
            this.logger.warn(`Failed to update lastUsedAt for initial access token: ${String(err)}`);
        });
        return true;
    }
}
