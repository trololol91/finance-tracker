import {
    Injectable, Logger
} from '@nestjs/common';
import * as crypto from 'crypto';
import {PrismaService} from '#database/prisma.service.js';
import {hashToken} from '#common/hash-token.js';
import {PrismaClientKnownRequestError} from '#generated/prisma/internal/prismaNamespace.js';
import type {UserRole} from '#generated/prisma/enums.js';
import type {OAuthAuthorizationCode} from '#generated/prisma/client.js';

type DeletedCodeWithUser = OAuthAuthorizationCode & {
    user: {role: UserRole};
    // Nullable even though OAuthAuthorizationCode.client is a required Prisma
    // relation (so a dangling reference can't exist today — no hard-delete
    // path exists on OAuthClientsService, and Postgres FK integrity would
    // block one anyway). Typed defensively so a future hard-delete/purge
    // method can't turn this into an uncaught TypeError here.
    client: {clientName: string} | null;
};

// Authorization codes are meant to be exchanged immediately after the
// redirect — a short TTL limits the window a leaked code (e.g. via browser
// history or a referrer header) stays usable.
const CODE_TTL_MS = 60 * 1000;

export interface IssueCodeParams {
    userId: string;
    clientId: string;
    redirectUri: string;
    scopes: string[];
    codeChallenge: string;
    codeChallengeMethod: string;
}

export interface ConsumedOAuthCode {
    userId: string;
    userRole: UserRole;
    clientId: string;
    clientName: string;
    redirectUri: string;
    scopes: string[];
    codeChallenge: string;
    codeChallengeMethod: string;
}

@Injectable()
export class OAuthCodesService {
    private readonly logger = new Logger(OAuthCodesService.name);

    constructor(private readonly prisma: PrismaService) {}

    public async issue(params: IssueCodeParams): Promise<string> {
        const rawCode = 'oac_' + crypto.randomBytes(32).toString('hex');
        const codeHash = hashToken(rawCode);

        await this.prisma.oAuthAuthorizationCode.create({
            data: {
                codeHash,
                clientId: params.clientId,
                userId: params.userId,
                redirectUri: params.redirectUri,
                scopes: params.scopes,
                codeChallenge: params.codeChallenge,
                codeChallengeMethod: params.codeChallengeMethod,
                expiresAt: new Date(Date.now() + CODE_TTL_MS)
            }
        });

        return rawCode;
    }

    /**
     * Validates and hard-deletes a raw authorization code in one step — codes
     * are single-use, matching this repo's refresh-token lesson that a
     * soft-revoke creates an ambiguous replay window (see
     * RefreshTokensService.revoke()). Using delete() directly (rather than
     * findUnique then delete) means Postgres's row lock on the DELETE makes
     * two concurrent consume() calls for the same code mutually exclusive —
     * only one can ever succeed.
     * Returns null if the code is unknown, already consumed, or expired.
     */
    public async consume(rawCode: string): Promise<ConsumedOAuthCode | null> {
        const codeHash = hashToken(rawCode);
        const record = await this.deleteByCodeHash(codeHash);
        if (!record) return null;

        if (record.expiresAt < new Date()) return null;

        return {
            userId: record.userId,
            userRole: record.user.role,
            clientId: record.clientId,
            clientName: record.client?.clientName ?? 'Unknown Client',
            redirectUri: record.redirectUri,
            scopes: record.scopes,
            codeChallenge: record.codeChallenge,
            codeChallengeMethod: record.codeChallengeMethod
        };
    }

    private async deleteByCodeHash(codeHash: string): Promise<DeletedCodeWithUser | null> {
        try {
            return await this.prisma.oAuthAuthorizationCode.delete({
                where: {codeHash},
                include: {user: {select: {role: true}}, client: {select: {clientName: true}}}
            });
        } catch (err) {
            // P2025 = no row matched the delete — unknown code, or already
            // consumed by a concurrent request. Anything else (connection
            // drop, timeout) is a real infrastructure failure and must not be
            // silently reported to the OAuth client as "invalid code" —
            // rethrow so it surfaces as a 500, matching this backend's
            // established pattern (see e.g. SyncScheduleService).
            if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
                return null;
            }
            this.logger.error('Failed to consume OAuth authorization code', err instanceof Error ? err.stack : undefined);
            throw err;
        }
    }
}
