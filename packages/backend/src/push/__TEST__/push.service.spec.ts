import {
    describe,
    it,
    expect,
    vi,
    beforeEach
} from 'vitest';
import {Logger} from '@nestjs/common';
import type {ConfigService} from '@nestjs/config';
import * as webpush from 'web-push';
import * as nodemailer from 'nodemailer';
import {PushService} from '#push/push.service.js';
import {PushSubscriptionStore} from '#push/push-subscription.store.js';
import type {PrismaService} from '#database/prisma.service.js';

// ---------------------------------------------------------------------------
// Module mocks — Vitest hoists these automatically
// ---------------------------------------------------------------------------
vi.mock('web-push', () => ({
    default: {setVapidDetails: vi.fn(), sendNotification: vi.fn()},
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn()
}));

vi.mock('nodemailer', () => ({
    default: {createTransport: vi.fn()},
    createTransport: vi.fn()
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeTransporter = () => ({sendMail: vi.fn().mockResolvedValue({})});

const makeUser = (overrides: object = {}) => ({
    id: 'user-1',
    email: 'user@example.com',
    notifyPush: true,
    notifyEmail: true,
    ...overrides
});

const makePrisma = (userData: object | null = makeUser()): PrismaService =>
    ({
        user: {findUnique: vi.fn().mockResolvedValue(userData)}
    }) as unknown as PrismaService;

const makeConfig = (values: Record<string, unknown>): ConfigService =>
    ({get: vi.fn((key: string) => values[key])}) as unknown as ConfigService;

const VAPID_CONFIG = {
    VAPID_PUBLIC_KEY: 'BPublicKey',
    VAPID_PRIVATE_KEY: 'privateKey',
    VAPID_SUBJECT: 'mailto:admin@example.com'
};

const SMTP_CONFIG = {
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: 587,
    SMTP_USER: 'user@example.com',
    SMTP_PASS: 's3cret'
};

/** Build a PushService using direct construction (mirrors project convention). */
const buildService = (
    configValues: Record<string, unknown> = {...VAPID_CONFIG, ...SMTP_CONFIG},
    userData: object | null = makeUser()
): {
    service: PushService;
    store: PushSubscriptionStore;
    transporter: ReturnType<typeof makeTransporter>;
} => {
    const transporter = makeTransporter();
    vi.mocked(nodemailer.createTransport).mockReturnValue(
        transporter as unknown as ReturnType<typeof nodemailer.createTransport>
    );
    const store = new PushSubscriptionStore();
    const prisma = makePrisma(userData);
    const config = makeConfig(configValues);
    const service = new PushService(prisma, store, config);
    return {service, store, transporter};
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('PushService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    describe('constructor', () => {
        it('calls setVapidDetails when all VAPID vars are present', () => {
            buildService();
            expect(vi.mocked(webpush.setVapidDetails)).toHaveBeenCalledWith(
                VAPID_CONFIG.VAPID_SUBJECT,
                VAPID_CONFIG.VAPID_PUBLIC_KEY,
                VAPID_CONFIG.VAPID_PRIVATE_KEY
            );
        });

        it('warns and skips setVapidDetails when VAPID vars are missing', () => {
            const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => void 0);
            buildService({...SMTP_CONFIG});
            expect(vi.mocked(webpush.setVapidDetails)).not.toHaveBeenCalled();
            expect(warnSpy).toHaveBeenCalled();
        });

        it('calls createTransport when SMTP vars are present', () => {
            buildService();
            expect(vi.mocked(nodemailer.createTransport)).toHaveBeenCalledWith(
                expect.objectContaining({host: SMTP_CONFIG.SMTP_HOST})
            );
        });

        it('warns and skips createTransport when SMTP vars are missing', () => {
            const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => void 0);
            buildService({...VAPID_CONFIG});
            expect(vi.mocked(nodemailer.createTransport)).not.toHaveBeenCalled();
            expect(warnSpy).toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // subscribe / unsubscribe
    // -------------------------------------------------------------------------

    describe('subscribe', () => {
        it('adds subscription to the store', () => {
            const {service, store} = buildService();
            service.subscribe('user-1', {
                endpoint: 'https://fcm.example.com/sub',
                keys: {p256dh: 'pub', auth: 'sec'}
            });
            expect(store.getAll('user-1')).toHaveLength(1);
            expect(store.getAll('user-1')[0].endpoint).toBe('https://fcm.example.com/sub');
        });

        it('replacing the same endpoint deduplicates', () => {
            const {service, store} = buildService();
            service.subscribe('user-1', {
                endpoint: 'https://fcm.example.com/sub',
                keys: {p256dh: 'pub1', auth: 'sec1'}
            });
            service.subscribe('user-1', {
                endpoint: 'https://fcm.example.com/sub',
                keys: {p256dh: 'pub2', auth: 'sec2'}
            });
            expect(store.getAll('user-1')).toHaveLength(1);
        });
    });

    describe('unsubscribe', () => {
        it('removes the subscription from the store', () => {
            const {service, store} = buildService();
            service.subscribe('user-1', {
                endpoint: 'https://fcm.example.com/sub',
                keys: {p256dh: 'k', auth: 'a'}
            });
            service.unsubscribe('user-1', 'https://fcm.example.com/sub');
            expect(store.getAll('user-1')).toHaveLength(0);
        });
    });

    // -------------------------------------------------------------------------
    // sendNotification
    // -------------------------------------------------------------------------

    describe('sendNotification', () => {
        it('does nothing when the user is not found', async () => {
            const {service} = buildService({...VAPID_CONFIG, ...SMTP_CONFIG}, null);
            await service.sendNotification('ghost', 'title', 'body', '/url');
            expect(vi.mocked(webpush.sendNotification)).not.toHaveBeenCalled();
        });

        it('sends a web push when notifyPush is true and subscriptions exist', async () => {
            const {service} = buildService(
                {...VAPID_CONFIG, ...SMTP_CONFIG},
                makeUser({notifyPush: true, notifyEmail: false})
            );
            service.subscribe('user-1', {
                endpoint: 'https://fcm.example.com/sub',
                keys: {p256dh: 'k', auth: 'a'}
            });
            vi.mocked(webpush.sendNotification).mockResolvedValue({} as never);

            await service.sendNotification('user-1', 'MFA', 'Enter code', '/mfa');

            expect(vi.mocked(webpush.sendNotification)).toHaveBeenCalledOnce();
            expect(vi.mocked(webpush.sendNotification)).toHaveBeenCalledWith(
                expect.objectContaining({endpoint: 'https://fcm.example.com/sub'}),
                JSON.stringify({title: 'MFA', body: 'Enter code', url: '/mfa'})
            );
        });

        it('does not send web push when notifyPush is false', async () => {
            const {service} = buildService(
                {...VAPID_CONFIG, ...SMTP_CONFIG},
                makeUser({notifyPush: false, notifyEmail: false})
            );
            service.subscribe('user-1', {
                endpoint: 'https://fcm.example.com/sub',
                keys: {p256dh: 'k', auth: 'a'}
            });

            await service.sendNotification('user-1', 'MFA', 'Enter code', '/mfa');

            expect(vi.mocked(webpush.sendNotification)).not.toHaveBeenCalled();
        });

        it('does not send web push when no subscriptions are registered', async () => {
            const {service} = buildService(
                {...VAPID_CONFIG, ...SMTP_CONFIG},
                makeUser({notifyPush: true, notifyEmail: false})
            );
            vi.mocked(webpush.sendNotification).mockResolvedValue({} as never);

            await service.sendNotification('user-1', 'MFA', 'Enter', '/mfa');

            expect(vi.mocked(webpush.sendNotification)).not.toHaveBeenCalled();
        });

        it('sends an email when notifyEmail is true', async () => {
            const {service, transporter} = buildService(
                {...VAPID_CONFIG, ...SMTP_CONFIG},
                makeUser({notifyPush: false, notifyEmail: true})
            );

            await service.sendNotification('user-1', 'MFA', 'Enter code', '/mfa');

            expect(transporter.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({to: 'user@example.com', subject: 'MFA'})
            );
        });

        it('does not send email when notifyEmail is false', async () => {
            const {service, transporter} = buildService(
                {...VAPID_CONFIG, ...SMTP_CONFIG},
                makeUser({notifyPush: false, notifyEmail: false})
            );

            await service.sendNotification('user-1', 'MFA', 'Enter code', '/mfa');

            expect(transporter.sendMail).not.toHaveBeenCalled();
        });

        it('does not send email when SMTP is not configured', async () => {
            const {service, transporter} = buildService(
                {...VAPID_CONFIG},  // no SMTP_*
                makeUser({notifyPush: false, notifyEmail: true})
            );

            await service.sendNotification('user-1', 'MFA', 'Enter code', '/mfa');

            expect(transporter.sendMail).not.toHaveBeenCalled();
        });

        it('does not send web push when VAPID is not configured', async () => {
            const {service} = buildService(
                {...SMTP_CONFIG},  // no VAPID_*
                makeUser({notifyPush: true, notifyEmail: false})
            );
            service.subscribe('user-1', {
                endpoint: 'https://fcm.example.com/sub',
                keys: {p256dh: 'k', auth: 'a'}
            });

            await service.sendNotification('user-1', 'MFA', 'Enter code', '/mfa');

            expect(vi.mocked(webpush.sendNotification)).not.toHaveBeenCalled();
        });

        it('purges a stale subscription on HTTP 410 response', async () => {
            const {service, store} = buildService(
                {...VAPID_CONFIG, ...SMTP_CONFIG},
                makeUser({notifyPush: true, notifyEmail: false})
            );
            service.subscribe('user-1', {
                endpoint: 'https://gone.example.com/sub',
                keys: {p256dh: 'k', auth: 'a'}
            });
            vi.mocked(webpush.sendNotification).mockRejectedValue(
                Object.assign(new Error('Subscription expired'), {statusCode: 410})
            );

            await service.sendNotification('user-1', 'MFA', 'Enter code', '/mfa');

            expect(store.getAll('user-1')).toHaveLength(0);
        });

        it('purges a stale subscription on HTTP 404 response', async () => {
            const {service, store} = buildService(
                {...VAPID_CONFIG, ...SMTP_CONFIG},
                makeUser({notifyPush: true, notifyEmail: false})
            );
            service.subscribe('user-1', {
                endpoint: 'https://gone.example.com/sub',
                keys: {p256dh: 'k', auth: 'a'}
            });
            vi.mocked(webpush.sendNotification).mockRejectedValue(
                Object.assign(new Error('Not Found'), {statusCode: 404})
            );

            await service.sendNotification('user-1', 'MFA', 'Enter code', '/mfa');

            expect(store.getAll('user-1')).toHaveLength(0);
        });

        it('logs error on unexpected push failure (not 404/410)', async () => {
            const errorSpy = vi.spyOn(Logger.prototype, 'error')
                .mockImplementation(() => void 0);
            const {service} = buildService(
                {...VAPID_CONFIG, ...SMTP_CONFIG},
                makeUser({notifyPush: true, notifyEmail: false})
            );
            service.subscribe('user-1', {
                endpoint: 'https://fcm.example.com/sub',
                keys: {p256dh: 'k', auth: 'a'}
            });
            vi.mocked(webpush.sendNotification).mockRejectedValue(
                Object.assign(new Error('Internal Server Error'), {statusCode: 500})
            );

            await service.sendNotification('user-1', 'MFA', 'Enter code', '/mfa');

            expect(errorSpy).toHaveBeenCalled();
        });

        it('delivers to all registered subscribers', async () => {
            const {service} = buildService(
                {...VAPID_CONFIG, ...SMTP_CONFIG},
                makeUser({notifyPush: true, notifyEmail: false})
            );
            service.subscribe('user-1', {
                endpoint: 'https://fcm.example.com/sub1',
                keys: {p256dh: 'k1', auth: 'a1'}
            });
            service.subscribe('user-1', {
                endpoint: 'https://fcm.example.com/sub2',
                keys: {p256dh: 'k2', auth: 'a2'}
            });
            vi.mocked(webpush.sendNotification).mockResolvedValue({} as never);

            await service.sendNotification('user-1', 'MFA', 'Enter', '/mfa');

            expect(vi.mocked(webpush.sendNotification)).toHaveBeenCalledTimes(2);
        });
    });
});
