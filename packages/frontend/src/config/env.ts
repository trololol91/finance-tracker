declare global {
    interface Window {
        __ENV__?: {VITE_API_BASE_URL?: string};
    }
}

export const env = {
    API_BASE_URL:
        window.__ENV__?.VITE_API_BASE_URL ??
        (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
        'http://localhost:3001',
    API_TIMEOUT: 30000,
    isDevelopment: import.meta.env.DEV,
    isProduction: import.meta.env.PROD
} as const;
