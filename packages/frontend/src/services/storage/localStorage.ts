import {STORAGE_KEYS} from '@config/constants';

export const storage = {
    getAuthToken: (): string | null => {
        return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    },

    setAuthToken: (token: string): void => {
        localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
    },

    removeAuthToken: (): void => {
        localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    },

    getUser: <T>(): T | null => {
        const user = localStorage.getItem(STORAGE_KEYS.USER);
        return user ? (JSON.parse(user) as T) : null;
    },

    setUser: <T>(user: T): void => {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    },

    removeUser: (): void => {
        localStorage.removeItem(STORAGE_KEYS.USER);
    },

    clear: (): void => {
        localStorage.clear();
    }
} as const;
