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
import {RegisterForm} from '@features/auth/components/RegisterForm.js';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
const mockRegister = vi.fn();

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
    useAuth: () => ({register: mockRegister})
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const renderRegisterForm = (): void => {
    render(
        <MemoryRouter>
            <RegisterForm />
        </MemoryRouter>
    );
};

const VALID_PASSWORD = 'Password1';

const fillValidForm = async (): Promise<void> => {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password$/i), VALID_PASSWORD);
    await user.type(screen.getByLabelText(/^confirm password$/i), VALID_PASSWORD);
    await user.click(screen.getByLabelText(/i agree to the terms/i));
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RegisterForm', () => {
    beforeEach(() => {
        mockNavigate.mockReset();
        mockRegister.mockReset();
    });

    // ── Rendering ─────────────────────────────────────────────────────────────

    describe('rendering', () => {
        it('renders First Name field', () => {
            renderRegisterForm();
            expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
        });

        it('renders Last Name field', () => {
            renderRegisterForm();
            expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
        });

        it('renders Email field', () => {
            renderRegisterForm();
            expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        });

        it('renders Password field', () => {
            renderRegisterForm();
            expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
        });

        it('renders Confirm Password field', () => {
            renderRegisterForm();
            expect(screen.getByLabelText(/^confirm password$/i)).toBeInTheDocument();
        });

        it('renders Terms & Conditions checkbox', () => {
            renderRegisterForm();
            expect(screen.getByLabelText(/i agree to the terms/i)).toBeInTheDocument();
        });

        it('renders Create Account submit button', () => {
            renderRegisterForm();
            expect(
                screen.getByRole('button', {name: /create account/i})
            ).toBeInTheDocument();
        });

        it('renders Sign in link', () => {
            renderRegisterForm();
            expect(screen.getByRole('link', {name: /sign in/i})).toBeInTheDocument();
        });
    });

    // ── Password visibility toggles ───────────────────────────────────────────

    describe('password visibility toggles', () => {
        it('password field starts as type=password', () => {
            renderRegisterForm();
            expect(screen.getByLabelText(/^password$/i)).toHaveAttribute(
                'type',
                'password'
            );
        });

        it('toggles password to text when show button clicked', async () => {
            const user = userEvent.setup();
            renderRegisterForm();
            await user.click(screen.getByRole('button', {name: /show password$/i}));
            expect(screen.getByLabelText(/^password$/i)).toHaveAttribute(
                'type',
                'text'
            );
        });

        it('confirm password field starts as type=password', () => {
            renderRegisterForm();
            expect(screen.getByLabelText(/^confirm password$/i)).toHaveAttribute(
                'type',
                'password'
            );
        });

        it('toggles confirm password to text when show button clicked', async () => {
            const user = userEvent.setup();
            renderRegisterForm();
            await user.click(
                screen.getByRole('button', {name: /show confirm password/i})
            );
            expect(screen.getByLabelText(/^confirm password$/i)).toHaveAttribute(
                'type',
                'text'
            );
        });
    });

    // ── Validation ────────────────────────────────────────────────────────────

    describe('validation', () => {
        it('shows email required error when submitted empty', async () => {
            const user = userEvent.setup();
            renderRegisterForm();
            await user.click(screen.getByRole('button', {name: /create account/i}));
            expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
        });

        it('shows invalid email error for bad format', async () => {
            const user = userEvent.setup();
            renderRegisterForm();
            await user.type(screen.getByLabelText(/email/i), 'notanemail');
            await user.click(screen.getByRole('button', {name: /create account/i}));
            expect(
                await screen.findByText(/valid email address/i)
            ).toBeInTheDocument();
        });

        it('shows password required error when submitted empty', async () => {
            const user = userEvent.setup();
            renderRegisterForm();
            await user.type(screen.getByLabelText(/email/i), 'test@example.com');
            await user.click(screen.getByRole('button', {name: /create account/i}));
            expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
        });

        it('shows password strength error for weak password', async () => {
            const user = userEvent.setup();
            renderRegisterForm();
            await user.type(screen.getByLabelText(/email/i), 'test@example.com');
            await user.type(screen.getByLabelText(/^password$/i), 'weak');
            await user.click(screen.getByRole('button', {name: /create account/i}));
            // validators.password will flag length or missing uppercase/number
            expect(
                await screen.findByText(/at least 8 characters|uppercase|number/i)
            ).toBeInTheDocument();
        });

        it('shows confirm password mismatch error', async () => {
            const user = userEvent.setup();
            renderRegisterForm();
            await user.type(screen.getByLabelText(/email/i), 'test@example.com');
            await user.type(screen.getByLabelText(/^password$/i), VALID_PASSWORD);
            await user.type(
                screen.getByLabelText(/^confirm password$/i),
                'Different1'
            );
            await user.click(screen.getByRole('button', {name: /create account/i}));
            expect(
                await screen.findByText(/passwords do not match/i)
            ).toBeInTheDocument();
        });

        it('shows terms error when checkbox unchecked', async () => {
            const user = userEvent.setup();
            renderRegisterForm();
            await user.type(screen.getByLabelText(/email/i), 'test@example.com');
            await user.type(screen.getByLabelText(/^password$/i), VALID_PASSWORD);
            await user.type(
                screen.getByLabelText(/^confirm password$/i),
                VALID_PASSWORD
            );
            await user.click(screen.getByRole('button', {name: /create account/i}));
            expect(
                await screen.findByText(/you must agree to the terms/i)
            ).toBeInTheDocument();
        });

        it('clears field error when user starts typing', async () => {
            const user = userEvent.setup();
            renderRegisterForm();
            await user.click(screen.getByRole('button', {name: /create account/i}));
            expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
            await user.type(screen.getByLabelText(/email/i), 'a');
            expect(screen.queryByText(/email is required/i)).not.toBeInTheDocument();
        });
    });

    // ── Successful submission ─────────────────────────────────────────────────

    describe('successful submission', () => {
        it('calls register with email and password', async () => {
            mockRegister.mockResolvedValue(undefined);
            const user = userEvent.setup();
            renderRegisterForm();
            await fillValidForm();
            await user.click(screen.getByRole('button', {name: /create account/i}));
            await waitFor(() => {
                expect(mockRegister).toHaveBeenCalledWith(
                    expect.objectContaining({
                        email: 'test@example.com',
                        password: VALID_PASSWORD
                    })
                );
            });
        });

        it('includes firstName when provided', async () => {
            mockRegister.mockResolvedValue(undefined);
            const user = userEvent.setup();
            renderRegisterForm();
            await user.type(screen.getByLabelText(/first name/i), 'Jane');
            await fillValidForm();
            await user.click(screen.getByRole('button', {name: /create account/i}));
            await waitFor(() => {
                expect(mockRegister).toHaveBeenCalledWith(
                    expect.objectContaining({firstName: 'Jane'})
                );
            });
        });

        it('omits firstName when not provided', async () => {
            mockRegister.mockResolvedValue(undefined);
            const user = userEvent.setup();
            renderRegisterForm();
            await fillValidForm();
            await user.click(screen.getByRole('button', {name: /create account/i}));
            await waitFor(() => {
                const dto = mockRegister.mock.calls[0][0] as Record<string, unknown>;
                expect(dto).not.toHaveProperty('firstName');
            });
        });

        it('navigates to dashboard after successful registration', async () => {
            mockRegister.mockResolvedValue(undefined);
            const user = userEvent.setup();
            renderRegisterForm();
            await fillValidForm();
            await user.click(screen.getByRole('button', {name: /create account/i}));
            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith('/dashboard', {
                    replace: true
                });
            });
        });

        it('shows loading state during submission', async () => {
            let resolveRegister!: () => void;
            mockRegister.mockReturnValue(
                new Promise<void>(res => { resolveRegister = res; })
            );
            const user = userEvent.setup();
            renderRegisterForm();
            await fillValidForm();
            await user.click(screen.getByRole('button', {name: /create account/i}));
            expect(
                screen.getByRole('button', {name: /loading/i})
            ).toBeDisabled();
            resolveRegister();
        });
    });

    // ── Error handling ────────────────────────────────────────────────────────

    describe('error handling', () => {
        it('shows email conflict message on 409 error', async () => {
            mockRegister.mockRejectedValue(new Error('409 Conflict'));
            const user = userEvent.setup();
            renderRegisterForm();
            await fillValidForm();
            await user.click(screen.getByRole('button', {name: /create account/i}));
            expect(
                await screen.findByText(/already exists/i)
            ).toBeInTheDocument();
        });

        it('shows network error message on connection failure', async () => {
            mockRegister.mockRejectedValue(new Error('Network Error'));
            const user = userEvent.setup();
            renderRegisterForm();
            await fillValidForm();
            await user.click(screen.getByRole('button', {name: /create account/i}));
            expect(
                await screen.findByText(/unable to connect/i)
            ).toBeInTheDocument();
        });

        it('shows generic error message for unknown errors', async () => {
            mockRegister.mockRejectedValue(new Error('Internal Server Error'));
            const user = userEvent.setup();
            renderRegisterForm();
            await fillValidForm();
            await user.click(screen.getByRole('button', {name: /create account/i}));
            expect(
                await screen.findByText(/something went wrong/i)
            ).toBeInTheDocument();
        });

        it('re-enables form after error', async () => {
            mockRegister.mockRejectedValue(new Error('Network Error'));
            const user = userEvent.setup();
            renderRegisterForm();
            await fillValidForm();
            await user.click(screen.getByRole('button', {name: /create account/i}));
            await screen.findByText(/unable to connect/i);
            expect(
                screen.getByRole('button', {name: /create account/i})
            ).not.toBeDisabled();
        });

        it('clears api error when user types', async () => {
            mockRegister.mockRejectedValue(new Error('Network Error'));
            const user = userEvent.setup();
            renderRegisterForm();
            await fillValidForm();
            await user.click(screen.getByRole('button', {name: /create account/i}));
            await screen.findByText(/unable to connect/i);
            await user.type(screen.getByLabelText(/email/i), 'x');
            expect(screen.queryByText(/unable to connect/i)).not.toBeInTheDocument();
        });
    });
});
