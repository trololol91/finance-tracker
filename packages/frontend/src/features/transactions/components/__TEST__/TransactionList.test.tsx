import {
    describe, it, expect, vi, beforeEach
} from 'vitest';
import {
    render, screen, within
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {TransactionList} from '@features/transactions/components/TransactionList.js';
import type {TransactionResponseDto} from '@/api/model/transactionResponseDto.js';
import {TransactionsControllerFindAllSortField} from '@/api/model/transactionsControllerFindAllSortField.js';
import {TransactionsControllerFindAllSortDirection} from '@/api/model/transactionsControllerFindAllSortDirection.js';

const mockTx = (overrides: Partial<TransactionResponseDto> = {}): TransactionResponseDto => ({
    id: 'tx-1',
    userId: 'user-1',
    amount: 42.5,
    description: 'Starbucks Coffee',
    notes: null,
    categoryId: null,
    accountId: null,
    transactionType: 'expense',
    date: '2026-02-15T12:00:00.000Z',
    originalDate: '2026-02-15T12:00:00.000Z',
    isActive: true,
    isPending: false,
    createdAt: '2026-02-15T12:00:00.000Z',
    updatedAt: '2026-02-15T12:00:00.000Z',
    ...overrides
});

const defaultProps = {
    transactions: [mockTx()],
    isLoading: false,
    isError: false,
    onEdit: vi.fn(),
    onToggleActive: vi.fn(),
    onDelete: vi.fn(),
    sortField: TransactionsControllerFindAllSortField.date,
    sortDirection: TransactionsControllerFindAllSortDirection.desc,
    onSort: vi.fn()
};

describe('TransactionList', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the table with transactions', () => {
        render(<TransactionList {...defaultProps} />);
        expect(screen.getByRole('table', {name: /transactions/i})).toBeInTheDocument();
        expect(screen.getByText('Starbucks Coffee')).toBeInTheDocument();
    });

    it('shows loading state', () => {
        render(<TransactionList {...defaultProps} transactions={[]} isLoading />);
        expect(screen.getByText(/loading transactions/i)).toBeInTheDocument();
    });

    it('shows error state', () => {
        render(<TransactionList {...defaultProps} transactions={[]} isError />);
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });

    it('shows empty state when no transactions', () => {
        render(<TransactionList {...defaultProps} transactions={[]} />);
        expect(screen.getByText(/no transactions found/i)).toBeInTheDocument();
    });

    it('renders all table column headers', () => {
        render(<TransactionList {...defaultProps} />);
        expect(screen.getByRole('columnheader', {name: /date/i})).toBeInTheDocument();
        expect(screen.getByRole('columnheader', {name: /description/i})).toBeInTheDocument();
        expect(screen.getByRole('columnheader', {name: /amount/i})).toBeInTheDocument();
        expect(screen.getByRole('columnheader', {name: /type/i})).toBeInTheDocument();
    });

    it('handles actions for transactions', async () => {
        const onEdit = vi.fn();
        const user = userEvent.setup();
        render(<TransactionList {...defaultProps} onEdit={onEdit} />);

        // Open actions menu
        const actionBtn = screen.getByRole('button', {name: /actions for starbucks/i});
        await user.click(actionBtn);

        // Click Edit
        await user.click(screen.getByRole('menuitem', {name: /edit/i}));
        expect(onEdit).toHaveBeenCalledWith(defaultProps.transactions[0]);
    });

    it('renders multiple transactions', () => {
        const transactions = [
            mockTx({id: 'tx-1', description: 'Starbucks'}),
            mockTx({id: 'tx-2', description: 'Netflix', transactionType: 'expense', amount: 15.99}),
            mockTx({id: 'tx-3', description: 'Salary', transactionType: 'income', amount: 3500})
        ];
        render(<TransactionList {...defaultProps} transactions={transactions} />);
        expect(screen.getByText('Starbucks')).toBeInTheDocument();
        expect(screen.getByText('Netflix')).toBeInTheDocument();
        expect(screen.getByText('Salary')).toBeInTheDocument();
    });

    describe('SortButton — sort header interactions', () => {
        it('clicking the active sort column (desc) toggles direction to asc', async () => {
            const onSort = vi.fn();
            const user = userEvent.setup();
            render(
                <TransactionList
                    {...defaultProps}
                    onSort={onSort}
                    sortField={TransactionsControllerFindAllSortField.date}
                    sortDirection={TransactionsControllerFindAllSortDirection.desc}
                />
            );
            // The Date column header contains a sort button
            const dateTh = screen.getByRole('columnheader', {name: /date/i});
            const btn = within(dateTh).getByRole('button');
            await user.click(btn);
            expect(onSort).toHaveBeenCalledWith(
                TransactionsControllerFindAllSortField.date,
                TransactionsControllerFindAllSortDirection.asc
            );
        });

        it('clicking the active sort column (asc) toggles direction to desc', async () => {
            const onSort = vi.fn();
            const user = userEvent.setup();
            render(
                <TransactionList
                    {...defaultProps}
                    onSort={onSort}
                    sortField={TransactionsControllerFindAllSortField.date}
                    sortDirection={TransactionsControllerFindAllSortDirection.asc}
                />
            );
            const dateTh = screen.getByRole('columnheader', {name: /date/i});
            const btn = within(dateTh).getByRole('button');
            await user.click(btn);
            expect(onSort).toHaveBeenCalledWith(
                TransactionsControllerFindAllSortField.date,
                TransactionsControllerFindAllSortDirection.desc
            );
        });

        it('clicking an inactive sort column calls onSort with that field and desc', async () => {
            const onSort = vi.fn();
            const user = userEvent.setup();
            render(
                <TransactionList
                    {...defaultProps}
                    onSort={onSort}
                    sortField={TransactionsControllerFindAllSortField.date}
                    sortDirection={TransactionsControllerFindAllSortDirection.desc}
                />
            );
            const descTh = screen.getByRole('columnheader', {name: /description/i});
            const btn = within(descTh).getByRole('button');
            await user.click(btn);
            expect(onSort).toHaveBeenCalledWith(
                TransactionsControllerFindAllSortField.description,
                TransactionsControllerFindAllSortDirection.desc
            );
        });

        it('active asc column shows ↑ icon', () => {
            render(
                <TransactionList
                    {...defaultProps}
                    sortField={TransactionsControllerFindAllSortField.date}
                    sortDirection={TransactionsControllerFindAllSortDirection.asc}
                />
            );
            const dateTh = screen.getByRole('columnheader', {name: /date/i});
            expect(within(dateTh).getByText('↑')).toBeInTheDocument();
        });

        it('active desc column shows ↓ icon', () => {
            render(
                <TransactionList
                    {...defaultProps}
                    sortField={TransactionsControllerFindAllSortField.date}
                    sortDirection={TransactionsControllerFindAllSortDirection.desc}
                />
            );
            const dateTh = screen.getByRole('columnheader', {name: /date/i});
            expect(within(dateTh).getByText('↓')).toBeInTheDocument();
        });

        it('inactive columns show ↕ icon', () => {
            render(
                <TransactionList
                    {...defaultProps}
                    sortField={TransactionsControllerFindAllSortField.date}
                    sortDirection={TransactionsControllerFindAllSortDirection.desc}
                />
            );
            // Description and Amount are inactive when Date is the active sort field
            const descTh = screen.getByRole('columnheader', {name: /description/i});
            expect(within(descTh).getByText('↕')).toBeInTheDocument();
            const amountTh = screen.getByRole('columnheader', {name: /amount/i});
            expect(within(amountTh).getByText('↕')).toBeInTheDocument();
        });

        it('active asc column header has aria-sort="ascending"', () => {
            render(
                <TransactionList
                    {...defaultProps}
                    sortField={TransactionsControllerFindAllSortField.date}
                    sortDirection={TransactionsControllerFindAllSortDirection.asc}
                />
            );
            const dateTh = screen.getByRole('columnheader', {name: /date/i});
            expect(dateTh).toHaveAttribute('aria-sort', 'ascending');
        });

        it('active desc column header has aria-sort="descending"', () => {
            render(
                <TransactionList
                    {...defaultProps}
                    sortField={TransactionsControllerFindAllSortField.date}
                    sortDirection={TransactionsControllerFindAllSortDirection.desc}
                />
            );
            const dateTh = screen.getByRole('columnheader', {name: /date/i});
            expect(dateTh).toHaveAttribute('aria-sort', 'descending');
        });

        it('inactive column headers do not have aria-sort attribute', () => {
            render(
                <TransactionList
                    {...defaultProps}
                    sortField={TransactionsControllerFindAllSortField.date}
                    sortDirection={TransactionsControllerFindAllSortDirection.desc}
                />
            );
            const descTh = screen.getByRole('columnheader', {name: /description/i});
            expect(descTh).not.toHaveAttribute('aria-sort');
        });

        it('Amount column header has tx-list__th--right class', () => {
            render(<TransactionList {...defaultProps} />);
            const amountTh = screen.getByRole('columnheader', {name: /amount/i});
            expect(amountTh).toHaveClass('tx-list__th--right');
        });
    });

    describe('mobile sort bar', () => {
        it('mobile sort field select calls onSort with new field and current direction', async () => {
            const onSort = vi.fn();
            const user = userEvent.setup();
            render(
                <TransactionList
                    {...defaultProps}
                    onSort={onSort}
                    sortField={TransactionsControllerFindAllSortField.date}
                    sortDirection={TransactionsControllerFindAllSortDirection.desc}
                />
            );
            const fieldSelect = screen.getByRole('combobox', {name: /sort by/i});
            await user.selectOptions(fieldSelect, TransactionsControllerFindAllSortField.amount);
            expect(onSort).toHaveBeenCalledWith(
                TransactionsControllerFindAllSortField.amount,
                TransactionsControllerFindAllSortDirection.desc
            );
        });

        it('mobile sort direction select calls onSort with current field and new direction', async () => {
            const onSort = vi.fn();
            const user = userEvent.setup();
            render(
                <TransactionList
                    {...defaultProps}
                    onSort={onSort}
                    sortField={TransactionsControllerFindAllSortField.amount}
                    sortDirection={TransactionsControllerFindAllSortDirection.desc}
                />
            );
            const dirSelect = screen.getByRole('combobox', {name: /sort direction/i});
            await user.selectOptions(dirSelect, TransactionsControllerFindAllSortDirection.asc);
            expect(onSort).toHaveBeenCalledWith(
                TransactionsControllerFindAllSortField.amount,
                TransactionsControllerFindAllSortDirection.asc
            );
        });
    });
});
