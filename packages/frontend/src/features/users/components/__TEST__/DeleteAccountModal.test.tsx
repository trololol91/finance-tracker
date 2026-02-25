import {
    describe,
    it,
    expect,
    vi,
    beforeEach
} from 'vitest';
import {
    render,
    screen,
    fireEvent
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {DeleteAccountModal} from '@features/users/components/DeleteAccountModal.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockMutate = vi.fn();

vi.mock('@/api/users/users.js', () => ({
    useUsersControllerRemove: () => ({
        mutate: mockMutate,
        isPending: false
    })
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const defaultProps = {
    isOpen: true,
    userId: 'user-123',
    onSuccess: vi.fn(),
    onClose: vi.fn()
};

const renderModal = (overrides: Partial<typeof defaultProps> = {}): void => {
    render(<DeleteAccountModal {...{...defaultProps, ...overrides}} />);
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DeleteAccountModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('visibility', () => {
        it('renders nothing when isOpen is false', () => {
            renderModal({isOpen: false});

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('renders the dialog when isOpen is true', () => {
            renderModal();

            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
    });

    describe('rendering', () => {
        it('renders the Delete Account heading', () => {
            renderModal();

            expect(
                screen.getByRole('heading', {name: /delete account/i})
            ).toBeInTheDocument();
        });

        it('renders a password confirmation input', () => {
            renderModal();

            expect(
                screen.getByLabelText(/enter your password to confirm/i)
            ).toBeInTheDocument();
        });

        it('renders password input as type="password"', () => {
            renderModal();

            expect(
                screen.getByLabelText(/enter your password to confirm/i)
            ).toHaveAttribute('type', 'password');
        });

        it('renders Cancel and Delete My Account buttons', () => {
            renderModal();

            expect(screen.getByRole('button', {name: /cancel/i})).toBeInTheDocument();
            expect(
                screen.getByRole('button', {name: /delete my account/i})
            ).toBeInTheDocument();
        });

        it('describes the irreversible consequence', () => {
            renderModal();

            expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
        });
    });

    describe('confirm button state', () => {
        it('disables the confirm button when password is empty', () => {
            renderModal();

            expect(
                screen.getByRole('button', {name: /delete my account/i})
            ).toBeDisabled();
        });

        it('enables the confirm button once a password is entered', async () => {
            renderModal();

            await userEvent.type(
                screen.getByLabelText(/password to confirm/i),
                'mypassword'
            );

            expect(
                screen.getByRole('button', {name: /delete my account/i})
            ).not.toBeDisabled();
        });

        it('disables the confirm button again if password is cleared', async () => {
            renderModal();
            const input = screen.getByLabelText(/password to confirm/i);

            await userEvent.type(input, 'abc');
            await userEvent.clear(input);

            expect(
                screen.getByRole('button', {name: /delete my account/i})
            ).toBeDisabled();
        });
    });

    describe('close behaviour', () => {
        it('calls onClose when Cancel is clicked', async () => {
            const onClose = vi.fn();
            renderModal({onClose});

            await userEvent.click(screen.getByRole('button', {name: /cancel/i}));

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('calls onClose when the backdrop is clicked', async () => {
            const onClose = vi.fn();
            renderModal({onClose});

            const overlay = document.querySelector(
                '.delete-account-modal__overlay'
            )!;
            await userEvent.click(overlay);

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('does not call onClose when the modal card itself is clicked', async () => {
            const onClose = vi.fn();
            renderModal({onClose});

            await userEvent.click(screen.getByRole('dialog'));

            expect(onClose).not.toHaveBeenCalled();
        });

        it('calls onClose when the Escape key is pressed', () => {
            const onClose = vi.fn();
            renderModal({onClose});

            fireEvent.keyDown(document, {key: 'Escape'});

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('does not call onClose for non-Escape keys', () => {
            const onClose = vi.fn();
            renderModal({onClose});

            fireEvent.keyDown(document, {key: 'Enter'});

            expect(onClose).not.toHaveBeenCalled();
        });
    });

    describe('delete flow', () => {
        it('calls mutate with the userId when confirmed', async () => {
            renderModal();

            await userEvent.type(
                screen.getByLabelText(/password to confirm/i),
                'mypassword'
            );
            await userEvent.click(
                screen.getByRole('button', {name: /delete my account/i})
            );

            expect(mockMutate).toHaveBeenCalledWith(
                {id: 'user-123'},
                expect.objectContaining({
                    onSuccess: expect.any(Function),
                    onError: expect.any(Function)
                })
            );
        });

        it('calls onSuccess callback after successful deletion', async () => {
            const onSuccess = vi.fn();
            mockMutate.mockImplementationOnce(
                (_args: unknown, {onSuccess: cb}: {onSuccess: () => void}) => { cb(); }
            );
            renderModal({onSuccess});

            await userEvent.type(
                screen.getByLabelText(/password to confirm/i),
                'mypassword'
            );
            await userEvent.click(
                screen.getByRole('button', {name: /delete my account/i})
            );

            expect(onSuccess).toHaveBeenCalledTimes(1);
        });
    });

    describe('error state', () => {
        it('shows an error alert when deletion fails', async () => {
            mockMutate.mockImplementationOnce(
                (_args: unknown, {onError}: {onError: () => void}) => { onError(); }
            );
            renderModal();

            await userEvent.type(
                screen.getByLabelText(/password to confirm/i),
                'mypassword'
            );
            await userEvent.click(
                screen.getByRole('button', {name: /delete my account/i})
            );

            expect(screen.getByRole('alert')).toHaveTextContent(/failed to delete/i);
        });

        it('does not show error alert before any submission attempt', () => {
            renderModal();

            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });
    });

    describe('accessibility', () => {
        it('has role="dialog" with aria-modal and aria-labelledby', () => {
            renderModal();

            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveAttribute('aria-modal', 'true');
            expect(dialog).toHaveAttribute('aria-labelledby', 'delete-modal-title');
        });

        it('auto-focuses the password input when opened', () => {
            renderModal();

            expect(
                screen.getByLabelText(/enter your password to confirm/i)
            ).toHaveFocus();
        });
    });
});
