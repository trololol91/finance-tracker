import {
    describe, it, expect, vi, beforeEach
} from 'vitest';
import {
    render, screen, within
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {TransactionFilters} from '@features/transactions/components/TransactionFilters.js';
import {TransactionsControllerFindAllIsActive} from '@/api/model/transactionsControllerFindAllIsActive.js';
import type {TransactionFilterState} from '@features/transactions/types/transaction.types.js';
import type {AccountResponseDto} from '@/api/model/accountResponseDto.js';

const defaultFilters: TransactionFilterState = {
    startDate: '2026-02-01T00:00:00.000Z',
    endDate: '2026-02-28T23:59:59.999Z',
    transactionType: [],
    isActive: TransactionsControllerFindAllIsActive.true,
    search: '',
    categoryId: [],
    accountId: [],
    page: 1,
    limit: 50,
    sortField: 'date' as const,
    sortDirection: 'desc' as const
};

const defaultProps = {
    filters: defaultFilters,
    categories: [],
    onFilterChange: vi.fn(),
    onMultiFilterChange: vi.fn(),
    onDateRangeChange: vi.fn(),
    onClear: vi.fn()
};

describe('TransactionFilters', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders filter controls', () => {
        render(<TransactionFilters {...defaultProps} />);
        expect(screen.getByLabelText(/^search$/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/type/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    });

    it('calls onMultiFilterChange with categoryId when a category is selected', async () => {
        const onMultiFilterChange = vi.fn();
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
                onMultiFilterChange={onMultiFilterChange}
            />
        );

        await user.click(screen.getByLabelText(/category/i));
        await user.click(screen.getByRole('option', {name: /food/i}));
        expect(onMultiFilterChange).toHaveBeenCalledWith('categoryId', ['cat-1']);
    });

    it('shows "All Categories" button label when no category is selected', () => {
        render(<TransactionFilters {...defaultProps} />);
        expect(screen.getByLabelText(/category/i)).toHaveTextContent('All Categories');
    });

    it('excludes inactive categories from the category dropdown', async () => {
        const user = userEvent.setup();
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
        await user.click(screen.getByLabelText(/category/i));
        expect(screen.getByRole('option', {name: /food/i})).toBeInTheDocument();
        expect(screen.queryByRole('option', {name: /hidden/i})).not.toBeInTheDocument();
    });

    it('calls onFilterChange when typing in search', async () => {
        const onFilterChange = vi.fn();
        const user = userEvent.setup();
        render(<TransactionFilters {...defaultProps} onFilterChange={onFilterChange} />);

        await user.type(screen.getByLabelText(/^search$/i), 'coffee');
        expect(onFilterChange).toHaveBeenCalledWith('search', expect.any(String));
    });

    it('calls onMultiFilterChange when selecting a type', async () => {
        const onMultiFilterChange = vi.fn();
        const user = userEvent.setup();
        render(<TransactionFilters {...defaultProps} onMultiFilterChange={onMultiFilterChange} />);

        await user.click(screen.getByLabelText(/type/i));
        await user.click(screen.getByRole('option', {name: /expense/i}));
        expect(onMultiFilterChange).toHaveBeenCalledWith('transactionType', ['expense']);
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

    describe('account filter', () => {
        const makeAccount = (overrides: Partial<AccountResponseDto> = {}): AccountResponseDto => ({
            id: 'acc-1',
            userId: 'u-1',
            name: 'Main Chequing',
            type: 'checking' as const,
            institution: 'TD Bank',
            currency: 'CAD',
            openingBalance: 0,
            currentBalance: 1000,
            transactionCount: 5,
            color: null,
            notes: null,
            isActive: true,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            ...overrides
        });

        it('renders the Account filter button', () => {
            render(<TransactionFilters {...defaultProps} />);
            expect(screen.getByLabelText(/account/i)).toBeInTheDocument();
        });

        it('shows "All Accounts" button label by default', () => {
            render(<TransactionFilters {...defaultProps} />);
            expect(screen.getByLabelText(/account/i)).toHaveTextContent('All Accounts');
        });

        it('shows active account names as options in dropdown', async () => {
            const user = userEvent.setup();
            render(
                <TransactionFilters
                    {...defaultProps}
                    accounts={[makeAccount({id: 'acc-1', name: 'Main Chequing'})]}
                />
            );
            await user.click(screen.getByLabelText(/account/i));
            expect(screen.getByRole('option', {name: 'Main Chequing'})).toBeInTheDocument();
        });

        it('excludes inactive accounts from the account dropdown', async () => {
            const user = userEvent.setup();
            const accounts = [
                makeAccount({id: 'acc-1', name: 'Main Chequing', isActive: true}),
                makeAccount({id: 'acc-2', name: 'Closed Savings', isActive: false})
            ];
            render(<TransactionFilters {...defaultProps} accounts={accounts} />);
            await user.click(screen.getByLabelText(/account/i));
            expect(screen.getByRole('option', {name: 'Main Chequing'})).toBeInTheDocument();
            expect(screen.queryByRole('option', {name: 'Closed Savings'})).not.toBeInTheDocument();
        });

        it('calls onMultiFilterChange with accountId when an account is selected', async () => {
            const onMultiFilterChange = vi.fn();
            const user = userEvent.setup();
            render(
                <TransactionFilters
                    {...defaultProps}
                    accounts={[makeAccount({id: 'acc-1', name: 'Main Chequing'})]}
                    onMultiFilterChange={onMultiFilterChange}
                />
            );
            await user.click(screen.getByLabelText(/account/i));
            await user.click(screen.getByRole('option', {name: 'Main Chequing'}));
            expect(onMultiFilterChange).toHaveBeenCalledWith('accountId', ['acc-1']);
        });

        it('shows selected count label when account is active in filter', () => {
            render(
                <TransactionFilters
                    {...defaultProps}
                    filters={{...defaultFilters, accountId: ['acc-1']}}
                    accounts={[makeAccount({id: 'acc-1', name: 'Main Chequing'})]}
                />
            );
            expect(screen.getByLabelText(/account/i)).toHaveTextContent('1 selected');
        });

        it('renders empty account dropdown (only All Accounts) when no accounts passed', async () => {
            const user = userEvent.setup();
            render(<TransactionFilters {...defaultProps} accounts={[]} />);
            await user.click(screen.getByLabelText(/account/i));
            const listbox = screen.getByRole('listbox', {name: /accounts/i});
            const options = within(listbox).getAllByRole('option');
            // Only "All Accounts" option
            expect(options).toHaveLength(1);
        });
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
