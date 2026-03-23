import {
    describe, it, expect, vi, beforeEach
} from 'vitest';
import {
    render, screen, act
} from '@testing-library/react';
import {PushBootstrap} from '@services/push/PushBootstrap.js';
import type {User} from '@features/auth/types/auth.types.js';

// ── Mock dependencies ──────────────────────────────────────────────────────

const mockMutateSubscribe = vi.fn();

vi.mock('@features/auth/hooks/useAuth.js', () => ({
    useAuth: vi.fn()
}));

vi.mock('@/api/push/push.js', () => ({
    usePushControllerSubscribe: vi.fn()
}));

vi.mock('@services/push/pushSubscription.js', () => ({
    getCurrentSubscription: vi.fn()
}));

import {useAuth} from '@features/auth/hooks/useAuth.js';
import {usePushControllerSubscribe} from '@/api/push/push.js';
import {getCurrentSubscription} from '@services/push/pushSubscription.js';

const mockUseAuth = vi.mocked(useAuth);
const mockUsePushSubscribe = vi.mocked(usePushControllerSubscribe);
const mockGetCurrentSubscription = vi.mocked(getCurrentSubscription);

type AuthReturn = ReturnType<typeof useAuth>;
type PushSubscribeReturn = ReturnType<typeof usePushControllerSubscribe>;

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

const makePushSub = (endpoint = 'https://push.example.com/sub'): PushSubscription =>
    ({
        endpoint,
        getKey: (k: string): ArrayBuffer =>
            k === 'p256dh' ? new ArrayBuffer(65) : new ArrayBuffer(16)
    }) as unknown as PushSubscription;

// ── Tests ──────────────────────────────────────────────────────────────────

describe('PushBootstrap', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseAuth.mockReturnValue(
            {user: mockUser, updateUser: vi.fn()} as unknown as AuthReturn
        );
        mockUsePushSubscribe.mockReturnValue(
            {mutate: mockMutateSubscribe, isPending: false} as unknown as PushSubscribeReturn
        );
        mockGetCurrentSubscription.mockResolvedValue(null);
    });

    it('renders children', async () => {
        await act(async () => {
            render(<PushBootstrap><span>child</span></PushBootstrap>);
            await Promise.resolve();
        });
        expect(screen.getByText('child')).toBeInTheDocument();
    });

    it('does not call mutateSubscribe when no existing subscription', async () => {
        mockGetCurrentSubscription.mockResolvedValue(null);
        await act(async () => {
            render(<PushBootstrap><span /></PushBootstrap>);
            await Promise.resolve();
        });
        expect(mockMutateSubscribe).not.toHaveBeenCalled();
    });

    it('calls mutateSubscribe with encoded keys when subscription exists', async () => {
        mockGetCurrentSubscription.mockResolvedValue(makePushSub());
        await act(async () => {
            render(<PushBootstrap><span /></PushBootstrap>);
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

    it('does not call mutateSubscribe when user is null', async () => {
        mockUseAuth.mockReturnValue(
            {user: null, updateUser: vi.fn()} as unknown as AuthReturn
        );
        mockGetCurrentSubscription.mockResolvedValue(makePushSub());
        await act(async () => {
            render(<PushBootstrap><span /></PushBootstrap>);
            await Promise.resolve();
        });
        expect(mockMutateSubscribe).not.toHaveBeenCalled();
    });

    it('does not call mutateSubscribe when subscription has no keys', async () => {
        const subNoKeys = {
            endpoint: 'https://push.example.com/sub',
            getKey: (): null => null
        } as unknown as PushSubscription;
        mockGetCurrentSubscription.mockResolvedValue(subNoKeys);
        await act(async () => {
            render(<PushBootstrap><span /></PushBootstrap>);
            await Promise.resolve();
        });
        expect(mockMutateSubscribe).not.toHaveBeenCalled();
    });
});
