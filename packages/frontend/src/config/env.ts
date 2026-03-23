declare global {
    interface Window {
        __ENV__?: {
            VITE_API_BASE_URL?: string;
            VITE_VAPID_PUBLIC_KEY?: string;
        };
    }
}

export const env = {
    API_BASE_URL:
        window.__ENV__?.VITE_API_BASE_URL ??
        (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
        'http://localhost:3001',
    API_TIMEOUT: 30000,
    VAPID_PUBLIC_KEY:
        window.__ENV__?.VITE_VAPID_PUBLIC_KEY ??
        (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ??
        '',
    isDevelopment: import.meta.env.DEV,
    isProduction: import.meta.env.PROD
} as const;
