import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {enrichTransaction, fetchLookupMaps, clearLookupCache} from '../enrich.js';

const mockFetchByPath = (responses: Record<string, unknown>) => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
        const path = new URL(url).pathname;
        const body = responses[path];
        return Promise.resolve(new Response(JSON.stringify(body ?? {}), {status: 200}));
    }));
};

const makeTx = (overrides: Record<string, unknown> = {}) => ({
    id: 'tx-1',
    userId: 'user-1',
    amount: 42.5,
    description: 'Coffee',
    notes: 'afternoon',
    categoryId: 'cat-1',
    accountId: 'acc-1',
    transactionType: 'expense',
    date: '2025-03-15T10:00:00.000Z',
    originalDate: '2025-03-15T10:00:00.000Z',
    isActive: true,
    isPending: false,
    transferDirection: null,
    createdAt: '2025-03-15T10:00:00.000Z',
    updatedAt: '2025-03-15T10:00:00.000Z',
    ...overrides
});

describe('enrichTransaction', () => {
    it('projects only the expected fields', () => {
        const accountsById = new Map([['acc-1', 'Chequing']]);
        const categoriesById = new Map([['cat-1', 'Food']]);
        const tx = makeTx();

        const result = enrichTransaction(tx as never, accountsById, categoriesById);

        expect(Object.keys(result).sort()).toEqual([
            'accountName', 'amount', 'categoryName', 'date', 'description',
            'id', 'isPending', 'notes', 'transactionType', 'transferDirection'
        ]);
        // original DTO-only fields should not appear
        expect(result).not.toHaveProperty('userId');
        expect(result).not.toHaveProperty('isActive');
        expect(result).not.toHaveProperty('originalDate');
        expect(result).not.toHaveProperty('createdAt');
        expect(result).not.toHaveProperty('updatedAt');
        expect(result).not.toHaveProperty('categoryId');
        expect(result).not.toHaveProperty('accountId');
    });

    it('resolves categoryId and accountId to names', () => {
        const accountsById = new Map([['acc-1', 'Savings']]);
        const categoriesById = new Map([['cat-1', 'Groceries']]);
        const result = enrichTransaction(makeTx() as never, accountsById, categoriesById);

        expect(result.categoryName).toBe('Groceries');
        expect(result.accountName).toBe('Savings');
    });

    it('returns null categoryName when categoryId is null', () => {
        const result = enrichTransaction(
            makeTx({categoryId: null}) as never,
            new Map(),
            new Map()
        );
        expect(result.categoryName).toBeNull();
    });

    it('returns null accountName when accountId is null', () => {
        const result = enrichTransaction(
            makeTx({accountId: null}) as never,
            new Map(),
            new Map()
        );
        expect(result.accountName).toBeNull();
    });

    it('returns null for unknown categoryId not in map', () => {
        const result = enrichTransaction(
            makeTx({categoryId: 'unknown-cat'}) as never,
            new Map([['acc-1', 'Chequing']]),
            new Map([['cat-99', 'Other']]) // 'unknown-cat' is absent
        );
        expect(result.categoryName).toBeNull();
    });

    it('returns null for unknown accountId not in map', () => {
        const result = enrichTransaction(
            makeTx({accountId: 'unknown-acc'}) as never,
            new Map([['acc-99', 'Other']]),
            new Map([['cat-1', 'Food']])
        );
        expect(result.accountName).toBeNull();
    });

    it('preserves scalar fields verbatim', () => {
        const accountsById = new Map([['acc-1', 'Chequing']]);
        const categoriesById = new Map([['cat-1', 'Food']]);
        const tx = makeTx({notes: 'my note', isPending: true, transferDirection: 'out'});
        const result = enrichTransaction(tx as never, accountsById, categoriesById);

        expect(result.id).toBe('tx-1');
        expect(result.description).toBe('Coffee');
        expect(result.amount).toBe(42.5);
        expect(result.transactionType).toBe('expense');
        expect(result.date).toBe('2025-03-15T10:00:00.000Z');
        expect(result.notes).toBe('my note');
        expect(result.isPending).toBe(true);
        expect(result.transferDirection).toBe('out');
    });
});

describe('fetchLookupMaps', () => {
    beforeEach(() => {
        vi.unstubAllGlobals();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        clearLookupCache();
    });

    it('builds accountsById map from API response', async () => {
        mockFetchByPath({
            '/accounts': [
                {id: 'acc-1', name: 'Chequing'},
                {id: 'acc-2', name: 'Savings'}
            ],
            '/categories': []
        });

        const {accountsById} = await fetchLookupMaps('test-token');

        expect(accountsById.get('acc-1')).toBe('Chequing');
        expect(accountsById.get('acc-2')).toBe('Savings');
        expect(accountsById.size).toBe(2);
    });

    it('builds categoriesById map from API response', async () => {
        mockFetchByPath({
            '/accounts': [],
            '/categories': [
                {id: 'cat-1', name: 'Food', children: []},
                {id: 'cat-2', name: 'Transport', children: []}
            ]
        });

        const {categoriesById} = await fetchLookupMaps('test-token');

        expect(categoriesById.get('cat-1')).toBe('Food');
        expect(categoriesById.get('cat-2')).toBe('Transport');
    });

    it('flattens nested child categories into the map', async () => {
        mockFetchByPath({
            '/accounts': [],
            '/categories': [
                {
                    id: 'cat-1',
                    name: 'Food',
                    children: [
                        {
                            id: 'cat-1a',
                            name: 'Restaurants',
                            children: [
                                {id: 'cat-1a-i', name: 'Fast Food', children: []}
                            ]
                        },
                        {id: 'cat-1b', name: 'Groceries', children: []}
                    ]
                }
            ]
        });

        const {categoriesById} = await fetchLookupMaps('test-token');

        expect(categoriesById.get('cat-1')).toBe('Food');
        expect(categoriesById.get('cat-1a')).toBe('Restaurants');
        expect(categoriesById.get('cat-1b')).toBe('Groceries');
        expect(categoriesById.get('cat-1a-i')).toBe('Fast Food');
        expect(categoriesById.size).toBe(4);
    });

    it('handles empty accounts and categories arrays', async () => {
        mockFetchByPath({'/accounts': [], '/categories': []});

        const {accountsById, categoriesById} = await fetchLookupMaps('test-token');

        expect(accountsById.size).toBe(0);
        expect(categoriesById.size).toBe(0);
    });

    it('returns both maps in a single call', async () => {
        mockFetchByPath({
            '/accounts': [{id: 'acc-1', name: 'Chequing'}],
            '/categories': [{id: 'cat-1', name: 'Food', children: []}]
        });

        const result = await fetchLookupMaps('test-token');

        expect(result).toHaveProperty('accountsById');
        expect(result).toHaveProperty('categoriesById');
    });
});
