import {
    describe,
    it,
    expect,
    beforeEach,
    vi
} from 'vitest';
import {authStorage} from '@services/storage/authStorage.js';
import type {User} from '@features/auth/types/auth.types.js';

describe('authStorage', () => {
    const mockToken = 'mock-jwt-token-12345';
    const mockUser: User = {
        id: '1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        timezone: 'America/New_York',
        currency: 'USD',
        isActive: true,
        createdAt: '2026-01-15T00:00:00.000Z',
        role: 'USER',
        notifyEmail: false
    };

    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    describe('token operations', () => {
        it('saves token to localStorage', () => {
            authStorage.saveToken(mockToken);
            expect(localStorage.getItem('auth_token')).toBe(mockToken);
        });

        it('retrieves token from localStorage', () => {
            localStorage.setItem('auth_token', mockToken);
            expect(authStorage.getToken()).toBe(mockToken);
        });

        it('returns null when token does not exist', () => {
            expect(authStorage.getToken()).toBeNull();
        });

        it('removes token from localStorage', () => {
            localStorage.setItem('auth_token', mockToken);
            authStorage.removeToken();
            expect(localStorage.getItem('auth_token')).toBeNull();
        });
    });

    describe('user operations', () => {
        it('saves user to localStorage', () => {
            authStorage.saveUser(mockUser);
            const stored = localStorage.getItem('user');
            expect(stored).toBeTruthy();
            expect(JSON.parse(stored!)).toEqual(mockUser);
        });

        it('retrieves user from localStorage', () => {
            localStorage.setItem('user', JSON.stringify(mockUser));
            const user = authStorage.getUser();
            expect(user).toEqual(mockUser);
        });

        it('returns null when user does not exist', () => {
            expect(authStorage.getUser()).toBeNull();
        });

        it('throws error when user data is invalid JSON', () => {
            localStorage.setItem('user', 'invalid-json');
            // Since the underlying localStorage.getUser() throws on invalid JSON,
            // we expect an error
            expect(() => authStorage.getUser()).toThrow();
        });

        it('removes user from localStorage', () => {
            localStorage.setItem('user', JSON.stringify(mockUser));
            authStorage.removeUser();
            expect(localStorage.getItem('user')).toBeNull();
        });
    });

    describe('clearAuth', () => {
        it('removes both token and user from localStorage', () => {
            authStorage.saveToken(mockToken);
            authStorage.saveUser(mockUser);

            authStorage.clearAuth();

            expect(localStorage.getItem('auth_token')).toBeNull();
            expect(localStorage.getItem('user')).toBeNull();
        });

        it('does not throw error when clearing empty storage', () => {
            expect(() => { 
                authStorage.clearAuth(); 
            }).not.toThrow();
        });
    });

    describe('edge cases', () => {
        it('handles empty string token', () => {
            authStorage.saveToken('');
            expect(authStorage.getToken()).toBe('');
        });

        it('handles user with special characters', () => {
            const specialUser: User = {
                ...mockUser,
                firstName: 'João',
                lastName: "O'Brien"
            };
            authStorage.saveUser(specialUser);
            const retrieved = authStorage.getUser();
            expect(retrieved).toEqual(specialUser);
        });

        it('handles multiple save operations', () => {
            authStorage.saveToken('token1');
            authStorage.saveToken('token2');
            expect(authStorage.getToken()).toBe('token2');
        });
    });
});
