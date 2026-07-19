import http from 'node:http';
import {randomUUID, createHash} from 'node:crypto';

import express from 'express';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {isInitializeRequest} from '@modelcontextprotocol/sdk/types.js';
import {
    mcpAuthMetadataRouter, getOAuthProtectedResourceMetadataUrl
} from '@modelcontextprotocol/sdk/server/auth/router.js';
import type {Server} from '@modelcontextprotocol/sdk/server/index.js';

import {tokenStorage} from './services/fetcher.js';
import {createMcpServer, validateBearerToken} from './server.js';
import {buildAuthorizationServerMetadata} from './oauth-metadata.js';

export const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes idle

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
    sessions: Map<string, SessionEntry>,
    resourceMetadataUrl: string
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
        // WWW-Authenticate points OAuth-aware clients (e.g. Claude) at the
        // protected-resource metadata document, which in turn names the
        // backend as the trusted authorization server (RFC 9728).
        res.writeHead(401, {
            'Content-Type': 'application/json',
            'WWW-Authenticate': `Bearer resource_metadata="${resourceMetadataUrl}"`
        });
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
                res.writeHead(401, {
                    'Content-Type': 'application/json',
                    'WWW-Authenticate': `Bearer resource_metadata="${resourceMetadataUrl}"`
                });
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

            await newServer.connect(newTransport);

            // Must be assigned AFTER connect(), not before: Server.connect()
            // (via the SDK's Protocol base class) unconditionally overwrites
            // transport.onclose with its own internal handler, silently
            // discarding anything assigned earlier. Chaining here (rather
            // than clobbering back) preserves the SDK's own cleanup while
            // still freeing the session on close — verified live that a
            // pre-connect() assignment here never fires on a real DELETE,
            // so a "deleted" session was still fully usable afterward.
            const sdkOnClose = newTransport.onclose;
            newTransport.onclose = (): void => {
                sdkOnClose?.call(newTransport);
                const sid = newTransport.sessionId;
                if (sid) {
                    sessions.delete(sid);
                }
            };
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

/**
 * Builds the Express app (routing, session store, TTL sweep) without binding
 * to a port. Split out from startHttpServer so tests can drive it directly
 * (e.g. via supertest) without a real network listener.
 */
export const createHttpApp = (): express.Express => {
    const sessions = new Map<string, SessionEntry>();

    // The backend's externally-reachable URL, used as the OAuth issuer
    // identifier (see oauth-metadata.ts) — deliberately NOT
    // FINANCE_TRACKER_URL (mcp-server's internal service-to-service URL for
    // calling the backend's REST API, e.g. http://backend:3001 in Docker).
    // The SDK's mcpAuthMetadataRouter rejects any issuer that isn't HTTPS or
    // literally localhost, so using the internal URL here crashes mcp-server
    // at startup under a Docker deployment.
    const backendUrl = process.env.PUBLIC_API_BASE_URL
        ?? process.env.FINANCE_TRACKER_URL
        ?? 'http://localhost:3001';
    // This server's own externally-reachable URL — distinct from backendUrl
    // above (that's mcp-server -> backend; this is client -> mcp-server).
    const mcpPublicUrl = process.env.MCP_PUBLIC_URL ?? 'http://localhost:3010';
    const resourceServerUrl = new URL('/mcp', mcpPublicUrl);
    const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(resourceServerUrl);

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

    const app = express();
    // Don't advertise the framework on every response.
    app.disable('x-powered-by');
    // Express's default path matching is case-insensitive; the previous raw
    // node:http implementation compared `url` with a case-sensitive `===`/
    // `startsWith`, so restore that here to avoid silently widening the
    // routing surface (e.g. `/MCP` or `/HEALTH` reaching a handler that used
    // to 404 them).
    app.set('case sensitive routing', true);

    // Health check — no auth required
    app.get('/health', (_req, res) => {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({status: 'ok'}));
    });

    // OAuth discovery (RFC 9728 protected-resource metadata at both the
    // path-suffixed and, on a client's 4xx fallback, bare well-known paths;
    // RFC 8414 authorization-server metadata mirrored from the backend) —
    // must be mounted before the catch-all 404 and terminal error handler
    // below, same as every other route.
    app.use(mcpAuthMetadataRouter({
        oauthMetadata: buildAuthorizationServerMetadata(backendUrl),
        resourceServerUrl
    }));

    // MCP routes — mounted (not an exact route) so every path under /mcp
    // reaches the handler. Note this is NOT identical to the previous raw
    // node:http `url.startsWith('/mcp')` check: Express's mount matching
    // requires a path-segment boundary, so `/mcpfoo` no longer matches (it
    // used to reach handleMcpRequest and get a 401; it now 404s from the
    // catch-all below instead) — a deliberately tighter, more conventional
    // routing surface, not a bug to restore.
    // No body-parsing middleware here deliberately: handleMcpRequest reads the
    // raw request stream itself, same as it did before this file used Express.
    // No explicit .catch(next) needed: Express 5 automatically forwards a
    // rejected promise from an async handler to the error-handling middleware.
    app.use('/mcp', async (req, res) => {
        await handleMcpRequest(req, res, sessions, resourceMetadataUrl);
    });

    app.use((_req, res) => {
        res.writeHead(404, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: 'Not Found'}));
    });

    // Terminal error handler (must be last, and must take 4 params for Express
    // to treat it as an error handler) — catches rejections from
    // handleMcpRequest forwarded via `.catch(next)` above, so a thrown error
    // becomes a scoped 500 instead of an unhandled promise rejection that
    // would otherwise crash the whole process and every other active session.
    // Express detects error-handling middleware by checking the function
    // declares exactly 4 parameters (fn.length === 4); dropping the unused
    // `_next` would silently stop this from being recognized as an error
    // handler and it would fall through to Express's own default handler.
    const handleUncaughtError: express.ErrorRequestHandler = (err, _req, res, _next) => {
        console.error('[mcp-server] Unhandled error handling /mcp request:', err);
        if (!res.headersSent) {
            res.writeHead(500, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({error: 'Internal Server Error'}));
        }
    };
    app.use(handleUncaughtError);

    return app;
};

export const startHttpServer = async (): Promise<http.Server> => {
    const port = parseInt(process.env.MCP_PORT ?? '3010', 10);
    const app = createHttpApp();
    // Deliberately NOT app.listen(port, cb) here: verified that Express's
    // app.listen() callback can fire *before* a bind failure is detected —
    // wrapping http.createServer(app) explicitly and listening on that server
    // directly is what actually guarantees the callback only fires on a
    // successful bind, so a rejection here reliably means the bind failed.
    const httpServer = http.createServer(app);

    return new Promise<http.Server>((resolve, reject) => {
        httpServer.on('error', reject);
        httpServer.listen(port, () => {
            // Intentional console.error: in stdio mode stdout is the MCP channel,
            // so all diagnostic output (including startup success) goes to stderr.
            console.error(`[mcp-server] HTTP transport listening on port ${port}`);
            resolve(httpServer);
        });
    });
};
