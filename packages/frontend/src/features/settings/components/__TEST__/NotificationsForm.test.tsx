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
import {NotificationsForm} from '@features/settings/components/NotificationsForm.js';
import type {User} from '@features/auth/types/auth.types.js';

// ── Mock dependencies ──────────────────────────────────────────────────────

const mockUpdateUser = vi.fn();
const mockMutate = vi.fn();

const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    timezone: 'UTC',
    currency: 'USD',
    isActive: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    role: 'USER',
    notifyPush: false,
    notifyEmail: true
};

vi.mock('@features/auth/hooks/useAuth.js', () => ({
    useAuth: vi.fn()
}));

vi.mock('@/api/users/users.js', () => ({
    useUsersControllerUpdate: vi.fn()
}));

import {useAuth} from '@features/auth/hooks/useAuth.js';
import {useUsersControllerUpdate} from '@/api/users/users.js';

const mockUseAuth = vi.mocked(useAuth);
const mockUseUpdate = vi.mocked(useUsersControllerUpdate);

type UpdateReturn = ReturnType<typeof useUsersControllerUpdate>;
type AuthReturn = ReturnType<typeof useAuth>;

const makeUpdate = (isPending = false): UpdateReturn =>
    ({mutate: mockMutate, isPending}) as unknown as UpdateReturn;

const makeAuth = (user: User | null = mockUser): AuthReturn =>
    ({user, updateUser: mockUpdateUser}) as unknown as AuthReturn;

const renderForm = (): void => {
    render(<NotificationsForm />);
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('NotificationsForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseAuth.mockReturnValue(makeAuth());
        mockUseUpdate.mockReturnValue(makeUpdate());
    });

    describe('rendering', () => {
        it('renders the form with aria-label', () => {
            renderForm();
            expect(
                screen.getByRole('form', {name: /notification preferences/i})
            ).toBeInTheDocument();
        });

        it('renders a Notification Preferences heading', () => {
            renderForm();
            expect(
                screen.getByRole('heading', {name: /notification preferences/i})
            ).toBeInTheDocument();
        });

        it('renders the Push notifications checkbox', () => {
            renderForm();
            expect(screen.getByLabelText(/push notifications/i)).toBeInTheDocument();
        });

        it('renders the Email notifications checkbox', () => {
            renderForm();
            expect(screen.getByLabelText(/email notifications/i)).toBeInTheDocument();
        });

        it('renders the Save preferences button', () => {
            renderForm();
            expect(
                screen.getByRole('button', {name: /save preferences/i})
            ).toBeInTheDocument();
        });
    });

    describe('initial state from auth user', () => {
        it('reflects notifyPush=false from authUser', () => {
            renderForm();
            const pushCheckbox = screen.getByLabelText(/push notifications/i);
            expect(pushCheckbox).not.toBeChecked();
        });

        it('reflects notifyEmail=true from authUser', () => {
            renderForm();
            const emailCheckbox = screen.getByLabelText(/email notifications/i);
            expect(emailCheckbox).toBeChecked();
        });

        it('defaults both to false when authUser is null', () => {
            mockUseAuth.mockReturnValue(makeAuth(null));
            renderForm();
            expect(screen.getByLabelText(/push notifications/i)).not.toBeChecked();
            expect(screen.getByLabelText(/email notifications/i)).not.toBeChecked();
        });
    });

    describe('toggle interactions', () => {
        it('toggles notifyPush when the push checkbox is clicked', () => {
            renderForm();
            const pushCheckbox = screen.getByLabelText(/push notifications/i);
            fireEvent.click(pushCheckbox);
            expect(pushCheckbox).toBeChecked();
        });

        it('toggles notifyEmail when the email checkbox is clicked', () => {
            renderForm();
            const emailCheckbox = screen.getByLabelText(/email notifications/i);
            fireEvent.click(emailCheckbox);
            expect(emailCheckbox).not.toBeChecked();
        });
    });

    describe('save — success', () => {
        it('calls updateProfile mutation when Save is clicked', () => {
            renderForm();
            fireEvent.submit(screen.getByRole('form', {name: /notification preferences/i}));
            expect(mockMutate).toHaveBeenCalledOnce();
        });

        it('submits with the current notifyPush and notifyEmail values', () => {
            renderForm();
            // Toggle push on
            fireEvent.click(screen.getByLabelText(/push notifications/i));
            fireEvent.submit(screen.getByRole('form', {name: /notification preferences/i}));
            expect(mockMutate).toHaveBeenCalledWith(
                {id: 'user-1', data: {notifyPush: true, notifyEmail: true}},
                expect.any(Object)
            );
        });

        it('shows success message after save', () => {
            const updatedUser = {...mockUser, notifyPush: true, notifyEmail: true};
            mockMutate.mockImplementationOnce(
                (_args: unknown, {onSuccess}: {onSuccess: (u: typeof updatedUser) => void}) => {
                    onSuccess(updatedUser);
                }
            );
            renderForm();
            fireEvent.submit(screen.getByRole('form', {name: /notification preferences/i}));
            expect(screen.getByRole('status')).toHaveTextContent(
                'Notification preferences saved.'
            );
        });

        it('calls updateUser with updated notifyPush and notifyEmail on success', () => {
            const updatedUser = {...mockUser, notifyPush: true, notifyEmail: false};
            mockMutate.mockImplementationOnce(
                (_args: unknown, {onSuccess}: {onSuccess: (u: typeof updatedUser) => void}) => {
                    onSuccess(updatedUser);
                }
            );
            renderForm();
            fireEvent.submit(screen.getByRole('form', {name: /notification preferences/i}));
            expect(mockUpdateUser).toHaveBeenCalledWith(
                expect.objectContaining({notifyPush: true, notifyEmail: false})
            );
        });
    });

    describe('save — error', () => {
        it('shows error alert when mutation fails', () => {
            mockMutate.mockImplementationOnce(
                (_args: unknown, {onError}: {onError: () => void}) => {
                    onError();
                }
            );
            renderForm();
            fireEvent.submit(screen.getByRole('form', {name: /notification preferences/i}));
            expect(screen.getByRole('alert')).toHaveTextContent(
                'Failed to save preferences. Please try again.'
            );
        });
    });

    describe('loading state', () => {
        it('disables Save button while saving', () => {
            mockUseUpdate.mockReturnValue(makeUpdate(true));
            renderForm();
            expect(screen.getByRole('button', {name: /loading/i})).toBeDisabled();
        });
    });

    describe('success message auto-dismiss', () => {
        it('clears the success message after 4 seconds', async () => {
            vi.useFakeTimers();
            const updatedUser = {...mockUser};
            mockMutate.mockImplementationOnce(
                (_args: unknown, {onSuccess}: {onSuccess: (u: typeof updatedUser) => void}) => {
                    onSuccess(updatedUser);
                }
            );
            renderForm();
            fireEvent.submit(screen.getByRole('form', {name: /notification preferences/i}));
            expect(screen.getByRole('status')).toBeInTheDocument();

            await act(async () => {
                vi.advanceTimersByTime(4001);
                await Promise.resolve();
            });
            expect(screen.queryByRole('status')).not.toBeInTheDocument();
            vi.useRealTimers();
        });
    });

    describe('no-op when authUser is null', () => {
        it('does not call mutate when authUser is null', () => {
            mockUseAuth.mockReturnValue(makeAuth(null));
            renderForm();
            fireEvent.submit(screen.getByRole('form', {name: /notification preferences/i}));
            expect(mockMutate).not.toHaveBeenCalled();
        });
    });
});
