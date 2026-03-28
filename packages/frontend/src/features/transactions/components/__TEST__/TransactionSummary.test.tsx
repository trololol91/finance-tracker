import {
    describe, it, expect, vi, beforeEach
} from 'vitest';
import {
    render, screen
} from '@testing-library/react';
import {TransactionSummary} from '@features/transactions/components/TransactionSummary.js';

// Mock the Orval hook
vi.mock('@/api/transactions/transactions.js', () => ({
    useTransactionsControllerGetTotals: vi.fn()
}));

import {useTransactionsControllerGetTotals} from '@/api/transactions/transactions.js';

const mockUseTotals = vi.mocked(useTransactionsControllerGetTotals);

describe('TransactionSummary', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders totals from the API', () => {
        mockUseTotals.mockReturnValue({
            data: {totalIncome: 3500, totalExpense: 1234.56, netTotal: 2265.44, startDate: '', endDate: ''},
            isLoading: false,
            isError: false
        } as ReturnType<typeof useTransactionsControllerGetTotals>);

        render(<TransactionSummary startDate="2026-02-01T00:00:00Z" endDate="2026-02-28T23:59:59Z" />);

        expect(screen.getByText('Income')).toBeInTheDocument();
        expect(screen.getByText('Expenses')).toBeInTheDocument();
        expect(screen.getByText('Net')).toBeInTheDocument();
    });

    it('shows loading state', () => {
        mockUseTotals.mockReturnValue({
            data: undefined,
            isLoading: true
        } as ReturnType<typeof useTransactionsControllerGetTotals>);

        render(<TransactionSummary startDate="2026-02-01T00:00:00Z" endDate="2026-02-28T23:59:59Z" />);

        expect(screen.getByText(/loading totals/i)).toBeInTheDocument();
    });

    it('shows zeros when no data', () => {
        mockUseTotals.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: false
        } as ReturnType<typeof useTransactionsControllerGetTotals>);

        render(<TransactionSummary startDate="2026-02-01T00:00:00Z" endDate="2026-02-28T23:59:59Z" />);

        // With no data, should show $0 values
        const values = screen.getAllByText(/\$0\.00/);
        expect(values.length).toBeGreaterThan(0);
    });

    it('shows error state', () => {
        mockUseTotals.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true
        } as ReturnType<typeof useTransactionsControllerGetTotals>);

        render(<TransactionSummary startDate="2026-02-01T00:00:00Z" endDate="2026-02-28T23:59:59Z" />);

        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/could not load totals/i)).toBeInTheDocument();
    });

    it('has accessible region label', () => {
        mockUseTotals.mockReturnValue({
            data: {totalIncome: 0, totalExpense: 0, netTotal: 0, startDate: '', endDate: ''},
            isLoading: false
        } as ReturnType<typeof useTransactionsControllerGetTotals>);

        render(<TransactionSummary startDate="2026-02-01T00:00:00Z" endDate="2026-02-28T23:59:59Z" />);

        expect(screen.getByRole('region', {name: /transaction totals/i})).toBeInTheDocument();
    });
});
