import {
    describe, it, expect, vi, beforeEach
} from 'vitest';
import {
    renderHook, act
} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import React from 'react';
import {useTransactionFilters} from '@features/transactions/hooks/useTransactionFilters.js';
import {TransactionsControllerFindAllSortField} from '@/api/model/transactionsControllerFindAllSortField.js';
import {TransactionsControllerFindAllSortDirection} from '@/api/model/transactionsControllerFindAllSortDirection.js';

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

const wrapperWithUrl = (search: string) =>
    ({children}: {children: React.ReactNode}) =>
        React.createElement(MemoryRouter, {initialEntries: [search]}, children);

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
        expect(result.current.filters.transactionType).toEqual([]);
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
            result.current.setMultiFilter('transactionType', ['expense']);
        });
        act(() => {
            result.current.clearFilters();
        });
        expect(result.current.filters.search).toBe('');
        expect(result.current.filters.transactionType).toEqual([]);
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

    describe('setSort', () => {
        it('sets sortField and sortDirection in filters', () => {
            const {result} = renderHook(() => useTransactionFilters(), {wrapper});
            act(() => {
                result.current.setSort(
                    TransactionsControllerFindAllSortField.amount,
                    TransactionsControllerFindAllSortDirection.asc
                );
            });
            expect(result.current.filters.sortField).toBe('amount');
            expect(result.current.filters.sortDirection).toBe('asc');
        });

        it('resets page to 1 when sort changes', () => {
            const {result} = renderHook(() => useTransactionFilters(), {wrapper});
            act(() => { result.current.setPage(4); });
            expect(result.current.filters.page).toBe(4);
            act(() => {
                result.current.setSort(
                    TransactionsControllerFindAllSortField.description,
                    TransactionsControllerFindAllSortDirection.desc
                );
            });
            expect(result.current.filters.page).toBe(1);
        });

        it('preserves unrelated filters when sort changes', () => {
            const {result} = renderHook(() => useTransactionFilters(), {wrapper});
            act(() => { result.current.updateFilter('search', 'coffee'); });
            act(() => {
                result.current.setSort(
                    TransactionsControllerFindAllSortField.amount,
                    TransactionsControllerFindAllSortDirection.desc
                );
            });
            expect(result.current.filters.search).toBe('coffee');
            expect(result.current.filters.sortField).toBe('amount');
            expect(result.current.filters.sortDirection).toBe('desc');
        });

        it('can set different combinations of field and direction', () => {
            const {result} = renderHook(() => useTransactionFilters(), {wrapper});
            act(() => {
                result.current.setSort(
                    TransactionsControllerFindAllSortField.description,
                    TransactionsControllerFindAllSortDirection.asc
                );
            });
            expect(result.current.filters.sortField).toBe('description');
            expect(result.current.filters.sortDirection).toBe('asc');
        });
    });

    describe('setMultiFilter', () => {
        // UUID v4 test fixtures (accountId/categoryId are validated as UUIDs on read-back)
        const ACC_1 = '123e4567-e89b-4abc-a456-426614174001';
        const ACC_2 = '123e4567-e89b-4abc-a456-426614174002';
        const CAT_1 = '123e4567-e89b-4abc-a456-426614174003';
        const CAT_2 = '123e4567-e89b-4abc-a456-426614174004';

        it('accountId defaults to empty array', () => {
            const {result} = renderHook(() => useTransactionFilters(), {wrapper});
            expect(result.current.filters.accountId).toEqual([]);
        });

        it('setMultiFilter sets accountId to multiple values', () => {
            const {result} = renderHook(() => useTransactionFilters(), {wrapper});
            act(() => { result.current.setMultiFilter('accountId', [ACC_1, ACC_2]); });
            expect(result.current.filters.accountId).toEqual([ACC_1, ACC_2]);
        });

        it('setMultiFilter sets accountId to a single value', () => {
            const {result} = renderHook(() => useTransactionFilters(), {wrapper});
            act(() => { result.current.setMultiFilter('accountId', [ACC_1]); });
            expect(result.current.filters.accountId).toEqual([ACC_1]);
        });

        it('setMultiFilter clears accountId when passed empty array', () => {
            const {result} = renderHook(() => useTransactionFilters(), {wrapper});
            act(() => { result.current.setMultiFilter('accountId', [ACC_1]); });
            act(() => { result.current.setMultiFilter('accountId', []); });
            expect(result.current.filters.accountId).toEqual([]);
        });

        it('setMultiFilter resets page to 1', () => {
            const {result} = renderHook(() => useTransactionFilters(), {wrapper});
            act(() => { result.current.setPage(3); });
            act(() => { result.current.setMultiFilter('accountId', [ACC_1]); });
            expect(result.current.filters.page).toBe(1);
        });

        it('clearFilters resets accountId to empty array', () => {
            const {result} = renderHook(() => useTransactionFilters(), {wrapper});
            act(() => { result.current.setMultiFilter('accountId', [ACC_1]); });
            expect(result.current.filters.accountId).toEqual([ACC_1]);
            act(() => { result.current.clearFilters(); });
            expect(result.current.filters.accountId).toEqual([]);
        });

        it('clearFilters resets categoryId to empty array', () => {
            const {result} = renderHook(() => useTransactionFilters(), {wrapper});
            act(() => { result.current.setMultiFilter('categoryId', [CAT_1, CAT_2]); });
            act(() => { result.current.clearFilters(); });
            expect(result.current.filters.categoryId).toEqual([]);
        });

        it('setMultiFilter preserves other filters', () => {
            const {result} = renderHook(() => useTransactionFilters(), {wrapper});
            act(() => { result.current.updateFilter('search', 'coffee'); });
            act(() => { result.current.setMultiFilter('accountId', [ACC_1]); });
            expect(result.current.filters.search).toBe('coffee');
            expect(result.current.filters.accountId).toEqual([ACC_1]);
        });

        it('removes the param from URL when value is empty string', () => {
            const {result} = renderHook(() => useTransactionFilters(), {wrapper});
            act(() => { result.current.updateFilter('search', 'coffee'); });
            expect(result.current.filters.search).toBe('coffee');
            act(() => { result.current.updateFilter('search', ''); });
            expect(result.current.filters.search).toBe('');
        });
    });

    describe('URL param validation', () => {
        it('drops invalid transactionType values from URL and keeps valid ones', () => {
            const {result} = renderHook(() => useTransactionFilters(), {
                wrapper: wrapperWithUrl('/?transactionType=bogus&transactionType=income')
            });
            expect(result.current.filters.transactionType).toEqual(['income']);
        });

        it('returns empty array when all transactionType URL values are invalid', () => {
            const {result} = renderHook(() => useTransactionFilters(), {
                wrapper: wrapperWithUrl('/?transactionType=bogus&transactionType=__proto__')
            });
            expect(result.current.filters.transactionType).toEqual([]);
        });

        it('falls back to default sortField when URL value is invalid', () => {
            const {result} = renderHook(() => useTransactionFilters(), {
                wrapper: wrapperWithUrl('/?sortField=notafield')
            });
            expect(result.current.filters.sortField).toBe('date');
        });

        it('falls back to default isActive when URL value is invalid', () => {
            const {result} = renderHook(() => useTransactionFilters(), {
                wrapper: wrapperWithUrl('/?isActive=hacked')
            });
            expect(result.current.filters.isActive).toBe('true');
        });

        it('falls back to default sortDirection when URL value is invalid', () => {
            const {result} = renderHook(() => useTransactionFilters(), {
                wrapper: wrapperWithUrl('/?sortDirection=badvalue')
            });
            expect(result.current.filters.sortDirection).toBe('desc');
        });

        it('drops non-UUID categoryId values from URL and keeps valid ones', () => {
            const validUuid = '123e4567-e89b-4234-a456-426614174000';
            const {result} = renderHook(() => useTransactionFilters(), {
                wrapper: wrapperWithUrl(`/?categoryId=notauuid&categoryId=${validUuid}`)
            });
            expect(result.current.filters.categoryId).toEqual([validUuid]);
        });

        it('drops non-UUID accountId values from URL and keeps valid ones', () => {
            const validUuid = '123e4567-e89b-4567-a456-426614174000';
            const {result} = renderHook(() => useTransactionFilters(), {
                wrapper: wrapperWithUrl(`/?accountId=__proto__&accountId=${validUuid}`)
            });
            expect(result.current.filters.accountId).toEqual([validUuid]);
        });
    });
});
