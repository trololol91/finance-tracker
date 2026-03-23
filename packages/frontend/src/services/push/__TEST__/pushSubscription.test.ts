import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    afterEach
} from 'vitest';
import {
    isPushSupported,
    registerServiceWorker,
    subscribeBrowser,
    unsubscribeBrowser,
    getCurrentSubscription
} from '@services/push/pushSubscription.js';

// ── Helpers ────────────────────────────────────────────────────────────────

const makeRegistration = (
    overrides: Partial<ServiceWorkerRegistration> = {}
): ServiceWorkerRegistration =>
    ({
        pushManager: {
            getSubscription: vi.fn().mockResolvedValue(null),
            subscribe: vi.fn()
        },
        ...overrides
    }) as unknown as ServiceWorkerRegistration;

const makeSub = (endpoint = 'https://push.example.com/sub'): PushSubscription =>
    ({
        endpoint,
        unsubscribe: vi.fn().mockResolvedValue(true)
    }) as unknown as PushSubscription;

// ── Tests ──────────────────────────────────────────────────────────────────

describe('isPushSupported', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('returns true when serviceWorker and PushManager are available', () => {
        vi.stubGlobal('navigator', {serviceWorker: {}});
        vi.stubGlobal('PushManager', class {});
        expect(isPushSupported()).toBe(true);
    });

    it('returns false when serviceWorker is not available', () => {
        vi.stubGlobal('navigator', {});
        expect(isPushSupported()).toBe(false);
    });

    it('returns false when PushManager is not available', () => {
        vi.stubGlobal('navigator', {serviceWorker: {}});
        vi.stubGlobal('PushManager', undefined);
        expect(isPushSupported()).toBe(false);
    });
});

describe('registerServiceWorker', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('returns null when push is not supported', async () => {
        vi.stubGlobal('navigator', {});
        const result = await registerServiceWorker();
        expect(result).toBeNull();
    });

    it('returns the registration on success', async () => {
        const reg = makeRegistration();
        vi.stubGlobal('navigator', {
            serviceWorker: {register: vi.fn().mockResolvedValue(reg)}
        });
        vi.stubGlobal('PushManager', class {});
        const result = await registerServiceWorker();
        expect(result).toBe(reg);
    });

    it('returns null when registration throws', async () => {
        vi.stubGlobal('navigator', {
            serviceWorker: {register: vi.fn().mockRejectedValue(new Error('HTTPS required'))}
        });
        vi.stubGlobal('PushManager', class {});
        const result = await registerServiceWorker();
        expect(result).toBeNull();
    });
});

describe('subscribeBrowser', () => {
    beforeEach(() => {
        vi.unstubAllGlobals();
    });

    it('returns null when vapidPublicKey is empty', async () => {
        expect(await subscribeBrowser('')).toBeNull();
    });

    it('returns null when push is not supported', async () => {
        vi.stubGlobal('navigator', {});
        expect(await subscribeBrowser('some-key')).toBeNull();
    });

    it('returns existing subscription without creating a new one', async () => {
        const existingSub = makeSub();
        const reg = makeRegistration({
            pushManager: {
                getSubscription: vi.fn().mockResolvedValue(existingSub),
                subscribe: vi.fn()
            } as unknown as PushManager
        });
        vi.stubGlobal('navigator', {
            serviceWorker: {register: vi.fn().mockResolvedValue(reg)}
        });
        vi.stubGlobal('PushManager', class {});

        const result = await subscribeBrowser('test-key');
        expect(result).toBe(existingSub);
        expect(reg.pushManager.subscribe).not.toHaveBeenCalled();
    });

    it('subscribes and returns new subscription when none exists', async () => {
        const newSub = makeSub('https://push.example.com/new');
        const reg = makeRegistration({
            pushManager: {
                getSubscription: vi.fn().mockResolvedValue(null),
                subscribe: vi.fn().mockResolvedValue(newSub)
            } as unknown as PushManager
        });
        vi.stubGlobal('navigator', {
            serviceWorker: {register: vi.fn().mockResolvedValue(reg)}
        });
        vi.stubGlobal('PushManager', class {});

        const result = await subscribeBrowser('dGVzdC12YXBpZC1rZXk=');
        expect(result).toBe(newSub);
    });

    it('returns null when subscribe throws (e.g. permission denied)', async () => {
        const reg = makeRegistration({
            pushManager: {
                getSubscription: vi.fn().mockResolvedValue(null),
                subscribe: vi.fn().mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'))
            } as unknown as PushManager
        });
        vi.stubGlobal('navigator', {
            serviceWorker: {register: vi.fn().mockResolvedValue(reg)}
        });
        vi.stubGlobal('PushManager', class {});

        const result = await subscribeBrowser('dGVzdC12YXBpZC1rZXk=');
        expect(result).toBeNull();
    });
});

describe('unsubscribeBrowser', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('returns null when push is not supported', async () => {
        vi.stubGlobal('navigator', {});
        expect(await unsubscribeBrowser()).toBeNull();
    });

    it('returns null when there is no existing subscription', async () => {
        const reg = makeRegistration();
        vi.stubGlobal('navigator', {
            serviceWorker: {register: vi.fn().mockResolvedValue(reg)}
        });
        vi.stubGlobal('PushManager', class {});
        expect(await unsubscribeBrowser()).toBeNull();
    });

    it('unsubscribes and returns the endpoint', async () => {
        const sub = makeSub('https://push.example.com/sub');
        const reg = makeRegistration({
            pushManager: {
                getSubscription: vi.fn().mockResolvedValue(sub),
                subscribe: vi.fn()
            } as unknown as PushManager
        });
        vi.stubGlobal('navigator', {
            serviceWorker: {register: vi.fn().mockResolvedValue(reg)}
        });
        vi.stubGlobal('PushManager', class {});

        const result = await unsubscribeBrowser();
        expect(result).toBe('https://push.example.com/sub');
        expect(sub.unsubscribe).toHaveBeenCalled();
    });
});

describe('getCurrentSubscription', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('returns null when push is not supported', async () => {
        vi.stubGlobal('navigator', {});
        expect(await getCurrentSubscription()).toBeNull();
    });

    it('returns null when there is no subscription', async () => {
        const reg = makeRegistration();
        vi.stubGlobal('navigator', {
            serviceWorker: {register: vi.fn().mockResolvedValue(reg)}
        });
        vi.stubGlobal('PushManager', class {});
        expect(await getCurrentSubscription()).toBeNull();
    });

    it('returns the existing subscription', async () => {
        const sub = makeSub();
        const reg = makeRegistration({
            pushManager: {
                getSubscription: vi.fn().mockResolvedValue(sub),
                subscribe: vi.fn()
            } as unknown as PushManager
        });
        vi.stubGlobal('navigator', {
            serviceWorker: {register: vi.fn().mockResolvedValue(reg)}
        });
        vi.stubGlobal('PushManager', class {});

        const result = await getCurrentSubscription();
        expect(result).toBe(sub);
    });
});
