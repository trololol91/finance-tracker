import http from 'node:http';
import {randomUUID, createHash} from 'node:crypto';

import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
    CallToolRequestSchema,
    isInitializeRequest,
    ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import type {CallToolResult} from '@modelcontextprotocol/sdk/types.js';

import {tokenStorage, mcpFetcher} from './services/fetcher.js';

// ---- Tool definitions ----

const TOOLS = [
    {
        name: 'list_transactions',
        description: 'List transactions for the authenticated user with optional filters. Use startDate/endDate for arbitrary ranges, categoryId/transactionType to narrow results, and search for keyword matching.',
        inputSchema: {
            type: 'object' as const,
            properties: {
                startDate: {
                    type: 'string',
                    description: 'Start of date range in ISO 8601 format (e.g. 2025-01-01).'
                },
                endDate: {
                    type: 'string',
                    description: 'End of date range in ISO 8601 format (e.g. 2025-03-31).'
                },
                categoryId: {
                    type: 'array',
                    items: {type: 'string'},
                    description: 'Filter by one or more category UUIDs.'
                },
                accountId: {
                    type: 'array',
                    items: {type: 'string'},
                    description: 'Filter by one or more account UUIDs.'
                },
                transactionType: {
                    type: 'array',
                    items: {type: 'string', enum: ['income', 'expense', 'transfer']},
                    description: 'Filter by transaction type(s).'
                },
                search: {
                    type: 'string',
                    description: 'Keyword search across transaction description/notes.'
                },
                limit: {
                    type: 'number',
                    description: 'Max results per page (default 50, max 100).'
                },
                offset: {
                    type: 'number',
                    description: 'Pagination offset.'
                }
            }
        }
    },
    {
        name: 'get_transaction_totals',
        description: 'Get income, expense and net totals for a date range.',
        inputSchema: {
            type: 'object' as const,
            properties: {
                month: {
                    type: 'string',
                    description: 'Month in YYYY-MM format. Required — used to derive startDate and endDate.'
                }
            },
            required: ['month']
        }
    },
    {
        name: 'list_accounts',
        description: 'List all accounts for the authenticated user.',
        inputSchema: {
            type: 'object' as const,
            properties: {}
        }
    },
    {
        name: 'list_categories',
        description: 'List all categories for the authenticated user.',
        inputSchema: {
            type: 'object' as const,
            properties: {}
        }
    },
    {
        name: 'get_dashboard_summary',
        description: 'Get dashboard summary including net worth, income, expenses and savings rate.',
        inputSchema: {
            type: 'object' as const,
            properties: {
                month: {
                    type: 'string',
                    description: 'Month in YYYY-MM format. Defaults to current month.'
                }
            }
        }
    },
    {
        name: 'create_transaction',
        description: 'Create a new transaction for the authenticated user. A synthetic fitid is automatically derived from the transaction fields to prevent duplicates if the same transaction is submitted more than once.',
        inputSchema: {
            type: 'object' as const,
            properties: {
                amount: {
                    type: 'number',
                    description: 'Transaction amount (positive number).'
                },
                description: {
                    type: 'string',
                    description: 'Transaction description.'
                },
                transactionType: {
                    type: 'string',
                    enum: ['income', 'expense', 'transfer'],
                    description: 'Transaction type.'
                },
                date: {
                    type: 'string',
                    description: 'Transaction date in ISO 8601 format (e.g. 2026-01-15T10:30:00.000Z).'
                },
                notes: {
                    type: 'string',
                    description: 'Optional additional notes.'
                },
                categoryId: {
                    type: 'string',
                    description: 'Optional category UUID.'
                },
                accountId: {
                    type: 'string',
                    description: 'Optional account UUID.'
                },
                transferDirection: {
                    type: 'string',
                    enum: ['in', 'out'],
                    description: 'Required when transactionType is "transfer". Whether money is arriving (in) or leaving (out) the account.'
                }
            },
            required: ['amount', 'description', 'transactionType', 'date']
        }
    }
];

// ---- Helpers ----

/**
 * Parse a YYYY-MM string into UTC start/end ISO strings for the full month.
 */
