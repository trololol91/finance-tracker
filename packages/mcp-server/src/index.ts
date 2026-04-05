import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';

import {createMcpServer, validateBearerToken, ALL_TOOLS} from './server.js';
import {startHttpServer} from './http-transport.js';

const startStdioServer = async (): Promise<void> => {
    const token = process.env.FINANCE_TRACKER_API_TOKEN;
    if (!token) {
        console.error('[mcp-server] FINANCE_TRACKER_API_TOKEN is required in stdio mode');
        process.exit(1);
    }

    // Validate the token against the backend at startup so misconfiguration fails
    // immediately rather than silently at first tool call.
    const validToken = await validateBearerToken(`Bearer ${token}`);
    if (!validToken) {
        console.error('[mcp-server] FINANCE_TRACKER_API_TOKEN is invalid or expired');
        process.exit(1);
    }

    const server = createMcpServer(token);
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`[mcp-server] stdio transport ready (${ALL_TOOLS.length} tools)`);
};

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
