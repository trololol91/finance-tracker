import http from 'node:http';

import express from 'express';
import {toNodeHandler} from '@modelcontextprotocol/node';
import {
    createMcpHandler, OAuthError, OAuthErrorCode
} from '@modelcontextprotocol/server';
import type {
    AuthInfo, McpRequestContext, OAuthTokenVerifier
} from '@modelcontextprotocol/server';
import {
    mcpAuthMetadataRouter, getOAuthProtectedResourceMetadataUrl, requireBearerAuth
} from '@modelcontextprotocol/express';

import {tokenStorage} from './services/fetcher.js';
import {createMcpServer, checkTokenWithBackend} from './server.js';
import {buildAuthorizationServerMetadata} from './oauth-metadata.js';

// requireBearerAuth's core rejects any token whose AuthInfo.expiresAt is
// unset, regardless of whether it's actually still valid — a library
// invariant, not something we opted into. Every request re-validates live
// against the backend (checkTokenWithBackend -> /api/auth/me) below, so this
// expiry carries no security weight of its own; it exists purely to satisfy
// that check. clientId/scopes are likewise not tracked for manually-created
// API tokens (only OAuth-issued ones have a real client), so both are fixed
// placeholders rather than looked up.
const AUTH_INFO_TTL_SEC = 60 * 60;

class BackendTokenVerifier implements OAuthTokenVerifier {
    public async verifyAccessToken(token: string): Promise<AuthInfo> {
        // requireBearerAuth has already stripped the "Bearer " prefix for
        // us, so this calls the backend check directly rather than
        // reconstructing a header value just to have validateBearerToken
        // re-parse the same prefix a second time.
        if (!(await checkTokenWithBackend(token))) {
            throw new OAuthError(OAuthErrorCode.InvalidToken, 'Missing or invalid API token');
        }
        return {
            token,
            clientId: 'finance-tracker-api-token',
            scopes: [],
            expiresAt: Math.floor(Date.now() / 1000) + AUTH_INFO_TTL_SEC
        };
    }
}

/**
 * Builds the Express app (routing, OAuth discovery, MCP endpoint) without
 * binding to a port. Split out from startHttpServer so tests can drive it
 * directly (e.g. via supertest) without a real network listener.
 *
 * Stateless by design (MCP SDK v2 / 2026-07-28 protocol): createMcpHandler
 * builds a fresh McpServer per request rather than tracking sessions in a
 * process-local Map, so this works correctly behind a plain round-robin load
 * balancer with no sticky routing — the previous session Map/TTL/hijack-check
 * design only ever worked with a single mcp-server instance. Auth also moves
 * from per-session (validated once at session creation, trusted via a
 * tokenHash comparison thereafter) to per-request (requireBearerAuth calls
 * the backend on every single request) — a revoked token now stops working
 * on the very next request instead of within the old 30-minute TTL, at the
 * cost of one extra backend round-trip per MCP request.
 */
export const createHttpApp = (): express.Express => {
    // The backend's externally-reachable URL, used as the OAuth issuer
    // identifier (see oauth-metadata.ts) — deliberately NOT
    // FINANCE_TRACKER_URL (mcp-server's internal service-to-service URL for
    // calling the backend's REST API, e.g. http://backend:3001 in Docker).
    // mcpAuthMetadataRouter rejects any issuer that isn't HTTPS or literally
    // localhost, so using the internal URL here crashes mcp-server at
    // startup under a Docker deployment.
    const backendUrl = process.env.PUBLIC_API_BASE_URL
        ?? process.env.FINANCE_TRACKER_URL
        ?? 'http://localhost:3001';
    // This server's own externally-reachable URL — distinct from backendUrl
    // above (that's mcp-server -> backend; this is client -> mcp-server).
    const mcpPublicUrl = process.env.MCP_PUBLIC_URL ?? 'http://localhost:3010';
    const resourceServerUrl = new URL('/mcp', mcpPublicUrl);
    const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(resourceServerUrl);

    const app = express();
    // Don't advertise the framework on every response.
    app.disable('x-powered-by');
    // Express's default path matching is case-insensitive; compare
    // case-sensitively to avoid silently widening the routing surface (e.g.
    // `/MCP` or `/HEALTH` reaching a handler that should 404 them).
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

    // One factory backs every request; createMcpHandler serves 2026-07-28
    // (modern) traffic per request and, via its default `legacy: 'stateless'`
    // posture, also serves pre-2026-07-28 (legacy) clients per request
    // through the same stateless idiom — one endpoint, both eras, no
    // hand-rolled branching. ctx.authInfo is populated from req.auth, which
    // requireBearerAuth below sets after verifying the token against the
    // backend — the factory itself performs no verification of its own.
    const mcpHandler = createMcpHandler(
        (ctx: McpRequestContext) => createMcpServer(ctx.authInfo!.token),
        {onerror: (err) => console.error('[mcp-server] Unhandled error in MCP handler:', err)}
    );
    const nodeHandler = toNodeHandler(mcpHandler);

    // No body-parsing middleware here deliberately: nodeHandler reads the
    // raw request stream itself, same as the pre-migration handler did.
    // Mounted (not an exact route) to preserve the pre-SDK-v2-migration
    // routing surface — matches any path under /mcp/*, not just the exact
    // path, same as this router did before this file adopted createMcpHandler.
    // No explicit .catch(next) needed: Express 5 automatically forwards a
    // rejected promise from an async handler to the error-handling middleware.
    app.use(
        '/mcp',
        requireBearerAuth({verifier: new BackendTokenVerifier(), resourceMetadataUrl}),
        async (req, res) => {
            await tokenStorage.run(req.auth!.token, () => nodeHandler(req, res));
        }
    );

    app.use((_req, res) => {
        res.writeHead(404, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: 'Not Found'}));
    });

    // Terminal error handler (must be last, and must take 4 params for Express
    // to treat it as an error handler). NOT the primary path for a thrown
    // MCP-handler/factory error: toNodeHandler's own returned function wraps
    // handler.fetch(...) in its own try/catch and writes its own JSON-RPC-shaped
    // 500 on any throw (see @modelcontextprotocol/node's toNodeHandler), so it
    // never rejects back to Express for that case. This is a defensive
    // fallback for errors outside that — e.g. a failure while streaming the
    // response body — genuinely rare, but real enough that Express 5's
    // automatic async-rejection forwarding is worth keeping wired up rather
    // than letting an uncaught rejection crash the process. The body matches
    // the SDK's own JSON-RPC error shape so a client sees a consistent format
    // regardless of which layer answers. Express detects error-handling
    // middleware by checking the function declares exactly 4 parameters
    // (fn.length === 4); dropping the unused `_next` would silently stop this
    // from being recognized as an error handler and it would fall through to
    // Express's own default (non-JSON) handler instead.
    const handleUncaughtError: express.ErrorRequestHandler = (err, _req, res, _next) => {
        console.error('[mcp-server] Unhandled error handling /mcp request:', err);
        if (!res.headersSent) {
            res.writeHead(500, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({jsonrpc: '2.0', error: {code: -32603, message: 'Internal server error'}, id: null}));
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
