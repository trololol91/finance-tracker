import {
    describe, it, expect
} from 'vitest';
import * as crypto from 'crypto';
import {verifyPkceChallenge} from '#oauth/pkce.js';

describe('verifyPkceChallenge', () => {
    it('accepts a verifier whose SHA-256/base64url matches the challenge', () => {
        const verifier = 'a'.repeat(43);
        const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

        expect(verifyPkceChallenge(verifier, challenge)).toBe(true);
    });

    it('rejects a verifier that does not hash to the given challenge', () => {
        const verifier = 'a'.repeat(43);
        const wrongChallenge = crypto.createHash('sha256').update('b'.repeat(43)).digest('base64url');

        expect(verifyPkceChallenge(verifier, wrongChallenge)).toBe(false);
    });

    it('rejects a plain (non-hashed) challenge match — plain method is not supported', () => {
        const verifier = 'a'.repeat(43);

        expect(verifyPkceChallenge(verifier, verifier)).toBe(false);
    });
});
