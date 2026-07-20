import {
    Injectable, HttpStatus
} from '@nestjs/common';
import type {
    CanActivate, ExecutionContext
} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {OAuthInitialAccessTokensService} from './oauth-initial-access-tokens.service.js';
import {OAuthException} from './oauth-exception.js';
import {extractBearerToken} from '#common/extract-bearer-token.js';

interface RequestWithHeaders {
    headers: {authorization?: string};
}

/**
 * Gates POST /oauth/register behind an admin-issued Initial Access Token
 * (RFC 7591 §3) — see test-plan/oauth-connector/implementation-plan.md §11.2
 * for why open self-registration isn't safe by default (it lets an attacker
 * register a client named "Claude" and phish an already-logged-in user's
 * approval).
 *
 * OAUTH_REGISTRATION_OPEN is an escape hatch, not the recommended posture:
 * as of writing, neither Claude nor GitHub Copilot's DCR implementations
 * have anywhere to supply an IAT, so this gate currently blocks 100% of
 * real DCR-capable clients while stopping 0% of an attacker willing to
 * self-register directly (the only remaining defense at that point is the
 * redirect-domain display, §11.4 — the same signal Google/GitHub rely on
 * for their own open registration ecosystems). Defaults to false (gated) —
 * set true only to temporarily test a DCR-capable client, then unset it.
 */
@Injectable()
export class IatGuard implements CanActivate {
    constructor(
        private readonly initialAccessTokens: OAuthInitialAccessTokensService,
        private readonly config: ConfigService
    ) {}

    public async canActivate(context: ExecutionContext): Promise<boolean> {
        if (this.config.get<boolean>('OAUTH_REGISTRATION_OPEN')) return true;

        const request = context.switchToHttp().getRequest<RequestWithHeaders>();
        const token = extractBearerToken(request.headers.authorization);

        if (!token || !(await this.initialAccessTokens.validate(token))) {
            throw new OAuthException(HttpStatus.UNAUTHORIZED, 'invalid_token', 'Missing or invalid initial access token');
        }

        return true;
    }
}
