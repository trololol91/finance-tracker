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
const mockMutateSubscribe = vi.fn();
const mockMutateUnsubscribe = vi.fn();

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
    notifyEmail: true
};

vi.mock('@features/auth/hooks/useAuth.js', () => ({
    useAuth: vi.fn()
}));

vi.mock('@/api/users/users.js', () => ({
    useUsersControllerUpdate: vi.fn()
}));

vi.mock('@/api/push/push.js', () => ({
    usePushControllerSubscribe: vi.fn(),
    usePushControllerUnsubscribe: vi.fn()
}));

vi.mock('@services/push/pushSubscription.js', () => ({
    subscribeBrowser: vi.fn(),
    unsubscribeBrowser: vi.fn(),
    getCurrentSubscription: vi.fn()
}));

vi.mock('@config/env.js', () => ({
    env: {
        API_BASE_URL: 'http://localhost:3001',
        API_TIMEOUT: 30000,
        VAPID_PUBLIC_KEY: 'test-vapid-public-key',
        isDevelopment: false,
        isProduction: false
    }
}));

import {useAuth} from '@features/auth/hooks/useAuth.js';
import {useUsersControllerUpdate} from '@/api/users/users.js';
import {
    usePushControllerSubscribe,
    usePushControllerUnsubscribe
} from '@/api/push/push.js';
import {
    subscribeBrowser,
    unsubscribeBrowser,
    getCurrentSubscription
} from '@services/push/pushSubscription.js';

const mockUseAuth = vi.mocked(useAuth);
const mockUseUpdate = vi.mocked(useUsersControllerUpdate);
const mockUsePushSubscribe = vi.mocked(usePushControllerSubscribe);
const mockUsePushUnsubscribe = vi.mocked(usePushControllerUnsubscribe);
const mockSubscribeBrowser = vi.mocked(subscribeBrowser);
const mockUnsubscribeBrowser = vi.mocked(unsubscribeBrowser);
const mockGetCurrentSubscription = vi.mocked(getCurrentSubscription);

type UpdateReturn = ReturnType<typeof useUsersControllerUpdate>;
type AuthReturn = ReturnType<typeof useAuth>;
type PushSubscribeReturn = ReturnType<typeof usePushControllerSubscribe>;
type PushUnsubscribeReturn = ReturnType<typeof usePushControllerUnsubscribe>;

const makeUpdate = (isPending = false): UpdateReturn =>
    ({mutate: mockMutate, isPending}) as unknown as UpdateReturn;

const makeAuth = (user: User | null = mockUser): AuthReturn =>
    ({user, updateUser: mockUpdateUser}) as unknown as AuthReturn;

const makePushSub = (endpoint = 'https://push.example.com/sub'): PushSubscription =>
    ({
        endpoint,
        getKey: (k: string): ArrayBuffer =>
            k === 'p256dh' ? new ArrayBuffer(65) : new ArrayBuffer(16)
    }) as unknown as PushSubscription;

