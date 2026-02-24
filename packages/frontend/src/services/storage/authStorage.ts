import type {User} from '@features/auth/types/auth.types.js';
import {STORAGE_KEYS} from '@config/constants';

/**
 * Authentication storage service for managing auth-related data in localStorage
 */
export const authStorage = {
    /**
     * Save JWT token to localStorage
     */
    saveToken: (token: string): void => {
        localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
    },

    /**
     * Retrieve JWT token from localStorage
     */
    getToken: (): string | null => {
        return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    },

    /**
     * Remove JWT token from localStorage
     */
    removeToken: (): void => {
        localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    },

    /**
     * Save user data to localStorage
     */
    saveUser: (user: User): void => {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    },

    /**
     * Retrieve user data from localStorage
     */
    getUser: (): User | null => {
        const user = localStorage.getItem(STORAGE_KEYS.USER);
        return user ? (JSON.parse(user) as User) : null;
    },

    /**
     * Remove user data from localStorage
     */
    removeUser: (): void => {
        localStorage.removeItem(STORAGE_KEYS.USER);
    },

    /**
     * Clear all authentication data (token + user)
     */
    clearAuth: (): void => {
        localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER);
    }
} as const;
