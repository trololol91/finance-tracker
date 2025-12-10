export const APP_NAME = 'Finance Tracker';

export const STORAGE_KEYS = {
    AUTH_TOKEN: 'auth_token',
    USER: 'user',
    THEME: 'theme',
} as const;

export const API_ROUTES = {
    AUTH: {
        LOGIN: '/auth/login',
        REGISTER: '/auth/register',
        LOGOUT: '/auth/logout',
        REFRESH: '/auth/refresh',
    },
    USERS: '/users',
    TRANSACTIONS: '/transactions',
    CATEGORIES: '/categories',
    ACCOUNTS: '/accounts',
    BUDGETS: '/budgets',
    REPORTS: '/reports',
    SCRAPER: '/scraper',
} as const;

export const APP_ROUTES = {
    HOME: '/',
    LOGIN: '/login',
    REGISTER: '/register',
    DASHBOARD: '/dashboard',
    TRANSACTIONS: '/transactions',
    CATEGORIES: '/categories',
    ACCOUNTS: '/accounts',
    BUDGETS: '/budgets',
    REPORTS: '/reports',
    SCRAPER: '/scraper',
} as const;
