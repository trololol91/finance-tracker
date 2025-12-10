export const env = {
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
    API_TIMEOUT: 30000,
    isDevelopment: import.meta.env.DEV,
    isProduction: import.meta.env.PROD,
} as const;
