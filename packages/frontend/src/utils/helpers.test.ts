import {
    describe, it, expect, vi
} from 'vitest';
import {helpers} from '@utils/helpers';

describe('helpers', () => {
    describe('sleep', () => {
        it('delays execution', async () => {
            const start = Date.now();
            await helpers.sleep(100);
            const elapsed = Date.now() - start;
            expect(elapsed).toBeGreaterThanOrEqual(90);
        });
    });

    describe('debounce', () => {
        it('debounces function calls', async () => {
            const fn = vi.fn();
            const debounced = helpers.debounce(fn, 100);

            debounced();
            debounced();
            debounced();

            expect(fn).not.toHaveBeenCalled();

            await helpers.sleep(150);
            expect(fn).toHaveBeenCalledTimes(1);
        });
    });

    describe('throttle', () => {
        it('throttles function calls', async () => {
            const fn = vi.fn();
            const throttled = helpers.throttle(fn, 100);

            throttled();
            throttled();
            throttled();

            expect(fn).toHaveBeenCalledTimes(1);

            await helpers.sleep(150);
            throttled();
            expect(fn).toHaveBeenCalledTimes(2);
        });
    });

    describe('generateId', () => {
        it('generates unique ids', () => {
            const id1 = helpers.generateId();
            const id2 = helpers.generateId();
            expect(id1).not.toBe(id2);
            expect(id1).toHaveLength(9);
        });
    });

    describe('capitalize', () => {
        it('capitalizes first letter', () => {
            expect(helpers.capitalize('hello')).toBe('Hello');
            expect(helpers.capitalize('HELLO')).toBe('Hello');
        });
    });

    describe('truncate', () => {
        it('truncates long strings', () => {
            expect(helpers.truncate('Hello World', 5)).toBe('Hello...');
        });

        it('does not truncate short strings', () => {
            expect(helpers.truncate('Hi', 10)).toBe('Hi');
        });
    });

    describe('groupBy', () => {
        it('groups array by key', () => {
            const data = [
                {type: 'a', value: 1},
                {type: 'b', value: 2},
                {type: 'a', value: 3}
            ];
            const grouped = helpers.groupBy(data, 'type');
            expect(grouped.a).toHaveLength(2);
            expect(grouped.b).toHaveLength(1);
        });
    });

    describe('sortBy', () => {
        it('sorts array ascending', () => {
            const data = [{age: 30}, {age: 20}, {age: 25}];
            const sorted = helpers.sortBy(data, 'age', 'asc');
            expect(sorted[0].age).toBe(20);
            expect(sorted[2].age).toBe(30);
        });

        it('sorts array descending', () => {
            const data = [{age: 30}, {age: 20}, {age: 25}];
            const sorted = helpers.sortBy(data, 'age', 'desc');
            expect(sorted[0].age).toBe(30);
            expect(sorted[2].age).toBe(20);
        });
    });

    describe('uniqueBy', () => {
        it('removes duplicates by key', () => {
            const data = [
                {id: 1, name: 'A'},
                {id: 2, name: 'B'},
                {id: 1, name: 'C'}
            ];
            const unique = helpers.uniqueBy(data, 'id');
            expect(unique).toHaveLength(2);
            expect(unique[0].name).toBe('A');
        });
    });
});