const monthToDateRange = (month: string): {startDate: string; endDate: string} => {
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const mon = parseInt(monthStr, 10) - 1; // 0-based
    const start = new Date(Date.UTC(year, mon, 1));
    const end = new Date(Date.UTC(year, mon + 1, 0, 23, 59, 59, 999));
    return {startDate: start.toISOString(), endDate: end.toISOString()};
};

// ---- Tool handler ----

const handleToolCall = async (
    token: string,
    name: string,
    args: Record<string, unknown>
): Promise<CallToolResult> => {
    try {
        let result: unknown;

        switch (name) {
            case 'list_transactions': {
                const params: Record<string, string | number | string[]> = {};
                if (args.startDate && typeof args.startDate === 'string') {
                    params.startDate = args.startDate;
                }
                if (args.endDate && typeof args.endDate === 'string') {
                    params.endDate = args.endDate;
                }
                if (Array.isArray(args.categoryId) && args.categoryId.length > 0) {
                    params.categoryId = args.categoryId as string[];
                }
                if (Array.isArray(args.accountId) && args.accountId.length > 0) {
                    params.accountId = args.accountId as string[];
                }
                if (Array.isArray(args.transactionType) && args.transactionType.length > 0) {
                    params.transactionType = args.transactionType as string[];
                }
                if (args.search && typeof args.search === 'string') {
                    params.search = args.search;
                }
                if (typeof args.limit === 'number') {
                    params.limit = args.limit;
                }
                if (typeof args.offset === 'number') {
                    params.offset = args.offset;
                }
                result = await tokenStorage.run(token, () =>
                    mcpFetcher({url: '/transactions', method: 'GET', params})
                );
                break;
            }

            case 'get_transaction_totals': {
                const month = args.month as string;
                const {startDate, endDate} = monthToDateRange(month);
                result = await tokenStorage.run(token, () =>
                    mcpFetcher({
                        url: '/transactions/totals',
                        method: 'GET',
                        params: {startDate, endDate}
                    })
                );
                break;
            }

            case 'list_accounts': {
                result = await tokenStorage.run(token, () =>
                    mcpFetcher({url: '/accounts', method: 'GET'})
                );
                break;
            }

            case 'list_categories': {
                result = await tokenStorage.run(token, () =>
                    mcpFetcher({url: '/categories', method: 'GET'})
                );
                break;
            }

            case 'get_dashboard_summary': {
                const params: Record<string, string> = {};
                if (args.month && typeof args.month === 'string') {
                    params.month = args.month;
                }
                result = await tokenStorage.run(token, () =>
                    mcpFetcher({url: '/dashboard/summary', method: 'GET', params})
                );
                break;
            }

            case 'create_transaction': {
                // Derive a synthetic fitid from stable fields to prevent AI-driven duplicates.
                const fitidDate = typeof args.date === 'string' ? args.date : '';
                const fitidAmount = typeof args.amount === 'number' ? String(args.amount) : '';
                const fitidDesc = typeof args.description === 'string' ? args.description : '';
                const fitidAcct = typeof args.accountId === 'string' ? args.accountId : '';
                const fitidParts = [fitidDate, fitidAmount, fitidDesc, fitidAcct].join('|');
                const fitid = createHash('sha256').update(fitidParts).digest('hex');

                const data: Record<string, unknown> = {
                    amount: args.amount,
                    description: args.description,
                    transactionType: args.transactionType,
                    date: args.date,
                    fitid
                };
                if (args.notes !== undefined) data.notes = args.notes;
                if (args.categoryId !== undefined) data.categoryId = args.categoryId;
                if (args.accountId !== undefined) data.accountId = args.accountId;
                if (args.transferDirection !== undefined) {
                    data.transferDirection = args.transferDirection;
                }

                result = await tokenStorage.run(token, () =>
                    mcpFetcher({url: '/transactions', method: 'POST', data})
                );
                break;
            }

            default:
                return {
                    content: [{type: 'text', text: `Unknown tool: ${name}`}],
                    isError: true
                };
        }

        return {
            content: [{type: 'text', text: JSON.stringify(result, null, 2)}]
        };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            content: [{type: 'text', text: message}],
            isError: true
        };
    }
};

