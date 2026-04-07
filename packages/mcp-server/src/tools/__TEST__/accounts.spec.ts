import {describe, it, expect, vi, afterEach} from 'vitest';
import {accountTools} from '../accounts.js';

const listAccounts = accountTools.find(t => t.name === 'list_accounts')!;

const mockFetchByPath = (responses: Record<string, unknown>) => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
        const path = new URL(url).pathname;
        const body = responses[path];
        return Promise.resolve(new Response(JSON.stringify(body ?? {}), {status: 200}));
    }));
};

describe('accountTools', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('list_accounts', () => {
        it('returns the accounts array from the API', async () => {
            const accounts = [
                {id: 'acc-1', name: 'Chequing', type: 'chequing', balance: 1500, currency: 'CAD', isActive: true},
                {id: 'acc-2', name: 'Savings', type: 'savings', balance: 5000, currency: 'CAD', isActive: true}
            ];
            mockFetchByPath({'/api/accounts': accounts});

            const result = await listAccounts.handle('test-token', {});

            expect(result).toEqual(accounts);
        });

        it('calls the /accounts endpoint', async () => {
            let capturedUrl = '';
            vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
                capturedUrl = url;
                return Promise.resolve(new Response(JSON.stringify([]), {status: 200}));
            }));

            await listAccounts.handle('test-token', {});

            expect(new URL(capturedUrl).pathname).toBe('/api/accounts');
        });

        it('returns empty array when no accounts exist', async () => {
            mockFetchByPath({'/api/accounts': []});

            const result = await listAccounts.handle('test-token', {});

            expect(result).toEqual([]);
        });

        it('passes the authorization token in the request', async () => {
            let capturedHeaders: Record<string, string> = {};
            vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
                capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
                return Promise.resolve(new Response(JSON.stringify([]), {status: 200}));
            }));

            await listAccounts.handle('my-api-token', {});

            expect(capturedHeaders.Authorization).toBe('Bearer my-api-token');
        });

        it('throws when the API returns a non-OK status', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
                new Response('Unauthorized', {status: 401, statusText: 'Unauthorized'})
            ));

            await expect(listAccounts.handle('bad-token', {})).rejects.toThrow('401');
        });
    });
});
