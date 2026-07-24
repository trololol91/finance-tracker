import type {JsonSchemaType} from '@modelcontextprotocol/server';

export interface ToolInputSchema {
    type: 'object';
    properties: Record<string, JsonSchemaType>;
    required?: string[];
}

export interface ToolModule<TResult = unknown> {
    name: string;
    description: string;
    inputSchema: ToolInputSchema;
    handle: (token: string, args: Record<string, unknown>) => Promise<TResult>;
}
