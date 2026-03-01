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
    categoryId: '',
    page: 1,
    limit: 50
};

const defaultProps = {
    filters: defaultFilters,
    categories: [],
    onFilterChange: vi.fn(),
    onDateRangeChange: vi.fn(),
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
        expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    });

    it('calls onFilterChange with categoryId when a category is selected', async () => {
        const onFilterChange = vi.fn();
        const user = userEvent.setup();
        const categories = [
            {
                id: 'cat-1', name: 'Food', color: '#ff0000', icon: '🍔',
                userId: 'u-1', description: null, parentId: null,
                isActive: true, transactionCount: 5, children: [],
                createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z'
            }
        ];
        render(
            <TransactionFilters
                {...defaultProps}
                categories={categories}
                onFilterChange={onFilterChange}
            />
        );

        await user.selectOptions(screen.getByLabelText(/category/i), 'cat-1');
        expect(onFilterChange).toHaveBeenCalledWith('categoryId', 'cat-1');
    });

    it('shows "All Categories" option when no category is selected', () => {
        render(<TransactionFilters {...defaultProps} />);
        expect(screen.getByRole('option', {name: /all categories/i})).toBeInTheDocument();
    });

    it('excludes inactive categories from the category dropdown', () => {
        const categories = [
            {
                id: 'cat-1', name: 'Food', color: '#ff0000', icon: null,
                userId: 'u-1', description: null, parentId: null,
                isActive: true, transactionCount: 5, children: [],
                createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z'
            },
            {
                id: 'cat-2', name: 'Hidden', color: '#000000', icon: null,
                userId: 'u-1', description: null, parentId: null,
                isActive: false, transactionCount: 0, children: [],
                createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z'
            }
        ];
        render(<TransactionFilters {...defaultProps} categories={categories} />);
        expect(screen.getByRole('option', {name: /food/i})).toBeInTheDocument();
        expect(screen.queryByRole('option', {name: /hidden/i})).not.toBeInTheDocument();
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

    describe('onDateRangeChange (BUG-02)', () => {
        it('calls onDateRangeChange with startDate and endDate when a date preset is clicked', async () => {
            const onDateRangeChange = vi.fn();
            const user = userEvent.setup();
            render(<TransactionFilters {...defaultProps} onDateRangeChange={onDateRangeChange} />);

            await user.click(screen.getByRole('button', {name: /this month/i}));

            expect(onDateRangeChange).toHaveBeenCalledOnce();
            const [start, end] = onDateRangeChange.mock.calls[0] as [string, string];
            expect(typeof start).toBe('string');
            expect(typeof end).toBe('string');
        });

        it('passes UTC-midnight startDate when a preset is clicked', async () => {
            const onDateRangeChange = vi.fn();
            const user = userEvent.setup();
            render(<TransactionFilters {...defaultProps} onDateRangeChange={onDateRangeChange} />);

            await user.click(screen.getByRole('button', {name: /this month/i}));

            const [start] = onDateRangeChange.mock.calls[0] as [string, string];
            expect(start).toMatch(/T00:00:00\.000Z$/);
        });

        it('does not call onFilterChange with startDate or endDate keys when a preset is used', async () => {
            const onFilterChange = vi.fn();
            const user = userEvent.setup();
            render(
                <TransactionFilters
                    {...defaultProps}
                    onFilterChange={onFilterChange}
                />
            );

            await user.click(screen.getByRole('button', {name: /this month/i}));

            const calledKeys = (onFilterChange.mock.calls as [string, unknown][][]).map(
                ([key]) => key
            );
            expect(calledKeys).not.toContain('startDate');
            expect(calledKeys).not.toContain('endDate');
        });
    });
});
