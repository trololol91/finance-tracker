export interface ToolInputSchema {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
}

export interface ToolModule<TResult = unknown> {
    name: string;
    description: string;
    inputSchema: ToolInputSchema;
    handle: (token: string, args: Record<string, unknown>) => Promise<TResult>;
}
