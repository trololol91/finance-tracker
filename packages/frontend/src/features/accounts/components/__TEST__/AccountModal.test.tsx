import {
    describe, it, expect, vi, beforeAll, beforeEach
} from 'vitest';
import {
    render, screen, fireEvent
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {AccountModal} from '@features/accounts/components/AccountModal.js';
import type {
    AccountFormValues, AccountFormErrors
} from '@features/accounts/types/account.types.js';
import {CreateAccountDtoType} from '@/api/model/createAccountDtoType.js';

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

const emptyValues: AccountFormValues = {
    name: '',
    type: CreateAccountDtoType.checking,
    institution: '',
    currency: 'CAD',
    openingBalance: '0',
    color: '',
    notes: '',
    isActive: true
};

const defaultProps = {
    mode: 'create' as const,
    values: emptyValues,
    errors: {} as AccountFormErrors,
    isSubmitting: false,
    onClose: vi.fn(),
    onChange: vi.fn(),
    onSubmit: vi.fn()
};

describe('AccountModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockShowModal.mockClear();
        mockClose.mockClear();
    });

    describe('title', () => {
        it('shows "New Account" when mode is create', () => {
            render(<AccountModal {...defaultProps} mode="create" />);
            expect(screen.getByRole('heading', {name: 'New Account'})).toBeInTheDocument();
        });

        it('shows "Edit Account" when mode is edit', () => {
            render(<AccountModal {...defaultProps} mode="edit" />);
            expect(screen.getByRole('heading', {name: 'Edit Account'})).toBeInTheDocument();
        });

        it('has an accessible dialog label derived from the heading', () => {
            render(<AccountModal {...defaultProps} mode="create" />);
            expect(screen.getByRole('dialog', {name: /new account/i})).toBeInTheDocument();
        });
    });

    describe('open / close', () => {
        it('calls showModal when mode is non-null', () => {
            render(<AccountModal {...defaultProps} mode="create" />);
            expect(mockShowModal).toHaveBeenCalled();
        });

        it('renders the close button', () => {
            render(<AccountModal {...defaultProps} />);
            expect(screen.getByRole('button', {name: /close dialog/i})).toBeInTheDocument();
        });

        it('calls onClose when the close button is clicked', async () => {
            const onClose = vi.fn();
            const user = userEvent.setup();
            render(<AccountModal {...defaultProps} onClose={onClose} />);
            await user.click(screen.getByRole('button', {name: /close dialog/i}));
            expect(onClose).toHaveBeenCalledOnce();
        });

        it('calls onClose when native dialog close event fires', () => {
            const onClose = vi.fn();
            render(<AccountModal {...defaultProps} onClose={onClose} />);
            // Trigger native close event
            const dialog = screen.getByRole('dialog');
            dialog.dispatchEvent(new Event('close'));
            expect(onClose).toHaveBeenCalled();
        });
    });

    describe('aria attributes', () => {
        it('has aria-modal="true"', () => {
            render(<AccountModal {...defaultProps} />);
            expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
        });

        it('has aria-labelledby pointing to the heading', () => {
            render(<AccountModal {...defaultProps} />);
            const dialog = screen.getByRole('dialog');
            const labelledBy = dialog.getAttribute('aria-labelledby');
            expect(labelledBy).toBeTruthy();
            const heading = document.getElementById(labelledBy!);
            expect(heading).toBeInTheDocument();
            expect(heading?.textContent).toMatch(/new account/i);
        });
    });

    describe('form integration', () => {
        it('renders the name input inside the modal', () => {
            render(<AccountModal {...defaultProps} />);
            expect(screen.getByLabelText(/account name/i)).toBeInTheDocument();
        });

        it('renders the submit button inside the modal', () => {
            render(<AccountModal {...defaultProps} />);
            expect(screen.getByRole('button', {name: /create account/i})).toBeInTheDocument();
        });

        it('renders "Save Changes" button in edit mode', () => {
            render(<AccountModal {...defaultProps} mode="edit" />);
            expect(screen.getByRole('button', {name: /save changes/i})).toBeInTheDocument();
        });

        it('passes isSubmitting to the form — disables submit when true', () => {
            render(<AccountModal {...defaultProps} isSubmitting />);
            expect(screen.getByRole('button', {name: /saving/i})).toBeDisabled();
        });

        it('shows validation errors inside the modal', () => {
            const errors: AccountFormErrors = {name: 'Name is required'};
            render(<AccountModal {...defaultProps} errors={errors} />);
            expect(screen.getByText('Name is required')).toBeInTheDocument();
        });
    });

    describe('Escape key', () => {
        it('calls onClose when Escape keydown fires on the dialog', () => {
            const onClose = vi.fn();
            render(<AccountModal {...defaultProps} onClose={onClose} />);
            const dialog = screen.getByRole('dialog');
            dialog.dispatchEvent(
                new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})
            );
            expect(onClose).toHaveBeenCalled();
        });
    });

    describe('backdrop click', () => {
        it('calls onClose when clicking directly on the dialog backdrop', () => {
            const onClose = vi.fn();
            const {container} = render(<AccountModal {...defaultProps} onClose={onClose} />);
            const dialog = container.querySelector('dialog')!;
            // Simulate a click where the target IS the dialog element (backdrop)
            Object.defineProperty(new MouseEvent('click'), 'target', {value: dialog});
            fireEvent.click(dialog, {target: dialog});
            expect(onClose).toHaveBeenCalled();
        });

        it('does not call onClose when clicking inside the content area', () => {
            const onClose = vi.fn();
            render(<AccountModal {...defaultProps} onClose={onClose} />);
            const heading = screen.getByRole('heading', {name: /new account/i});
            fireEvent.click(heading);
            expect(onClose).not.toHaveBeenCalled();
        });
    });

    describe('Tab key focus trap', () => {
        it('does not throw when Tab is pressed inside the dialog', () => {
            render(<AccountModal {...defaultProps} />);
            const dialog = screen.getByRole('dialog');
            expect(() => {
                dialog.dispatchEvent(
                    new KeyboardEvent('keydown', {key: 'Tab', bubbles: true})
                );
            }).not.toThrow();
        });

        it('does not throw when Shift+Tab is pressed inside the dialog', () => {
            render(<AccountModal {...defaultProps} />);
            const dialog = screen.getByRole('dialog');
            expect(() => {
                dialog.dispatchEvent(
                    new KeyboardEvent('keydown', {key: 'Tab', shiftKey: true, bubbles: true})
                );
            }).not.toThrow();
        });

        it('ignores non-Tab non-Escape keystrokes', () => {
            const onClose = vi.fn();
            render(<AccountModal {...defaultProps} onClose={onClose} />);
            const dialog = screen.getByRole('dialog');
            dialog.dispatchEvent(
                new KeyboardEvent('keydown', {key: 'Enter', bubbles: true})
            );
            expect(onClose).not.toHaveBeenCalled();
        });
    });
});
