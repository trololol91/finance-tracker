import {
    describe, it, expect, beforeEach, vi
} from 'vitest';
import type {ConfigService} from '@nestjs/config';
import {WellKnownController} from '#oauth/well-known.controller.js';

describe('WellKnownController', () => {
    let controller: WellKnownController;
    let config: ConfigService;

    beforeEach(() => {
        config = {get: vi.fn().mockReturnValue('https://finance-api.example.com')} as unknown as ConfigService;
        controller = new WellKnownController(config);
    });

    it('builds absolute /api/oauth/* endpoint URLs from PUBLIC_API_BASE_URL', () => {
        const metadata = controller.getAuthorizationServerMetadata();

        expect(metadata.issuer).toBe('https://finance-api.example.com');
        expect(metadata.authorization_endpoint).toBe('https://finance-api.example.com/api/oauth/authorize');
        expect(metadata.token_endpoint).toBe('https://finance-api.example.com/api/oauth/token');
    });

    it('advertises S256-only PKCE and the authorization_code grant', () => {
        const metadata = controller.getAuthorizationServerMetadata();

        expect(metadata.response_types_supported).toEqual(['code']);
        expect(metadata.grant_types_supported).toEqual(['authorization_code']);
        expect(metadata.code_challenge_methods_supported).toEqual(['S256']);
    });

    it('advertises the fixed scope set granted to every OAuth-issued token', () => {
        const metadata = controller.getAuthorizationServerMetadata();

        expect(metadata.scopes_supported).toEqual(
            expect.arrayContaining(['transactions:read', 'transactions:write', 'accounts:read', 'categories:read', 'dashboard:read'])
        );
    });
});
