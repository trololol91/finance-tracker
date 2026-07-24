import {
    describe, it, expect, beforeEach, vi
} from 'vitest';
import * as crypto from 'crypto';
import type {ConfigService} from '@nestjs/config';
import type {Response} from 'express';
import {OAuthController} from '#oauth/oauth.controller.js';
import {OAuthException} from '#oauth/oauth-exception.js';
import type {OAuthClientsService} from '#oauth/oauth-clients.service.js';
import type {OAuthCodesService} from '#oauth/oauth-codes.service.js';
import type {OAuthInitialAccessTokensService} from '#oauth/oauth-initial-access-tokens.service.js';
import type {ApiTokensService} from '#api-tokens/api-tokens.service.js';
import type {User} from '#generated/prisma/client.js';

const redirectedUrl = (res: Response): URL => {
    const url = vi.mocked(res.redirect).mock.calls[0][0] as unknown as string;
    return new URL(url);
};

const mockOAuthClients = {
    findByClientId: vi.fn(),
    register: vi.fn()
} as unknown as OAuthClientsService;

const mockOAuthCodes = {
    issue: vi.fn(),
    consume: vi.fn()
} as unknown as OAuthCodesService;

const mockInitialAccessTokens = {
    issue: vi.fn()
} as unknown as OAuthInitialAccessTokensService;

const mockApiTokens = {
    create: vi.fn()
} as unknown as ApiTokensService;

const registeredClient = {
    id: 'oc-1',
    clientId: 'claude-ai',
    clientName: 'Claude',
    redirectUris: ['https://claude.ai/callback'],
    tokenEndpointAuthMethod: 'none',
    grantTypes: ['authorization_code'],
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
};

const buildRes = (): Response => ({redirect: vi.fn()} as unknown as Response);

