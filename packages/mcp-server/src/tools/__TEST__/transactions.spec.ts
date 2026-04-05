import {createHash} from 'node:crypto';
import {describe, it, expect, vi, afterEach} from 'vitest';
import {transactionTools} from '../transactions.js';
import {clearLookupCache} from '../enrich.js';
import type {EnrichedTransaction} from '../enrich.js';

interface EnrichedPage {
    data: EnrichedTransaction[];
    total: number;
    page: number;
    limit: number;
}


const listTransactions = transactionTools.find(t => t.name === 'list_transactions')!;
const getTransactionTotals = transactionTools.find(t => t.name === 'get_transaction_totals')!;
const createTransaction = transactionTools.find(t => t.name === 'create_transaction')!;

const makeAccount = (id: string, name: string) => ({id, name, type: 'chequing', balance: 0, currency: 'CAD', isActive: true, createdAt: '', updatedAt: ''});
const makeCategory = (id: string, name: string, children: unknown[] = []) => ({id, name, children});
const makeTx = (overrides: Record<string, unknown> = {}) => ({
    id: 'tx-1',
    userId: 'user-1',
    amount: 25.0,
    description: 'Lunch',
    notes: null,
    categoryId: 'cat-1',
    accountId: 'acc-1',
    transactionType: 'expense',
    date: '2025-03-15T00:00:00.000Z',
    originalDate: '2025-03-15T00:00:00.000Z',
    isActive: true,
    isPending: false,
    transferDirection: null,
    createdAt: '2025-03-15T00:00:00.000Z',
    updatedAt: '2025-03-15T00:00:00.000Z',
    ...overrides
});

let capturedUrls: string[] = [];
let capturedBodies: unknown[] = [];

const mockFetchByPath = (responses: Record<string, unknown>) => {
    capturedUrls = [];
    capturedBodies = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        capturedUrls.push(url);
        if (init?.body) {
            capturedBodies.push(JSON.parse(init.body as string));
        }
        const path = new URL(url).pathname;
        const body = responses[path];
        return new Response(JSON.stringify(body ?? {}), {status: 200});
    }));
};

