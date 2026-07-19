import type {ApiTokenScope} from '#auth/api-token-scopes.js';

/**
 * Every OAuth-issued token gets this exact scope set — covers every existing
 * MCP tool (see packages/mcp-server/src/server.ts's ALL_TOOLS composition).
 * Fixed block grant, no per-scope consent picker (see implementation plan §1).
 */
export const OAUTH_FIXED_SCOPES: readonly ApiTokenScope[] = [
    'transactions:read',
    'transactions:write',
    'accounts:read',
    'categories:read',
    'dashboard:read'
];
