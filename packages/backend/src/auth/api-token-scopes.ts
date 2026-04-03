export const API_TOKEN_SCOPES = [
    'transactions:read',
    'transactions:write',
    'accounts:read',
    'accounts:write',
    'categories:read',
    'categories:write',
    'dashboard:read',
    'admin'
] as const;

export type ApiTokenScope = typeof API_TOKEN_SCOPES[number];