const renderForm = (): void => {
    render(<NotificationsForm />);
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('NotificationsForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseAuth.mockReturnValue(makeAuth());
        mockUseUpdate.mockReturnValue(makeUpdate());
        mockUsePushSubscribe.mockReturnValue(
            {mutate: mockMutateSubscribe, isPending: false} as unknown as PushSubscribeReturn
        );
        mockUsePushUnsubscribe.mockReturnValue(
            {mutate: mockMutateUnsubscribe, isPending: false} as unknown as PushUnsubscribeReturn
        );
        mockSubscribeBrowser.mockResolvedValue(null);
        mockUnsubscribeBrowser.mockResolvedValue(null);
        mockGetCurrentSubscription.mockResolvedValue(null);
    });

    describe('rendering', () => {
        it('renders the form with aria-label', async () => {
            await act(async () => { renderForm(); await Promise.resolve(); });
            expect(
                screen.getByRole('form', {name: /notification preferences/i})
            ).toBeInTheDocument();
        });

        it('renders a Notification Preferences heading', async () => {
            await act(async () => { renderForm(); await Promise.resolve(); });
            expect(
                screen.getByRole('heading', {name: /notification preferences/i})
            ).toBeInTheDocument();
        });

        it('renders the Email notifications checkbox', async () => {
            await act(async () => { renderForm(); await Promise.resolve(); });
            expect(screen.getByLabelText(/email notifications/i)).toBeInTheDocument();
        });

        it('renders the Save preferences button', async () => {
            await act(async () => { renderForm(); await Promise.resolve(); });
            expect(
                screen.getByRole('button', {name: /save preferences/i})
            ).toBeInTheDocument();
        });

        it('renders the push Enable button when not subscribed', async () => {
            await act(async () => { renderForm(); await Promise.resolve(); });
            expect(screen.getByRole('button', {name: /enable/i})).toBeInTheDocument();
        });
    });

    describe('push subscription status on mount', () => {
        it('shows Enable button when getCurrentSubscription returns null', async () => {
            mockGetCurrentSubscription.mockResolvedValue(null);
            await act(async () => { renderForm(); await Promise.resolve(); });
            expect(screen.getByRole('button', {name: /enable/i})).toBeInTheDocument();
        });

        it('shows Disable button when getCurrentSubscription returns a subscription', async () => {
            mockGetCurrentSubscription.mockResolvedValue(makePushSub());
            await act(async () => { renderForm(); await Promise.resolve(); });
            expect(screen.getByRole('button', {name: /disable/i})).toBeInTheDocument();
        });
    });

    describe('enabling push', () => {
        it('calls subscribeBrowser when Enable is clicked', async () => {
            await act(async () => { renderForm(); await Promise.resolve(); });
            await act(async () => {
                fireEvent.click(screen.getByRole('button', {name: /enable/i}));
                await Promise.resolve();
            });
            expect(mockSubscribeBrowser).toHaveBeenCalledWith('test-vapid-public-key');
        });

        it('calls mutateSubscribe with encoded keys when subscribeBrowser succeeds', async () => {
            const mockSub = makePushSub();
            mockSubscribeBrowser.mockResolvedValue(mockSub);
            await act(async () => { renderForm(); await Promise.resolve(); });
            await act(async () => {
                fireEvent.click(screen.getByRole('button', {name: /enable/i}));
                await Promise.resolve();
            });
            expect(mockMutateSubscribe).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        endpoint: 'https://push.example.com/sub',
                        keys: expect.objectContaining({
                            p256dh: expect.any(String),
                            auth: expect.any(String)
                        })
                    })
                })
            );
        });

        it('shows pushWarning when subscribeBrowser returns null', async () => {
            mockSubscribeBrowser.mockResolvedValue(null);
            await act(async () => { renderForm(); await Promise.resolve(); });
            await act(async () => {
                fireEvent.click(screen.getByRole('button', {name: /enable/i}));
                await Promise.resolve();
            });
            expect(screen.getByRole('alert')).toHaveTextContent(
                /push notifications could not be enabled/i
            );
        });

        it('shows Disable button after subscribeBrowser succeeds', async () => {
            mockSubscribeBrowser.mockResolvedValue(makePushSub());
            await act(async () => { renderForm(); await Promise.resolve(); });
            await act(async () => {
                fireEvent.click(screen.getByRole('button', {name: /enable/i}));
                await Promise.resolve();
            });
            expect(screen.getByRole('button', {name: /disable/i})).toBeInTheDocument();
        });
    });

    describe('disabling push', () => {
        it('calls unsubscribeBrowser when Disable is clicked', async () => {
            mockGetCurrentSubscription.mockResolvedValue(makePushSub());
            await act(async () => { renderForm(); await Promise.resolve(); });
            await act(async () => {
                fireEvent.click(screen.getByRole('button', {name: /disable/i}));
                await Promise.resolve();
            });
            expect(mockUnsubscribeBrowser).toHaveBeenCalledOnce();
        });

        it('calls mutateUnsubscribe with endpoint when browser had a subscription', async () => {
            mockGetCurrentSubscription.mockResolvedValue(makePushSub());
            mockUnsubscribeBrowser.mockResolvedValue('https://push.example.com/sub');
            await act(async () => { renderForm(); await Promise.resolve(); });
            await act(async () => {
                fireEvent.click(screen.getByRole('button', {name: /disable/i}));
                await Promise.resolve();
            });
            expect(mockMutateUnsubscribe).toHaveBeenCalledWith(
                {data: {endpoint: 'https://push.example.com/sub'}}
            );
        });

        it('shows Enable button after disabling', async () => {
            mockGetCurrentSubscription.mockResolvedValue(makePushSub());
            mockUnsubscribeBrowser.mockResolvedValue('https://push.example.com/sub');
            await act(async () => { renderForm(); await Promise.resolve(); });
            await act(async () => {
                fireEvent.click(screen.getByRole('button', {name: /disable/i}));
                await Promise.resolve();
            });
            expect(screen.getByRole('button', {name: /enable/i})).toBeInTheDocument();
        });
    });

    describe('initial state from auth user', () => {
        it('reflects notifyEmail=true from authUser', async () => {
            await act(async () => { renderForm(); await Promise.resolve(); });
            expect(screen.getByLabelText(/email notifications/i)).toBeChecked();
        });

        it('defaults notifyEmail to false when authUser is null', async () => {
            mockUseAuth.mockReturnValue(makeAuth(null));
            await act(async () => { renderForm(); await Promise.resolve(); });
            expect(screen.getByLabelText(/email notifications/i)).not.toBeChecked();
        });
    });

    describe('toggle interactions', () => {
        it('toggles notifyEmail when the email checkbox is clicked', async () => {
            await act(async () => { renderForm(); await Promise.resolve(); });
            const emailCheckbox = screen.getByLabelText(/email notifications/i);
            fireEvent.click(emailCheckbox);
            expect(emailCheckbox).not.toBeChecked();
        });
    });

    describe('save — success', () => {
        it('calls updateProfile mutation when Save is clicked', async () => {
            await act(async () => { renderForm(); await Promise.resolve(); });
            fireEvent.submit(screen.getByRole('form', {name: /notification preferences/i}));
            expect(mockMutate).toHaveBeenCalledOnce();
        });

        it('submits with only notifyEmail', async () => {
            await act(async () => { renderForm(); await Promise.resolve(); });
            fireEvent.submit(screen.getByRole('form', {name: /notification preferences/i}));
            expect(mockMutate).toHaveBeenCalledWith(
                {id: 'user-1', data: {notifyEmail: true}},
                expect.any(Object)
            );
        });

        it('shows success message after save', async () => {
            const updatedUser = {...mockUser, notifyEmail: true};
            mockMutate.mockImplementationOnce(
                (_args: unknown, {onSuccess}: {onSuccess: (u: typeof updatedUser) => void}) => {
                    onSuccess(updatedUser);
                }
            );
            await act(async () => { renderForm(); await Promise.resolve(); });
            fireEvent.submit(screen.getByRole('form', {name: /notification preferences/i}));
            expect(screen.getByRole('status')).toHaveTextContent(
                'Notification preferences saved.'
            );
        });

        it('calls updateUser with updated notifyEmail on success', async () => {
            const updatedUser = {...mockUser, notifyEmail: false};
            mockMutate.mockImplementationOnce(
                (_args: unknown, {onSuccess}: {onSuccess: (u: typeof updatedUser) => void}) => {
                    onSuccess(updatedUser);
                }
            );
            await act(async () => { renderForm(); await Promise.resolve(); });
            fireEvent.submit(screen.getByRole('form', {name: /notification preferences/i}));
            expect(mockUpdateUser).toHaveBeenCalledWith(
                expect.objectContaining({notifyEmail: false})
            );
        });
    });

    describe('save — error', () => {
        it('shows error alert when mutation fails', async () => {
            mockMutate.mockImplementationOnce(
                (_args: unknown, {onError}: {onError: () => void}) => {
                    onError();
                }
            );
            await act(async () => { renderForm(); await Promise.resolve(); });
            fireEvent.submit(screen.getByRole('form', {name: /notification preferences/i}));
            expect(screen.getByRole('alert')).toHaveTextContent(
                'Failed to save preferences. Please try again.'
            );
        });
    });

    describe('loading state', () => {
        it('disables Save button while saving', async () => {
            mockUseUpdate.mockReturnValue(makeUpdate(true));
            await act(async () => { renderForm(); await Promise.resolve(); });
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
            await act(async () => { renderForm(); await Promise.resolve(); });
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
        it('does not call mutate when authUser is null', async () => {
            mockUseAuth.mockReturnValue(makeAuth(null));
            await act(async () => { renderForm(); await Promise.resolve(); });
            fireEvent.submit(screen.getByRole('form', {name: /notification preferences/i}));
            expect(mockMutate).not.toHaveBeenCalled();
        });
    });
});
