import {describe, it, expect, vi, afterEach} from 'vitest';
import {dashboardTools} from '../dashboard.js';

const getDashboardSummary = dashboardTools.find(t => t.name === 'get_dashboard_summary')!;

const mockFetchByPath = (responses: Record<string, unknown>) => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
        const path = new URL(url).pathname;
        const body = responses[path];
        return Promise.resolve(new Response(JSON.stringify(body ?? {}), {status: 200}));
    }));
};

const makeSummary = (overrides: Record<string, unknown> = {}) => ({
    month: '2025-03',
    totalIncome: 3000,
    totalExpenses: 1500,
    netBalance: 1500,
    transactionCount: 20,
    savingsRate: 50,
    accounts: [],
    recentTransactions: [],
    ...overrides
});

describe('dashboardTools', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('get_dashboard_summary', () => {
        it('returns the dashboard summary from the API', async () => {
            const summary = makeSummary();
            mockFetchByPath({'/api/dashboard/summary': summary});

            const result = await getDashboardSummary.handle('test-token', {});

            expect(result).toEqual(summary);
        });

        it('calls the /dashboard/summary endpoint', async () => {
            let capturedUrl = '';
            vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
                capturedUrl = url;
                return Promise.resolve(new Response(JSON.stringify(makeSummary()), {status: 200}));
            }));

            await getDashboardSummary.handle('test-token', {});

            expect(new URL(capturedUrl).pathname).toBe('/api/dashboard/summary');
        });

        it('passes the month param when provided', async () => {
            let capturedUrl = '';
            vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
                capturedUrl = url;
                return Promise.resolve(new Response(JSON.stringify(makeSummary({month: '2025-06'})), {status: 200}));
            }));

            await getDashboardSummary.handle('test-token', {month: '2025-06'});

            const params = new URL(capturedUrl).searchParams;
            expect(params.get('month')).toBe('2025-06');
        });

        it('does not send month param when not provided', async () => {
            let capturedUrl = '';
            vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
                capturedUrl = url;
                return Promise.resolve(new Response(JSON.stringify(makeSummary()), {status: 200}));
            }));

            await getDashboardSummary.handle('test-token', {});

            expect(new URL(capturedUrl).searchParams.has('month')).toBe(false);
        });

        it('does not send month param when month is not a string', async () => {
            let capturedUrl = '';
            vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
                capturedUrl = url;
                return Promise.resolve(new Response(JSON.stringify(makeSummary()), {status: 200}));
            }));

            await getDashboardSummary.handle('test-token', {month: 12345});

            expect(new URL(capturedUrl).searchParams.has('month')).toBe(false);
        });

        it('returns summary with null savingsRate when income is zero', async () => {
            const summary = makeSummary({totalIncome: 0, netBalance: -500, savingsRate: null});
            mockFetchByPath({'/api/dashboard/summary': summary});

            const result = await getDashboardSummary.handle('test-token', {month: '2025-03'});

            expect(result.savingsRate).toBeNull();
        });

        it('passes the authorization token in the request', async () => {
            let capturedHeaders: Record<string, string> = {};
            vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
                capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
                return Promise.resolve(new Response(JSON.stringify(makeSummary()), {status: 200}));
            }));

            await getDashboardSummary.handle('my-dashboard-token', {});

            expect(capturedHeaders.Authorization).toBe('Bearer my-dashboard-token');
        });

        it('throws when the API returns a non-OK status', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
                new Response('Unauthorized', {status: 401, statusText: 'Unauthorized'})
            ));

            await expect(getDashboardSummary.handle('bad-token', {})).rejects.toThrow('401');
        });
    });
});
