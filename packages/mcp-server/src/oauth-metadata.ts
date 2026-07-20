import type {OAuthMetadata} from '@modelcontextprotocol/sdk/shared/auth.js';

// Mirrors backend's src/oauth/oauth-scopes.ts OAUTH_FIXED_SCOPES — every
// OAuth-issued token gets exactly this scope set. Duplicated here (not
// imported) since mcp-server and backend are separate packages with no
// shared module between them.
const OAUTH_FIXED_SCOPES = [
    'transactions:read',
    'transactions:write',
    'accounts:read',
    'categories:read',
    'dashboard:read'
];

/**
 * Mirrors what the backend's own well-known.controller.ts publishes at
 * /.well-known/oauth-authorization-server.
 *
 * SYNC OBLIGATION: this hand-duplicates packages/backend/src/oauth/
 * well-known.controller.ts's OAuthAuthorizationServerMetadata shape field-for-
 * field (no shared module between the two packages). If a field is added,
 * removed, or renamed there, mirror it here too.
 *
 * Built from issuerUrl, which the caller must pass as PUBLIC_API_BASE_URL
 * (the backend's externally-facing
 * URL) — not FINANCE_TRACKER_URL, mcp-server's internal service-to-service
 * URL for calling the backend's REST API. Those two are easy to conflate
 * since they usually point at the same host, but in a Docker deployment
 * they're genuinely different values (FINANCE_TRACKER_URL is typically
 * http://backend:3001, an internal hostname): the installed SDK's
 * mcpAuthMetadataRouter calls checkIssuerUrl() on this value and throws
 * "Issuer URL must be HTTPS" for anything that isn't https: or literally
 * localhost/127.0.0.1, so passing the internal URL here crashes mcp-server
 * at startup in exactly that deployment shape.
 */
export const buildAuthorizationServerMetadata = (issuerUrl: string): OAuthMetadata => ({
    issuer: issuerUrl,
    authorization_endpoint: `${issuerUrl}/api/oauth/authorize`,
    token_endpoint: `${issuerUrl}/api/oauth/token`,
    // RFC 7591 dynamic client registration (Phase 2) — gated behind an
    // admin-issued Initial Access Token on the backend, not open.
    registration_endpoint: `${issuerUrl}/api/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: OAUTH_FIXED_SCOPES
});
