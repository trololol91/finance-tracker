import {
    describe, it, expect, vi, beforeEach
} from 'vitest';
import {
    render, screen, fireEvent
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {TransactionForm} from '@features/transactions/components/TransactionForm.js';
import type {TransactionFormValues} from '@features/transactions/types/transaction.types.js';
import type {TransactionResponseDto} from '@/api/model/transactionResponseDto.js';
import type {AccountResponseDto} from '@/api/model/accountResponseDto.js';

const emptyValues: TransactionFormValues = {
    amount: '',
    description: '',
    notes: '',
    transactionType: 'expense',
    date: '2026-02-15',
    categoryId: '',
    accountId: ''
};

const filledValues: TransactionFormValues = {
    amount: '42.50',
    description: 'Starbucks Coffee',
    notes: 'Work expense',
    transactionType: 'expense',
    date: '2026-02-15',
    categoryId: '',
    accountId: ''
};

const mockTx: TransactionResponseDto = {
    id: 'tx-1',
    userId: 'u-1',
    amount: 42.5,
    description: 'Starbucks Coffee',
    notes: 'Work expense',
    categoryId: null,
    accountId: null,
    transactionType: 'expense',
    date: '2026-02-15T12:00:00.000Z',
    originalDate: '2026-02-15T12:00:00.000Z',
    isActive: true,
    createdAt: '2026-02-15T12:00:00.000Z',
    updatedAt: '2026-02-15T12:00:00.000Z'
};

const defaultProps = {
    formValues: filledValues,
    errors: {},
    editTarget: null,
    isSubmitting: false,
    categories: [],
    onFieldChange: vi.fn(),
    onSubmit: vi.fn(),
    onCancel: vi.fn()
};

describe('TransactionForm', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    describe('create mode', () => {
        it('renders all form fields', () => {
            render(<TransactionForm {...defaultProps} />);
            expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
        });

        it('renders the type select', () => {
            render(<TransactionForm {...defaultProps} />);
            expect(screen.getByLabelText(/type \*/i)).toBeInTheDocument();
        });

        it('renders the category select', () => {
            render(<TransactionForm {...defaultProps} />);
            expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
        });

        it('category select shows "None" option by default', () => {
            render(<TransactionForm {...defaultProps} />);
            // Both category and account selects have a "None" option
            expect(screen.getAllByRole('option', {name: /none/i}).length).toBeGreaterThan(0);
        });

        it('category select shows active categories as options', () => {
            const categories = [
                {
                    id: 'cat-1', name: 'Food', color: '#ff0000', icon: null,
                    userId: 'u-1', description: null, parentId: null,
                    isActive: true, transactionCount: 0, children: [],
                    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z'
                }
            ];
            render(<TransactionForm {...defaultProps} categories={categories} />);
            expect(screen.getByRole('option', {name: 'Food'})).toBeInTheDocument();
        });

        it('excludes inactive categories from the category select', () => {
            const categories = [
                {
                    id: 'cat-1', name: 'Food', color: '#ff0000', icon: null,
                    userId: 'u-1', description: null, parentId: null,
                    isActive: true, transactionCount: 0, children: [],
                    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z'
                },
                {
                    id: 'cat-2', name: 'Hidden', color: '#000000', icon: null,
                    userId: 'u-1', description: null, parentId: null,
                    isActive: false, transactionCount: 0, children: [],
                    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z'
                }
            ];
            render(<TransactionForm {...defaultProps} categories={categories} />);
            expect(screen.getByRole('option', {name: 'Food'})).toBeInTheDocument();
            expect(screen.queryByRole('option', {name: 'Hidden'})).not.toBeInTheDocument();
        });

        it('shows "Add Transaction" on the submit button', () => {
            render(<TransactionForm {...defaultProps} />);
            expect(screen.getByRole('button', {name: /add transaction/i})).toBeInTheDocument();
        });

        it('type select is enabled in create mode', () => {
            render(<TransactionForm {...defaultProps} />);
            expect(screen.getByLabelText(/type \*/i)).not.toBeDisabled();
        });

        it('does not show the type-locked hint in create mode', () => {
            render(<TransactionForm {...defaultProps} />);
            expect(screen.queryByText(/cannot be changed/i)).not.toBeInTheDocument();
        });
    });

    describe('edit mode', () => {
        const editProps = {...defaultProps, editTarget: mockTx};

        it('shows "Save Changes" on the submit button', () => {
            render(<TransactionForm {...editProps} />);
            expect(screen.getByRole('button', {name: /save changes/i})).toBeInTheDocument();
        });

        it('type select is disabled in edit mode', () => {
            render(<TransactionForm {...editProps} />);
            expect(screen.getByLabelText(/type \*/i)).toBeDisabled();
        });

        it('shows the type-locked hint in edit mode', () => {
            render(<TransactionForm {...editProps} />);
            // Both type and account show 'cannot be changed' hints in edit mode
            expect(screen.getAllByText(/cannot be changed/i).length).toBeGreaterThan(0);
        });
    });

    describe('field values', () => {
        it('amount input reflects formValues.amount', () => {
            render(<TransactionForm {...defaultProps} />);
            expect(screen.getByLabelText(/amount/i)).toHaveValue(42.5);
        });

        it('description input reflects formValues.description', () => {
            render(<TransactionForm {...defaultProps} />);
            expect(screen.getByLabelText(/description/i)).toHaveValue('Starbucks Coffee');
        });

        it('notes textarea reflects formValues.notes', () => {
            render(<TransactionForm {...defaultProps} />);
            expect(screen.getByLabelText(/notes/i)).toHaveValue('Work expense');
        });
    });

    describe('field interactions', () => {
        it('calls onFieldChange when amount is changed', async () => {
            const onFieldChange = vi.fn();
            const user = userEvent.setup();
            const p = {...defaultProps, formValues: emptyValues, onFieldChange};
            render(<TransactionForm {...p} />);
            await user.type(screen.getByLabelText(/amount/i), '25');
            expect(onFieldChange).toHaveBeenCalledWith('amount', expect.any(String));
        });

        it('calls onFieldChange when description is changed', async () => {
            const onFieldChange = vi.fn();
            const user = userEvent.setup();
            const p = {...defaultProps, formValues: emptyValues, onFieldChange};
            render(<TransactionForm {...p} />);
            await user.type(screen.getByLabelText(/description/i), 'Lunch');
            expect(onFieldChange).toHaveBeenCalledWith('description', expect.any(String));
        });

        it('calls onFieldChange when notes is changed', async () => {
            const onFieldChange = vi.fn();
            const user = userEvent.setup();
            const p = {...defaultProps, formValues: emptyValues, onFieldChange};
            render(<TransactionForm {...p} />);
            await user.type(screen.getByLabelText(/notes/i), 'memo');
            expect(onFieldChange).toHaveBeenCalledWith('notes', expect.any(String));
        });

        it('calls onFieldChange when type select is changed', async () => {
            const onFieldChange = vi.fn();
            const user = userEvent.setup();
            const p = {...defaultProps, formValues: emptyValues, onFieldChange};
            render(<TransactionForm {...p} />);
            await user.selectOptions(screen.getByLabelText(/type \*/i), 'income');
            expect(onFieldChange).toHaveBeenCalledWith('transactionType', 'income');
        });

        it('calls onFieldChange when date is changed', () => {
            const onFieldChange = vi.fn();
            render(<TransactionForm {...defaultProps} onFieldChange={onFieldChange} />);
            fireEvent.change(screen.getByLabelText(/date/i), {target: {value: '2026-03-01'}});
            expect(onFieldChange).toHaveBeenCalledWith('date', '2026-03-01');
        });

        it('calls onCancel when Cancel button is clicked', async () => {
            const onCancel = vi.fn();
            const user = userEvent.setup();
            render(<TransactionForm {...defaultProps} onCancel={onCancel} />);
            await user.click(screen.getByRole('button', {name: /cancel/i}));
            expect(onCancel).toHaveBeenCalledOnce();
        });

        it('calls onSubmit when the form is submitted', async () => {
            const onSubmit = vi.fn((e: React.FormEvent) => { e.preventDefault(); });
            const user = userEvent.setup();
            render(<TransactionForm {...defaultProps} onSubmit={onSubmit} />);
            await user.click(screen.getByRole('button', {name: /add transaction/i}));
            expect(onSubmit).toHaveBeenCalledOnce();
        });
    });

    describe('error display', () => {
        it('shows amount error message', () => {
            render(<TransactionForm {...defaultProps} errors={{amount: 'Amount must be positive'}} />);
            expect(screen.getByText('Amount must be positive')).toBeInTheDocument();
        });

        it('shows description error message', () => {
            render(<TransactionForm {...defaultProps} errors={{description: 'Description is required'}} />);
            expect(screen.getByText('Description is required')).toBeInTheDocument();
        });

        it('shows date error message', () => {
            render(<TransactionForm {...defaultProps} errors={{date: 'Date is required'}} />);
            expect(screen.getByText('Date is required')).toBeInTheDocument();
        });
    });

    describe('submitting state', () => {
        it('disables Cancel button while submitting', () => {
            render(<TransactionForm {...defaultProps} isSubmitting />);
            expect(screen.getByRole('button', {name: /cancel/i})).toBeDisabled();
        });

        it('disables submit button while submitting', () => {
            render(<TransactionForm {...defaultProps} isSubmitting />);
            // Button renders "Loading..." text when isLoading is true
            expect(screen.getByRole('button', {name: /loading/i})).toBeDisabled();
        });
    });

    describe('account select (Phase 6)', () => {
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

        it('renders the account select', () => {
            render(<TransactionForm {...defaultProps} />);
            expect(screen.getByLabelText(/account/i)).toBeInTheDocument();
        });

        it('shows "None" option in the account select', () => {
            render(<TransactionForm {...defaultProps} />);
            // There may be multiple "None" options (category + account); at least one must exist
            expect(screen.getAllByRole('option', {name: /none/i}).length).toBeGreaterThan(0);
        });

        it('shows active accounts as options', () => {
            const accounts = [makeAccount({id: 'acc-1', name: 'Main Chequing'})];
            render(<TransactionForm {...defaultProps} accounts={accounts} />);
            expect(screen.getByRole('option', {name: 'Main Chequing'})).toBeInTheDocument();
        });

        it('excludes inactive accounts from the account select', () => {
            const accounts = [
                makeAccount({id: 'acc-1', name: 'Active Account', isActive: true}),
                makeAccount({id: 'acc-2', name: 'Closed Account', isActive: false})
            ];
            render(<TransactionForm {...defaultProps} accounts={accounts} />);
            expect(screen.getByRole('option', {name: 'Active Account'})).toBeInTheDocument();
            expect(screen.queryByRole('option', {name: 'Closed Account'})).not.toBeInTheDocument();
        });

        it('account select is enabled in create mode', () => {
            render(
                <TransactionForm
                    {...defaultProps}
                    accounts={[makeAccount()]}
                    editTarget={null}
                />
            );
            expect(screen.getByLabelText(/account/i)).not.toBeDisabled();
        });

        it('account select is disabled in edit mode', () => {
            render(
                <TransactionForm
                    {...defaultProps}
                    accounts={[makeAccount()]}
                    editTarget={mockTx}
                />
            );
            expect(screen.getByLabelText(/account/i)).toBeDisabled();
        });

        it('shows account-locked hint in edit mode', () => {
            render(
                <TransactionForm
                    {...defaultProps}
                    accounts={[makeAccount()]}
                    editTarget={mockTx}
                />
            );
            // Both type and account show cannot-change hints; at least two should appear
            const hints = screen.getAllByText(/cannot be changed/i);
            expect(hints.length).toBeGreaterThanOrEqual(2);
        });

        it('does not show account-locked hint in create mode', () => {
            render(
                <TransactionForm {...defaultProps} accounts={[makeAccount()]} editTarget={null} />
            );
            // Neither the type nor the account lock hint appears in create mode
            expect(screen.queryByText(/cannot be changed/i)).not.toBeInTheDocument();
        });

        it('calls onFieldChange with accountId when account is selected', async () => {
            const onFieldChange = vi.fn();
            const user = userEvent.setup();
            const accounts = [makeAccount({id: 'acc-1', name: 'Main Chequing'})];
            render(
                <TransactionForm
                    {...defaultProps}
                    formValues={{...filledValues, accountId: ''}}
                    accounts={accounts}
                    onFieldChange={onFieldChange}
                />
            );
            await user.selectOptions(screen.getByLabelText(/account/i), 'acc-1');
            expect(onFieldChange).toHaveBeenCalledWith('accountId', 'acc-1');
        });
    });
});
