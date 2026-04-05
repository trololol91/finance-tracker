import http from 'node:http';
import {randomUUID, createHash} from 'node:crypto';

import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {isInitializeRequest} from '@modelcontextprotocol/sdk/types.js';
import type {Server} from '@modelcontextprotocol/sdk/server/index.js';

import {tokenStorage} from './services/fetcher.js';
import {createMcpServer, validateBearerToken} from './server.js';

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes idle

interface SessionEntry {
    server: Server;
    transport: StreamableHTTPServerTransport;
    tokenHash: string;
    lastAccessedAt: number;
}

/**
 * Extract and syntactically validate a Bearer token from the Authorization header.
 * Does NOT call the backend — use validateBearerToken for full remote validation.
 */
const extractBearerToken = (authHeader: string | undefined): string | null => {
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice('Bearer '.length).trim();
    return token || null;
};

const handleMcpRequest = async (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    sessions: Map<string, SessionEntry>
): Promise<void> => {
    // Extract token from header — full remote validation only happens for new sessions
    // (init requests). Existing sessions are authorised by tokenHash comparison, which
    // prevents hijacking while avoiding a round-trip to /auth/me on every tool call.
    // Trade-off: a revoked token keeps working for existing sessions until they expire
    // via the 30-minute TTL sweep or an explicit DELETE. Similarly, if a token's scopes
    // were ever narrowed (no such endpoint exists today), the change would not take effect
    // mid-session — restart the server to force immediate re-validation.
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
        res.writeHead(401, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: 'Unauthorized'}));
        return;
    }

    if (req.method === 'POST') {
        // Collect body
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
            chunks.push(chunk as Buffer);
        }
        const bodyText = Buffer.concat(chunks).toString('utf-8');
        let parsedBody: unknown;
        try {
            parsedBody = bodyText ? JSON.parse(bodyText) : undefined;
        } catch {
            res.writeHead(400, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({error: 'Invalid JSON'}));
            return;
        }

        const sessionId = req.headers['mcp-session-id'] as string | undefined;

        if (sessionId && sessions.has(sessionId)) {
            // Existing session — verify token matches the one that created this session.
            // Return the same 400 as "session not found" to avoid leaking session existence
            // to a requester with a different (but valid) token.
            const entry = sessions.get(sessionId)!; // sessions.has() checked above
            const requestTokenHash = createHash('sha256').update(token).digest('hex');
            if (requestTokenHash !== entry.tokenHash) {
                res.writeHead(400, {'Content-Type': 'application/json'});
                res.end(
                    JSON.stringify({
                        jsonrpc: '2.0',
                        error: {code: -32000, message: 'Bad Request: No valid session ID provided'},
                        id: null
                    })
                );
                return;
            }
            entry.lastAccessedAt = Date.now();
            await tokenStorage.run(token, () =>
                entry.transport.handleRequest(req, res, parsedBody)
            );
            return;
        }

        if (!sessionId && isInitializeRequest(parsedBody)) {
            // New session — validate token against the backend before accepting
            const validToken = await validateBearerToken(req.headers.authorization);
            if (!validToken) {
                res.writeHead(401, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({error: 'Unauthorized'}));
                return;
            }
            const tokenHash = createHash('sha256').update(validToken).digest('hex');
            const newServer = createMcpServer(validToken);
            const newTransport = new StreamableHTTPServerTransport({
                sessionIdGenerator: (): string => randomUUID(),
                onsessioninitialized: (newSessionId: string): void => {
                    sessions.set(newSessionId, {
                        server: newServer,
                        transport: newTransport,
                        tokenHash,
                        lastAccessedAt: Date.now()
                    });
                }
            });

            newTransport.onclose = (): void => {
                const sid = newTransport.sessionId;
                if (sid) {
                    sessions.delete(sid);
                }
            };

            await newServer.connect(newTransport);
            await tokenStorage.run(validToken, () =>
                newTransport.handleRequest(req, res, parsedBody)
            );
            return;
        }

        // Invalid — no session and not an init request
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(
            JSON.stringify({
                jsonrpc: '2.0',
                error: {code: -32000, message: 'Bad Request: No valid session ID provided'},
                id: null
            })
        );
        return;
    }

    if (req.method === 'GET') {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (!sessionId || !sessions.has(sessionId)) {
            res.writeHead(400, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({error: 'Invalid or missing session ID'}));
            return;
        }
        const entry = sessions.get(sessionId)!; // sessions.has() checked above
        const requestTokenHash = createHash('sha256').update(token).digest('hex');
        if (requestTokenHash !== entry.tokenHash) {
            res.writeHead(400, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({error: 'Invalid or missing session ID'}));
            return;
        }
        entry.lastAccessedAt = Date.now();
        await tokenStorage.run(token, () => entry.transport.handleRequest(req, res));
        return;
    }

    if (req.method === 'DELETE') {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (sessionId && sessions.has(sessionId)) {
            const entry = sessions.get(sessionId)!; // sessions.has() checked above
            const requestTokenHash = createHash('sha256').update(token).digest('hex');
            if (requestTokenHash !== entry.tokenHash) {
                res.writeHead(400, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({error: 'Session not found'}));
                return;
            }
            // Session cleanup is handled by the transport's onclose callback.
            await entry.transport.handleRequest(req, res);
            return;
        }
        res.writeHead(404, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: 'Session not found'}));
        return;
    }

    res.writeHead(405, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({error: 'Method Not Allowed'}));
};

export const startHttpServer = async (): Promise<void> => {
    const port = parseInt(process.env.MCP_PORT ?? '3010', 10);
    const sessions = new Map<string, SessionEntry>();

    // Evict sessions idle for longer than SESSION_TTL_MS. Clients that disconnect
    // without sending DELETE would otherwise accumulate indefinitely.
    // unref() so the sweep timer doesn't keep the process alive after all connections close.
    setInterval((): void => {
        const cutoff = Date.now() - SESSION_TTL_MS;
        for (const [sid, entry] of sessions) {
            if (entry.lastAccessedAt < cutoff) {
                sessions.delete(sid);
                entry.transport.close().catch(() => undefined);
            }
        }
    }, SESSION_TTL_MS).unref();

    const httpServer = http.createServer((req, res) => {
        const url = req.url ?? '/';

        // Health check — no auth required
        if (req.method === 'GET' && url === '/health') {
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({status: 'ok'}));
            return;
        }

        // MCP routes
        if (url.startsWith('/mcp')) {
            void handleMcpRequest(req, res, sessions);
            return;
        }

        res.writeHead(404, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: 'Not Found'}));
    });

    await new Promise<void>((resolve, reject) => {
        httpServer.on('error', reject);
        httpServer.listen(port, () => {
            // Intentional console.error: in stdio mode stdout is the MCP channel,
            // so all diagnostic output (including startup success) goes to stderr.
            console.error(`[mcp-server] HTTP transport listening on port ${port}`);
            resolve();
        });
    });
};
