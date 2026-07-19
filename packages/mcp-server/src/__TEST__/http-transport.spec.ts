import http from 'node:http';
import type {IncomingMessage, ServerResponse} from 'node:http';

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import request from 'supertest';
import type {SuperTest, Test} from 'supertest';

interface FakeTransportOptions {
    sessionIdGenerator?: () => string;
    onsessioninitialized?: (sessionId: string) => void;
}

interface JsonRpcBody {
    jsonrpc: '2.0';
    id?: unknown;
    method?: string;
    params?: unknown;
}

const {mockValidateBearerToken, mockCreateMcpServer} = vi.hoisted(() => ({
    mockValidateBearerToken: vi.fn(),
    mockCreateMcpServer: vi.fn()
}));

vi.mock('../server.js', () => ({
    validateBearerToken: mockValidateBearerToken,
    createMcpServer: mockCreateMcpServer
}));

// Replaces the real SDK transport with a minimal fake so these tests exercise
// only this file's own routing/session/hijack/TTL logic, not the SDK's
// Streamable HTTP protocol handling (which is out of scope here).
vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => {
    class FakeStreamableHTTPServerTransport {
        sessionId: string | undefined;
        onclose: (() => void) | undefined;
        private readonly opts: FakeTransportOptions;

        constructor(opts: FakeTransportOptions) {
            this.opts = opts;
        }

        async handleRequest(
            req: IncomingMessage,
            res: ServerResponse,
            body?: JsonRpcBody
        ): Promise<void> {
            if (body?.method === 'initialize') {
                this.sessionId = this.opts.sessionIdGenerator?.();
                if (this.sessionId) this.opts.onsessioninitialized?.(this.sessionId);
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'mcp-session-id': this.sessionId ?? ''
                });
                res.end(JSON.stringify({jsonrpc: '2.0', id: body.id, result: {}}));
                return;
            }
            if (req.method === 'DELETE') {
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({jsonrpc: '2.0', result: {}}));
                this.onclose?.();
                return;
            }
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({jsonrpc: '2.0', id: body?.id ?? null, result: {}}));
        }

        async close(): Promise<void> {
            this.onclose?.();
        }
    }

    return {StreamableHTTPServerTransport: FakeStreamableHTTPServerTransport};
});

const {
    createHttpApp: buildRawApp,
    startHttpServer,
    SESSION_TTL_MS
} = await import('../http-transport.js');

// supertest wraps a bare Express app in a *new* http.createServer(...).listen(0)
// on every request() call, leaking a never-closed listener each time. Wrapping
// once here and reusing that single server across a test's requests avoids
// that (this doesn't affect production code — startHttpServer still uses the
// standard app.listen() form directly). Every server created this way is
// tracked and closed in afterEach so the suite doesn't accumulate open
// listening sockets as more tests are added.
const createdServers: http.Server[] = [];
const buildTestServer = (): http.Server => {
    const server = http.createServer(buildRawApp());
    createdServers.push(server);
    return server;
};

const initializeBody = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {name: 'test-client', version: '1.0.0'}
    }
};

/** Initializes a session on the given server and returns its session id. */
const initSession = async (
    server: SuperTest<Test>,
    token = 'valid-token'
): Promise<string> => {
    mockValidateBearerToken.mockResolvedValue(token);
    const res = await server
        .post('/mcp')
        .set('Authorization', `Bearer ${token}`)
        .send(initializeBody);
    return res.headers['mcp-session-id'];
};

