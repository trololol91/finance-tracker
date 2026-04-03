import {
    describe, it, expect, beforeEach, vi
} from 'vitest';
import {ForbiddenException} from '@nestjs/common';
import type {ExecutionContext} from '@nestjs/common';
import type {Reflector} from '@nestjs/core';
import {ScopesGuard} from '#auth/guards/scopes.guard.js';
import {SCOPES_KEY} from '#auth/decorators/require-scopes.decorator.js';

const makeContext = (_scopes: string[] | undefined, userScopes?: string[]): ExecutionContext => ({
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue({
            user: userScopes !== undefined ? {apiTokenScopes: userScopes} : undefined
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

    it('allows access when no scopes are required', () => {
        vi.mocked(reflector.getAllAndOverride).mockReturnValue([]);
        expect(guard.canActivate(makeContext([]))).toBe(true);
    });

    it('denies access when user is missing', () => {
        vi.mocked(reflector.getAllAndOverride).mockReturnValue(['transactions:read']);
        const ctx = makeContext(['transactions:read'], undefined);
        // Override to have no user
        vi.mocked(ctx.switchToHttp().getRequest).mockReturnValue({user: undefined});
        expect(guard.canActivate(ctx)).toBe(false);
    });

    it('allows access for JWT user (wildcard scopes)', () => {
        vi.mocked(reflector.getAllAndOverride).mockReturnValue(
            [SCOPES_KEY, ['transactions:read']]
        );
        const ctx = makeContext(['transactions:read'], ['*']);
        vi.mocked(reflector.getAllAndOverride).mockReturnValue(['transactions:read']);
        expect(guard.canActivate(ctx)).toBe(true);
    });

    it('allows access when API token has required scope', () => {
        vi.mocked(reflector.getAllAndOverride).mockReturnValue(['transactions:read']);
        expect(guard.canActivate(makeContext(['transactions:read'], ['transactions:read']))).toBe(true);
    });

    it('throws ForbiddenException when scope is missing', () => {
        vi.mocked(reflector.getAllAndOverride).mockReturnValue(['transactions:write']);
        expect(() =>
            guard.canActivate(makeContext(['transactions:write'], ['transactions:read']))
        ).toThrow(ForbiddenException);
    });

    it('defaults to wildcard when user has no apiTokenScopes', () => {
        vi.mocked(reflector.getAllAndOverride).mockReturnValue(['transactions:read']);
        const ctx = makeContext(['transactions:read']);
        vi.mocked(ctx.switchToHttp().getRequest).mockReturnValue({user: {}});
        expect(guard.canActivate(ctx)).toBe(true);
    });
});
