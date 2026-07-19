import {startStdioServer} from './stdio-transport.js';
import {startHttpServer} from './http-transport.js';

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
