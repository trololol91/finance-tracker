import {
    describe, it, expect
} from 'vitest';
import {envValidationSchema} from '#config/env.validation.js';

const baseEnv = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    JWT_SECRET: 'a'.repeat(32),
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(64)
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
});
