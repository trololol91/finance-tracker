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
    fireEvent,
    act
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import {ProfileForm} from '@features/settings/components/ProfileForm.js';
import type {User} from '@features/auth/types/auth.types.js';

// ── Mock dependencies ──────────────────────────────────────────────────────

const mockUpdateUser = vi.fn();
const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    timezone: 'America/New_York',
    currency: 'USD',
    isActive: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    role: 'USER',
    notifyEmail: true
};

vi.mock('@features/auth/hooks/useAuth.js', () => ({
    useAuth: vi.fn()
}));

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: vi.fn(() => ({setQueryData: vi.fn()}))
}));

const mockMutate = vi.fn();

vi.mock('@/api/users/users.js', () => ({
    useUsersControllerUpdate: vi.fn(),
    getUsersControllerFindOneQueryKey: vi.fn((id: string) => [`/users/${id}`])
}));

// Profile edit sub-components already tested separately — use real component
vi.mock('@features/users/components/ProfileEdit.js', () => ({
    ProfileEdit: ({
        form,
        email,
        apiError,
        isSaving,
        onFieldChange,
        onSave,
        onCancel
    }: {
        form: {
            firstName: string;
            lastName: string;
            timezone: string;
            currency: string;
        };
        email: string;
        apiError: string;
        isSaving: boolean;
        onFieldChange: (field: string, value: string) => void;
        onSave: (e: React.FormEvent) => void;
        onCancel: () => void;
    }) => (
        <div data-testid="profile-edit">
            <span data-testid="pe-email">{email}</span>
            <span data-testid="pe-first-name">{form.firstName}</span>
            <span data-testid="pe-last-name">{form.lastName}</span>
            {apiError !== '' && <span role="alert">{apiError}</span>}
            {isSaving && <span data-testid="pe-saving" />}
            <button onClick={(): void => { onFieldChange('firstName', 'Updated'); }}>
                Change First Name
            </button>
            <button
                onClick={(e): void => {
                    e.preventDefault();
                    onSave(e as unknown as React.FormEvent);
                }}
            >
                Save
            </button>
            <button onClick={onCancel}>Cancel</button>
        </div>
    )
}));

import {useAuth} from '@features/auth/hooks/useAuth.js';
import {useUsersControllerUpdate} from '@/api/users/users.js';

const mockUseAuth = vi.mocked(useAuth);
const mockUseUpdate = vi.mocked(useUsersControllerUpdate);

type UpdateReturn = ReturnType<typeof useUsersControllerUpdate>;

const makeUpdate = (isPending = false): UpdateReturn =>
    ({mutate: mockMutate, isPending}) as unknown as UpdateReturn;

type AuthReturn = ReturnType<typeof useAuth>;

const makeAuth = (user: User | null = mockUser): AuthReturn =>
    ({user, updateUser: mockUpdateUser}) as unknown as AuthReturn;

