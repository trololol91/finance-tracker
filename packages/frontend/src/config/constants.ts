export const APP_NAME = 'Finance Tracker';

export const STORAGE_KEYS = {
    AUTH_TOKEN: 'auth_token',
    USER: 'user',
    THEME: 'theme'
} as const;

export const API_ROUTES = {
    AUTH: {
        LOGIN: '/auth/login',
        REGISTER: '/auth/register',
        LOGOUT: '/auth/logout',
        REFRESH: '/auth/refresh'
    },
    USERS: '/users',
    TRANSACTIONS: '/transactions',
    CATEGORIES: '/categories',
    ACCOUNTS: '/accounts',
    BUDGETS: '/budgets',
    REPORTS: '/reports',
    SCRAPER: '/scraper',
    DASHBOARD: '/dashboard',
    ADMIN_USERS: '/admin/users'
} as const;

export const APP_ROUTES = {
    HOME: '/',
    LOGIN: '/login',
    REGISTER: '/register',
    DASHBOARD: '/dashboard',
    PROFILE: '/profile',
    TRANSACTIONS: '/transactions',
    CATEGORIES: '/categories',
    ACCOUNTS: '/accounts',
    BUDGETS: '/budgets',
    REPORTS: '/reports',
    SCRAPER: '/scraper',
    MFA: '/mfa',
    SETTINGS: '/settings',
    ADMIN: '/admin'
} as const;
