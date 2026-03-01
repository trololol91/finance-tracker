import {
    describe, it, expect, vi, beforeEach
} from 'vitest';
import {
    render, screen
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {TransactionListItem} from '@features/transactions/components/TransactionListItem.js';
import type {TransactionResponseDto} from '@/api/model/transactionResponseDto.js';

const makeTx = (overrides: Partial<TransactionResponseDto> = {}): TransactionResponseDto => ({
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

/** <tr> must live inside a table/tbody to be valid HTML. */
const renderItem = (
    tx: TransactionResponseDto,
    handlers: Partial<React.ComponentProps<typeof TransactionListItem>> = {}
) =>
    render(
        <table>
            <tbody>
                <TransactionListItem
                    transaction={tx}
                    onEdit={vi.fn()}
                    onToggleActive={vi.fn()}
                    onDelete={vi.fn()}
                    {...handlers}
                />
            </tbody>
        </table>
    );

describe('TransactionListItem', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    describe('date column', () => {
        it('renders a human-readable date', () => {
            renderItem(makeTx());
            // en-CA locale → "Feb. 15, 2026" (exact text depends on runtime ICU data)
            expect(screen.getByText(/2026/)).toBeInTheDocument();
        });
    });

    describe('description column', () => {
        it('renders the description text', () => {
            renderItem(makeTx());
            expect(screen.getByText('Starbucks Coffee')).toBeInTheDocument();
        });

        it('renders notes when present', () => {
            renderItem(makeTx({notes: 'Work expense'}));
            expect(screen.getByText('Work expense')).toBeInTheDocument();
        });

        it('does not render a notes element when notes is null', () => {
            const {container} = renderItem(makeTx({notes: null}));
            expect(container.querySelector('.tx-item__notes')).toBeNull();
        });
    });

    describe('amount column', () => {
        it('prefixes expense amounts with −', () => {
            renderItem(makeTx({amount: 42.5, transactionType: 'expense'}));
            expect(screen.getByText(/^-/)).toBeInTheDocument();
        });

        it('prefixes income amounts with +', () => {
            renderItem(makeTx({amount: 1000, transactionType: 'income'}));
            expect(screen.getByText(/^\+/)).toBeInTheDocument();
        });

        it('does not prefix transfer amounts', () => {
            renderItem(makeTx({amount: 200, transactionType: 'transfer'}));
            const amountCell = screen.getByText(/200/);
            expect(amountCell.textContent).not.toMatch(/^[+-]/);
        });
    });

    describe('type badge', () => {
        it('shows the transaction type badge', () => {
            renderItem(makeTx({transactionType: 'expense'}));
            expect(screen.getByText('expense')).toBeInTheDocument();
        });

        it('shows income badge for income transactions', () => {
            renderItem(makeTx({transactionType: 'income'}));
            expect(screen.getByText('income')).toBeInTheDocument();
        });
    });

    describe('status column', () => {
        it('does not show Inactive badge for active transactions', () => {
            renderItem(makeTx({isActive: true}));
            expect(screen.queryByText('Inactive')).not.toBeInTheDocument();
        });

        it('shows Inactive badge for inactive transactions', () => {
            renderItem(makeTx({isActive: false}));
            expect(screen.getByText('Inactive')).toBeInTheDocument();
        });

        it('applies the inactive CSS class when isActive is false', () => {
            const {container} = renderItem(makeTx({isActive: false}));
            const row = container.querySelector('tr');
            expect(row).toHaveClass('tx-item--inactive');
        });

        it('does not apply the inactive CSS class when active', () => {
            const {container} = renderItem(makeTx({isActive: true}));
            const row = container.querySelector('tr');
            expect(row).not.toHaveClass('tx-item--inactive');
        });
    });

    describe('row accessibility', () => {
        it('has an aria-label describing the transaction', () => {
            const tx = makeTx({description: 'Salary', transactionType: 'income', amount: 3500});
            const {container} = renderItem(tx);
            const row = container.querySelector('tr');
            expect(row?.getAttribute('aria-label')).toMatch(/Salary/);
        });
    });

    describe('actions', () => {
        it('forwards onEdit to TransactionActions', async () => {
            const onEdit = vi.fn();
            const user = userEvent.setup();
            renderItem(makeTx(), {onEdit});
            await user.click(screen.getByRole('button', {name: /actions for starbucks/i}));
            await user.click(screen.getByRole('menuitem', {name: /edit/i}));
            expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({id: 'tx-1'}));
        });

        it('forwards onToggleActive to TransactionActions', async () => {
            const onToggleActive = vi.fn();
            const user = userEvent.setup();
            renderItem(makeTx(), {onToggleActive});
            await user.click(screen.getByRole('button', {name: /actions for starbucks/i}));
            await user.click(screen.getByRole('menuitem', {name: /mark inactive/i}));
            expect(onToggleActive).toHaveBeenCalledWith('tx-1');
        });
    });
});
