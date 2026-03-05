import {
    describe,
    it,
    expect,
    vi,
    beforeEach
} from 'vitest';
import {PushController} from '#push/push.controller.js';
import type {PushService} from '#push/push.service.js';
import type {User} from '#generated/prisma/client.js';
import type {SubscribePushDto} from '#push/dto/subscribe-push.dto.js';
import type {UnsubscribePushDto} from '#push/dto/unsubscribe-push.dto.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeUser = (overrides: Partial<User> = {}): User =>
    ({
        id: 'user-uuid-1',
        email: 'alice@example.com',
        ...overrides
    }) as User;

const makePushService = (): PushService =>
    ({
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        sendNotification: vi.fn()
    }) as unknown as PushService;

const makeSubscribeDto = (): SubscribePushDto => ({
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
    keys: {p256dh: 'BGPublicKey', auth: 'authSecret'}
});

const makeUnsubscribeDto = (): UnsubscribePushDto => ({
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc123'
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PushController', () => {
    let controller: PushController;
    let pushService: PushService;

    beforeEach(() => {
        vi.clearAllMocks();
        pushService = makePushService();
        controller = new PushController(pushService);
    });

    describe('subscribe', () => {
        it('calls pushService.subscribe with userId and dto', () => {
            const user = makeUser();
            const dto = makeSubscribeDto();

            controller.subscribe(user, dto);

            expect(pushService.subscribe).toHaveBeenCalledWith(user.id, dto);
        });

        it('returns a confirmation message', () => {
            const result = controller.subscribe(makeUser(), makeSubscribeDto());
            expect(result).toEqual({message: 'Subscribed to push notifications.'});
        });
    });

    describe('unsubscribe', () => {
        it('calls pushService.unsubscribe with userId and endpoint', () => {
            const user = makeUser();
            const dto = makeUnsubscribeDto();

            controller.unsubscribe(user, dto);

            expect(pushService.unsubscribe).toHaveBeenCalledWith(
                user.id,
                dto.endpoint
            );
        });

        it('delegates to pushService.unsubscribe without returning a body', () => {
            controller.unsubscribe(makeUser(), makeUnsubscribeDto());
            expect(pushService.unsubscribe).toHaveBeenCalledTimes(1);
        });
    });
});
