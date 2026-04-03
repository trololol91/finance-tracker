import {
    Injectable, UnauthorizedException
} from '@nestjs/common';
import {PassportStrategy} from '@nestjs/passport';
import {PrismaService} from '#database/prisma.service.js';
import * as crypto from 'crypto';

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
    constructor(private readonly prisma: PrismaService) {
        super();
    }

    public async validate(_req: unknown, rawToken: string): Promise<unknown> {
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const apiToken = await this.prisma.apiToken.findFirst({
            where: {
                tokenHash,
                deletedAt: null,
                OR: [{expiresAt: null}, {expiresAt: {gt: new Date()}}]
            },
            include: {user: true}
        });
        if (!apiToken) throw new UnauthorizedException('Invalid or expired API token');

        // Fire-and-forget lastUsedAt update
        void this.prisma.apiToken.update({
            where: {id: apiToken.id},
            data: {lastUsedAt: new Date()}
        }).catch((_err: unknown) => undefined);

        const {user} = apiToken;
        return {...user, apiTokenScopes: apiToken.scopes, isApiKeyAuth: true as const};
    }
}
