import {
    describe, it, expect, vi, beforeAll, beforeEach
} from 'vitest';
import {
    render, screen, fireEvent, act
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

        it('computes an accessible name for the dialog from the heading text', () => {
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

    describe('accessibility (BUG-06)', () => {
        it('has aria-modal="true" on the dialog element', () => {
            render(<TransactionModal {...defaultProps} />);
            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveAttribute('aria-modal', 'true');
        });

        it('does not use aria-label on the dialog (uses aria-labelledby instead)', () => {
            render(<TransactionModal {...defaultProps} />);
            const dialog = screen.getByRole('dialog');
            expect(dialog).not.toHaveAttribute('aria-label');
        });

        it('aria-labelledby on the dialog points to the heading id', () => {
            render(<TransactionModal {...defaultProps} />);
            const dialog = screen.getByRole('dialog');
            const heading = screen.getByRole('heading', {name: /add transaction/i});
            const labelledBy = dialog.getAttribute('aria-labelledby');
            expect(labelledBy).toBeTruthy();
            expect(heading.id).toBe(labelledBy);
        });

        it('heading id changes to match "Edit Transaction" heading when editing', () => {
            render(<TransactionModal {...defaultProps} editTarget={mockTx} />);
            const dialog = screen.getByRole('dialog');
            const heading = screen.getByRole('heading', {name: /edit transaction/i});
            expect(dialog.getAttribute('aria-labelledby')).toBe(heading.id);
        });
    });

    describe('focus management (BUG-05)', () => {
        it('moves focus into the amount input when the modal opens', () => {
            vi.useFakeTimers();
            render(<TransactionModal {...defaultProps} isOpen />);
            act(() => { vi.runAllTimers(); });
            vi.useRealTimers();
            expect(screen.getByLabelText(/amount/i)).toHaveFocus();
        });

        it('does not steal focus when the modal is closed', () => {
            vi.useFakeTimers();
            render(<TransactionModal {...defaultProps} isOpen={false} />);
            act(() => { vi.runAllTimers(); });
            vi.useRealTimers();
            expect(screen.queryByLabelText(/amount/i)).not.toHaveFocus();
        });
    });

    describe('focus trap (BUG-06)', () => {
        const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

        it('wraps forward: Tab on the last focusable element moves focus to the first', () => {
            render(<TransactionModal {...defaultProps} isOpen />);
            const dialog = screen.getByRole('dialog');
            const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            last.focus();
            expect(document.activeElement).toBe(last);

            fireEvent.keyDown(last, {key: 'Tab', bubbles: true, cancelable: true});
            expect(document.activeElement).toBe(first);
        });

        it('wraps backward: Shift+Tab on the first focusable element moves focus to the last', () => {
            render(<TransactionModal {...defaultProps} isOpen />);
            const dialog = screen.getByRole('dialog');
            const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            first.focus();
            expect(document.activeElement).toBe(first);

            fireEvent.keyDown(first, {key: 'Tab', shiftKey: true, bubbles: true, cancelable: true});
            expect(document.activeElement).toBe(last);
        });

        it('does not interfere with Tab on a non-boundary element', () => {
            render(<TransactionModal {...defaultProps} isOpen />);
            const dialog = screen.getByRole('dialog');
            const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
            // Use a middle element if there are at least 3 focusable elements
            if (focusable.length < 3) return;
            const middle = focusable[1];
            middle.focus();
            const event = new KeyboardEvent('keydown', {key: 'Tab', bubbles: true, cancelable: true});
            const prevented = !dialog.dispatchEvent(event);
            expect(prevented).toBe(false); // preventDefault NOT called for a middle element
        });

        it('Shift+Tab on a non-first element does not preventDefault (no focus wrap)', () => {
            render(<TransactionModal {...defaultProps} isOpen />);
            const dialog = screen.getByRole('dialog');
            const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
            if (focusable.length < 3) return; // guard: need at least 3 elements
            const middle = focusable[1];
            middle.focus();
            expect(document.activeElement).toBe(middle);
            // Shift+Tab on a non-first element — the inner if check fails, default is NOT prevented
            const event = new KeyboardEvent('keydown', {
                key: 'Tab', shiftKey: true, bubbles: true, cancelable: true
            });
            // returns false only if preventDefault was called
            const notPrevented = dialog.dispatchEvent(event);
            expect(notPrevented).toBe(true);
            // focus should remain on the middle element (browser moves it, but jsdom does not)
            expect(document.activeElement).toBe(middle);
        });

        it('ignores non-Tab keypresses', () => {
            render(<TransactionModal {...defaultProps} isOpen />);
            const dialog = screen.getByRole('dialog');
            const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
            const last = focusable[focusable.length - 1];
            last.focus();
            // Pressing Escape should not move focus
            fireEvent.keyDown(last, {key: 'Escape', bubbles: true});
            expect(document.activeElement).toBe(last);
        });

        it('does not throw when the dialog has no focusable children', () => {
            // Render with isOpen=false then toggle — simulate edge case where
            // all inputs are somehow removed. We test by dispatching keydown
            // directly on an empty dialog clone.
            render(<TransactionModal {...defaultProps} isOpen />);
            const dialog = screen.getByRole('dialog');
            // Hide all focusable elements by disabling them
            const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
            focusable.forEach((el) => { el.setAttribute('disabled', ''); });
            expect(() => {
                fireEvent.keyDown(dialog, {key: 'Tab', bubbles: true, cancelable: true});
            }).not.toThrow();
        });
    });

    describe('dialog already open (BUG-07)', () => {
        it('does not call showModal when the dialog already has the open attribute', () => {
            const {rerender} = render(<TransactionModal {...defaultProps} isOpen />);
            // First open sets open attribute via mockShowModal
            expect(mockShowModal).toHaveBeenCalledOnce();
            mockShowModal.mockClear();
            // Rerender with isOpen still true — dialog.open is already true
            rerender(<TransactionModal {...defaultProps} isOpen />);
            expect(mockShowModal).not.toHaveBeenCalled();
        });

        it('swallows the error when showModal throws (covers catch block)', () => {
            // showModal throws — the component must not propagate the error upward
            mockShowModal.mockImplementationOnce(() => {
                throw new DOMException('Element is already in the top layer', 'InvalidStateError');
            });
            expect(() => {
                render(<TransactionModal {...defaultProps} isOpen />);
            }).not.toThrow();
        });
    });
});
