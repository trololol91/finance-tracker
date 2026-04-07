import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {CallToolRequestSchema, ListToolsRequestSchema} from '@modelcontextprotocol/sdk/types.js';

import {transactionTools} from './tools/transactions.js';
import {accountTools} from './tools/accounts.js';
import {categoryTools} from './tools/categories.js';
import {dashboardTools} from './tools/dashboard.js';
import type {ToolModule} from './tools/types.js';

export const ALL_TOOLS: ToolModule[] = [
    ...transactionTools,
    ...accountTools,
    ...categoryTools,
    ...dashboardTools
];

export const createMcpServer = (token: string): Server => {
    const server = new Server(
        {name: 'finance-tracker', version: '0.1.0'},
        {capabilities: {tools: {}}}
    );

    server.setRequestHandler(ListToolsRequestSchema, () =>
        Promise.resolve({
            tools: ALL_TOOLS.map(({name, description, inputSchema}) => ({
                name,
                description,
                inputSchema
            }))
        })
    );

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const {name, arguments: args = {}} = request.params;
        const tool = ALL_TOOLS.find((t) => t.name === name);
        if (!tool) {
            return {
                content: [{type: 'text', text: `Unknown tool: ${name}`}],
                isError: true
            };
        }
        try {
            const result = await tool.handle(token, args);
            return {content: [{type: 'text', text: JSON.stringify(result, null, 2)}]};
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            return {content: [{type: 'text', text: message}], isError: true};
        }
    });

    return server;
};

export const validateBearerToken = async (
    authHeader: string | undefined
): Promise<string | null> => {
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) return null;

    const baseUrl = process.env.FINANCE_TRACKER_URL ?? 'http://localhost:3001';
    try {
        const response = await fetch(`${baseUrl}/api/auth/me`, {
            headers: {Authorization: `Bearer ${token}`}
        });
        if (!response.ok) return null;
        return token;
    } catch {
        return null;
    }
};
