import {
    describe, it, expect
} from 'vitest';
import {envValidationSchema} from '#config/env.validation.js';

const baseEnv = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    JWT_SECRET: 'a'.repeat(32),
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(64),
    PUBLIC_API_BASE_URL: 'https://finance-api.example.com',
    OAUTH_STATIC_CLIENT_ID: 'claude-ai',
    OAUTH_STATIC_REDIRECT_URIS: 'https://claude.ai/api/mcp/auth_callback'
};

describe('envValidationSchema', () => {
    describe('JWT_EXPIRES_IN / JWT_REFRESH_EXPIRES_IN', () => {
        it('accepts the default values when unset', () => {
            const {error, value} = envValidationSchema.validate(baseEnv);

            expect(error).toBeUndefined();
            expect(value.JWT_EXPIRES_IN).toBe('15m');
            expect(value.JWT_REFRESH_EXPIRES_IN).toBe('30d');
        });

        it.each(['15m', '30d', '1h', '45s', '999d'])('accepts a valid duration string "%s"', (duration) => {
            const {error} = envValidationSchema.validate({
                ...baseEnv, JWT_EXPIRES_IN: duration, JWT_REFRESH_EXPIRES_IN: duration
            });

            expect(error).toBeUndefined();
        });

        it.each(['1w', '2y', '30 days', '15', 'm15', '15m ', ''])(
            'rejects an unsupported duration string "%s" at startup instead of surfacing as a runtime 500',
            (duration) => {
                const {error} = envValidationSchema.validate({
                    ...baseEnv, JWT_REFRESH_EXPIRES_IN: duration
                });

                expect(error).toBeDefined();
            }
        );
    });

    describe('OAuth authorization server vars', () => {
        it.each(['PUBLIC_API_BASE_URL', 'OAUTH_STATIC_CLIENT_ID', 'OAUTH_STATIC_REDIRECT_URIS'])(
            'requires %s at startup', (key) => {
                const env = {...baseEnv};
                delete (env as Record<string, unknown>)[key];

                const {error} = envValidationSchema.validate(env);

                expect(error).toBeDefined();
            }
        );

        it('requires PUBLIC_API_BASE_URL to be an absolute URL', () => {
            const {error} = envValidationSchema.validate({
                ...baseEnv, PUBLIC_API_BASE_URL: 'not-a-url'
            });

            expect(error).toBeDefined();
        });
    });

    describe('OAUTH_REGISTRATION_OPEN', () => {
        it('defaults to false when unset — dynamic client registration stays IAT-gated', () => {
            const {error, value} = envValidationSchema.validate(baseEnv);

            expect(error).toBeUndefined();
            expect(value.OAUTH_REGISTRATION_OPEN).toBe(false);
        });

        it.each(['true', 'false'])('coerces the string env value "%s" into a real boolean', (raw) => {
            const {error, value} = envValidationSchema.validate({
                ...baseEnv, OAUTH_REGISTRATION_OPEN: raw
            });

            expect(error).toBeUndefined();
            expect(value.OAUTH_REGISTRATION_OPEN).toBe(raw === 'true');
        });
    });
});
