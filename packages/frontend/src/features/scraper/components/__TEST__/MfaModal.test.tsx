import {
    describe, it, expect, vi, beforeAll, beforeEach
} from 'vitest';
import {
    render, screen, fireEvent
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MfaModal} from '@features/scraper/components/MfaModal.js';

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

const defaultProps = {
    isOpen: true,
    challenge: 'Enter the code from your authenticator',
    isSubmitting: false,
    onSubmit: vi.fn(),
    onCancel: vi.fn()
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe('MfaModal', () => {
    describe('closed state', () => {
        it('shows dialog but not open when isOpen is false', () => {
            const {container} = render(<MfaModal {...defaultProps} isOpen={false} />);
            const dialog = container.querySelector('dialog');
            expect(dialog).toBeInTheDocument();
            expect(dialog?.hasAttribute('open')).toBe(false);
        });
    });

    describe('open state', () => {
        it('shows the heading "MFA Required"', () => {
            render(<MfaModal {...defaultProps} />);
            expect(screen.getByRole('heading', {name: /mfa required/i})).toBeInTheDocument();
        });

        it('shows the challenge text', () => {
            render(<MfaModal {...defaultProps} challenge="Enter OTP from bank" />);
            expect(screen.getByText('Enter OTP from bank')).toBeInTheDocument();
        });

        it('does not show challenge area when challenge is empty', () => {
            render(<MfaModal {...defaultProps} challenge="" />);
            expect(screen.queryByText('Enter the code from your authenticator')).not.toBeInTheDocument();
        });

        it('has a code input field', () => {
            render(<MfaModal {...defaultProps} />);
            expect(screen.getByLabelText(/authentication code/i)).toBeInTheDocument();
        });

        it('has a Submit Code button', () => {
            render(<MfaModal {...defaultProps} />);
            expect(screen.getByRole('button', {name: /submit code/i})).toBeInTheDocument();
        });

        it('has a Cancel button', () => {
            render(<MfaModal {...defaultProps} />);
            expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
        });

        it('has aria-modal="true"', () => {
            const {container} = render(<MfaModal {...defaultProps} />);
            expect(container.querySelector('[aria-modal="true"]')).toBeInTheDocument();
        });

        it('shows "Submitting…" on button when isSubmitting', () => {
            render(<MfaModal {...defaultProps} isSubmitting={true} />);
            expect(screen.getByRole('button', {name: /submitting/i})).toBeInTheDocument();
        });

        it('disables submit button when isSubmitting', () => {
            render(<MfaModal {...defaultProps} isSubmitting={true} />);
            expect(screen.getByRole('button', {name: /submitting/i})).toBeDisabled();
        });
    });

    describe('interactions', () => {
        it('calls onCancel when Cancel button clicked', async () => {
            const user = userEvent.setup();
            const onCancel = vi.fn();
            render(<MfaModal {...defaultProps} onCancel={onCancel} />);
            await user.click(screen.getByRole('button', {name: 'Cancel'}));
            expect(onCancel).toHaveBeenCalledOnce();
        });

        it('calls onCancel when close (✕) button clicked', async () => {
            const user = userEvent.setup();
            const onCancel = vi.fn();
            render(<MfaModal {...defaultProps} onCancel={onCancel} />);
            await user.click(screen.getByRole('button', {name: /cancel mfa/i}));
            expect(onCancel).toHaveBeenCalledOnce();
        });

        it('shows validation error when submitting empty code', async () => {
            const user = userEvent.setup();
            render(<MfaModal {...defaultProps} />);
            await user.click(screen.getByRole('button', {name: /submit code/i}));
            expect(screen.getByRole('alert')).toBeInTheDocument();
            expect(screen.getByText(/mfa code is required/i)).toBeInTheDocument();
        });

        it('calls onSubmit with trimmed code when valid', async () => {
            const user = userEvent.setup();
            const onSubmit = vi.fn();
            render(<MfaModal {...defaultProps} onSubmit={onSubmit} />);
            await user.type(screen.getByLabelText(/authentication code/i), '  123456  ');
            await user.click(screen.getByRole('button', {name: /submit code/i}));
            expect(onSubmit).toHaveBeenCalledWith('123456');
        });

        it('clears validation error when user types', async () => {
            const user = userEvent.setup();
            render(<MfaModal {...defaultProps} />);
            // Trigger validation error
            await user.click(screen.getByRole('button', {name: /submit code/i}));
            expect(screen.getByRole('alert')).toBeInTheDocument();
            // Type to clear it
            await user.type(screen.getByLabelText(/authentication code/i), '1');
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        it('calls onCancel when Escape key is pressed', () => {
            const onCancel = vi.fn();
            const {container} = render(<MfaModal {...defaultProps} onCancel={onCancel} />);
            const dialog = container.querySelector('dialog')!;
            fireEvent.keyDown(dialog, {key: 'Escape'});
            expect(onCancel).toHaveBeenCalled();
        });

        it('does not throw on Tab key', () => {
            const {container} = render(<MfaModal {...defaultProps} />);
            const dialog = container.querySelector('dialog')!;
            expect(() => {
                fireEvent.keyDown(dialog, {key: 'Tab', shiftKey: false});
            }).not.toThrow();
        });

        it('does not throw on Shift+Tab key', () => {
            const {container} = render(<MfaModal {...defaultProps} />);
            const dialog = container.querySelector('dialog')!;
            expect(() => {
                fireEvent.keyDown(dialog, {key: 'Tab', shiftKey: true});
            }).not.toThrow();
        });
    });
});