describe('OAuthController', () => {
    let controller: OAuthController;
    let config: ConfigService;

    beforeEach(() => {
        vi.clearAllMocks();
        config = {get: vi.fn().mockReturnValue('https://finance.example.com')} as unknown as ConfigService;
        controller = new OAuthController(
            mockOAuthClients, mockOAuthCodes, mockInitialAccessTokens, mockApiTokens, config
        );
    });

    describe('authorize', () => {
        const baseQuery = {
            response_type: 'code',
            client_id: 'claude-ai',
            redirect_uri: 'https://claude.ai/callback',
            code_challenge: 'challenge-value',
            code_challenge_method: 'S256'
        };

        it('throws invalid_client for an unregistered client_id, without redirecting', async () => {
            vi.mocked(mockOAuthClients.findByClientId).mockResolvedValue(null);
            const res = buildRes();

            await expect(controller.authorize(baseQuery, res)).rejects.toMatchObject({
                response: {error: 'invalid_client'}
            });
            expect(res.redirect).not.toHaveBeenCalled();
        });

        it('throws invalid_request for a redirect_uri not registered to the client, without redirecting', async () => {
            vi.mocked(mockOAuthClients.findByClientId).mockResolvedValue(registeredClient as never);
            const res = buildRes();

            await expect(controller.authorize({
                ...baseQuery, redirect_uri: 'https://evil.example.com/callback'
            }, res)).rejects.toBeInstanceOf(OAuthException);
            expect(res.redirect).not.toHaveBeenCalled();
        });

        it('redirects to the (now-trusted) redirect_uri with an error for an unsupported response_type', async () => {
            vi.mocked(mockOAuthClients.findByClientId).mockResolvedValue(registeredClient as never);
            const res = buildRes();

            await controller.authorize({...baseQuery, response_type: 'token', state: 'xyz'}, res);

            const redirectUrl = redirectedUrl(res);
            expect(redirectUrl.origin + redirectUrl.pathname).toBe('https://claude.ai/callback');
            expect(redirectUrl.searchParams.get('error')).toBe('unsupported_response_type');
            expect(redirectUrl.searchParams.get('state')).toBe('xyz');
            // RFC 9207 — lets the client detect mix-up attacks.
            expect(redirectUrl.searchParams.get('iss')).toBe('https://finance.example.com');
        });

        it('redirects with an error for an unsupported code_challenge_method', async () => {
            vi.mocked(mockOAuthClients.findByClientId).mockResolvedValue(registeredClient as never);
            const res = buildRes();

            await controller.authorize({...baseQuery, code_challenge_method: 'plain'}, res);

            const redirectUrl = redirectedUrl(res);
            expect(redirectUrl.searchParams.get('error')).toBe('invalid_request');
            expect(redirectUrl.searchParams.get('iss')).toBe('https://finance.example.com');
        });

        it('redirects to the frontend consent screen with all params carried over on success, including the real client_name', async () => {
            vi.mocked(mockOAuthClients.findByClientId).mockResolvedValue(registeredClient as never);
            const res = buildRes();

            await controller.authorize({...baseQuery, state: 'xyz'}, res);

            const redirectUrl = redirectedUrl(res);
            expect(redirectUrl.origin + redirectUrl.pathname).toBe('https://finance.example.com/oauth/consent');
            expect(redirectUrl.searchParams.get('client_id')).toBe('claude-ai');
            expect(redirectUrl.searchParams.get('client_name')).toBe('Claude');
            expect(redirectUrl.searchParams.get('redirect_uri')).toBe('https://claude.ai/callback');
            expect(redirectUrl.searchParams.get('code_challenge')).toBe('challenge-value');
            expect(redirectUrl.searchParams.get('code_challenge_method')).toBe('S256');
            expect(redirectUrl.searchParams.get('state')).toBe('xyz');
            expect(redirectUrl.searchParams.get('scope')).toBe(
                'transactions:read transactions:write accounts:read categories:read dashboard:read'
            );
        });

        it('falls back to a default origin instead of throwing when CORS_ORIGIN is unset (it is optional)', async () => {
            vi.mocked(mockOAuthClients.findByClientId).mockResolvedValue(registeredClient as never);
            vi.mocked(config.get).mockReturnValue(undefined);
            const res = buildRes();

            await controller.authorize(baseQuery, res);

            const redirectUrl = redirectedUrl(res);
            expect(redirectUrl.origin + redirectUrl.pathname).toBe('http://localhost:5173/oauth/consent');
        });
    });

    describe('consent', () => {
        const baseDto = {
            client_id: 'claude-ai',
            redirect_uri: 'https://claude.ai/callback',
            code_challenge: 'challenge-value',
            code_challenge_method: 'S256' as const,
            approved: true
        };
        const user = {id: 'user-1'} as User;

        it('throws for an unknown client or unregistered redirect_uri, never trusting the SPA-echoed values alone', async () => {
            vi.mocked(mockOAuthClients.findByClientId).mockResolvedValue(null);

            await expect(controller.consent(baseDto, user)).rejects.toBeInstanceOf(OAuthException);
            expect(mockOAuthCodes.issue).not.toHaveBeenCalled();
        });

        it('returns an access_denied redirect without issuing a code when denied', async () => {
            vi.mocked(mockOAuthClients.findByClientId).mockResolvedValue(registeredClient as never);

            const result = await controller.consent({...baseDto, approved: false, state: 'xyz'}, user);

            expect(mockOAuthCodes.issue).not.toHaveBeenCalled();
            const target = new URL(result.redirectTo);
            expect(target.searchParams.get('error')).toBe('access_denied');
            expect(target.searchParams.get('state')).toBe('xyz');
            expect(target.searchParams.get('iss')).toBe('https://finance.example.com');
        });

        it('issues a code with the fixed scope set and returns the redirect with the code on approval', async () => {
            vi.mocked(mockOAuthClients.findByClientId).mockResolvedValue(registeredClient as never);
            vi.mocked(mockOAuthCodes.issue).mockResolvedValue('oac_rawcode');

            const result = await controller.consent({...baseDto, state: 'xyz'}, user);

            expect(mockOAuthCodes.issue).toHaveBeenCalledWith(expect.objectContaining({
                userId: 'user-1',
                clientId: 'claude-ai',
                redirectUri: 'https://claude.ai/callback',
                codeChallenge: 'challenge-value',
                codeChallengeMethod: 'S256'
            }));
            const target = new URL(result.redirectTo);
            expect(target.searchParams.get('code')).toBe('oac_rawcode');
            expect(target.searchParams.get('state')).toBe('xyz');
            expect(target.searchParams.get('iss')).toBe('https://finance.example.com');
        });
    });

    describe('token', () => {
        const codeVerifier = 'a'.repeat(43);
        const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
        const baseDto = {
            grant_type: 'authorization_code',
            code: 'oac_rawcode',
            redirect_uri: 'https://claude.ai/callback',
            client_id: 'claude-ai',
            code_verifier: codeVerifier
        };
        const consumedCode = {
            userId: 'user-1',
            userRole: 'USER' as const,
            clientId: 'claude-ai',
            clientName: 'Claude',
            redirectUri: 'https://claude.ai/callback',
            scopes: ['transactions:read', 'dashboard:read'],
            codeChallenge,
            codeChallengeMethod: 'S256'
        };

        it('throws unsupported_grant_type for any grant_type other than authorization_code', async () => {
            await expect(controller.token({...baseDto, grant_type: 'refresh_token'}))
                .rejects.toMatchObject({response: {error: 'unsupported_grant_type'}});
            expect(mockOAuthCodes.consume).not.toHaveBeenCalled();
        });

        it('throws invalid_grant when the code is unknown, expired, or already used', async () => {
            vi.mocked(mockOAuthCodes.consume).mockResolvedValue(null);

            await expect(controller.token(baseDto)).rejects.toMatchObject({response: {error: 'invalid_grant'}});
        });

        it('throws invalid_grant when client_id does not match the original authorization request', async () => {
            vi.mocked(mockOAuthCodes.consume).mockResolvedValue(consumedCode);

            await expect(controller.token({...baseDto, client_id: 'someone-else'}))
                .rejects.toMatchObject({response: {error: 'invalid_grant'}});
            expect(mockApiTokens.create).not.toHaveBeenCalled();
        });

        it('throws invalid_grant when the code_verifier does not match the stored code_challenge', async () => {
            vi.mocked(mockOAuthCodes.consume).mockResolvedValue(consumedCode);

            await expect(controller.token({...baseDto, code_verifier: 'b'.repeat(43)}))
                .rejects.toMatchObject({response: {error: 'invalid_grant'}});
            expect(mockApiTokens.create).not.toHaveBeenCalled();
        });

        it('throws server_error instead of minting a token when a consumed scope is not a valid ApiTokenScope', async () => {
            vi.mocked(mockOAuthCodes.consume).mockResolvedValue({...consumedCode, scopes: ['transactions:read', 'not-a-real-scope']});

            await expect(controller.token(baseDto)).rejects.toMatchObject({response: {error: 'server_error'}});
            expect(mockApiTokens.create).not.toHaveBeenCalled();
        });

        it('mints an ApiToken named after the real requesting client, not a hardcoded string', async () => {
            vi.mocked(mockOAuthCodes.consume).mockResolvedValue(consumedCode);
            vi.mocked(mockApiTokens.create).mockResolvedValue({
                id: 'tok-1',
                name: 'Claude (OAuth)',
                scopes: consumedCode.scopes,
                lastUsedAt: null,
                expiresAt: null,
                createdAt: new Date(),
                token: 'ft_rawtoken'
            });

            const result = await controller.token(baseDto);

            // clientName comes from the consumed code itself (denormalized via
            // oauth-codes.service.ts's include), not a second findByClientId
            // lookup — see oauth-codes.service.spec.ts for that coverage.
            expect(mockOAuthClients.findByClientId).not.toHaveBeenCalled();
            expect(mockApiTokens.create).toHaveBeenCalledWith('user-1', 'USER', {
                name: 'Claude (OAuth)',
                scopes: consumedCode.scopes
            });
            expect(result).toEqual({
                access_token: 'ft_rawtoken',
                token_type: 'Bearer',
                scope: 'transactions:read dashboard:read'
            });
        });
    });

    describe('issueInitialAccessToken', () => {
        it('delegates to OAuthInitialAccessTokensService with the given label and expiresInHours', async () => {
            const issued = {token: 'iat_raw', label: 'GitHub Copilot setup', expiresAt: new Date('2026-01-02T00:00:00.000Z')};
            vi.mocked(mockInitialAccessTokens.issue).mockResolvedValue(issued);

            const result = await controller.issueInitialAccessToken({label: 'GitHub Copilot setup', expiresInHours: 24});

            expect(mockInitialAccessTokens.issue).toHaveBeenCalledWith('GitHub Copilot setup', 24);
            expect(result).toBe(issued);
        });
    });

    describe('register', () => {
        it('delegates to OAuthClientsService.register and reshapes the result into RFC 7591 wire format', async () => {
            vi.mocked(mockOAuthClients.register).mockResolvedValue({
                id: 'oc-2',
                clientId: 'abcd1234',
                clientName: 'GitHub Copilot',
                redirectUris: ['https://github.com/copilot/oauth/callback'],
                tokenEndpointAuthMethod: 'none',
                grantTypes: ['authorization_code'],
                deletedAt: null,
                createdAt: new Date(),
                updatedAt: new Date()
            } as never);

            const result = await controller.register({
                client_name: 'GitHub Copilot',
                redirect_uris: ['https://github.com/copilot/oauth/callback']
            });

            expect(mockOAuthClients.register).toHaveBeenCalledWith({
                client_name: 'GitHub Copilot',
                redirect_uris: ['https://github.com/copilot/oauth/callback']
            });
            expect(result).toEqual({
                client_id: 'abcd1234',
                client_name: 'GitHub Copilot',
                redirect_uris: ['https://github.com/copilot/oauth/callback'],
                token_endpoint_auth_method: 'none',
                grant_types: ['authorization_code'],
                response_types: ['code']
            });
        });
    });
});
