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
});