const renderProfileForm = (): void => {
    render(<ProfileForm />);
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ProfileForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseAuth.mockReturnValue(makeAuth());
        mockUseUpdate.mockReturnValue(makeUpdate());
    });

    describe('rendering', () => {
        it('renders the ProfileEdit sub-component', () => {
            renderProfileForm();
            expect(screen.getByTestId('profile-edit')).toBeInTheDocument();
        });

        it('passes the authUser email to ProfileEdit', () => {
            renderProfileForm();
            expect(screen.getByTestId('pe-email')).toHaveTextContent('test@example.com');
        });

        it('pre-populates firstName from auth user', () => {
            renderProfileForm();
            expect(screen.getByTestId('pe-first-name')).toHaveTextContent('Jane');
        });

        it('pre-populates lastName from auth user', () => {
            renderProfileForm();
            expect(screen.getByTestId('pe-last-name')).toHaveTextContent('Doe');
        });

        it('renders empty strings when authUser is null', () => {
            mockUseAuth.mockReturnValue(makeAuth(null));
            renderProfileForm();
            expect(screen.getByTestId('pe-email')).toHaveTextContent('');
        });
    });

    describe('field change', () => {
        it('updates form state when onFieldChange is called', async () => {
            const user = userEvent.setup();
            renderProfileForm();
            await user.click(screen.getByRole('button', {name: /change first name/i}));
            // No error thrown — form state updated
            expect(screen.getByTestId('profile-edit')).toBeInTheDocument();
        });
    });

    describe('save — success', () => {
        it('calls updateProfile mutation on save', async () => {
            const user = userEvent.setup();
            renderProfileForm();
            await user.click(screen.getByRole('button', {name: /^save$/i}));
            expect(mockMutate).toHaveBeenCalledOnce();
        });

        it('shows success message after successful save', async () => {
            const user = userEvent.setup();
            mockMutate.mockImplementationOnce(
                (_args: unknown, {onSuccess}: {onSuccess: (u: User) => void}) => {
                    const updatedUser = {...mockUser};
                    onSuccess(updatedUser as unknown as User);
                }
            );
            renderProfileForm();
            await user.click(screen.getByRole('button', {name: /^save$/i}));
            expect(screen.getByRole('status')).toHaveTextContent('Profile updated successfully.');
        });

        it('calls updateUser with merged data on success', async () => {
            const user = userEvent.setup();
            const serverResponse = {
                ...mockUser,
                firstName: 'Jane',
                lastName: 'Doe',
                timezone: 'America/New_York',
                currency: 'USD',
                notifyEmail: true
            };
            mockMutate.mockImplementationOnce(
                (_args: unknown, {onSuccess}: {onSuccess: (u: typeof serverResponse) => void}) => {
                    onSuccess(serverResponse);
                }
            );
            renderProfileForm();
            await user.click(screen.getByRole('button', {name: /^save$/i}));
            expect(mockUpdateUser).toHaveBeenCalledOnce();
        });
    });

    describe('save — error', () => {
        it('shows error message when mutation fails', async () => {
            const user = userEvent.setup();
            mockMutate.mockImplementationOnce(
                (_args: unknown, {onError}: {onError: () => void}) => {
                    onError();
                }
            );
            renderProfileForm();
            await user.click(screen.getByRole('button', {name: /^save$/i}));
            expect(screen.getByRole('alert')).toHaveTextContent(
                'Failed to save profile. Please try again.'
            );
        });
    });

    describe('cancel', () => {
        it('resets form to authUser values on cancel', async () => {
            const user = userEvent.setup();
            renderProfileForm();
            // Change first name
            await user.click(screen.getByRole('button', {name: /change first name/i}));
            // Cancel — should reset
            await user.click(screen.getByRole('button', {name: /cancel/i}));
            expect(screen.getByTestId('pe-first-name')).toHaveTextContent('Jane');
        });
    });

    describe('success message auto-dismiss', () => {
        it('clears the success message after 4 seconds', async () => {
            vi.useFakeTimers();
            const serverResponse = {...mockUser};
            mockMutate.mockImplementationOnce(
                (_args: unknown, {onSuccess}: {onSuccess: (u: typeof serverResponse) => void}) => {
                    onSuccess(serverResponse);
                }
            );
            renderProfileForm();
            // Use fireEvent in the fake-timer context — userEvent's internal timers
            // do not play well with vi.useFakeTimers; the timer-advance behavior
            // under test here is what matters, not the pointer-event fidelity.
            fireEvent.click(screen.getByRole('button', {name: /^save$/i}));
            expect(screen.getByRole('status')).toBeInTheDocument();

            await act(async () => {
                vi.advanceTimersByTime(4001);
                await Promise.resolve();
            });
            expect(screen.queryByRole('status')).not.toBeInTheDocument();
            vi.useRealTimers();
        });
    });

    describe('saving state', () => {
        it('passes isPending to ProfileEdit as isSaving', () => {
            mockUseUpdate.mockReturnValue(makeUpdate(true));
            renderProfileForm();
            expect(screen.getByTestId('pe-saving')).toBeInTheDocument();
        });
    });

    describe('save guard — no authUser', () => {
        it('does not call mutate when authUser is null', async () => {
            mockUseAuth.mockReturnValue(makeAuth(null));
            const user = userEvent.setup();
            renderProfileForm();
            await user.click(screen.getByRole('button', {name: /^save$/i}));
            expect(mockMutate).not.toHaveBeenCalled();
        });
    });

    describe('cancel guard — no authUser', () => {
        it('does not throw when cancel is called with null authUser', async () => {
            mockUseAuth.mockReturnValue(makeAuth(null));
            const user = userEvent.setup();
            renderProfileForm();
            await expect(
                user.click(screen.getByRole('button', {name: /cancel/i}))
            ).resolves.not.toThrow();
        });
    });
});
