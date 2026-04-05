import {
    Injectable, UnauthorizedException, Logger
} from '@nestjs/common';
import {PassportStrategy} from '@nestjs/passport';
import {PrismaService} from '#database/prisma.service.js';
import type {
    User, UserRole
} from '#generated/prisma/client.js';
import * as crypto from 'crypto';

// Passport's built-in strategies (e.g. passport-local, passport-jwt) extend a real
// Passport `Strategy` class that exposes `this.fail()` and `this.success()` callbacks.
// There is no published npm package for a generic bearer-token Passport strategy that
// reads only the Authorization header without additional parsing. This hand-rolled base
// class mimics the minimal Passport Strategy interface so that NestJS PassportStrategy
// can extend it — the inline `this` type in `authenticate` is required because TypeScript
// cannot infer the mixin members from PassportStrategy's generics at this abstraction level.
class ApiKeyBaseStrategy {
    public name = 'api-key';

    public authenticate(this: ApiKeyBaseStrategy & {
        fail: (err: unknown, status: number) => void;
        success: (user: unknown) => void;
        validate: (req: unknown, token: string) => Promise<unknown>;
    }, req: {headers: Record<string, string | undefined>}): void {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            this.fail({message: 'Missing bearer token'}, 401);
            return;
        }
        const token = authHeader.slice(7);
        this.validate(req, token)
            .then(user => { this.success(user); })
            .catch(err => { this.fail(err, 401); });
    }
}

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(ApiKeyBaseStrategy, 'api-key') {
    private readonly logger = new Logger(ApiKeyStrategy.name);

    constructor(private readonly prisma: PrismaService) {
        super();
    }

    public async validate(
        _req: unknown,
        rawToken: string
    ): Promise<Pick<User, 'id' | 'role' | 'isActive' | 'deletedAt'> & {apiTokenScopes: string[], isApiKeyAuth: true}> {
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

        let apiToken: {
            id: string;
            scopes: string[];
            user: {id: string, role: UserRole, isActive: boolean, deletedAt: Date | null};
        } | null;

        try {
            apiToken = await this.prisma.apiToken.findFirst({
                where: {
                    tokenHash,
                    deletedAt: null,
                    OR: [{expiresAt: null}, {expiresAt: {gt: new Date()}}]
                },
                select: {
                    id: true,
                    scopes: true,
                    user: {select: {id: true, role: true, isActive: true, deletedAt: true}}
                }
            });
        } catch {
            throw new UnauthorizedException('Invalid or expired API token');
        }

        if (!apiToken) throw new UnauthorizedException('Invalid or expired API token');

        // Reject tokens belonging to deactivated or soft-deleted users.
        if (!apiToken.user.isActive || apiToken.user.deletedAt !== null) {
            throw new UnauthorizedException('Invalid or expired API token');
        }

        // Fire-and-forget lastUsedAt update — capture id before the async closure
        // so TypeScript can narrow it as non-null within the callback.
        const tokenId = apiToken.id;
        void this.prisma.apiToken.update({
            where: {id: tokenId},
            data: {lastUsedAt: new Date()}
        }).catch((err: unknown) => {
            this.logger.warn(`Failed to update lastUsedAt for token ${tokenId}: ${String(err)}`);
        });

        return {...apiToken.user, apiTokenScopes: apiToken.scopes, isApiKeyAuth: true as const};
    }
}
