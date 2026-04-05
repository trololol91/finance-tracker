import {
    Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException
} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {SCOPES_KEY} from '#auth/decorators/require-scopes.decorator.js';
import type {ApiTokenScope} from '#auth/api-token-scopes.js';

@Injectable()
export class ScopesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    public canActivate(context: ExecutionContext): boolean {
        const required = this.reflector.getAllAndOverride<ApiTokenScope[] | undefined>(SCOPES_KEY, [
            context.getHandler(),
            context.getClass()
        ]);
        if (!required || required.length === 0) return true;

        const request = context.switchToHttp().getRequest<{
            user?: {apiTokenScopes?: string[], isApiKeyAuth?: boolean};
        }>();
        const user = request.user;
        if (user === undefined) throw new UnauthorizedException();

        // JWT auth explicitly sets isApiKeyAuth === false and gets wildcard scopes.
        // API key auth sets isApiKeyAuth === true and gets only its declared scopes.
        // Unknown/future strategies (isApiKeyAuth === undefined) default to deny — not wildcard.
        const userScopes: string[] =
            user.isApiKeyAuth === false
                ? (user.apiTokenScopes ?? ['*'])
                : (user.apiTokenScopes ?? []);
        if (userScopes.includes('*')) return true;

        const hasAll = required.every(scope => userScopes.includes(scope));
        if (!hasAll) throw new ForbiddenException('Insufficient token scopes');
        return true;
    }
}
