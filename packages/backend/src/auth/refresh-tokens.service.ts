import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {PrismaService} from '#database/prisma.service.js';
import {hashToken} from '#common/hash-token.js';
import * as crypto from 'crypto';

/** How long a just-rotated token's replacement stays retrievable, to tolerate
 * concurrent requests from multiple tabs racing on the same cookie (all tabs
 * of a browser share one cookie jar). A replay outside this window is
 * treated as reuse of a revoked token and rejected. */
const ROTATION_GRACE_PERIOD_MS = 30 * 1000;

/** Safety-net lifetime for a non-persistent ("remember me" off) refresh
 * token. The cookie itself carries no Max-Age in that case (dies with the
 * browser), so this only matters if the browser process is never closed. */
const SESSION_EXPIRES_IN_MS = 24 * 60 * 60 * 1000;

/**
 * Parses the small subset of duration strings this app actually uses
 * (e.g. "30d", "15m") into milliseconds. JWT_REFRESH_EXPIRES_IN is validated
 * against this same format at startup (see env.validation.ts), so this
 * throw is unreachable in normal operation — it's defense-in-depth only.
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

interface CachedRotation extends RotatedRefreshToken {
    cachedAt: number;
}

/**
 * Manages opaque, hashed, revocable refresh tokens — mirrors ApiTokensService's
 * hash-at-rest pattern (see #api-tokens/api-tokens.service.js), but with
 * single-use rotation on every refresh instead of long-lived reuse.
 */
@Injectable()
export class RefreshTokensService {
    /**
     * Caches each rotation's result, keyed by the *old* token's hash, for
     * ROTATION_GRACE_PERIOD_MS. Concurrent tabs racing on the same
     * already-rotated cookie converge on this one cached replacement instead
     * of each minting their own new token — without this, every replay
     * within the grace window would create an independent, orphaned
     * refresh_token row that outlives the race and only expires naturally.
     * In-memory only: acceptable to lose on restart, since the grace period
     * is a UX nicety for concurrent tabs, not a correctness guarantee.
     */
    private readonly recentRotations = new Map<string, CachedRotation>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService
    ) {}

    public async issue(userId: string, rememberMe: boolean): Promise<IssuedRefreshToken> {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(rawToken);
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
        const tokenHash = hashToken(rawToken);
        this.pruneExpiredRotations();

        const cached = this.recentRotations.get(tokenHash);
        if (cached) {
            const {cachedAt: _cachedAt, ...rotated} = cached;
            return rotated;
        }

        const existing = await this.prisma.refreshToken.findUnique({where: {tokenHash}});

        if (!existing || existing.expiresAt < new Date() || existing.revokedAt !== null) {
            // Unknown, expired, or already-rotated outside (or with no) grace-period
            // cache entry — a revoked token with no cache hit is genuine reuse.
            return null;
        }

        await this.prisma.refreshToken.update({
            where: {tokenHash},
            data: {revokedAt: new Date()}
        });

        const issued = await this.issue(existing.userId, existing.rememberMe);
        const rotated: RotatedRefreshToken = {...issued, userId: existing.userId};

        this.recentRotations.set(tokenHash, {...rotated, cachedAt: Date.now()});

        return rotated;
    }

    /**
     * Logout: permanently deletes the token rather than soft-revoking it.
     * A soft revoke would fall into the rotation grace period above and let
     * a just-logged-out cookie keep working for up to ROTATION_GRACE_PERIOD_MS.
     */
    public async revoke(rawToken: string): Promise<void> {
        const tokenHash = hashToken(rawToken);
        await this.prisma.refreshToken.deleteMany({where: {tokenHash}});
    }

    private pruneExpiredRotations(): void {
        const now = Date.now();
        for (const [tokenHash, entry] of this.recentRotations) {
            if (now - entry.cachedAt >= ROTATION_GRACE_PERIOD_MS) {
                this.recentRotations.delete(tokenHash);
            }
        }
    }
}
