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
    notifyPush: false,
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

        it('submits with the current notifyPush and notifyEmail values', async () => {
            const mockSub = makePushSub();
            mockSubscribeBrowser.mockResolvedValue(mockSub);
            renderForm();
            // Toggle push on then submit — subscribeBrowser succeeds so notifyPush stays true
            fireEvent.click(screen.getByLabelText(/push notifications/i));
            await act(async () => {
                fireEvent.submit(screen.getByRole('form', {name: /notification preferences/i}));
                await Promise.resolve();
            });
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

        it('rolls back browser subscription when updateProfile fails after subscribeBrowser succeeded', async () => {
            const mockSub = makePushSub();
            mockSubscribeBrowser.mockResolvedValue(mockSub);
            mockMutate.mockImplementationOnce(
                (_args: unknown, {onError}: {onError: () => void}) => {
                    onError();
                }
            );
            renderForm();
            fireEvent.click(screen.getByLabelText(/push notifications/i));
            await act(async () => {
                fireEvent.submit(screen.getByRole('form', {name: /notification preferences/i}));
                await Promise.resolve();
            });
            expect(mockUnsubscribeBrowser).toHaveBeenCalledOnce();
        });

        it('does not call unsubscribeBrowser on error when subscribeBrowser returned null', async () => {
            mockSubscribeBrowser.mockResolvedValue(null);
            mockMutate.mockImplementationOnce(
                (_args: unknown, {onError}: {onError: () => void}) => {
                    onError();
                }
            );
            renderForm();
            fireEvent.click(screen.getByLabelText(/push notifications/i));
            await act(async () => {
                fireEvent.submit(screen.getByRole('form', {name: /notification preferences/i}));
                await Promise.resolve();
            });
            expect(mockUnsubscribeBrowser).not.toHaveBeenCalled();
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

    describe('push subscription — enabling push', () => {
        const userWithPushOn = {...mockUser, notifyPush: true};

        it('calls subscribeBrowser after save when notifyPush becomes true', async () => {
            mockMutate.mockImplementationOnce(
                (_args: unknown, {onSuccess}: {onSuccess: (u: typeof userWithPushOn) => void}) => {
                    onSuccess(userWithPushOn);
                }
            );
            renderForm();
            fireEvent.click(screen.getByLabelText(/push notifications/i));
            await act(async () => {
                fireEvent.submit(screen.getByRole('form', {name: /notification preferences/i}));
                await Promise.resolve();
            });
            expect(mockSubscribeBrowser).toHaveBeenCalledWith('test-vapid-public-key');
        });

        it('calls mutateSubscribe with encoded keys when subscribeBrowser succeeds', async () => {
            const mockSub = makePushSub();
            mockSubscribeBrowser.mockResolvedValue(mockSub);
            mockMutate.mockImplementationOnce(
                (_args: unknown, {onSuccess}: {onSuccess: (u: typeof userWithPushOn) => void}) => {
                    onSuccess(userWithPushOn);
                }
            );
            renderForm();
            fireEvent.click(screen.getByLabelText(/push notifications/i));
            await act(async () => {
                fireEvent.submit(screen.getByRole('form', {name: /notification preferences/i}));
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
            mockMutate.mockImplementationOnce(
                (_args: unknown, {onSuccess}: {onSuccess: (u: typeof userWithPushOn) => void}) => {
                    onSuccess(userWithPushOn);
                }
            );
            renderForm();
            fireEvent.click(screen.getByLabelText(/push notifications/i));
            await act(async () => {
                fireEvent.submit(screen.getByRole('form', {name: /notification preferences/i}));
                await Promise.resolve();
            });
            expect(screen.getByRole('alert')).toHaveTextContent(/push notifications could not be enabled/i);
        });

        it('does not call mutateSubscribe when subscribeBrowser returns null', async () => {
            mockSubscribeBrowser.mockResolvedValue(null);
            mockMutate.mockImplementationOnce(
                (_args: unknown, {onSuccess}: {onSuccess: (u: typeof userWithPushOn) => void}) => {
                    onSuccess(userWithPushOn);
                }
            );
            renderForm();
            fireEvent.click(screen.getByLabelText(/push notifications/i));
            await act(async () => {
                fireEvent.submit(screen.getByRole('form', {name: /notification preferences/i}));
                await Promise.resolve();
            });
            expect(mockMutateSubscribe).not.toHaveBeenCalled();
        });
    });

    describe('push subscription — disabling push', () => {
        const userWithPushOff = {...mockUser, notifyPush: false};

        it('calls unsubscribeBrowser after save when notifyPush is false', async () => {
            mockMutate.mockImplementationOnce(
                (_args: unknown, {onSuccess}: {onSuccess: (u: typeof userWithPushOff) => void}) => {
                    onSuccess(userWithPushOff);
                }
            );
            renderForm();
            await act(async () => {
                fireEvent.submit(screen.getByRole('form', {name: /notification preferences/i}));
                await Promise.resolve();
            });
            expect(mockUnsubscribeBrowser).toHaveBeenCalledOnce();
        });

        it('calls mutateUnsubscribe with endpoint when browser had a subscription', async () => {
            mockUnsubscribeBrowser.mockResolvedValue('https://push.example.com/sub');
            mockMutate.mockImplementationOnce(
                (_args: unknown, {onSuccess}: {onSuccess: (u: typeof userWithPushOff) => void}) => {
                    onSuccess(userWithPushOff);
                }
            );
            renderForm();
            await act(async () => {
                fireEvent.submit(screen.getByRole('form', {name: /notification preferences/i}));
                await Promise.resolve();
            });
            expect(mockMutateUnsubscribe).toHaveBeenCalledWith(
                {data: {endpoint: 'https://push.example.com/sub'}}
            );
        });

        it('does not call mutateUnsubscribe when unsubscribeBrowser returns null', async () => {
            mockUnsubscribeBrowser.mockResolvedValue(null);
            mockMutate.mockImplementationOnce(
                (_args: unknown, {onSuccess}: {onSuccess: (u: typeof userWithPushOff) => void}) => {
                    onSuccess(userWithPushOff);
                }
            );
            renderForm();
            await act(async () => {
                fireEvent.submit(screen.getByRole('form', {name: /notification preferences/i}));
                await Promise.resolve();
            });
            expect(mockMutateUnsubscribe).not.toHaveBeenCalled();
        });
    });

    describe('re-registration on mount', () => {
        it('calls getCurrentSubscription on mount when notifyPush is true', async () => {
            mockUseAuth.mockReturnValue(makeAuth({...mockUser, notifyPush: true}));
            await act(async () => {
                renderForm();
                await Promise.resolve();
            });
            expect(mockGetCurrentSubscription).toHaveBeenCalledOnce();
        });

        it('calls mutateSubscribe with existing subscription data on mount', async () => {
            const mockSub = makePushSub();
            mockGetCurrentSubscription.mockResolvedValue(mockSub);
            mockUseAuth.mockReturnValue(makeAuth({...mockUser, notifyPush: true}));
            await act(async () => {
                renderForm();
                await Promise.resolve();
            });
            expect(mockMutateSubscribe).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        endpoint: 'https://push.example.com/sub'
                    })
                })
            );
        });

        it('does not call mutateSubscribe on mount when getCurrentSubscription returns null', async () => {
            mockGetCurrentSubscription.mockResolvedValue(null);
            mockUseAuth.mockReturnValue(makeAuth({...mockUser, notifyPush: true}));
            await act(async () => {
                renderForm();
                await Promise.resolve();
            });
            expect(mockMutateSubscribe).not.toHaveBeenCalled();
        });

        it('does not call getCurrentSubscription on mount when notifyPush is false', async () => {
            mockUseAuth.mockReturnValue(makeAuth({...mockUser, notifyPush: false}));
            await act(async () => {
                renderForm();
                await Promise.resolve();
            });
            expect(mockGetCurrentSubscription).not.toHaveBeenCalled();
        });
    });
});
