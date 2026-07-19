import * as crypto from 'crypto';

/**
 * Verifies an RFC 7636 S256 PKCE code_verifier against the code_challenge
 * stored at authorization time. This backend only supports S256 (never
 * `plain`) — enforced separately at /authorize and /token.
 */
export const verifyPkceChallenge = (codeVerifier: string, codeChallenge: string): boolean =>
    crypto.createHash('sha256').update(codeVerifier).digest('base64url') === codeChallenge;
