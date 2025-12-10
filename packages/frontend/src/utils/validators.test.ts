import { describe, it, expect } from 'vitest';
import { validators } from '@utils/validators';

describe('validators', () => {
    describe('email', () => {
        it('validates correct email', () => {
            expect(validators.email('test@example.com')).toBe(true);
        });

        it('rejects invalid email', () => {
            expect(validators.email('invalid')).toBe(false);
            expect(validators.email('test@')).toBe(false);
            expect(validators.email('@example.com')).toBe(false);
        });
    });

    describe('password', () => {
        it('validates strong password', () => {
            const result = validators.password('Password123');
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('rejects short password', () => {
            const result = validators.password('Pass1');
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password must be at least 8 characters');
        });

        it('rejects password without uppercase', () => {
            const result = validators.password('password123');
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password must contain at least one uppercase letter');
        });

        it('rejects password without lowercase', () => {
            const result = validators.password('PASSWORD123');
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password must contain at least one lowercase letter');
        });

        it('rejects password without number', () => {
            const result = validators.password('Password');
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password must contain at least one number');
        });
    });

    describe('required', () => {
        it('validates non-empty string', () => {
            expect(validators.required('test')).toBe(true);
        });

        it('rejects empty string', () => {
            expect(validators.required('')).toBe(false);
            expect(validators.required('   ')).toBe(false);
        });

        it('rejects null and undefined', () => {
            expect(validators.required(null)).toBe(false);
            expect(validators.required(undefined)).toBe(false);
        });

        it('validates non-null values', () => {
            expect(validators.required(0)).toBe(true);
            expect(validators.required(false)).toBe(true);
        });
    });

    describe('minLength', () => {
        it('validates string meeting minimum', () => {
            expect(validators.minLength('hello', 3)).toBe(true);
        });

        it('rejects string below minimum', () => {
            expect(validators.minLength('hi', 3)).toBe(false);
        });
    });

    describe('maxLength', () => {
        it('validates string within maximum', () => {
            expect(validators.maxLength('hello', 10)).toBe(true);
        });

        it('rejects string exceeding maximum', () => {
            expect(validators.maxLength('hello world', 5)).toBe(false);
        });
    });

    describe('isPositive', () => {
        it('validates positive number', () => {
            expect(validators.isPositive(5)).toBe(true);
        });

        it('rejects zero and negative', () => {
            expect(validators.isPositive(0)).toBe(false);
            expect(validators.isPositive(-5)).toBe(false);
        });
    });

    describe('isNumeric', () => {
        it('validates numeric string', () => {
            expect(validators.isNumeric('123')).toBe(true);
            expect(validators.isNumeric('12.34')).toBe(true);
        });

        it('rejects non-numeric string', () => {
            expect(validators.isNumeric('abc')).toBe(false);
            expect(validators.isNumeric('12abc')).toBe(false);
        });
    });
});
