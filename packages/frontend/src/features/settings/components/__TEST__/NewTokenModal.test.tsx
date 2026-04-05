import {
    describe,
    it,
    expect,
    vi,
    beforeAll,
    beforeEach
} from 'vitest';
import {
    render,
    screen,
    waitFor,
    fireEvent,
    act
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {NewTokenModal} from '@features/settings/components/NewTokenModal.js';
import type {CreateApiTokenResponseDto} from '@/api/model';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockOnClose = vi.fn();
const mockMutate = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock('@/api/api-tokens/api-tokens.js', () => ({
    useApiTokensControllerCreate: vi.fn(),
    getApiTokensControllerFindAllQueryKey: vi.fn(() => ['/api-tokens'])
}));

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: vi.fn(() => ({invalidateQueries: mockInvalidateQueries}))
}));

vi.mock('@features/auth/hooks/useAuth.js', () => ({
    useAuth: vi.fn()
}));

import {useApiTokensControllerCreate} from '@/api/api-tokens/api-tokens.js';
import {useAuth} from '@features/auth/hooks/useAuth.js';

const mockUseCreate = vi.mocked(useApiTokensControllerCreate);
const mockUseAuth = vi.mocked(useAuth);

type CreateReturn = ReturnType<typeof useApiTokensControllerCreate>;
type AuthReturn = ReturnType<typeof useAuth>;

const makeCreate = (isPending = false): CreateReturn =>
    ({mutate: mockMutate, isPending}) as unknown as CreateReturn;

const makeAuth = (role: 'USER' | 'ADMIN' = 'USER'): AuthReturn =>
    ({user: {role}}) as unknown as AuthReturn;

// jsdom does not implement showModal/close on HTMLDialogElement
const mockShowModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
});
const mockClose = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
});

const mockWriteText = vi.fn();

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = mockShowModal;
    HTMLDialogElement.prototype.close = mockClose;
    Object.defineProperty(navigator, 'clipboard', {
        value: {writeText: mockWriteText},
        configurable: true,
        writable: true
    });
});

