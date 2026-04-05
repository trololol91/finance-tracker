import type {AccountResponseDto} from '../api/model/accountResponseDto.js';
import {tokenStorage, mcpFetcher} from '../services/fetcher.js';
import type {ToolModule} from './types.js';

export const accountTools: ToolModule<AccountResponseDto[]>[] = [
    {
        name: 'list_accounts',
        description: 'List all accounts for the authenticated user.',
        inputSchema: {
            type: 'object',
            properties: {}
        },
        handle: async (token) =>
            tokenStorage.run(token, () =>
                mcpFetcher<AccountResponseDto[]>({url: '/accounts', method: 'GET'})
            )
    }
];
