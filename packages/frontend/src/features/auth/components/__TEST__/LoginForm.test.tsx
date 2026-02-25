import {
    describe,
    it,
    expect,
    beforeEach,
    vi
} from 'vitest';
import {
    render,
    screen,
    waitFor
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import type * as ReactRouterDom from 'react-router-dom';
import {LoginForm} from '@features/auth/components/LoginForm.js';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
const mockLogin = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof ReactRouterDom>(
        'react-router-dom'
    );
    return {
        ...actual,
        useNavigate: () => mockNavigate
    };
});

vi.mock('@features/auth/hooks/useAuth.js', () => ({
    useAuth: () => ({login: mockLogin})
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const renderLoginForm = (): void => {
    render(
        <MemoryRouter>
            <LoginForm />
        </MemoryRouter>
    );
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LoginForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('rendering', () => {
        it('renders all form elements', () => {
            renderLoginForm();

            expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /sign in/i})).toBeInTheDocument();
            expect(
                screen.getByRole('button', {name: /show password/i})
            ).toBeInTheDocument();
            expect(
                screen.getByRole('checkbox', {name: /remember me/i})
            ).toBeInTheDocument();
            expect(screen.getByRole('link', {name: /sign up/i})).toBeInTheDocument();
        });

        it('renders email input with correct type and autocomplete', () => {
            renderLoginForm();

            const emailInput = screen.getByLabelText(/email/i);
            expect(emailInput).toHaveAttribute('type', 'email');
            expect(emailInput).toHaveAttribute('autocomplete', 'email');
        });

        it('renders password input as type="password" by default', () => {
            renderLoginForm();

            expect(screen.getByLabelText(/^password$/i)).toHaveAttribute(
                'type',
                'password'
            );
        });
    });

    describe('password visibility toggle', () => {
        it('toggles password visibility when the toggle button is clicked', async () => {
            const user = userEvent.setup();
            renderLoginForm();

            const passwordInput = screen.getByLabelText(/^password$/i);
            const toggleBtn = screen.getByRole('button', {name: /show password/i});

            expect(passwordInput).toHaveAttribute('type', 'password');

            await user.click(toggleBtn);

            expect(passwordInput).toHaveAttribute('type', 'text');
            expect(
                screen.getByRole('button', {name: /hide password/i})
            ).toBeInTheDocument();

            await user.click(screen.getByRole('button', {name: /hide password/i}));

            expect(passwordInput).toHaveAttribute('type', 'password');
        });
    });

    describe('form validation', () => {
        it('shows email required error when submitting with empty email', async () => {
            const user = userEvent.setup();
            renderLoginForm();

            await user.click(screen.getByRole('button', {name: /sign in/i}));

            expect(
                await screen.findByText(/email is required/i)
            ).toBeInTheDocument();
            expect(mockLogin).not.toHaveBeenCalled();
        });

        it('shows email format error for invalid email', async () => {
            const user = userEvent.setup();
            renderLoginForm();

            await user.type(screen.getByLabelText(/email/i), 'not-an-email');
            await user.type(screen.getByLabelText(/^password$/i), 'Password1');
            await user.click(screen.getByRole('button', {name: /sign in/i}));

            expect(
                await screen.findByText(/valid email/i)
            ).toBeInTheDocument();
            expect(mockLogin).not.toHaveBeenCalled();
        });

        it('shows password required error when submitting with empty password', async () => {
            const user = userEvent.setup();
            renderLoginForm();

            await user.type(screen.getByLabelText(/email/i), 'test@example.com');
            await user.click(screen.getByRole('button', {name: /sign in/i}));

            expect(
                await screen.findByText(/password is required/i)
            ).toBeInTheDocument();
            expect(mockLogin).not.toHaveBeenCalled();
        });

        it('shows password length error for password shorter than 8 characters', async () => {
            const user = userEvent.setup();
            renderLoginForm();

            await user.type(screen.getByLabelText(/email/i), 'test@example.com');
            await user.type(screen.getByLabelText(/^password$/i), 'short');
            await user.click(screen.getByRole('button', {name: /sign in/i}));

            expect(
                await screen.findByText(/at least 8 characters/i)
            ).toBeInTheDocument();
            expect(mockLogin).not.toHaveBeenCalled();
        });

        it('clears email error when user types in the email field', async () => {
            const user = userEvent.setup();
            renderLoginForm();

            // Trigger validation error
            await user.click(screen.getByRole('button', {name: /sign in/i}));
            expect(
                await screen.findByText(/email is required/i)
            ).toBeInTheDocument();

            // Typing clears the error
            await user.type(screen.getByLabelText(/email/i), 'a');
            expect(
                screen.queryByText(/email is required/i)
            ).not.toBeInTheDocument();
        });
    });

    describe('form submission', () => {
        it('calls login with email and password on valid submit', async () => {
            const user = userEvent.setup();
            mockLogin.mockResolvedValue(undefined);
            renderLoginForm();

            await user.type(
                screen.getByLabelText(/email/i),
                'test@example.com'
            );
            await user.type(
                screen.getByLabelText(/^password$/i),
                'Password1!'
            );
            await user.click(screen.getByRole('button', {name: /sign in/i}));

            await waitFor(() => {
                expect(mockLogin).toHaveBeenCalledWith(
                    'test@example.com',
                    'Password1!'
                );
            });
        });

        it('navigates to dashboard on successful login', async () => {
            const user = userEvent.setup();
            mockLogin.mockResolvedValue(undefined);
            renderLoginForm();

            await user.type(
                screen.getByLabelText(/email/i),
                'test@example.com'
            );
            await user.type(
                screen.getByLabelText(/^password$/i),
                'Password1!'
            );
            await user.click(screen.getByRole('button', {name: /sign in/i}));

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    '/dashboard',
                    {replace: true}
                );
            });
        });

        it('shows loading state while submitting', async () => {
            const user = userEvent.setup();
            // Never resolves during test to hold the loading state
            mockLogin.mockReturnValue(new Promise(() => undefined));
            renderLoginForm();

            await user.type(
                screen.getByLabelText(/email/i),
                'test@example.com'
            );
            await user.type(
                screen.getByLabelText(/^password$/i),
                'Password1!'
            );
            await user.click(screen.getByRole('button', {name: /sign in/i}));

            await waitFor(() => {
                expect(
                    screen.getByRole('button', {name: /loading/i})
                ).toBeDisabled();
            });
        });

        it('disables inputs while submitting', async () => {
            const user = userEvent.setup();
            mockLogin.mockReturnValue(new Promise(() => undefined));
            renderLoginForm();

            await user.type(
                screen.getByLabelText(/email/i),
                'test@example.com'
            );
            await user.type(
                screen.getByLabelText(/^password$/i),
                'Password1!'
            );
            await user.click(screen.getByRole('button', {name: /sign in/i}));

            await waitFor(() => {
                expect(screen.getByLabelText(/email/i)).toBeDisabled();
                expect(screen.getByLabelText(/^password$/i)).toBeDisabled();
            });
        });
    });

    describe('error handling', () => {
        it('shows invalid credentials message on 401 error', async () => {
            const user = userEvent.setup();
            mockLogin.mockRejectedValue(
                new Error('AxiosError: Request failed with status code 401')
            );
            renderLoginForm();

            await user.type(
                screen.getByLabelText(/email/i),
                'test@example.com'
            );
            await user.type(
                screen.getByLabelText(/^password$/i),
                'WrongPass1!'
            );
            await user.click(screen.getByRole('button', {name: /sign in/i}));

            expect(
                await screen.findByRole('alert')
            ).toHaveTextContent(/email or password is incorrect/i);
        });

        it('shows network error message on connection failure', async () => {
            const user = userEvent.setup();
            mockLogin.mockRejectedValue(new Error('Network Error'));
            renderLoginForm();

            await user.type(
                screen.getByLabelText(/email/i),
                'test@example.com'
            );
            await user.type(
                screen.getByLabelText(/^password$/i),
                'Password1!'
            );
            await user.click(screen.getByRole('button', {name: /sign in/i}));

            expect(
                await screen.findByRole('alert')
            ).toHaveTextContent(/unable to connect/i);
        });

        it('shows generic error message on unknown failure', async () => {
            const user = userEvent.setup();
            mockLogin.mockRejectedValue(new Error('Internal Server Error'));
            renderLoginForm();

            await user.type(
                screen.getByLabelText(/email/i),
                'test@example.com'
            );
            await user.type(
                screen.getByLabelText(/^password$/i),
                'Password1!'
            );
            await user.click(screen.getByRole('button', {name: /sign in/i}));

            expect(
                await screen.findByRole('alert')
            ).toHaveTextContent(/something went wrong/i);
        });

        it('clears api error when user edits a field', async () => {
            const user = userEvent.setup();
            mockLogin.mockRejectedValue(new Error('Internal Server Error'));
            renderLoginForm();

            await user.type(
                screen.getByLabelText(/email/i),
                'test@example.com'
            );
            await user.type(
                screen.getByLabelText(/^password$/i),
                'Password1!'
            );
            await user.click(screen.getByRole('button', {name: /sign in/i}));

            await screen.findByRole('alert');

            // Typing in email clears the api error
            await user.type(screen.getByLabelText(/email/i), 'x');
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        it('re-enables form after a failed submission', async () => {
            const user = userEvent.setup();
            mockLogin.mockRejectedValue(new Error('Internal Server Error'));
            renderLoginForm();

            await user.type(
                screen.getByLabelText(/email/i),
                'test@example.com'
            );
            await user.type(
                screen.getByLabelText(/^password$/i),
                'Password1!'
            );
            await user.click(screen.getByRole('button', {name: /sign in/i}));

            // Wait for error to appear (form is unlocked again)
            await screen.findByRole('alert');

            expect(screen.getByLabelText(/email/i)).not.toBeDisabled();
            expect(screen.getByLabelText(/^password$/i)).not.toBeDisabled();
        });
    });
});
