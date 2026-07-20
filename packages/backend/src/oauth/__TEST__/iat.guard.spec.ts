import {
    describe, it, expect, beforeEach, vi
} from 'vitest';
import type {ExecutionContext} from '@nestjs/common';
import type {ConfigService} from '@nestjs/config';
import {IatGuard} from '#oauth/iat.guard.js';
import {OAuthException} from '#oauth/oauth-exception.js';
import type {OAuthInitialAccessTokensService} from '#oauth/oauth-initial-access-tokens.service.js';

const mockInitialAccessTokens = {
    validate: vi.fn()
} as unknown as OAuthInitialAccessTokensService;

const mockConfig = {
    get: vi.fn()
} as unknown as ConfigService;

const buildContext = (authorization?: string): ExecutionContext => ({
    switchToHttp: () => ({
        getRequest: () => ({headers: {authorization}})
    })
}) as unknown as ExecutionContext;

describe('IatGuard', () => {
    let guard: IatGuard;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(mockConfig.get).mockReturnValue(false);
        guard = new IatGuard(mockInitialAccessTokens, mockConfig);
    });

    it('bypasses the IAT check entirely when OAUTH_REGISTRATION_OPEN is true', async () => {
        vi.mocked(mockConfig.get).mockReturnValue(true);

        const result = await guard.canActivate(buildContext(undefined));

        expect(result).toBe(true);
        expect(mockInitialAccessTokens.validate).not.toHaveBeenCalled();
    });

    it('rejects with invalid_token when no Authorization header is present', async () => {
        await expect(guard.canActivate(buildContext(undefined)))
            .rejects.toMatchObject({response: {error: 'invalid_token'}});
        expect(mockInitialAccessTokens.validate).not.toHaveBeenCalled();
    });

    it('rejects with invalid_token for a non-Bearer Authorization header', async () => {
        await expect(guard.canActivate(buildContext('Token abc123')))
            .rejects.toBeInstanceOf(OAuthException);
        expect(mockInitialAccessTokens.validate).not.toHaveBeenCalled();
    });

    it('rejects with invalid_token when the token fails validation (unknown or expired)', async () => {
        vi.mocked(mockInitialAccessTokens.validate).mockResolvedValue(false);

        await expect(guard.canActivate(buildContext('Bearer iat_bad')))
            .rejects.toMatchObject({response: {error: 'invalid_token'}});
        expect(mockInitialAccessTokens.validate).toHaveBeenCalledWith('iat_bad');
    });

    it('allows the request through when the token validates', async () => {
        vi.mocked(mockInitialAccessTokens.validate).mockResolvedValue(true);

        const result = await guard.canActivate(buildContext('Bearer iat_good'));

        expect(result).toBe(true);
    });
});
