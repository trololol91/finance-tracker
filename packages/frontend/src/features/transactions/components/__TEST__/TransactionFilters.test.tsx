import {
    describe, it, expect, vi, beforeEach
} from 'vitest';
import {
    render, screen
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {TransactionFilters} from '@features/transactions/components/TransactionFilters.js';
import {TransactionsControllerFindAllIsActive} from '@/api/model/transactionsControllerFindAllIsActive.js';
import type {TransactionFilterState} from '@features/transactions/types/transaction.types.js';

const defaultFilters: TransactionFilterState = {
    startDate: '2026-02-01T00:00:00.000Z',
    endDate: '2026-02-28T23:59:59.999Z',
    transactionType: '',
    isActive: TransactionsControllerFindAllIsActive.true,
    search: '',
    page: 1,
    limit: 50
};

const defaultProps = {
    filters: defaultFilters,
    onFilterChange: vi.fn(),
    onClear: vi.fn()
};

describe('TransactionFilters', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders filter controls', () => {
        render(<TransactionFilters {...defaultProps} />);
        expect(screen.getByLabelText(/search transactions/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/type/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
    });

    it('calls onFilterChange when typing in search', async () => {
        const onFilterChange = vi.fn();
        const user = userEvent.setup();
        render(<TransactionFilters {...defaultProps} onFilterChange={onFilterChange} />);

        await user.type(screen.getByLabelText(/search transactions/i), 'coffee');
        expect(onFilterChange).toHaveBeenCalledWith('search', expect.any(String));
    });

    it('calls onFilterChange when selecting a type', async () => {
        const onFilterChange = vi.fn();
        const user = userEvent.setup();
        render(<TransactionFilters {...defaultProps} onFilterChange={onFilterChange} />);

        await user.selectOptions(screen.getByLabelText(/type/i), 'expense');
        expect(onFilterChange).toHaveBeenCalledWith('transactionType', 'expense');
    });

    it('calls onFilterChange when selecting a status', async () => {
        const onFilterChange = vi.fn();
        const user = userEvent.setup();
        render(<TransactionFilters {...defaultProps} onFilterChange={onFilterChange} />);

        await user.selectOptions(screen.getByLabelText(/status/i), 'all');
        expect(onFilterChange).toHaveBeenCalledWith('isActive', 'all');
    });

    it('calls onClear when Clear button is clicked', async () => {
        const onClear = vi.fn();
        const user = userEvent.setup();
        render(<TransactionFilters {...defaultProps} onClear={onClear} />);

        await user.click(screen.getByRole('button', {name: /clear/i}));
        expect(onClear).toHaveBeenCalled();
    });

    it('has accessible search landmark', () => {
        render(<TransactionFilters {...defaultProps} />);
        expect(screen.getByRole('search', {name: /transaction filters/i})).toBeInTheDocument();
    });
});
