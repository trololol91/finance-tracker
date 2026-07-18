import * as crypto from 'crypto';

/**
 * Hashes an opaque bearer token (API token, refresh token) for storage/lookup.
 * Tokens are stored hashed at rest — only this hash is ever persisted, never
 * the raw token.
 */
export const hashToken = (rawToken: string): string =>
    crypto.createHash('sha256').update(rawToken).digest('hex');
