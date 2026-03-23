/* eslint-disable */
// Service Worker for Web Push notifications.
// Plain JS — not bundled, not TypeScript. Served from root scope as /sw.js.

self.addEventListener('push', (event) => {
    if (!event.data) return;

    let payload;
    try {
        payload = event.data.json();
    } catch {
        payload = {title: 'Finance Tracker', body: event.data.text(), url: '/'};
    }

    const title = payload.title ?? 'Finance Tracker';
    const options = {
        body: payload.body ?? '',
        icon: '/vite.svg',
        data: {url: payload.url ?? '/'}
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url ?? '/';

    event.waitUntil(
        clients.matchAll({type: 'window', includeUncontrolled: true}).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url === targetUrl && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
