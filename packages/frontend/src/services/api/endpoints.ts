import { API_ROUTES } from '@config/constants';

export const endpoints = {
    auth: {
        login: API_ROUTES.AUTH.LOGIN,
        register: API_ROUTES.AUTH.REGISTER,
        logout: API_ROUTES.AUTH.LOGOUT,
        refresh: API_ROUTES.AUTH.REFRESH,
    },
    users: {
        base: API_ROUTES.USERS,
        byId: (id: string): string => `${API_ROUTES.USERS}/${id}`,
    },
    transactions: {
        base: API_ROUTES.TRANSACTIONS,
        byId: (id: string): string => `${API_ROUTES.TRANSACTIONS}/${id}`,
    },
    categories: {
        base: API_ROUTES.CATEGORIES,
        byId: (id: string): string => `${API_ROUTES.CATEGORIES}/${id}`,
    },
    accounts: {
        base: API_ROUTES.ACCOUNTS,
        byId: (id: string): string => `${API_ROUTES.ACCOUNTS}/${id}`,
    },
    budgets: {
        base: API_ROUTES.BUDGETS,
        byId: (id: string): string => `${API_ROUTES.BUDGETS}/${id}`,
    },
    reports: {
        base: API_ROUTES.REPORTS,
        generate: `${API_ROUTES.REPORTS}/generate`,
    },
    scraper: {
        base: API_ROUTES.SCRAPER,
        trigger: `${API_ROUTES.SCRAPER}/trigger`,
        status: `${API_ROUTES.SCRAPER}/status`,
    },
} as const;
