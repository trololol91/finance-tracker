import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {PrismaService} from '#database/prisma.service.js';
import * as crypto from 'crypto';

/** How long a just-rotated token stays acceptable, to tolerate concurrent
 * requests from multiple tabs racing on the same cookie (all tabs of a
 * browser share one cookie jar). A replay outside this window is treated
 * as reuse of a revoked token and rejected. */
const ROTATION_GRACE_PERIOD_MS = 30 * 1000;

/** Safety-net lifetime for a non-persistent ("remember me" off) refresh
 * token. The cookie itself carries no Max-Age in that case (dies with the
 * browser), so this only matters if the browser process is never closed. */
const SESSION_EXPIRES_IN_MS = 24 * 60 * 60 * 1000;

/**
 * Parses the small subset of duration strings this app actually uses
 * (e.g. "30d", "15m") into milliseconds.
 */
const parseDurationMs = (value: string): number => {
    const match = /^(\d+)(s|m|h|d)$/.exec(value);
    if (!match) {
        throw new Error(`Invalid duration string: "${value}"`);
    }
    const unitMs: Record<string, number> = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000
    };
    return Number(match[1]) * unitMs[match[2]];
};

export interface IssuedRefreshToken {
    rawToken: string;
    expiresAt: Date;
    rememberMe: boolean;
}

export interface RotatedRefreshToken extends IssuedRefreshToken {
    userId: string;
}

/**
 * Manages opaque, hashed, revocable refresh tokens — mirrors ApiTokensService's
 * hash-at-rest pattern (see #api-tokens/api-tokens.service.js), but with
 * single-use rotation on every refresh instead of long-lived reuse.
 */
@Injectable()
export class RefreshTokensService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService
    ) {}

    public async issue(userId: string, rememberMe: boolean): Promise<IssuedRefreshToken> {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const lifetimeMs = rememberMe
            ? parseDurationMs(this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d')
            : SESSION_EXPIRES_IN_MS;
        const expiresAt = new Date(Date.now() + lifetimeMs);

        await this.prisma.refreshToken.create({
            data: {
                userId, tokenHash, rememberMe, expiresAt
            }
        });

        return {
            rawToken, expiresAt, rememberMe
        };
    }

    /**
     * Validates a raw refresh token and rotates it to a fresh one.
     * Returns null if the token is unknown, expired, or was revoked outside
     * the rotation grace period (i.e. genuine reuse of a stale token).
     */
    public async validateAndRotate(rawToken: string): Promise<RotatedRefreshToken | null> {
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const existing = await this.prisma.refreshToken.findUnique({where: {tokenHash}});

        if (!existing || existing.expiresAt < new Date()) {
            return null;
        }

        const isFreshUse = existing.revokedAt === null;
        const withinGracePeriod =
            existing.revokedAt !== null &&
            Date.now() - existing.revokedAt.getTime() < ROTATION_GRACE_PERIOD_MS;

        if (!isFreshUse && !withinGracePeriod) {
            return null;
        }

        if (isFreshUse) {
            await this.prisma.refreshToken.update({
                where: {tokenHash},
                data: {revokedAt: new Date()}
            });
        }

        const issued = await this.issue(existing.userId, existing.rememberMe);
        return {...issued, userId: existing.userId};
    }

    /**
     * Logout: permanently deletes the token rather than soft-revoking it.
     * A soft revoke would fall into the rotation grace period above and let
     * a just-logged-out cookie keep working for up to ROTATION_GRACE_PERIOD_MS.
     */
    public async revoke(rawToken: string): Promise<void> {
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        await this.prisma.refreshToken.deleteMany({where: {tokenHash}});
    }
}
