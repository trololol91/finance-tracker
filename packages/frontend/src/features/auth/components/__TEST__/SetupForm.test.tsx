import {
    render,
    screen,
    waitFor
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {
    describe,
    it,
    expect,
    vi,
    beforeEach
} from 'vitest';
import {SetupForm} from '@features/auth/components/SetupForm.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockCompleteSetup = vi.fn();

vi.mock('@features/auth/hooks/useAuth.js', () => ({
    useAuth: () => ({completeSetup: mockCompleteSetup})
}));

// ── Helper ────────────────────────────────────────────────────────────────────

const renderSetupForm = (): void => {
    render(
        <MemoryRouter>
            <SetupForm />
        </MemoryRouter>
    );
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SetupForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('rendering', () => {
        it('renders all form fields', () => {
            renderSetupForm();

            expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/^confirm password$/i)).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /create admin account/i})).toBeInTheDocument();
        });
    });

    describe('validation', () => {
        it('shows email error when submitted empty', async () => {
            const user = userEvent.setup();
            renderSetupForm();

            await user.click(screen.getByRole('button', {name: /create admin account/i}));

            expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
        });

        it('shows password error when submitted empty', async () => {
            const user = userEvent.setup();
            renderSetupForm();

            await user.type(screen.getByLabelText(/email/i), 'admin@test.com');
            await user.click(screen.getByRole('button', {name: /create admin account/i}));

            expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
        });

        it('shows confirm password mismatch error', async () => {
            const user = userEvent.setup();
            renderSetupForm();

            await user.type(screen.getByLabelText(/email/i), 'admin@test.com');
            await user.type(screen.getByLabelText(/^password$/i), 'Password1!');
            await user.type(screen.getByLabelText(/^confirm password$/i), 'Different1!');
            await user.click(screen.getByRole('button', {name: /create admin account/i}));

            expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
        });
    });

    describe('successful submission', () => {
        it('calls completeSetup and navigates to dashboard on success', async () => {
            mockCompleteSetup.mockResolvedValue(undefined);
            const user = userEvent.setup();
            renderSetupForm();

            await user.type(screen.getByLabelText(/first name/i), 'Admin');
            await user.type(screen.getByLabelText(/email/i), 'admin@test.com');
            await user.type(screen.getByLabelText(/^password$/i), 'Password1!');
            await user.type(screen.getByLabelText(/^confirm password$/i), 'Password1!');
            await user.click(screen.getByRole('button', {name: /create admin account/i}));

            await waitFor(() => {
                expect(mockCompleteSetup).toHaveBeenCalledWith(
                    expect.objectContaining({
                        email: 'admin@test.com',
                        password: 'Password1!'
                    })
                );
            });
        });
    });

    describe('API error handling', () => {
        it('shows error message when completeSetup throws', async () => {
            mockCompleteSetup.mockRejectedValue(new Error('Something went wrong'));
            const user = userEvent.setup();
            renderSetupForm();

            await user.type(screen.getByLabelText(/first name/i), 'Admin');
            await user.type(screen.getByLabelText(/email/i), 'admin@test.com');
            await user.type(screen.getByLabelText(/^password$/i), 'Password1!');
            await user.type(screen.getByLabelText(/^confirm password$/i), 'Password1!');
            await user.click(screen.getByRole('button', {name: /create admin account/i}));

            expect(await screen.findByRole('alert')).toBeInTheDocument();
        });
    });
});
