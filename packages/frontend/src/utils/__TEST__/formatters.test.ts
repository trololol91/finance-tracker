import {
    describe, it, expect
} from 'vitest';
import {formatters} from '@utils/formatters';

describe('formatters', () => {
    describe('currency', () => {
        it('formats USD currency', () => {
            expect(formatters.currency(1234.56)).toBe('$1,234.56');
        });

        it('formats negative amounts', () => {
            expect(formatters.currency(-500)).toBe('-$500.00');
        });

        it('formats zero', () => {
            expect(formatters.currency(0)).toBe('$0.00');
        });
    });

    describe('date', () => {
        it('formats date string', () => {
            const result = formatters.date('2024-12-25');
            expect(result).toBe('Dec 25, 2024');
        });

        it('formats Date object', () => {
            const date = new Date('2024-12-25T12:00:00Z');
            const result = formatters.date(date);
            expect(result).toContain('Dec');
            expect(result).toContain('2024');
        });

        it('handles invalid date', () => {
            expect(formatters.date('invalid')).toBe('Invalid date');
        });

        it('accepts a custom format string', () => {
            expect(formatters.date('2024-06-15', 'yyyy/MM/dd')).toBe('2024/06/15');
        });
    });

    describe('dateTime', () => {
        it('formats a date string with time', () => {
            const result = formatters.dateTime('2024-12-25T14:30:00Z');
            expect(result).toContain('Dec');
            expect(result).toContain('2024');
            // 12-hour time present
            expect(result).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/i);
        });

        it('formats a Date object with time', () => {
            const date = new Date('2024-06-01T09:00:00Z');
            const result = formatters.dateTime(date);
            expect(result).toContain('Jun');
            expect(result).toContain('2024');
        });

        it('returns "Invalid date" for an unparseable string', () => {
            expect(formatters.dateTime('not-a-date')).toBe('Invalid date');
        });
    });

    describe('percentage', () => {
        it('formats percentage with default decimals', () => {
            expect(formatters.percentage(12.3456)).toBe('12.35%');
        });

        it('formats percentage with custom decimals', () => {
            expect(formatters.percentage(12.3456, 0)).toBe('12%');
        });
    });

    describe('number', () => {
        it('formats number with default decimals', () => {
            expect(formatters.number(123.456)).toBe('123.46');
        });

        it('formats number with custom decimals', () => {
            expect(formatters.number(123.456, 1)).toBe('123.5');
        });
    });

    describe('compact', () => {
        it('formats large numbers', () => {
            expect(formatters.compact(1500)).toBe('1.5K');
            expect(formatters.compact(1500000)).toBe('1.5M');
        });
    });
});
