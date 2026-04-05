import type {AccountResponseDto} from '../api/model/accountResponseDto.js';
import type {CategoryResponseDto} from '../api/model/categoryResponseDto.js';
import type {TransactionResponseDto} from '../api/model/transactionResponseDto.js';
import {tokenStorage, mcpFetcher} from '../services/fetcher.js';

export interface EnrichedTransaction {
    id: string;
    description: string;
    amount: number;
    transactionType: string;
    date: string;
    notes: string | null;
    isPending: boolean;
    transferDirection?: string | null;
    categoryName: string | null;
    accountName: string | null;
}

const flattenCategories = (categories: CategoryResponseDto[]): CategoryResponseDto[] =>
    categories.flatMap((c) => [c, ...flattenCategories(c.children ?? [])]);

const CACHE_TTL_MS = 60_000; // 1 minute

interface LookupMaps {
    accountsById: Map<string, string>;
    categoriesById: Map<string, string>;
}

interface CacheEntry {
    maps: LookupMaps;
    expiresAt: number;
}

// Keyed by token so different users get independent caches.
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<LookupMaps>>();

/**
 * Fetch accounts and categories in parallel and return lookup maps by ID.
 * Results are cached per token for 60 seconds to avoid redundant API calls
 * on every tool invocation.
 */
export const fetchLookupMaps = async (token: string): Promise<LookupMaps> => {
    const cached = cache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.maps;
    }

    // Deduplicate concurrent misses — all callers share one in-flight fetch.
    const existing = inflight.get(token);
    if (existing) return existing;

    const fetch = (async (): Promise<LookupMaps> => {
        const [accounts, categories] = await Promise.all([
            tokenStorage.run(token, () =>
                mcpFetcher<AccountResponseDto[]>({url: '/accounts', method: 'GET'})
            ),
            tokenStorage.run(token, () =>
                mcpFetcher<CategoryResponseDto[]>({url: '/categories', method: 'GET'})
            )
        ]);
        const maps: LookupMaps = {
            accountsById: new Map<string, string>(
                (accounts ?? []).map((a) => [a.id, a.name])
            ),
            categoriesById: new Map<string, string>(
                flattenCategories(categories ?? []).map((c) => [c.id, c.name])
            )
        };

        cache.set(token, {maps, expiresAt: Date.now() + CACHE_TTL_MS});
        inflight.delete(token);
        return maps;
    })();

    inflight.set(token, fetch);
    return fetch;
};

/** Clear the lookup cache. Useful in tests and after account/category mutations. */
export const clearLookupCache = (): void => cache.clear();

/**
 * Project a transaction down to the fields useful for an LLM, replacing
 * categoryId/accountId with their human-readable names.
 */
export const enrichTransaction = (
    tx: TransactionResponseDto,
    accountsById: Map<string, string>,
    categoriesById: Map<string, string>
): EnrichedTransaction => ({
    id: tx.id,
    description: tx.description,
    amount: tx.amount,
    transactionType: tx.transactionType,
    date: tx.date,
    notes: tx.notes,
    isPending: tx.isPending,
    transferDirection: tx.transferDirection,
    categoryName: tx.categoryId ? (categoriesById.get(tx.categoryId) ?? null) : null,
    accountName: tx.accountId ? (accountsById.get(tx.accountId) ?? null) : null
});
