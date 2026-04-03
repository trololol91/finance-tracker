import {
    Injectable, CanActivate, ExecutionContext, ForbiddenException
} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {SCOPES_KEY} from '#auth/decorators/require-scopes.decorator.js';
import type {ApiTokenScope} from '#auth/api-token-scopes.js';

@Injectable()
export class ScopesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    public canActivate(context: ExecutionContext): boolean {
        const required = this.reflector.getAllAndOverride<ApiTokenScope[]>(SCOPES_KEY, [
            context.getHandler(),
            context.getClass()
        ]);
        if (required.length === 0) return true;

        const request = context.switchToHttp().getRequest<{user?: {apiTokenScopes?: string[]}}>();
        const user = request.user;
        if (user === undefined) return false;

        const userScopes: string[] = user.apiTokenScopes ?? ['*'];
        if (userScopes.includes('*')) return true;

        const hasAll = required.every(scope => userScopes.includes(scope));
        if (!hasAll) throw new ForbiddenException('Insufficient token scopes');
        return true;
    }
}
