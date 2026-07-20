import {describe, it, expect} from 'vitest';
import {buildAuthorizationServerMetadata} from '../oauth-metadata.js';

describe('buildAuthorizationServerMetadata', () => {
    it('builds absolute /api/oauth/* endpoint URLs under the given backend URL', () => {
        const metadata = buildAuthorizationServerMetadata('http://backend:3001');

        expect(metadata.issuer).toBe('http://backend:3001');
        expect(metadata.authorization_endpoint).toBe('http://backend:3001/api/oauth/authorize');
        expect(metadata.token_endpoint).toBe('http://backend:3001/api/oauth/token');
        expect(metadata.registration_endpoint).toBe('http://backend:3001/api/oauth/register');
    });

    it('advertises S256-only PKCE and the authorization_code grant, matching the backend', () => {
        const metadata = buildAuthorizationServerMetadata('http://backend:3001');

        expect(metadata.response_types_supported).toEqual(['code']);
        expect(metadata.grant_types_supported).toEqual(['authorization_code']);
        expect(metadata.code_challenge_methods_supported).toEqual(['S256']);
        expect(metadata.token_endpoint_auth_methods_supported).toEqual(['none']);
    });

    it('advertises the fixed scope set, matching the backend well-known document', () => {
        const metadata = buildAuthorizationServerMetadata('http://backend:3001');

        expect(metadata.scopes_supported).toEqual([
            'transactions:read', 'transactions:write', 'accounts:read', 'categories:read', 'dashboard:read'
        ]);
    });
});
