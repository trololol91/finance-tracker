import type {CategoryResponseDto} from '../api/model/categoryResponseDto.js';
import {tokenStorage, mcpFetcher} from '../services/fetcher.js';
import type {ToolModule} from './types.js';

export const categoryTools: ToolModule<CategoryResponseDto[]>[] = [
    {
        name: 'list_categories',
        description: 'List all categories for the authenticated user.',
        inputSchema: {
            type: 'object',
            properties: {}
        },
        handle: async (token) =>
            tokenStorage.run(token, () =>
                mcpFetcher<CategoryResponseDto[]>({url: '/api/categories', method: 'GET'})
            )
    }
];
