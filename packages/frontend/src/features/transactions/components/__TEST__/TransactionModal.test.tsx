import {
    describe, it, expect, vi, beforeAll, beforeEach
} from 'vitest';
import {
    render, screen, fireEvent
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {TransactionModal} from '@features/transactions/components/TransactionModal.js';
import type {TransactionFormValues} from '@features/transactions/types/transaction.types.js';
import type {TransactionResponseDto} from '@/api/model/transactionResponseDto.js';

// jsdom does not implement showModal/close on HTMLDialogElement
const mockShowModal = vi.fn(function(this: HTMLDialogElement) {
    this.setAttribute('open', '');
});
const mockClose = vi.fn(function(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
});

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = mockShowModal;
    HTMLDialogElement.prototype.close = mockClose;
});

const emptyValues: TransactionFormValues = {
    amount: '',
    description: '',
    notes: '',
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
    notes: null,
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
    isOpen: true,
    editTarget: null,
    formValues: emptyValues,
    errors: {},
    isSubmitting: false,
    onFieldChange: vi.fn(),
    onSubmit: vi.fn(),
    onClose: vi.fn()
};

describe('TransactionModal', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    describe('title', () => {
        it('shows "Add Transaction" when editTarget is null', () => {
            render(<TransactionModal {...defaultProps} />);
            expect(screen.getByRole('heading', {name: 'Add Transaction'})).toBeInTheDocument();
        });

        it('shows "Edit Transaction" when editTarget is set', () => {
            render(<TransactionModal {...defaultProps} editTarget={mockTx} />);
            expect(screen.getByRole('heading', {name: 'Edit Transaction'})).toBeInTheDocument();
        });

        it('has a matching aria-label on the dialog', () => {
            render(<TransactionModal {...defaultProps} />);
            expect(screen.getByRole('dialog', {name: /add transaction/i})).toBeInTheDocument();
        });
    });

    describe('close button', () => {
        it('renders a close button', () => {
            render(<TransactionModal {...defaultProps} />);
            expect(screen.getByRole('button', {name: /close modal/i})).toBeInTheDocument();
        });

        it('calls onClose when the close button is clicked', async () => {
            const onClose = vi.fn();
            const user = userEvent.setup();
            render(<TransactionModal {...defaultProps} onClose={onClose} />);
            await user.click(screen.getByRole('button', {name: /close modal/i}));
            expect(onClose).toHaveBeenCalledOnce();
        });
    });

    describe('form content', () => {
        it('renders the amount field inside the modal', () => {
            render(<TransactionModal {...defaultProps} />);
            expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
        });

        it('renders the description field inside the modal', () => {
            render(<TransactionModal {...defaultProps} />);
            expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
        });

        it('passes field errors through to the form', () => {
            render(<TransactionModal {...defaultProps} errors={{amount: 'Amount required'}} />);
            expect(screen.getByText('Amount required')).toBeInTheDocument();
        });
    });

    describe('dialog open/close behaviour', () => {
        it('calls showModal when isOpen becomes true', () => {
            render(<TransactionModal {...defaultProps} isOpen />);
            expect(mockShowModal).toHaveBeenCalled();
        });

        it('calls close when isOpen becomes false', () => {
            const {rerender} = render(<TransactionModal {...defaultProps} isOpen />);
            rerender(<TransactionModal {...defaultProps} isOpen={false} />);
            expect(mockClose).toHaveBeenCalled();
        });

        it('fires onClose when the dialog emits a close event', () => {
            const onClose = vi.fn();
            const {container} = render(<TransactionModal {...defaultProps} onClose={onClose} />);
            const dialog = container.querySelector('dialog');
            dialog?.dispatchEvent(new Event('close'));
            expect(onClose).toHaveBeenCalledOnce();
        });

        it('does not call showModal again when dialog is already open', () => {
            const {rerender} = render(<TransactionModal {...defaultProps} isOpen />);
            mockShowModal.mockClear();
            rerender(<TransactionModal {...defaultProps} isOpen />);
            expect(mockShowModal).not.toHaveBeenCalled();
        });

        it('does not call close when dialog starts closed and isOpen is false', () => {
            render(<TransactionModal {...defaultProps} isOpen={false} />);
            expect(mockClose).not.toHaveBeenCalled();
        });

        it('calls onClose when the backdrop (dialog element) is clicked', () => {
            const onClose = vi.fn();
            const {container} = render(<TransactionModal {...defaultProps} onClose={onClose} />);
            const dialog = container.querySelector('dialog')!;
            fireEvent.click(dialog);
            expect(onClose).toHaveBeenCalledOnce();
        });

        it('does not call onClose when a child element inside the modal is clicked', () => {
            const onClose = vi.fn();
            const {container} = render(<TransactionModal {...defaultProps} onClose={onClose} />);
            const content = container.querySelector('.tx-modal__content')!;
            fireEvent.click(content);
            expect(onClose).not.toHaveBeenCalled();
        });

        it('removes the close listener on unmount', () => {
            const onClose = vi.fn();
            const {unmount, container} = render(
                <TransactionModal {...defaultProps} onClose={onClose} />
            );
            const dialog = container.querySelector('dialog')!;
            unmount();
            dialog.dispatchEvent(new Event('close'));
            expect(onClose).not.toHaveBeenCalled();
        });
    });
});
