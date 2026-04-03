import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {tokenStorage, mcpFetcher} from '../services/fetcher.js';

describe('tokenStorage', () => {
    it('provides token within run callback', async () => {
        let capturedToken: string | undefined;
        await tokenStorage.run('test-token', async () => {
            capturedToken = tokenStorage.getStore();
        });
        expect(capturedToken).toBe('test-token');
    });

    it('returns undefined outside of run context', () => {
        const token = tokenStorage.getStore();
        expect(token).toBeUndefined();
    });

    it('isolates token to its own run context', async () => {
        let inner1Token: string | undefined;
        let inner2Token: string | undefined;

        await Promise.all([
            tokenStorage.run('token-one', async () => {
                await new Promise(resolve => setTimeout(resolve, 5));
                inner1Token = tokenStorage.getStore();
            }),
            tokenStorage.run('token-two', async () => {
                inner2Token = tokenStorage.getStore();
            })
        ]);

        expect(inner1Token).toBe('token-one');
        expect(inner2Token).toBe('token-two');
    });
});

describe('mcpFetcher', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('throws when no token in context', async () => {
        await expect(mcpFetcher({url: '/test', method: 'GET'}))
            .rejects.toThrow('No API token in context');
    });

    it('injects Authorization header with token', async () => {
        const mockFetch = vi.mocked(fetch);
        mockFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ok: true}), {status: 200})
        );

        await tokenStorage.run('ft_abc123', async () => {
            await mcpFetcher({url: '/test', method: 'GET'});
        });

        expect(mockFetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer ft_abc123'
                })
            })
        );
    });

    it('sets Content-Type header to application/json', async () => {
        const mockFetch = vi.mocked(fetch);
        mockFetch.mockResolvedValueOnce(new Response('{}', {status: 200}));

        await tokenStorage.run('ft_token', async () => {
            await mcpFetcher({url: '/test', method: 'GET'});
        });

        expect(mockFetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                headers: expect.objectContaining({
                    'Content-Type': 'application/json'
                })
            })
        );
    });

    it('throws on non-OK response', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            new Response('Unauthorized', {status: 401, statusText: 'Unauthorized'})
        );

        await expect(
            tokenStorage.run('ft_token', () => mcpFetcher({url: '/test', method: 'GET'}))
        ).rejects.toThrow('401');
    });

    it('throws on non-OK response and includes status text', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            new Response('', {status: 403, statusText: 'Forbidden'})
        );

        await expect(
            tokenStorage.run('ft_token', () => mcpFetcher({url: '/test', method: 'GET'}))
        ).rejects.toThrow('Forbidden');
    });

    it('handles error reading response body on non-OK response', async () => {
        const brokenResponse = new Response('body', {status: 500, statusText: 'Internal Server Error'});
        vi.spyOn(brokenResponse, 'text').mockRejectedValueOnce(new Error('stream error'));
        vi.mocked(fetch).mockResolvedValueOnce(brokenResponse);

        await expect(
            tokenStorage.run('ft_token', () => mcpFetcher({url: '/test', method: 'GET'}))
        ).rejects.toThrow('500');
    });

    it('appends query params to URL', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', {status: 200}));

        await tokenStorage.run('ft_token', async () => {
            await mcpFetcher({url: '/test', method: 'GET', params: {page: 1, limit: 10}});
        });

        const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
        expect(calledUrl).toContain('page=1');
        expect(calledUrl).toContain('limit=10');
    });

    it('omits null and undefined query params', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', {status: 200}));

        await tokenStorage.run('ft_token', async () => {
            await mcpFetcher({
                url: '/test',
                method: 'GET',
                params: {present: 'yes', absent: null, missing: undefined}
            });
        });

        const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
        expect(calledUrl).toContain('present=yes');
        expect(calledUrl).not.toContain('absent');
        expect(calledUrl).not.toContain('missing');
    });

    it('returns parsed JSON from successful response', async () => {
        const payload = {id: 1, name: 'test'};
        vi.mocked(fetch).mockResolvedValueOnce(
            new Response(JSON.stringify(payload), {status: 200})
        );

        const result = await tokenStorage.run('ft_token', () =>
            mcpFetcher<typeof payload>({url: '/test', method: 'GET'})
        );

        expect(result).toEqual(payload);
    });

    it('returns undefined for empty response body', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(new Response('', {status: 200}));

        const result = await tokenStorage.run('ft_token', () =>
            mcpFetcher({url: '/test', method: 'GET'})
        );

        expect(result).toBeUndefined();
    });

    it('sends body as JSON for POST requests', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            new Response(JSON.stringify({created: true}), {status: 201})
        );

        const body = {amount: 100, description: 'Test'};
        await tokenStorage.run('ft_token', async () => {
            await mcpFetcher({url: '/test', method: 'POST', data: body});
        });

        expect(vi.mocked(fetch)).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify(body)
            })
        );
    });

    it('sends no body when data is undefined', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', {status: 200}));

        await tokenStorage.run('ft_token', async () => {
            await mcpFetcher({url: '/test', method: 'GET'});
        });

        expect(vi.mocked(fetch)).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({body: undefined})
        );
    });

    it('merges custom headers with defaults', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', {status: 200}));

        await tokenStorage.run('ft_token', async () => {
            await mcpFetcher({
                url: '/test',
                method: 'GET',
                headers: {'X-Custom-Header': 'custom-value'}
            });
        });

        expect(vi.mocked(fetch)).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer ft_token',
                    'Content-Type': 'application/json',
                    'X-Custom-Header': 'custom-value'
                })
            })
        );
    });

    it('uses FINANCE_TRACKER_URL env var as base URL', async () => {
        const originalEnv = process.env.FINANCE_TRACKER_URL;
        process.env.FINANCE_TRACKER_URL = 'https://api.example.com';

        try {
            vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', {status: 200}));

            await tokenStorage.run('ft_token', async () => {
                await mcpFetcher({url: '/api/v1/test', method: 'GET'});
            });

            const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
            expect(calledUrl).toContain('https://api.example.com');
        } finally {
            if (originalEnv === undefined) {
                delete process.env.FINANCE_TRACKER_URL;
            } else {
                process.env.FINANCE_TRACKER_URL = originalEnv;
            }
        }
    });

    it('appends array params as repeated query string entries', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', {status: 200}));

        await tokenStorage.run('ft_token', async () => {
            await mcpFetcher({
                url: '/test',
                method: 'GET',
                params: {categoryId: ['cat-1', 'cat-2'], limit: 10}
            });
        });

        const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
        expect(calledUrl).toContain('categoryId=cat-1');
        expect(calledUrl).toContain('categoryId=cat-2');
        expect(calledUrl).toContain('limit=10');
    });

    it('passes AbortSignal to fetch', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', {status: 200}));

        const controller = new AbortController();
        await tokenStorage.run('ft_token', async () => {
            await mcpFetcher({url: '/test', method: 'GET', signal: controller.signal});
        });

        expect(vi.mocked(fetch)).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({signal: controller.signal})
        );
    });
});
