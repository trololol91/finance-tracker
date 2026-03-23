/**
 * Browser-side Web Push utility functions.
 *
 * All functions are plain async (not React hooks) so they can be called from
 * event handlers without violating Rules of Hooks.  Functions never throw —
 * they return null on every failure path so callers can show user-friendly
 * messages without try/catch boilerplate.
 */

/**
 * Returns true if the ArrayBuffer `a` contains the same bytes as Uint8Array `b`.
 * Used to compare a stored applicationServerKey against the current VAPID key.
 */
const keysMatch = (a: ArrayBuffer, b: Uint8Array<ArrayBuffer>): boolean => {
    if (a.byteLength === 0 || a.byteLength !== b.byteLength) return false;
    const aView = new Uint8Array(a);
    for (let i = 0; i < aView.length; i++) {
        if (aView[i] !== b[i]) return false;
    }
    return true;
};

/** Convert a URL-safe base64 string to a Uint8Array (required for applicationServerKey). */
const urlBase64ToUint8Array = (base64String: string): Uint8Array<ArrayBuffer> => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const output = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
        output[i] = rawData.charCodeAt(i);
    }
    return output;
};

/** Returns true if this browser supports Service Workers and the Push API. */
export const isPushSupported = (): boolean => {
    const win = window as Window & {PushManager?: unknown};
    return 'serviceWorker' in navigator && win.PushManager != null;
};

/**
 * Registers the Service Worker at /sw.js if not already registered.
 * Returns the registration, or null if registration fails (e.g. non-HTTPS, SW not found).
 */
export const registerServiceWorker =
    async (): Promise<ServiceWorkerRegistration | null> => {
        if (!isPushSupported()) return null;
        try {
            return await navigator.serviceWorker.register('/sw.js');
        } catch (err) {
            console.warn('[push] Service Worker registration failed:', err);
            return null;
        }
    };

/**
 * Subscribes the browser to Web Push using the given VAPID public key.
 *
 * Returns the PushSubscription on success, or null when:
 * - vapidPublicKey is empty
 * - Push is not supported in this browser
 * - The user denied notification permission
 * - Any other error occurred
 *
 * Does NOT call the backend — the caller is responsible for POSTing the
 * subscription to /push/subscribe.
 */
export const subscribeBrowser = async (
    vapidPublicKey: string
): Promise<PushSubscription | null> => {
    if (!vapidPublicKey) return null;
    if (!isPushSupported()) return null;

    const registration = await registerServiceWorker();
    if (!registration) return null;

    const newKeyBytes = urlBase64ToUint8Array(vapidPublicKey);

    try {
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
            const storedKey = existing.options.applicationServerKey;
            if (storedKey && keysMatch(storedKey, newKeyBytes)) {
                return existing;
            }
            // Key mismatch (VAPID key rotated) — unsubscribe and re-subscribe.
            await existing.unsubscribe();
        }

        return await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: newKeyBytes
        });
    } catch (err) {
        console.warn('[push] pushManager.subscribe failed:', err);
        return null;
    }
};

/**
 * Unsubscribes the existing browser push subscription.
 *
 * Returns the endpoint string of the subscription that was removed (so the
 * caller can DELETE it from the backend), or null if there was no active
 * subscription.
 *
 * Does NOT call the backend.
 */
export const unsubscribeBrowser = async (): Promise<string | null> => {
    if (!isPushSupported()) return null;

    const registration = await registerServiceWorker();
    if (!registration) return null;

    try {
        const sub = await registration.pushManager.getSubscription();
        if (!sub) return null;
        const {endpoint} = sub;
        await sub.unsubscribe();
        return endpoint;
    } catch (err) {
        console.warn('[push] unsubscribe failed:', err);
        return null;
    }
};

/**
 * Returns the current push subscription without modifying it.
 * Used on app load to re-register a known-good subscription with the backend
 * after a server restart (the backend store is in-memory).
 */
export const getCurrentSubscription =
    async (): Promise<PushSubscription | null> => {
        if (!isPushSupported()) return null;

        const registration = await registerServiceWorker();
        if (!registration) return null;

        try {
            return await registration.pushManager.getSubscription();
        } catch (err) {
            console.warn('[push] getSubscription failed:', err);
            return null;
        }
    };
