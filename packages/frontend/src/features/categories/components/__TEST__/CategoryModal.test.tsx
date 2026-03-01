import {
    describe, it, expect, vi, beforeAll, beforeEach
} from 'vitest';
import {
    render, screen, fireEvent
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {CategoryModal} from '@features/categories/components/CategoryModal.js';
import type {
    CategoryFormValues, CategoryFormErrors
} from '@features/categories/types/category.types.js';

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

const emptyValues: CategoryFormValues = {
    name: '',
    description: '',
    color: '',
    icon: '',
    parentId: ''
};

const defaultProps = {
    mode: 'create' as const,
    values: emptyValues,
    errors: {} as CategoryFormErrors,
    isSubmitting: false,
    parentOptions: [],
    onClose: vi.fn(),
    onChange: vi.fn(),
    onSubmit: vi.fn()
};

describe('CategoryModal', () => {
    beforeEach(() => { vi.clearAllMocks(); mockShowModal.mockClear(); mockClose.mockClear(); });

    describe('title', () => {
        it('shows "New Category" when mode is create', () => {
            render(<CategoryModal {...defaultProps} mode="create" />);
            expect(screen.getByRole('heading', {name: 'New Category'})).toBeInTheDocument();
        });

        it('shows "Edit Category" when mode is edit', () => {
            render(<CategoryModal {...defaultProps} mode="edit" />);
            expect(screen.getByRole('heading', {name: 'Edit Category'})).toBeInTheDocument();
        });

        it('has an accessible dialog label derived from the heading', () => {
            render(<CategoryModal {...defaultProps} mode="create" />);
            expect(screen.getByRole('dialog', {name: /new category/i})).toBeInTheDocument();
        });
    });

    describe('open / close', () => {
        it('calls showModal when mode is non-null', () => {
            render(<CategoryModal {...defaultProps} mode="create" />);
            expect(mockShowModal).toHaveBeenCalled();
        });

        it('renders the close button', () => {
            render(<CategoryModal {...defaultProps} />);
            expect(screen.getByRole('button', {name: /close dialog/i})).toBeInTheDocument();
        });

        it('calls onClose when the close button is clicked', async () => {
            const onClose = vi.fn();
            const user = userEvent.setup();
            render(<CategoryModal {...defaultProps} onClose={onClose} />);
            await user.click(screen.getByRole('button', {name: /close dialog/i}));
            expect(onClose).toHaveBeenCalledOnce();
        });
    });

    describe('aria attributes', () => {
        it('has aria-modal="true"', () => {
            render(<CategoryModal {...defaultProps} />);
            expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
        });

        it('has aria-labelledby pointing to the heading', () => {
            render(<CategoryModal {...defaultProps} />);
            const dialog = screen.getByRole('dialog');
            const labelledBy = dialog.getAttribute('aria-labelledby');
            expect(labelledBy).toBeTruthy();
            const heading = document.getElementById(labelledBy!);
            expect(heading).toBeInTheDocument();
            expect(heading?.textContent).toMatch(/new category/i);
        });
    });

    describe('form integration', () => {
        it('renders the name input inside the modal', () => {
            render(<CategoryModal {...defaultProps} />);
            expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
        });

        it('renders the submit button inside the modal', () => {
            render(<CategoryModal {...defaultProps} />);
            expect(screen.getByRole('button', {name: /create category/i})).toBeInTheDocument();
        });

        it('renders "Save Changes" button in edit mode', () => {
            render(<CategoryModal {...defaultProps} mode="edit" />);
            expect(screen.getByRole('button', {name: /save changes/i})).toBeInTheDocument();
        });

        it('passes isSubmitting to the form — disables submit when true', () => {
            render(<CategoryModal {...defaultProps} isSubmitting />);
            expect(screen.getByRole('button', {name: /saving/i})).toBeDisabled();
        });
    });

    describe('keyboard', () => {
        it('closes when Escape key is pressed', () => {
            const onClose = vi.fn();
            render(<CategoryModal {...defaultProps} onClose={onClose} />);
            fireEvent.keyDown(screen.getByRole('dialog'), {key: 'Escape', code: 'Escape'});
            expect(onClose).toHaveBeenCalled();
        });

        it('does not close on unrelated key press', () => {
            const onClose = vi.fn();
            render(<CategoryModal {...defaultProps} onClose={onClose} />);
            fireEvent.keyDown(screen.getByRole('dialog'), {key: 'Enter', code: 'Enter'});
            expect(onClose).not.toHaveBeenCalled();
        });

        it('handles Tab key without error when focusable elements exist', () => {
            render(<CategoryModal {...defaultProps} />);
            // Should not throw
            expect(() => {
                fireEvent.keyDown(screen.getByRole('dialog'), {key: 'Tab', code: 'Tab'});
            }).not.toThrow();
        });

        it('handles Shift+Tab key without error', () => {
            render(<CategoryModal {...defaultProps} />);
            expect(() => {
                fireEvent.keyDown(screen.getByRole('dialog'), {key: 'Tab', code: 'Tab', shiftKey: true});
            }).not.toThrow();
        });
    });

    describe('closed state (mode=null)', () => {
        it('does not call showModal when mode is null', () => {
            mockShowModal.mockClear();
            render(<CategoryModal {...defaultProps} mode={null} />);
            expect(mockShowModal).not.toHaveBeenCalled();
        });
    });

    describe('backdrop click', () => {
        it('calls onClose when backdrop is clicked', () => {
            const onClose = vi.fn();
            render(<CategoryModal {...defaultProps} onClose={onClose} />);
            // Fire a click on the dialog element itself (simulates backdrop click)
            fireEvent.click(screen.getByRole('dialog'));
            expect(onClose).toHaveBeenCalled();
        });
    });

    describe('focus restoration', () => {
        let triggerBtn: HTMLButtonElement;

        beforeEach(() => {
            triggerBtn = document.createElement('button');
            triggerBtn.textContent = 'Open';
            document.body.appendChild(triggerBtn);
        });

        afterEach(() => {
            triggerBtn.remove();
        });

        it('restores focus to the element that triggered the modal when closed', () => {
            triggerBtn.focus();
            expect(document.activeElement).toBe(triggerBtn);

            // Open the modal — useEffect captures document.activeElement (triggerBtn)
            const {rerender} = render(<CategoryModal {...defaultProps} mode="create" />);

            // Close the modal — restore-focus effect should call triggerBtn.focus()
            rerender(<CategoryModal {...defaultProps} mode={null} />);

            expect(document.activeElement).toBe(triggerBtn);
        });

        it('does not throw when there is no trigger element to restore focus to', () => {
            // Start with nothing focused (activeElement = body)
            const {rerender} = render(<CategoryModal {...defaultProps} mode="create" />);
            // Close — triggerRef.current is document.body which is an HTMLElement;
            // focus() on body is a no-op in jsdom but must not throw.
            expect(() => {
                rerender(<CategoryModal {...defaultProps} mode={null} />);
            }).not.toThrow();
        });
    });
});