// ---- Server factory ----

const createMcpServer = (token: string): Server => {
    const server = new Server(
        {name: 'finance-tracker', version: '0.1.0'},
        {capabilities: {tools: {}}}
    );

    server.setRequestHandler(ListToolsRequestSchema, () => Promise.resolve({tools: TOOLS}));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const {name, arguments: args = {}} = request.params;
        return handleToolCall(token, name, args);
    });

    return server;
};

// ---- Auth helper for HTTP mode ----

const validateBearerToken = async (authHeader: string | undefined): Promise<string | null> => {
    if (!authHeader?.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) return null;

    const baseUrl = process.env.FINANCE_TRACKER_URL ?? 'http://localhost:3000';
    try {
        const response = await fetch(`${baseUrl}/auth/me`, {
            headers: {Authorization: `Bearer ${token}`}
        });
        if (!response.ok) return null;
        return token;
    } catch {
        return null;
    }
};

// ---- HTTP mode ----

interface SessionEntry {
    server: Server;
    transport: StreamableHTTPServerTransport;
}

const handleMcpRequest = async (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    sessions: Map<string, SessionEntry>
): Promise<void> => {
    // Validate token on every MCP request (detects revocation mid-session)
    const token = await validateBearerToken(req.headers.authorization);
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
            // Existing session — route to its transport
            const entry = sessions.get(sessionId)!;
            await tokenStorage.run(token, () =>
                entry.transport.handleRequest(req, res, parsedBody)
            );
            return;
        }

        if (!sessionId && isInitializeRequest(parsedBody)) {
            // New session
            const newServer = createMcpServer(token);
            const newTransport = new StreamableHTTPServerTransport({
                sessionIdGenerator: (): string => randomUUID(),
                onsessioninitialized: (newSessionId: string): void => {
                    sessions.set(newSessionId, {server: newServer, transport: newTransport});
                }
            });

            newTransport.onclose = (): void => {
                const sid = newTransport.sessionId;
                if (sid) {
                    sessions.delete(sid);
                }
            };

            await newServer.connect(newTransport);
            await tokenStorage.run(token, () =>
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
            res.writeHead(400, {'Content-Type': 'text/plain'});
            res.end('Invalid or missing session ID');
            return;
        }
        const entry = sessions.get(sessionId)!;
        await tokenStorage.run(token, () =>
            entry.transport.handleRequest(req, res)
        );
        return;
    }

    if (req.method === 'DELETE') {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (sessionId && sessions.has(sessionId)) {
            const entry = sessions.get(sessionId)!;
            await entry.transport.handleRequest(req, res);
            sessions.delete(sessionId);
            return;
        }
        res.writeHead(404, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: 'Session not found'}));
        return;
    }

    res.writeHead(405, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({error: 'Method Not Allowed'}));
};

const startHttpServer = async (): Promise<void> => {
    const port = parseInt(process.env.MCP_PORT ?? '3010', 10);
    const sessions = new Map<string, SessionEntry>();

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
            console.error(`[mcp-server] HTTP transport listening on port ${port}`);
            resolve();
        });
    });
};

// ---- Stdio mode ----

const startStdioServer = async (): Promise<void> => {
    const token = process.env.FINANCE_TRACKER_API_TOKEN;
    if (!token) {
        console.error('[mcp-server] FINANCE_TRACKER_API_TOKEN is required in stdio mode');
        process.exit(1);
    }

    const server = createMcpServer(token);
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`[mcp-server] stdio transport ready (${TOOLS.length} tools)`);
};

// ---- Entry point ----

const transportMode = process.env.MCP_TRANSPORT ?? 'stdio';

if (transportMode === 'http') {
    void startHttpServer().catch((err: unknown) => {
        console.error('[mcp-server] Failed to start HTTP server:', err);
        process.exit(1);
    });
} else {
    void startStdioServer().catch((err: unknown) => {
        console.error('[mcp-server] Failed to start stdio server:', err);
        process.exit(1);
    });
}
