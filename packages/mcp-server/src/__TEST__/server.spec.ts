import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {ALL_TOOLS, createMcpServer, validateBearerToken} from '../server.js';

// Pull a registered request handler out of the server by its method name.
type AnyFn = (req: unknown) => Promise<unknown>;
const getHandler = (server: ReturnType<typeof createMcpServer>, method: string): AnyFn => {
    const handlers = (
        server as unknown as {_requestHandlers: Map<string, AnyFn>}
    )._requestHandlers;
    const handler = handlers.get(method);
    if (!handler) throw new Error(`No handler registered for ${method}`);
    return handler;
};

describe('ALL_TOOLS', () => {
    it('includes all expected tool names', () => {
        const names = ALL_TOOLS.map(t => t.name);
        expect(names).toContain('list_transactions');
        expect(names).toContain('get_transaction_totals');
        expect(names).toContain('create_transaction');
        expect(names).toContain('list_accounts');
        expect(names).toContain('list_categories');
        expect(names).toContain('get_dashboard_summary');
    });

    it('every tool has name, description, inputSchema, and handle', () => {
        for (const tool of ALL_TOOLS) {
            expect(typeof tool.name).toBe('string');
            expect(tool.name.length).toBeGreaterThan(0);
            expect(typeof tool.description).toBe('string');
            expect(tool.description.length).toBeGreaterThan(0);
            expect(typeof tool.inputSchema).toBe('object');
            expect(typeof tool.handle).toBe('function');
        }
    });
});

describe('createMcpServer', () => {
    it('returns a Server instance', () => {
        const server = createMcpServer('test-token');
        expect(server).toBeDefined();
        expect(typeof server.connect).toBe('function');
    });

    it('creates a fresh server each call', () => {
        const s1 = createMcpServer('token-1');
        const s2 = createMcpServer('token-2');
        expect(s1).not.toBe(s2);
    });

    describe('ListTools handler', () => {
        it('returns tools with name, description, inputSchema — no handle', async () => {
            const handler = getHandler(createMcpServer('test-token'), 'tools/list');
            const result = await handler({method: 'tools/list', params: {}}) as {
                tools: {name: string; description: string; inputSchema: unknown}[];
            };

            expect(result.tools).toBeInstanceOf(Array);
            expect(result.tools.length).toBeGreaterThan(0);
            for (const tool of result.tools) {
                expect(typeof tool.name).toBe('string');
                expect(typeof tool.description).toBe('string');
                expect(typeof tool.inputSchema).toBe('object');
                expect(tool).not.toHaveProperty('handle');
            }
        });

        it('includes all expected tool names', async () => {
            const handler = getHandler(createMcpServer('test-token'), 'tools/list');
            const result = await handler({method: 'tools/list', params: {}}) as {
                tools: {name: string}[];
            };

            const names = result.tools.map(t => t.name);
            expect(names).toContain('list_transactions');
            expect(names).toContain('list_accounts');
            expect(names).toContain('list_categories');
            expect(names).toContain('get_dashboard_summary');
        });
    });

    describe('CallTool handler', () => {
        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('returns error content for unknown tool name', async () => {
            const handler = getHandler(createMcpServer('test-token'), 'tools/call');
            const result = await handler({
                method: 'tools/call',
                params: {name: 'nonexistent_tool', arguments: {}}
            }) as {content: {type: string; text: string}[]; isError: boolean};

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('Unknown tool: nonexistent_tool');
        });

        it('calls the tool handle and returns JSON content on success', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
                new Response(JSON.stringify([{id: 'acc-1', name: 'Chequing'}]), {status: 200})
            ));

            const handler = getHandler(createMcpServer('test-token'), 'tools/call');
            const result = await handler({
                method: 'tools/call',
                params: {name: 'list_accounts', arguments: {}}
            }) as {content: {type: string; text: string}[]; isError?: boolean};

            expect(result.isError).toBeFalsy();
            expect(result.content[0].type).toBe('text');
            expect(Array.isArray(JSON.parse(result.content[0].text))).toBe(true);
        });

        it('returns error content when the tool handle throws', async () => {
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

            const handler = getHandler(createMcpServer('test-token'), 'tools/call');
            const result = await handler({
                method: 'tools/call',
                params: {name: 'list_accounts', arguments: {}}
            }) as {content: {type: string; text: string}[]; isError: boolean};

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('network down');
        });

        it('handles non-Error throws by converting to string', async () => {
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue('plain string error'));

            const handler = getHandler(createMcpServer('test-token'), 'tools/call');
            const result = await handler({
                method: 'tools/call',
                params: {name: 'list_accounts', arguments: {}}
            }) as {content: {type: string; text: string}[]; isError: boolean};

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toBe('plain string error');
        });
    });
});

describe('validateBearerToken', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('returns null for undefined auth header', async () => {
        expect(await validateBearerToken(undefined)).toBeNull();
    });

    it('returns null when auth header does not start with "Bearer "', async () => {
        expect(await validateBearerToken('Token abc123')).toBeNull();
    });

    it('returns null when token is empty after "Bearer "', async () => {
        expect(await validateBearerToken('Bearer ')).toBeNull();
    });

    it('returns null when the backend /auth/me returns non-OK', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            new Response('Unauthorized', {status: 401, statusText: 'Unauthorized'})
        );
        expect(await validateBearerToken('Bearer bad-token')).toBeNull();
    });

    it('returns the token when the backend /auth/me returns 200', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            new Response(JSON.stringify({id: 'user-1'}), {status: 200})
        );
        expect(await validateBearerToken('Bearer valid-token')).toBe('valid-token');
    });

    it('calls /api/auth/me with the Authorization header', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            new Response(JSON.stringify({id: 'user-1'}), {status: 200})
        );
        await validateBearerToken('Bearer my-token');
        expect(vi.mocked(fetch)).toHaveBeenCalledWith(
            expect.stringContaining('/api/auth/me'),
            expect.objectContaining({headers: {Authorization: 'Bearer my-token'}})
        );
    });

    it('returns null when fetch throws (network error)', async () => {
        vi.mocked(fetch).mockRejectedValueOnce(new Error('network failure'));
        expect(await validateBearerToken('Bearer some-token')).toBeNull();
    });

    it('strips whitespace around the token', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            new Response(JSON.stringify({id: 'user-1'}), {status: 200})
        );
        expect(await validateBearerToken('Bearer   trimmed-token   ')).toBe('trimmed-token');
    });
});