describe('transactionTools', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        clearLookupCache();
    });

    describe('list_transactions', () => {
        it('fetches transactions and returns enriched page', async () => {
            const tx = makeTx();
            mockFetchByPath({
                '/transactions': {data: [tx], total: 1, page: 1, limit: 50},
                '/accounts': [makeAccount('acc-1', 'Chequing')],
                '/categories': [makeCategory('cat-1', 'Food')]
            });

            const result = await listTransactions.handle('test-token', {}) as EnrichedPage;

            expect(result.total).toBe(1);
            expect(result.data).toHaveLength(1);
            expect(result.data[0].categoryName).toBe('Food');
            expect(result.data[0].accountName).toBe('Chequing');
        });

        it('does not include raw categoryId/accountId fields in enriched transactions', async () => {
            const tx = makeTx();
            mockFetchByPath({
                '/transactions': {data: [tx], total: 1, page: 1, limit: 50},
                '/accounts': [makeAccount('acc-1', 'Chequing')],
                '/categories': [makeCategory('cat-1', 'Food')]
            });

            const result = await listTransactions.handle('test-token', {}) as EnrichedPage;

            expect(result.data[0]).not.toHaveProperty('categoryId');
            expect(result.data[0]).not.toHaveProperty('accountId');
        });

        it('passes startDate and endDate as query params', async () => {
            mockFetchByPath({
                '/transactions': {data: [], total: 0, page: 1, limit: 50},
                '/accounts': [],
                '/categories': []
            });

            await listTransactions.handle('test-token', {
                startDate: '2025-01-01',
                endDate: '2025-01-31'
            });

            const txUrl = capturedUrls.find(u => new URL(u).pathname === '/transactions')!;
            const params = new URL(txUrl).searchParams;
            expect(params.get('startDate')).toBe('2025-01-01');
            expect(params.get('endDate')).toBe('2025-01-31');
        });

        it('passes categoryId array as repeated query params', async () => {
            mockFetchByPath({
                '/transactions': {data: [], total: 0, page: 1, limit: 50},
                '/accounts': [],
                '/categories': []
            });

            await listTransactions.handle('test-token', {
                categoryId: ['cat-1', 'cat-2']
            });

            const txUrl = capturedUrls.find(u => new URL(u).pathname === '/transactions')!;
            const params = new URL(txUrl).searchParams;
            expect(params.getAll('categoryId')).toEqual(['cat-1', 'cat-2']);
        });

        it('passes accountId array as repeated query params', async () => {
            mockFetchByPath({
                '/transactions': {data: [], total: 0, page: 1, limit: 50},
                '/accounts': [],
                '/categories': []
            });

            await listTransactions.handle('test-token', {
                accountId: ['acc-1', 'acc-2']
            });

            const txUrl = capturedUrls.find(u => new URL(u).pathname === '/transactions')!;
            expect(new URL(txUrl).searchParams.getAll('accountId')).toEqual(['acc-1', 'acc-2']);
        });

        it('passes transactionType array as repeated query params', async () => {
            mockFetchByPath({
                '/transactions': {data: [], total: 0, page: 1, limit: 50},
                '/accounts': [],
                '/categories': []
            });

            await listTransactions.handle('test-token', {
                transactionType: ['income', 'expense']
            });

            const txUrl = capturedUrls.find(u => new URL(u).pathname === '/transactions')!;
            expect(new URL(txUrl).searchParams.getAll('transactionType')).toEqual(['income', 'expense']);
        });

        it('passes search, limit, page query params', async () => {
            mockFetchByPath({
                '/transactions': {data: [], total: 0, page: 2, limit: 10},
                '/accounts': [],
                '/categories': []
            });

            await listTransactions.handle('test-token', {
                search: 'coffee',
                limit: 10,
                page: 2
            });

            const txUrl = capturedUrls.find(u => new URL(u).pathname === '/transactions')!;
            const params = new URL(txUrl).searchParams;
            expect(params.get('search')).toBe('coffee');
            expect(params.get('limit')).toBe('10');
            expect(params.get('page')).toBe('2');
        });

        it('omits optional filters when not provided', async () => {
            mockFetchByPath({
                '/transactions': {data: [], total: 0, page: 1, limit: 50},
                '/accounts': [],
                '/categories': []
            });

            await listTransactions.handle('test-token', {});

            const txUrl = capturedUrls.find(u => new URL(u).pathname === '/transactions')!;
            const params = new URL(txUrl).searchParams;
            expect(params.has('startDate')).toBe(false);
            expect(params.has('endDate')).toBe(false);
            expect(params.has('categoryId')).toBe(false);
            expect(params.has('search')).toBe(false);
        });

        it('ignores empty categoryId array', async () => {
            mockFetchByPath({
                '/transactions': {data: [], total: 0, page: 1, limit: 50},
                '/accounts': [],
                '/categories': []
            });

            await listTransactions.handle('test-token', {categoryId: []});

            const txUrl = capturedUrls.find(u => new URL(u).pathname === '/transactions')!;
            expect(new URL(txUrl).searchParams.has('categoryId')).toBe(false);
        });

        it('resolves child category names from nested categories', async () => {
            const tx = makeTx({categoryId: 'cat-1a'});
            mockFetchByPath({
                '/transactions': {data: [tx], total: 1, page: 1, limit: 50},
                '/accounts': [makeAccount('acc-1', 'Chequing')],
                '/categories': [
                    makeCategory('cat-1', 'Food', [makeCategory('cat-1a', 'Restaurants')])
                ]
            });

            const result = await listTransactions.handle('test-token', {}) as EnrichedPage;

            expect(result.data[0].categoryName).toBe('Restaurants');
        });
    });

    describe('get_transaction_totals', () => {
        it('throws for missing month argument', async () => {
            await expect(
                getTransactionTotals.handle('test-token', {})
            ).rejects.toThrow('month must be in YYYY-MM format');
        });

        it('throws for invalid month format (no dash)', async () => {
            await expect(
                getTransactionTotals.handle('test-token', {month: '202503'})
            ).rejects.toThrow('month must be in YYYY-MM format');
        });

        it('throws for invalid month format (letters)', async () => {
            await expect(
                getTransactionTotals.handle('test-token', {month: '2025-March'})
            ).rejects.toThrow('month must be in YYYY-MM format');
        });

        it('derives correct UTC startDate and endDate for a 31-day month', async () => {
            const totals = {totalIncome: 1000, totalExpenses: 500, netBalance: 500};
            mockFetchByPath({'/transactions/totals': totals});

            await getTransactionTotals.handle('test-token', {month: '2025-03'});

            const totalsUrl = capturedUrls.find(u => new URL(u).pathname === '/transactions/totals')!;
            const params = new URL(totalsUrl).searchParams;
            expect(params.get('startDate')).toBe('2025-03-01T00:00:00.000Z');
            expect(params.get('endDate')).toBe('2025-03-31T23:59:59.999Z');
        });

        it('derives correct UTC startDate and endDate for February (non-leap year)', async () => {
            const totals = {totalIncome: 800, totalExpenses: 200, netBalance: 600};
            mockFetchByPath({'/transactions/totals': totals});

            await getTransactionTotals.handle('test-token', {month: '2025-02'});

            const totalsUrl = capturedUrls.find(u => new URL(u).pathname === '/transactions/totals')!;
            const params = new URL(totalsUrl).searchParams;
            expect(params.get('startDate')).toBe('2025-02-01T00:00:00.000Z');
            expect(params.get('endDate')).toBe('2025-02-28T23:59:59.999Z');
        });

        it('derives correct UTC startDate and endDate for February (leap year)', async () => {
            const totals = {totalIncome: 800, totalExpenses: 200, netBalance: 600};
            mockFetchByPath({'/transactions/totals': totals});

            await getTransactionTotals.handle('test-token', {month: '2024-02'});

            const totalsUrl = capturedUrls.find(u => new URL(u).pathname === '/transactions/totals')!;
            const params = new URL(totalsUrl).searchParams;
            expect(params.get('startDate')).toBe('2024-02-01T00:00:00.000Z');
            expect(params.get('endDate')).toBe('2024-02-29T23:59:59.999Z');
        });

        it('returns the totals object from the API', async () => {
            const totals = {totalIncome: 1500, totalExpenses: 700, netBalance: 800};
            mockFetchByPath({'/transactions/totals': totals});

            const result = await getTransactionTotals.handle('test-token', {month: '2025-03'});

            expect(result).toEqual(totals);
        });
    });

    describe('create_transaction', () => {
        it('creates a transaction and returns an enriched result', async () => {
            const newTx = makeTx({id: 'tx-new', amount: 99, description: 'Dinner', accountId: 'acc-1', categoryId: 'cat-1'});
            mockFetchByPath({
                '/transactions': {status: 'created', transaction: newTx},
                '/accounts': [makeAccount('acc-1', 'Chequing')],
                '/categories': [makeCategory('cat-1', 'Food')]
            });

            const result = await createTransaction.handle('test-token', {
                amount: 99,
                description: 'Dinner',
                transactionType: 'expense',
                date: '2025-03-15T00:00:00.000Z',
                accountId: 'acc-1',
                categoryId: 'cat-1'
            }) as EnrichedTransaction;

            expect(result.id).toBe('tx-new');
            expect(result.categoryName).toBe('Food');
            expect(result.accountName).toBe('Chequing');
        });

        it('includes a fitid sha256 hash derived from date|amount|description|accountId', async () => {
            const newTx = makeTx();
            mockFetchByPath({
                '/transactions': {status: 'created', transaction: newTx},
                '/accounts': [],
                '/categories': []
            });

            const args = {
                amount: 25,
                description: 'Coffee',
                transactionType: 'expense',
                date: '2025-03-15T00:00:00.000Z',
                accountId: 'acc-1'
            };
            await createTransaction.handle('test-token', args);

            const postBody = capturedBodies.find(() => true) as Record<string, unknown>;
            const expectedFitid = createHash('sha256')
                .update(`${args.date}|${args.amount}|${args.description}|${args.accountId}`)
                .digest('hex');

            expect(postBody.fitid).toBe(expectedFitid);
        });

        it('fitid uses empty string for missing optional accountId', async () => {
            const newTx = makeTx({accountId: null});
            mockFetchByPath({
                '/transactions': {status: 'created', transaction: newTx},
                '/accounts': [],
                '/categories': []
            });

            const args = {
                amount: 10,
                description: 'Bus fare',
                transactionType: 'expense',
                date: '2025-04-01T00:00:00.000Z'
                // no accountId
            };
            await createTransaction.handle('test-token', args);

            const postBody = capturedBodies.find(() => true) as Record<string, unknown>;
            const expectedFitid = createHash('sha256')
                .update(`${args.date}|${args.amount}|${args.description}|`)
                .digest('hex');

            expect(postBody.fitid).toBe(expectedFitid);
        });

        it('sends optional fields when provided', async () => {
            const newTx = makeTx();
            mockFetchByPath({
                '/transactions': {status: 'created', transaction: newTx},
                '/accounts': [],
                '/categories': []
            });

            await createTransaction.handle('test-token', {
                amount: 50,
                description: 'Transfer',
                transactionType: 'transfer',
                date: '2025-03-15T00:00:00.000Z',
                notes: 'monthly savings',
                categoryId: 'cat-1',
                accountId: 'acc-1',
                transferDirection: 'out'
            });

            const postBody = capturedBodies.find(() => true) as Record<string, unknown>;
            expect(postBody.notes).toBe('monthly savings');
            expect(postBody.categoryId).toBe('cat-1');
            expect(postBody.accountId).toBe('acc-1');
            expect(postBody.transferDirection).toBe('out');
        });

        it('omits optional fields when not provided', async () => {
            const newTx = makeTx({categoryId: null, accountId: null, notes: null});
            mockFetchByPath({
                '/transactions': {status: 'created', transaction: newTx},
                '/accounts': [],
                '/categories': []
            });

            await createTransaction.handle('test-token', {
                amount: 15,
                description: 'Snack',
                transactionType: 'expense',
                date: '2025-03-15T00:00:00.000Z'
            });

            const postBody = capturedBodies.find(() => true) as Record<string, unknown>;
            expect(postBody).not.toHaveProperty('notes');
            expect(postBody).not.toHaveProperty('categoryId');
            expect(postBody).not.toHaveProperty('accountId');
            expect(postBody).not.toHaveProperty('transferDirection');
        });

        it('sends required fields in POST body', async () => {
            const newTx = makeTx();
            mockFetchByPath({
                '/transactions': {status: 'created', transaction: newTx},
                '/accounts': [],
                '/categories': []
            });

            await createTransaction.handle('test-token', {
                amount: 42,
                description: 'Test tx',
                transactionType: 'income',
                date: '2025-06-01T00:00:00.000Z'
            });

            const postBody = capturedBodies.find(() => true) as Record<string, unknown>;
            expect(postBody.amount).toBe(42);
            expect(postBody.description).toBe('Test tx');
            expect(postBody.transactionType).toBe('income');
            expect(postBody.date).toBe('2025-06-01T00:00:00.000Z');
        });

        it('returns enriched transaction with null names when IDs not in maps', async () => {
            const newTx = makeTx({categoryId: 'unknown-cat', accountId: 'unknown-acc'});
            mockFetchByPath({
                '/transactions': {status: 'created', transaction: newTx},
                '/accounts': [],
                '/categories': []
            });

            const result = await createTransaction.handle('test-token', {
                amount: 25,
                description: 'Mystery',
                transactionType: 'expense',
                date: '2025-03-15T00:00:00.000Z'
            }) as EnrichedTransaction;

            expect(result.categoryName).toBeNull();
            expect(result.accountName).toBeNull();
        });
    });
});
