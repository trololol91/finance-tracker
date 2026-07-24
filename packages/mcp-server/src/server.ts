import {McpServer, fromJsonSchema} from '@modelcontextprotocol/server';
import {transactionTools} from './tools/transactions.js';
import {accountTools} from './tools/accounts.js';
import {categoryTools} from './tools/categories.js';
import {dashboardTools} from './tools/dashboard.js';
import type {ToolModule} from './tools/types.js';

/** Every MCP tool this server exposes, composed from each domain's tool module. */
export const ALL_TOOLS: ToolModule[] = [
    ...transactionTools,
    ...accountTools,
    ...categoryTools,
    ...dashboardTools
];

/**
 * Builds a fresh MCP server registered with every tool in `ALL_TOOLS`,
 * scoped to a single already-validated token.
 *
 * Called once per request by the stateless HTTP transport's
 * `createMcpHandler` factory (see http-transport.ts) and once at startup
 * for the stdio transport — never reused across requests or connections.
 *
 * @param token - A backend API token; the caller is responsible for having
 *   already validated it (via `validateBearerToken`/`checkTokenWithBackend`)
 *   before calling this.
 */
export const createMcpServer = (token: string): McpServer => {
    const server = new McpServer({name: 'finance-tracker', version: '0.1.0'});

    for (const tool of ALL_TOOLS) {
        server.registerTool(
            tool.name,
            {
                description: tool.description,
                // ALL_TOOLS' hand-written inputSchema objects are typed
                // directly against the SDK's own JsonSchemaType (see
                // tools/types.ts), so no cast is needed here — fromJsonSchema
                // bridges them into the Standard Schema shape registerTool
                // expects, deriving the wire tools/list entry from the same
                // object we hand-author.
                inputSchema: fromJsonSchema<Record<string, unknown>>(tool.inputSchema)
            },
            async (args) => {
                try {
                    const result = await tool.handle(token, args);
                    return {content: [{type: 'text', text: JSON.stringify(result, null, 2)}]};
                } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : String(err);
                    return {content: [{type: 'text', text: message}], isError: true};
                }
            }
        );
    }

    return server;
};

/**
 * Checks a bare token (no `Bearer ` prefix) against the backend's
 * `/api/auth/me`. Shared by both callers below so neither has to round-trip
 * through reconstructing and re-parsing a header value it already has in
 * one form or the other.
 *
 * @param token - The bare API token, already stripped of any `Bearer ` prefix.
 * @returns `true` if the backend accepts the token, `false` on rejection or
 *   a network error.
 */
const checkTokenWithBackend = async (token: string): Promise<boolean> => {
    const baseUrl = process.env.FINANCE_TRACKER_URL ?? 'http://localhost:3001';
    try {
        const response = await fetch(`${baseUrl}/api/auth/me`, {
            headers: {Authorization: `Bearer ${token}`}
        });
        return response.ok;
    } catch {
        return false;
    }
};

/**
 * Validates a raw `Authorization` header value against the backend.
 *
 * Used by stdio-transport.ts, which only ever has a full header value
 * (`FINANCE_TRACKER_API_TOKEN` wrapped as `"Bearer <token>"`).
 * http-transport.ts's `BackendTokenVerifier` already receives a bare token
 * from `requireBearerAuth`'s own header parsing, so it calls
 * `checkTokenWithBackend` directly instead of reconstructing a header just
 * to have this function re-parse it.
 *
 * @param authHeader - The raw header value (e.g. `"Bearer abc123"`), or
 *   `undefined` if none was sent.
 * @returns The bare token on success; `null` if the header is missing,
 *   non-`Bearer`, empty, or the backend rejects the token.
 */
export const validateBearerToken = async (
    authHeader: string | undefined
): Promise<string | null> => {
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) return null;
    return (await checkTokenWithBackend(token)) ? token : null;
};

export {checkTokenWithBackend};