describe('createHttpApp', () => {
    beforeEach(() => {
        mockValidateBearerToken.mockReset();
        mockCreateMcpServer.mockReset().mockReturnValue({
            // Mirrors the real SDK's Protocol.connect(), which unconditionally
            // overwrites transport.onclose with its own handler — this is what
            // makes these tests actually exercise the production code's
            // chain-not-clobber fix, rather than trivially passing regardless
            // of whether onclose is assigned before or after connect().
            connect: vi.fn((transport: {onclose?: () => void}) => {
                transport.onclose = () => undefined;
                return Promise.resolve();
            })
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        for (const server of createdServers.splice(0)) {
            server.close();
        }
    });

    describe('GET /health', () => {
        it('returns 200 with no auth header required', async () => {
            const res = await request(buildTestServer()).get('/health');
            expect(res.status).toBe(200);
            expect(res.body).toEqual({status: 'ok'});
        });

        it('does not advertise the framework via X-Powered-By', async () => {
            const res = await request(buildTestServer()).get('/health');
            expect(res.headers['x-powered-by']).toBeUndefined();
        });
    });

    describe('unknown routes', () => {
        it('returns 404 outside /health and /mcp', async () => {
            const res = await request(buildTestServer()).get('/unknown');
            expect(res.status).toBe(404);
        });

        it('returns 404 for a different-case path (routing is case-sensitive)', async () => {
            const res = await request(buildTestServer()).get('/HEALTH');
            expect(res.status).toBe(404);
        });
    });

    describe('auth requirement', () => {
        it('returns 401 with no Authorization header', async () => {
            const res = await request(buildTestServer()).post('/mcp').send(initializeBody);
            expect(res.status).toBe(401);
            expect(res.body).toEqual({error: 'Unauthorized'});
        });

        it('returns 401 for a non-Bearer Authorization header', async () => {
            const res = await request(buildTestServer())
                .post('/mcp')
                .set('Authorization', 'Token abc123')
                .send(initializeBody);
            expect(res.status).toBe(401);
        });

        it('returns 401 when validateBearerToken rejects the token on session init', async () => {
            mockValidateBearerToken.mockResolvedValue(null);
            const res = await request(buildTestServer())
                .post('/mcp')
                .set('Authorization', 'Bearer bad-token')
                .send(initializeBody);
            expect(res.status).toBe(401);
            expect(res.body).toEqual({error: 'Unauthorized'});
        });

        it('returns 405 for an unsupported method with a syntactically valid token', async () => {
            const res = await request(buildTestServer())
                .put('/mcp')
                .set('Authorization', 'Bearer some-token');
            expect(res.status).toBe(405);
        });
    });

    describe('error handling', () => {
        it('returns a 500 instead of an unhandled rejection when handleMcpRequest throws', async () => {
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
            mockValidateBearerToken.mockResolvedValue('valid-token');
            mockCreateMcpServer.mockReturnValue({
                connect: vi.fn().mockRejectedValue(new Error('boom'))
            });

            const res = await request(buildTestServer())
                .post('/mcp')
                .set('Authorization', 'Bearer valid-token')
                .send(initializeBody);

            expect(res.status).toBe(500);
            expect(res.body).toEqual({error: 'Internal Server Error'});
            expect(errorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Unhandled error handling /mcp request'),
                expect.any(Error)
            );
            errorSpy.mockRestore();
        });
    });

    describe('session lifecycle', () => {
        it('creates a session on initialize and returns the session id header', async () => {
            const sessionId = await initSession(request(buildTestServer()));
            expect(sessionId).toBeTruthy();
        });

        it('reuses an existing session for a follow-up request with the same token', async () => {
            const app = request(buildTestServer());
            const sessionId = await initSession(app);

            const res = await app
                .post('/mcp')
                .set('Authorization', 'Bearer valid-token')
                .set('mcp-session-id', sessionId)
                .send({jsonrpc: '2.0', id: 2, method: 'tools/list', params: {}});

            expect(res.status).toBe(200);
        });

        it('rejects a follow-up request on an existing session with a different token (hijack protection)', async () => {
            const app = request(buildTestServer());
            const sessionId = await initSession(app);

            const res = await app
                .post('/mcp')
                .set('Authorization', 'Bearer someone-elses-token')
                .set('mcp-session-id', sessionId)
                .send({jsonrpc: '2.0', id: 2, method: 'tools/list', params: {}});

            const body = res.body as {error: {message: string}};
            expect(res.status).toBe(400);
            expect(body.error.message).toContain('No valid session ID provided');
        });

        it('returns 400 for a POST with neither a known session id nor an initialize request', async () => {
            const res = await request(buildTestServer())
                .post('/mcp')
                .set('Authorization', 'Bearer valid-token')
                .send({jsonrpc: '2.0', id: 1, method: 'tools/list', params: {}});

            expect(res.status).toBe(400);
        });

        it('returns 400 for a malformed JSON body', async () => {
            const res = await request(buildTestServer())
                .post('/mcp')
                .set('Authorization', 'Bearer valid-token')
                .set('Content-Type', 'application/json')
                .send('not-json{');

            expect(res.status).toBe(400);
            expect(res.body).toEqual({error: 'Invalid JSON'});
        });
    });

    describe('GET /mcp', () => {
        it('returns 400 for a missing session id', async () => {
            const res = await request(buildTestServer())
                .get('/mcp')
                .set('Authorization', 'Bearer valid-token');
            expect(res.status).toBe(400);
        });

        it('returns 400 for an unrecognized session id', async () => {
            const res = await request(buildTestServer())
                .get('/mcp')
                .set('Authorization', 'Bearer valid-token')
                .set('mcp-session-id', 'nonexistent');
            expect(res.status).toBe(400);
        });

        it('succeeds for a known session id with the matching token', async () => {
            const app = request(buildTestServer());
            const sessionId = await initSession(app);

            const res = await app
                .get('/mcp')
                .set('Authorization', 'Bearer valid-token')
                .set('mcp-session-id', sessionId);

            expect(res.status).toBe(200);
        });

        it('returns 400 for a known session id with a mismatched token', async () => {
            const app = request(buildTestServer());
            const sessionId = await initSession(app);

            const res = await app
                .get('/mcp')
                .set('Authorization', 'Bearer wrong-token')
                .set('mcp-session-id', sessionId);

            expect(res.status).toBe(400);
        });
    });

    describe('DELETE /mcp', () => {
        it('returns 404 for an unrecognized session id', async () => {
            const res = await request(buildTestServer())
                .delete('/mcp')
                .set('Authorization', 'Bearer valid-token')
                .set('mcp-session-id', 'nonexistent');
            expect(res.status).toBe(404);
        });

        it('returns 400 for a known session id with a mismatched token', async () => {
            const app = request(buildTestServer());
            const sessionId = await initSession(app);

            const res = await app
                .delete('/mcp')
                .set('Authorization', 'Bearer wrong-token')
                .set('mcp-session-id', sessionId);

            expect(res.status).toBe(400);
        });

        it('removes the session so a later request with the same session id is rejected', async () => {
            const app = request(buildTestServer());
            const sessionId = await initSession(app);

            const delRes = await app
                .delete('/mcp')
                .set('Authorization', 'Bearer valid-token')
                .set('mcp-session-id', sessionId);
            expect(delRes.status).toBe(200);

            const res = await app
                .get('/mcp')
                .set('Authorization', 'Bearer valid-token')
                .set('mcp-session-id', sessionId);
            expect(res.status).toBe(400);
        });
    });

    describe('TTL eviction', () => {
        it('evicts an idle session after SESSION_TTL_MS', async () => {
            vi.useFakeTimers({toFake: ['setInterval', 'clearInterval', 'Date']});
            const app = request(buildTestServer());
            const sessionId = await initSession(app);

            // The sweep runs every SESSION_TTL_MS and evicts entries idle for
            // longer than that cutoff; the first tick lands exactly at the
            // boundary (not evicted), so advance past a second tick to
            // guarantee eviction has actually run.
            await vi.advanceTimersByTimeAsync(SESSION_TTL_MS * 2 + 1);

            const res = await app
                .get('/mcp')
                .set('Authorization', 'Bearer valid-token')
                .set('mcp-session-id', sessionId);

            expect(res.status).toBe(400);
        });
    });
});

describe('startHttpServer', () => {
    const originalPort = process.env.MCP_PORT;

    afterEach(() => {
        if (originalPort === undefined) {
            delete process.env.MCP_PORT;
        } else {
            process.env.MCP_PORT = originalPort;
        }
    });

    it('resolves with a listening server on the configured port', async () => {
        process.env.MCP_PORT = '0';
        const server = await startHttpServer();
        try {
            expect(server.listening).toBe(true);
        } finally {
            server.close();
        }
    });

    it('rejects when the configured port is already in use', async () => {
        process.env.MCP_PORT = '0';
        const firstServer = await startHttpServer();
        const address = firstServer.address();
        if (address === null || typeof address === 'string') {
            firstServer.close();
            throw new Error('expected an AddressInfo from the listening server');
        }

        try {
            process.env.MCP_PORT = String(address.port);
            await expect(startHttpServer()).rejects.toThrow();
        } finally {
            firstServer.close();
        }
    });
});