const renderModal = (isOpen = true): void => {
    render(<NewTokenModal isOpen={isOpen} onClose={mockOnClose} />);
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('NewTokenModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseCreate.mockReturnValue(makeCreate());
        mockUseAuth.mockReturnValue(makeAuth());
    });

    describe('dialog element', () => {
        it('renders a dialog element', () => {
            renderModal();
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('has aria-modal="true"', () => {
            renderModal();
            expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
        });

        it('shows the "Generate new API token" heading', () => {
            renderModal();
            expect(
                screen.getByRole('heading', {name: /generate new api token/i})
            ).toBeInTheDocument();
        });

        it('has a close button', () => {
            renderModal();
            expect(screen.getByRole('button', {name: /close dialog/i})).toBeInTheDocument();
        });

        it('calls onClose when close button is clicked', async () => {
            const user = userEvent.setup();
            renderModal();
            await user.click(screen.getByRole('button', {name: /close dialog/i}));
            expect(mockOnClose).toHaveBeenCalledOnce();
        });
    });

    describe('form fields', () => {
        it('renders the token name input', () => {
            renderModal();
            expect(screen.getByLabelText(/token name/i)).toBeInTheDocument();
        });

        it('renders scope checkboxes for transactions', () => {
            renderModal();
            expect(screen.getByLabelText('transactions:read')).toBeInTheDocument();
            expect(screen.getByLabelText('transactions:write')).toBeInTheDocument();
        });

        it('renders scope checkboxes for accounts', () => {
            renderModal();
            expect(screen.getByLabelText('accounts:read')).toBeInTheDocument();
            expect(screen.getByLabelText('accounts:write')).toBeInTheDocument();
        });

        it('renders scope checkboxes for dashboard', () => {
            renderModal();
            expect(screen.getByLabelText('dashboard:read')).toBeInTheDocument();
        });

        it('renders the expiry date input', () => {
            renderModal();
            expect(screen.getByLabelText(/expiry date/i)).toBeInTheDocument();
        });

        it('does not show admin scope for USER role', () => {
            renderModal();
            expect(screen.queryByLabelText('admin')).not.toBeInTheDocument();
        });

        it('shows admin scope for ADMIN role', () => {
            mockUseAuth.mockReturnValue(makeAuth('ADMIN'));
            renderModal();
            expect(screen.getByLabelText('admin')).toBeInTheDocument();
        });
    });

    describe('validation', () => {
        it('shows error when name is empty on submit', async () => {
            const user = userEvent.setup();
            renderModal();
            await user.click(screen.getByRole('button', {name: /generate token/i}));
            expect(screen.getByText(/token name is required/i)).toBeInTheDocument();
        });

        it('shows error when no scopes are selected on submit', async () => {
            const user = userEvent.setup();
            renderModal();
            await user.type(screen.getByLabelText(/token name/i), 'My Token');
            await user.click(screen.getByRole('button', {name: /generate token/i}));
            expect(screen.getByText(/select at least one scope/i)).toBeInTheDocument();
        });

        it('shows error when name exceeds 100 characters', async () => {
            const user = userEvent.setup();
            renderModal();
            await user.type(screen.getByLabelText(/token name/i), 'a'.repeat(101));
            await user.click(screen.getByLabelText('transactions:read'));
            await user.click(screen.getByRole('button', {name: /generate token/i}));
            expect(screen.getByText(/100 characters or fewer/i)).toBeInTheDocument();
        });

        it('does not call mutate when validation fails', async () => {
            const user = userEvent.setup();
            renderModal();
            await user.click(screen.getByRole('button', {name: /generate token/i}));
            expect(mockMutate).not.toHaveBeenCalled();
        });
    });

    describe('successful submission', () => {
        const createdToken: CreateApiTokenResponseDto = {
            id: 'tok-1',
            name: 'My Token',
            scopes: ['transactions:read'],
            lastUsedAt: null,
            expiresAt: null,
            createdAt: '2025-01-01T00:00:00.000Z',
            token: 'ft_secretrawtoken123'
        };

        beforeEach(() => {
            mockMutate.mockImplementationOnce(
                (
                    _args: unknown,
                    {onSuccess}: {onSuccess: (r: CreateApiTokenResponseDto) => void}
                ) => {
                    onSuccess(createdToken);
                }
            );
        });

        it('calls mutate with correct data', async () => {
            const user = userEvent.setup();
            renderModal();
            await user.type(screen.getByLabelText(/token name/i), 'My Token');
            await user.click(screen.getByLabelText('transactions:read'));
            await user.click(screen.getByRole('button', {name: /generate token/i}));
            expect(mockMutate).toHaveBeenCalledWith(
                {data: {name: 'My Token', scopes: ['transactions:read'], expiresAt: undefined}},
                expect.objectContaining({onSuccess: expect.any(Function)})
            );
        });

        it('shows the token reveal step after success', async () => {
            const user = userEvent.setup();
            renderModal();
            await user.type(screen.getByLabelText(/token name/i), 'My Token');
            await user.click(screen.getByLabelText('transactions:read'));
            await user.click(screen.getByRole('button', {name: /generate token/i}));
            await waitFor(() => {
                expect(
                    screen.getByRole('heading', {name: /token created/i})
                ).toBeInTheDocument();
            });
        });

        it('shows the warning message in the reveal step', async () => {
            const user = userEvent.setup();
            renderModal();
            await user.type(screen.getByLabelText(/token name/i), 'My Token');
            await user.click(screen.getByLabelText('transactions:read'));
            await user.click(screen.getByRole('button', {name: /generate token/i}));
            await waitFor(() => {
                expect(
                    screen.getByText(/this token will not be shown again/i)
                ).toBeInTheDocument();
            });
        });

        it('displays the raw token in the reveal step', async () => {
            const user = userEvent.setup();
            renderModal();
            await user.type(screen.getByLabelText(/token name/i), 'My Token');
            await user.click(screen.getByLabelText('transactions:read'));
            await user.click(screen.getByRole('button', {name: /generate token/i}));
            await waitFor(() => {
                expect(
                    screen.getByLabelText(/generated api token/i)
                ).toHaveValue('ft_secretrawtoken123');
            });
        });

        it('shows a copy button in the reveal step', async () => {
            const user = userEvent.setup();
            renderModal();
            await user.type(screen.getByLabelText(/token name/i), 'My Token');
            await user.click(screen.getByLabelText('transactions:read'));
            await user.click(screen.getByRole('button', {name: /generate token/i}));
            await waitFor(() => {
                expect(
                    screen.getByRole('button', {name: /copy token/i})
                ).toBeInTheDocument();
            });
        });

        it('shows a Done button in the reveal step that closes the modal', async () => {
            const user = userEvent.setup();
            renderModal();
            await user.type(screen.getByLabelText(/token name/i), 'My Token');
            await user.click(screen.getByLabelText('transactions:read'));
            await user.click(screen.getByRole('button', {name: /generate token/i}));
            await waitFor(() => {
                expect(screen.getByRole('button', {name: /done/i})).toBeInTheDocument();
            });
            await user.click(screen.getByRole('button', {name: /done/i}));
            expect(mockOnClose).toHaveBeenCalled();
        });

        it('passes expiresAt string when expiry date is set', async () => {
            const user = userEvent.setup();
            renderModal();
            await user.type(screen.getByLabelText(/token name/i), 'Expiring Token');
            await user.click(screen.getByLabelText('transactions:read'));
            await user.type(screen.getByLabelText(/expiry date/i), '2027-12-31');
            await user.click(screen.getByRole('button', {name: /generate token/i}));
            expect(mockMutate).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({expiresAt: '2027-12-31'})
                }),
                expect.any(Object)
            );
        });

        it('invalidates the api-tokens query on success', async () => {
            const user = userEvent.setup();
            renderModal();
            await user.type(screen.getByLabelText(/token name/i), 'My Token');
            await user.click(screen.getByLabelText('transactions:read'));
            await user.click(screen.getByRole('button', {name: /generate token/i}));
            await waitFor(() => {
                expect(mockInvalidateQueries).toHaveBeenCalledWith(
                    expect.objectContaining({queryKey: ['/api-tokens']})
                );
            });
        });
    });

    describe('error handling', () => {
        it('shows api error message when mutation fails', async () => {
            mockMutate.mockImplementationOnce(
                (_args: unknown, {onError}: {onError: () => void}) => {
                    onError();
                }
            );
            const user = userEvent.setup();
            renderModal();
            await user.type(screen.getByLabelText(/token name/i), 'My Token');
            await user.click(screen.getByLabelText('transactions:read'));
            await user.click(screen.getByRole('button', {name: /generate token/i}));
            await waitFor(() => {
                expect(
                    screen.getByText(/failed to create token/i)
                ).toBeInTheDocument();
            });
        });
    });

    describe('cancel button', () => {
        it('calls onClose when Cancel is clicked', async () => {
            const user = userEvent.setup();
            renderModal();
            await user.click(screen.getByRole('button', {name: /^cancel$/i}));
            expect(mockOnClose).toHaveBeenCalledOnce();
        });
    });

    describe('copy button', () => {
        const createdToken: CreateApiTokenResponseDto = {
            id: 'tok-1',
            name: 'Copy Token',
            scopes: ['transactions:read'],
            lastUsedAt: null,
            expiresAt: null,
            createdAt: '2025-01-01T00:00:00.000Z',
            token: 'ft_copytesttoken'
        };

        beforeEach(() => {
            mockMutate.mockImplementationOnce((
                _args: unknown,
                {onSuccess}: {onSuccess: (r: CreateApiTokenResponseDto) => void}
            ) => {
                onSuccess(createdToken);
            });
        });

        it('shows copy button with initial Copy text in reveal step', async () => {
            const user = userEvent.setup();
            renderModal();
            await user.type(screen.getByLabelText(/token name/i), 'Copy Token');
            await user.click(screen.getByLabelText('transactions:read'));
            await user.click(screen.getByRole('button', {name: /generate token/i}));
            await waitFor(() => {
                expect(screen.getByRole('button', {name: /copy token/i})).toHaveTextContent('Copy');
            });
        });

        it('calls clipboard.writeText with the token value when copy is clicked', async () => {
            // jsdom provides a native navigator.clipboard; spy on it directly
            // rather than replacing the whole object, since Object.defineProperty
            // cannot override jsdom's non-configurable getter on the prototype.
            const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText')
                .mockResolvedValue(undefined);
            const user = userEvent.setup();
            renderModal();
            await user.type(screen.getByLabelText(/token name/i), 'Copy Token');
            await user.click(screen.getByLabelText('transactions:read'));
            await user.click(screen.getByRole('button', {name: /generate token/i}));
            let copyBtn: HTMLElement;
            await waitFor(() => {
                copyBtn = screen.getByRole('button', {name: 'Copy token to clipboard'});
                expect(copyBtn).toBeInTheDocument();
            });
            act(() => { fireEvent.click(copyBtn!); });
            await waitFor(() => {
                expect(writeTextSpy).toHaveBeenCalledWith('ft_copytesttoken');
            });
            writeTextSpy.mockRestore();
        });
    });

    describe('scope toggle', () => {
        it('toggles a scope off when clicked twice', async () => {
            const user = userEvent.setup();
            renderModal();
            const checkbox = screen.getByLabelText('transactions:read');
            await user.click(checkbox);
            expect(checkbox).toBeChecked();
            await user.click(checkbox);
            expect(checkbox).not.toBeChecked();
        });

        it('clears scopes error when a scope is toggled', async () => {
            const user = userEvent.setup();
            renderModal();
            await user.type(screen.getByLabelText(/token name/i), 'My Token');
            await user.click(screen.getByRole('button', {name: /generate token/i}));
            expect(screen.getByText(/select at least one scope/i)).toBeInTheDocument();
            await user.click(screen.getByLabelText('transactions:read'));
            expect(screen.queryByText(/select at least one scope/i)).not.toBeInTheDocument();
        });

        it('clears name error when name is typed after error', async () => {
            const user = userEvent.setup();
            renderModal();
            await user.click(screen.getByRole('button', {name: /generate token/i}));
            expect(screen.getByText(/token name is required/i)).toBeInTheDocument();
            await user.type(screen.getByLabelText(/token name/i), 'x');
            expect(screen.queryByText(/token name is required/i)).not.toBeInTheDocument();
        });
    });

    describe('keyboard handling', () => {
        it('calls onClose when Escape key is dispatched on the dialog', () => {
            renderModal();
            const dialog = screen.getByRole('dialog');
            act(() => {
                fireEvent.keyDown(dialog, {key: 'Escape', bubbles: true});
            });
            expect(mockOnClose).toHaveBeenCalled();
        });

        it('does not call onClose for non-Tab non-Escape keys dispatched on the dialog', () => {
            renderModal();
            const dialog = screen.getByRole('dialog');
            act(() => {
                fireEvent.keyDown(dialog, {key: 'Enter', bubbles: true});
            });
            expect(mockOnClose).not.toHaveBeenCalled();
        });

        it('handles Tab key through focus trap without throwing', () => {
            renderModal();
            const dialog = screen.getByRole('dialog');
            act(() => {
                fireEvent.keyDown(dialog, {key: 'Tab', bubbles: true});
            });
            // No assertion needed — just verifying no crash
        });

        it('handles Shift+Tab through focus trap without throwing', () => {
            renderModal();
            const dialog = screen.getByRole('dialog');
            act(() => {
                fireEvent.keyDown(dialog, {key: 'Tab', shiftKey: true, bubbles: true});
            });
        });
    });

    describe('closed modal', () => {
        it('renders with isOpen=false without throwing', () => {
            expect(() => { renderModal(false); }).not.toThrow();
        });
    });
});
