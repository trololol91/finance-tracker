import {createHash} from 'node:crypto';

import type {CreateTransactionResponseDto} from '../api/model/createTransactionResponseDto.js';
import type {PaginatedTransactionsResponseDto} from '../api/model/paginatedTransactionsResponseDto.js';
import type {TransactionTotalsResponseDto} from '../api/model/transactionTotalsResponseDto.js';
import {tokenStorage, mcpFetcher} from '../services/fetcher.js';
import {fetchLookupMaps, enrichTransaction, type EnrichedTransaction} from './enrich.js';
import type {ToolModule} from './types.js';

const monthToDateRange = (month: string): {startDate: string; endDate: string} => {
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const mon = parseInt(monthStr, 10) - 1; // 0-based
    const start = new Date(Date.UTC(year, mon, 1));
    const end = new Date(Date.UTC(year, mon + 1, 0, 23, 59, 59, 999));
    return {startDate: start.toISOString(), endDate: end.toISOString()};
};

interface EnrichedPage extends Omit<PaginatedTransactionsResponseDto, 'data'> {
    data: EnrichedTransaction[];
}

const listTransactions: ToolModule<EnrichedPage> = {
    name: 'list_transactions',
    description:
        'List transactions for the authenticated user with optional filters. Use startDate/endDate for arbitrary ranges, categoryId/transactionType to narrow results, and search for keyword matching.',
    inputSchema: {
        type: 'object',
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
            page: {
                type: 'number',
                description: 'Page number (1-based). Combine with limit to paginate results.'
            }
        }
    },
    handle: async (token, args) => {
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
        if (typeof args.page === 'number') {
            params.page = args.page;
        }
        const [result, {accountsById, categoriesById}] = await Promise.all([
            tokenStorage.run(token, () =>
                mcpFetcher<PaginatedTransactionsResponseDto>({url: '/api/transactions', method: 'GET', params})
            ),
            fetchLookupMaps(token)
        ]);
        return {
            ...result,
            data: result.data.map((tx) => enrichTransaction(tx, accountsById, categoriesById))
        };
    }
};

const getTransactionTotals: ToolModule<TransactionTotalsResponseDto> = {
    name: 'get_transaction_totals',
    description: 'Get income, expense and net totals for a given month.',
    inputSchema: {
        type: 'object',
        properties: {
            month: {
                type: 'string',
                description: 'Month in YYYY-MM format. Required — used to derive startDate and endDate.'
            }
        },
        required: ['month']
    },
    handle: async (token, args) => {
        if (typeof args.month !== 'string' || !/^\d{4}-\d{2}$/.test(args.month)) {
            throw new Error('month must be in YYYY-MM format');
        }
        const {startDate, endDate} = monthToDateRange(args.month);
        return tokenStorage.run(token, () =>
            mcpFetcher<TransactionTotalsResponseDto>({
                url: '/api/transactions/totals',
                method: 'GET',
                params: {startDate, endDate}
            })
        );
    }
};

const createTransaction: ToolModule<EnrichedTransaction> = {
    name: 'create_transaction',
    description:
        'Create a new transaction for the authenticated user. A synthetic fitid is automatically derived from the transaction fields to prevent duplicates if the same transaction is submitted more than once.',
    inputSchema: {
        type: 'object',
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
                description:
                    'Required when transactionType is "transfer". Whether money is arriving (in) or leaving (out) the account.'
            }
        },
        required: ['amount', 'description', 'transactionType', 'date']
    },
    handle: async (token, args) => {
        // Derive a synthetic fitid from stable fields to prevent AI-driven duplicates.
        // The schema declares date/amount/description as required strings/numbers, so the
        // MCP framework will reject missing values before we get here. The '' fallback
        // guards against unexpected non-string/non-number values from a misbehaving
        // client — two such calls would collide in the dedup check rather than creating
        // duplicates, which is the safer outcome.
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
        if (args.transferDirection !== undefined) data.transferDirection = args.transferDirection;

        const [result, {accountsById, categoriesById}] = await Promise.all([
            tokenStorage.run(token, () =>
                mcpFetcher<CreateTransactionResponseDto>({url: '/api/transactions', method: 'POST', data})
            ),
            fetchLookupMaps(token)
        ]);
        return enrichTransaction(result.transaction, accountsById, categoriesById);
    }
};

export const transactionTools: ToolModule[] = [
    listTransactions,
    getTransactionTotals,
    createTransaction
];
