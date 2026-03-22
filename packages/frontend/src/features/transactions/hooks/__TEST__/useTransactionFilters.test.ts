import {
    describe, it, expect, vi, beforeEach
} from 'vitest';
import {
    renderHook, act
} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import React from 'react';
import {useTransactionFilters} from '@features/transactions/hooks/useTransactionFilters.js';

// Mock the Orval hook
vi.mock('@/api/transactions/transactions.js', () => ({
    useTransactionsControllerFindAll: vi.fn(() => ({
        data: {data: [], total: 0, page: 1, limit: 50},
        isLoading: false,
        isError: false
    })),
    getTransactionsControllerFindAllQueryKey: vi.fn((params) => ['/transactions', params])
}));

const wrapper = ({children}: {children: React.ReactNode}) =>
    React.createElement(MemoryRouter, null, children);

describe('useTransactionFilters', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns default filter values', () => {
        const {result} = renderHook(() => useTransactionFilters(), {wrapper});
        expect(result.current.filters.isActive).toBe('true');
        expect(result.current.filters.page).toBe(1);
        expect(result.current.filters.limit).toBe(50);
        expect(result.current.filters.search).toBe('');
        expect(result.current.filters.transactionType).toBe('');
    });

    it('updateFilter changes the filter value', () => {
        const {result} = renderHook(() => useTransactionFilters(), {wrapper});
        act(() => {
            result.current.updateFilter('search', 'coffee');
        });
        expect(result.current.filters.search).toBe('coffee');
    });

    it('updateFilter resets page to 1', () => {
        const {result} = renderHook(() => useTransactionFilters(), {wrapper});
        // First set page to 3
        act(() => {
            result.current.setPage(3);
        });
        expect(result.current.filters.page).toBe(3);
        // Then changing a filter should reset to page 1
        act(() => {
            result.current.updateFilter('search', 'test');
        });
        expect(result.current.filters.page).toBe(1);
    });

    it('setPage changes the page without resetting other filters', () => {
        const {result} = renderHook(() => useTransactionFilters(), {wrapper});
        act(() => {
            result.current.updateFilter('search', 'coffee');
        });
        act(() => {
            result.current.setPage(2);
        });
        expect(result.current.filters.page).toBe(2);
        expect(result.current.filters.search).toBe('coffee');
    });

    it('clearFilters resets to defaults', () => {
        const {result} = renderHook(() => useTransactionFilters(), {wrapper});
        act(() => {
            result.current.updateFilter('search', 'coffee');
            result.current.updateFilter('transactionType', 'expense');
        });
        act(() => {
            result.current.clearFilters();
        });
        expect(result.current.filters.search).toBe('');
        expect(result.current.filters.transactionType).toBe('');
        expect(result.current.filters.page).toBe(1);
    });

    describe('setDateRange (BUG-02)', () => {
        it('sets startDate and endDate simultaneously', () => {
            const {result} = renderHook(() => useTransactionFilters(), {wrapper});
            act(() => {
                result.current.setDateRange(
                    '2026-03-01T00:00:00.000Z',
                    '2026-03-31T23:59:59.999Z'
                );
            });
            expect(result.current.filters.startDate).toBe('2026-03-01T00:00:00.000Z');
            expect(result.current.filters.endDate).toBe('2026-03-31T23:59:59.999Z');
        });

        it('resets page to 1 when setting a date range', () => {
            const {result} = renderHook(() => useTransactionFilters(), {wrapper});
            act(() => { result.current.setPage(5); });
            expect(result.current.filters.page).toBe(5);
            act(() => {
                result.current.setDateRange(
                    '2026-03-01T00:00:00.000Z',
                    '2026-03-31T23:59:59.999Z'
                );
            });
            expect(result.current.filters.page).toBe(1);
        });

        it('preserves unrelated filters when setting a date range', () => {
            const {result} = renderHook(() => useTransactionFilters(), {wrapper});
            act(() => { result.current.updateFilter('search', 'rent'); });
            act(() => {
                result.current.setDateRange(
                    '2026-04-01T00:00:00.000Z',
                    '2026-04-30T23:59:59.999Z'
                );
            });
            expect(result.current.filters.search).toBe('rent');
        });
    });

    describe('default UTC month range (BUG-01)', () => {
        it('default startDate is the first of the current UTC month at midnight', () => {
            const {result} = renderHook(() => useTransactionFilters(), {wrapper});
            expect(result.current.filters.startDate).toMatch(/-01T00:00:00\.000Z$/);
        });

        it('default endDate ends at 23:59:59.999Z', () => {
            const {result} = renderHook(() => useTransactionFilters(), {wrapper});
            expect(result.current.filters.endDate).toMatch(/T23:59:59\.999Z$/);
        });

        it('default startDate and endDate are in the same calendar month', () => {
            const {result} = renderHook(() => useTransactionFilters(), {wrapper});
            const start = new Date(result.current.filters.startDate);
            const end = new Date(result.current.filters.endDate);
            expect(start.getUTCMonth()).toBe(end.getUTCMonth());
            expect(start.getUTCFullYear()).toBe(end.getUTCFullYear());
        });
    });

    describe('accountId filter (Phase 6)', () => {
        it('accountId defaults to empty string', () => {
            const {result} = renderHook(() => useTransactionFilters(), {wrapper});
            expect(result.current.filters.accountId).toBe('');
        });

        it('updateFilter updates accountId', () => {
            const {result} = renderHook(() => useTransactionFilters(), {wrapper});
            act(() => { result.current.updateFilter('accountId', 'acc-1'); });
            expect(result.current.filters.accountId).toBe('acc-1');
        });

        it('updateFilter with accountId resets page to 1', () => {
            const {result} = renderHook(() => useTransactionFilters(), {wrapper});
            act(() => { result.current.setPage(3); });
            act(() => { result.current.updateFilter('accountId', 'acc-1'); });
            expect(result.current.filters.page).toBe(1);
        });

        it('clearFilters resets accountId to empty string', () => {
            const {result} = renderHook(() => useTransactionFilters(), {wrapper});
            act(() => { result.current.updateFilter('accountId', 'acc-1'); });
            expect(result.current.filters.accountId).toBe('acc-1');
            act(() => { result.current.clearFilters(); });
            expect(result.current.filters.accountId).toBe('');
        });

        it('removes the param from URL when value is empty string', () => {
            const {result} = renderHook(() => useTransactionFilters(), {wrapper});
            act(() => { result.current.updateFilter('search', 'coffee'); });
            expect(result.current.filters.search).toBe('coffee');
            act(() => { result.current.updateFilter('search', ''); });
            expect(result.current.filters.search).toBe('');
        });

        it('clearFilters does not preserve accountId alongside other filters', () => {
            const {result} = renderHook(() => useTransactionFilters(), {wrapper});
            act(() => {
                result.current.updateFilter('accountId', 'acc-2');
                result.current.updateFilter('search', 'coffee');
            });
            act(() => { result.current.clearFilters(); });
            expect(result.current.filters.accountId).toBe('');
            expect(result.current.filters.search).toBe('');
        });
    });
});
