import {describe, it, expect, vi, afterEach} from 'vitest';
import {categoryTools} from '../categories.js';

const listCategories = categoryTools.find(t => t.name === 'list_categories')!;

const mockFetchByPath = (responses: Record<string, unknown>) => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
        const path = new URL(url).pathname;
        const body = responses[path];
        return Promise.resolve(new Response(JSON.stringify(body ?? {}), {status: 200}));
    }));
};

describe('categoryTools', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('list_categories', () => {
        it('returns the categories array from the API', async () => {
            const categories = [
                {id: 'cat-1', name: 'Food', children: []},
                {id: 'cat-2', name: 'Transport', children: []}
            ];
            mockFetchByPath({'/categories': categories});

            const result = await listCategories.handle('test-token', {});

            expect(result).toEqual(categories);
        });

        it('calls the /categories endpoint', async () => {
            let capturedUrl = '';
            vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
                capturedUrl = url;
                return Promise.resolve(new Response(JSON.stringify([]), {status: 200}));
            }));

            await listCategories.handle('test-token', {});

            expect(new URL(capturedUrl).pathname).toBe('/categories');
        });

        it('returns empty array when no categories exist', async () => {
            mockFetchByPath({'/categories': []});

            const result = await listCategories.handle('test-token', {});

            expect(result).toEqual([]);
        });

        it('returns nested category structure as-is (raw API response)', async () => {
            const nestedCategories = [
                {
                    id: 'cat-1',
                    name: 'Food',
                    children: [
                        {id: 'cat-1a', name: 'Restaurants', children: []},
                        {id: 'cat-1b', name: 'Groceries', children: []}
                    ]
                }
            ];
            mockFetchByPath({'/categories': nestedCategories});

            const result = await listCategories.handle('test-token', {});

            expect(result).toEqual(nestedCategories);
        });

        it('passes the authorization token in the request', async () => {
            let capturedHeaders: Record<string, string> = {};
            vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
                capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
                return Promise.resolve(new Response(JSON.stringify([]), {status: 200}));
            }));

            await listCategories.handle('my-api-token', {});

            expect(capturedHeaders.Authorization).toBe('Bearer my-api-token');
        });

        it('throws when the API returns a non-OK status', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
                new Response('Forbidden', {status: 403, statusText: 'Forbidden'})
            ));

            await expect(listCategories.handle('bad-token', {})).rejects.toThrow('403');
        });
    });
});
