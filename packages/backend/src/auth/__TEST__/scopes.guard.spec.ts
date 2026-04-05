import {
    describe, it, expect, beforeEach, vi
} from 'vitest';
import {
    ForbiddenException, UnauthorizedException
} from '@nestjs/common';
import type {ExecutionContext} from '@nestjs/common';
import type {Reflector} from '@nestjs/core';
import {ScopesGuard} from '#auth/guards/scopes.guard.js';

const makeContext = (
    userScopes?: string[],
    isApiKeyAuth = false
): ExecutionContext => ({
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue({
            user: userScopes !== undefined
                ? {apiTokenScopes: userScopes, isApiKeyAuth}
                : undefined
        })
    })
}) as unknown as ExecutionContext;

describe('ScopesGuard', () => {
    let guard: ScopesGuard;
    let reflector: Reflector;

    beforeEach(() => {
        reflector = {
            getAllAndOverride: vi.fn()
        } as unknown as Reflector;
        guard = new ScopesGuard(reflector);
    });

    it('allows access when no scopes are required (empty array)', () => {
        vi.mocked(reflector.getAllAndOverride).mockReturnValue([]);
        expect(guard.canActivate(makeContext())).toBe(true);
    });

    it('allows access when @RequireScopes is absent (reflector returns undefined)', () => {
        vi.mocked(reflector.getAllAndOverride).mockReturnValue(undefined);
        expect(guard.canActivate(makeContext())).toBe(true);
    });

    it('throws UnauthorizedException when user is missing', () => {
        vi.mocked(reflector.getAllAndOverride).mockReturnValue(['transactions:read']);
        // no userScopes arg → user: undefined on the request
        expect(() => guard.canActivate(makeContext()))
            .toThrow(UnauthorizedException);
    });

    it('allows access for JWT user (wildcard scopes)', () => {
        vi.mocked(reflector.getAllAndOverride).mockReturnValue(['transactions:read']);
        expect(guard.canActivate(makeContext(['*']))).toBe(true);
    });

    it('allows access when API token has required scope', () => {
        vi.mocked(reflector.getAllAndOverride).mockReturnValue(['transactions:read']);
        expect(guard.canActivate(makeContext(['transactions:read'], true))).toBe(true);
    });

    it('throws ForbiddenException when scope is missing', () => {
        vi.mocked(reflector.getAllAndOverride).mockReturnValue(['transactions:write']);
        expect(() =>
            guard.canActivate(makeContext(['transactions:read'], true))
        ).toThrow(ForbiddenException);
    });

    it('defaults to wildcard when JWT user has no apiTokenScopes', () => {
        vi.mocked(reflector.getAllAndOverride).mockReturnValue(['transactions:read']);
        const ctx = makeContext();
        vi.mocked(ctx.switchToHttp().getRequest).mockReturnValue({user: {isApiKeyAuth: false}});
        expect(guard.canActivate(ctx)).toBe(true);
    });

    it('denies access when API key user has no apiTokenScopes', () => {
        vi.mocked(reflector.getAllAndOverride).mockReturnValue(['transactions:read']);
        const ctx = makeContext();
        vi.mocked(ctx.switchToHttp().getRequest).mockReturnValue({user: {isApiKeyAuth: true}});
        expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('denies access when isApiKeyAuth is undefined (unknown strategy)', () => {
        vi.mocked(reflector.getAllAndOverride).mockReturnValue(['transactions:read']);
        const ctx = makeContext();
        vi.mocked(ctx.switchToHttp().getRequest).mockReturnValue({user: {isApiKeyAuth: undefined}});
        expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });
});
