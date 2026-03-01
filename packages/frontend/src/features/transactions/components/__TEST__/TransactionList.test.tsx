import {
    describe, it, expect, vi
} from 'vitest';
import {
    render, screen
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {TransactionList} from '@features/transactions/components/TransactionList.js';
import type {TransactionResponseDto} from '@/api/model/transactionResponseDto.js';

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
    onDelete: vi.fn()
};

describe('TransactionList', () => {
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
});
