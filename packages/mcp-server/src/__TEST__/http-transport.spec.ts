import http from 'node:http';

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import request from 'supertest';
import {Client, StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
import type * as ServerModule from '../server.js';

const {mockCheckTokenWithBackend, mockCreateMcpServer} = vi.hoisted(() => ({
    mockCheckTokenWithBackend: vi.fn(),
    mockCreateMcpServer: vi.fn()
}));

// checkTokenWithBackend is mocked (it's our own boundary to the backend, and
// controlling its resolution is how these tests drive auth pass/fail).
// createMcpServer defaults to the REAL implementation — these tests exercise
// the actual createMcpHandler + NodeStreamableHTTPServerTransport stack
// (unmocked), not a fake standing in for it, since the whole point of the
// stateless rewrite is that there's no session/hijack/TTL state left to
// isolate against. Individual tests can still override createMcpServer's
// mock implementation (e.g. to force a synchronous throw) via mockCreateMcpServer.
let realCreateMcpServer: typeof ServerModule['createMcpServer'];

vi.mock('../server.js', async (importOriginal) => {
    const actual = await importOriginal<typeof ServerModule>();
    realCreateMcpServer = actual.createMcpServer;
    return {
        ...actual,
        checkTokenWithBackend: mockCheckTokenWithBackend,
        createMcpServer: mockCreateMcpServer
    };
});

const {
    createHttpApp: buildRawApp,
    startHttpServer
} = await import('../http-transport.js');
const {ALL_TOOLS} = await import('../server.js');

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

// A claim-less (no `_meta`) JSON-RPC body classifies as legacy (pre-2026-07-28)
// traffic under createMcpHandler's default `legacy: 'stateless'` posture —
// each such POST is served standalone by a fresh instance, with no session
// continuity required or expected, matching what a current real client
// (Claude, VS Code) actually sends today.
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

const listToolsBody = {jsonrpc: '2.0', id: 2, method: 'tools/list', params: {}};

const acceptHeader = 'application/json, text/event-stream';

describe('createHttpApp', () => {
    beforeEach(() => {
        mockCheckTokenWithBackend.mockReset();
        mockCreateMcpServer.mockReset().mockImplementation(realCreateMcpServer);
    });

    afterEach(async () => {
        vi.useRealTimers();
        for (const server of createdServers.splice(0)) {
            await new Promise<void>((resolve) => server.close(() => resolve()));
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

    describe('OAuth discovery (RFC 9728 / RFC 8414)', () => {
        it('serves protected-resource metadata at the path-suffixed well-known URL', async () => {
            const res = await request(buildTestServer()).get('/.well-known/oauth-protected-resource/mcp');

            expect(res.status).toBe(200);
            expect(res.body).toEqual(expect.objectContaining({
                resource: 'http://localhost:3010/mcp',
                authorization_servers: ['http://localhost:3001']
            }));
        });

        it('mirrors the backend\'s authorization-server metadata at its own well-known path', async () => {
            const res = await request(buildTestServer()).get('/.well-known/oauth-authorization-server');

            expect(res.status).toBe(200);
            expect(res.body).toEqual(expect.objectContaining({
                issuer: 'http://localhost:3001',
                authorization_endpoint: 'http://localhost:3001/api/oauth/authorize',
                token_endpoint: 'http://localhost:3001/api/oauth/token'
            }));
        });
    });

    describe('auth requirement', () => {
        it('returns 401 with no Authorization header', async () => {
            const res = await request(buildTestServer())
                .post('/mcp')
                .set('Accept', acceptHeader)
                .send(initializeBody);
            expect(res.status).toBe(401);
        });

        it('points WWW-Authenticate at the protected-resource metadata URL when no token is given', async () => {
            const res = await request(buildTestServer())
                .post('/mcp')
                .set('Accept', acceptHeader)
                .send(initializeBody);
            expect(res.headers['www-authenticate']).toContain(
                'resource_metadata="http://localhost:3010/.well-known/oauth-protected-resource/mcp"'
            );
        });

        it('returns 401 for a non-Bearer Authorization header', async () => {
            const res = await request(buildTestServer())
                .post('/mcp')
                .set('Accept', acceptHeader)
                .set('Authorization', 'Token abc123')
                .send(initializeBody);
            expect(res.status).toBe(401);
        });

        it('returns 401 when checkTokenWithBackend rejects the token', async () => {
            mockCheckTokenWithBackend.mockResolvedValue(false);
            const res = await request(buildTestServer())
                .post('/mcp')
                .set('Accept', acceptHeader)
                .set('Authorization', 'Bearer bad-token')
                .send(initializeBody);
            expect(res.status).toBe(401);
            expect(res.headers['www-authenticate']).toContain('resource_metadata=');
        });

        it('re-verifies the token on every request — a token valid on one call and revoked on the next is rejected immediately', async () => {
            const app = request(buildTestServer());
            mockCheckTokenWithBackend.mockResolvedValueOnce(true);

            const first = await app
                .post('/mcp')
                .set('Accept', acceptHeader)
                .set('Authorization', 'Bearer valid-token')
                .send(listToolsBody);
            expect(first.status).toBe(200);

            // Simulates the token being revoked between requests (e.g. deleted
            // from Settings -> API Tokens) — the old session-based design would
            // keep honouring it until the session's TTL expired; per-request
            // verification rejects it on the very next call instead.
            mockCheckTokenWithBackend.mockResolvedValueOnce(false);
            const second = await app
                .post('/mcp')
                .set('Accept', acceptHeader)
                .set('Authorization', 'Bearer valid-token')
                .send(listToolsBody);
            expect(second.status).toBe(401);
        });
    });

    describe('MCP requests', () => {
        beforeEach(() => {
            mockCheckTokenWithBackend.mockResolvedValue(true);
        });

        it('serves a claim-less initialize request', async () => {
            const res = await request(buildTestServer())
                .post('/mcp')
                .set('Accept', acceptHeader)
                .set('Authorization', 'Bearer valid-token')
                .send(initializeBody);

            expect(res.status).toBe(200);
        });

        it('serves a claim-less tools/list request standalone, with no prior initialize required', async () => {
            const res = await request(buildTestServer())
                .post('/mcp')
                .set('Accept', acceptHeader)
                .set('Authorization', 'Bearer valid-token')
                .send(listToolsBody);

            expect(res.status).toBe(200);
        });

        // Real SDK client over a real HTTP listener, one test per protocol era
        // — the hand-rolled supertest bodies above only cover the legacy
        // stateless leg, so these guard the modern (2026-07-28) leg too,
        // including the standard headers (MCP-Protocol-Version, Mcp-Method,
        // Content-Type) that SDK 2.1+ enforces on modern POSTs.
        it.each([
            ['legacy (initialize handshake)', {mode: 'legacy'}, (v: string | undefined) => expect(v).not.toBe('2026-07-28')],
            ['modern (2026-07-28)', {mode: {pin: '2026-07-28'}}, (v: string | undefined) => expect(v).toBe('2026-07-28')]
        ] as const)('lists every tool to a real SDK client negotiating the %s era', async (_era, versionNegotiation, expectVersion) => {
            const server = buildTestServer();
            await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
            const address = server.address();
            if (address === null || typeof address === 'string') {
                throw new Error('expected an AddressInfo from the listening server');
            }

            const client = new Client({name: 'test-client', version: '0.0.0'}, {versionNegotiation});
            const transport = new StreamableHTTPClientTransport(
                new URL(`http://127.0.0.1:${address.port}/mcp`),
                {requestInit: {headers: {Authorization: 'Bearer valid-token'}}}
            );
            try {
                await client.connect(transport);
                expectVersion(client.getNegotiatedProtocolVersion());
                const {tools} = await client.listTools();
                expect(tools.map(t => t.name).sort()).toEqual(ALL_TOOLS.map(t => t.name).sort());
                expect(mockCheckTokenWithBackend).toHaveBeenCalledWith('valid-token');
            } finally {
                await client.close();
            }
        });

        it('GET /mcp is not a supported legacy session operation under the stateless fallback', async () => {
            const res = await request(buildTestServer())
                .get('/mcp')
                .set('Accept', acceptHeader)
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(405);
        });
    });

    describe('error handling', () => {
        it('returns a JSON-RPC 500 instead of an unhandled rejection when the server factory throws', async () => {
            // createMcpHandler's own onerror option (wired to console.error
            // in createHttpApp) fires for this — suppressed here as expected
            // noise, not asserted on, since the response body below is what
            // actually matters to a real client.
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
            mockCheckTokenWithBackend.mockResolvedValue(true);
            mockCreateMcpServer.mockImplementation(() => {
                throw new Error('boom');
            });

            const res = await request(buildTestServer())
                .post('/mcp')
                .set('Accept', acceptHeader)
                .set('Authorization', 'Bearer valid-token')
                .send(initializeBody);

            // This is answered by createMcpHandler/toNodeHandler's own
            // catch-and-respond behavior, not this file's terminal
            // handleUncaughtError middleware — toNodeHandler wraps the
            // factory call in its own try/catch and writes a response
            // before Express's error-forwarding path is ever reached. The
            // exact JSON-RPC shape (echoing the request's id) is asserted
            // here specifically because that's what a real client receives.
            expect(res.status).toBe(500);
            expect(res.body).toEqual({
                jsonrpc: '2.0',
                error: {code: -32603, message: 'Internal server error'},
                id: 1
            });
            errorSpy.mockRestore();
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
