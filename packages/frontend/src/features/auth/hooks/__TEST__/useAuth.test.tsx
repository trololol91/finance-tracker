import {
    describe,
    it,
    expect
} from 'vitest';
import {
    renderHook,
    waitFor
} from '@testing-library/react';
import {useAuth} from '@features/auth/hooks/useAuth.js';
import {
    AuthProvider,
    AuthContext
} from '@features/auth/context/AuthContext.js';
import React from 'react';
import type {User} from '@features/auth/types/auth.types.js';

describe('useAuth', () => {
    const mockUser: User = {
        id: '1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        timezone: 'America/New_York',
        currency: 'USD',
        isActive: true,
        createdAt: '2026-01-15T00:00:00.000Z'
    };

    it('throws error when used outside AuthProvider', () => {
        // Suppress console.error for this test
        const originalError = console.error;
        console.error = () => {};

        expect(() => {
            renderHook(() => useAuth());
        }).toThrow('useAuth must be used within an AuthProvider');

        console.error = originalError;
    });

    it('returns auth context when used within AuthProvider', async () => {
        const wrapper = ({children}: {children: React.ReactNode}): React.JSX.Element => (
            <AuthProvider>{children}</AuthProvider>
        );

        const {result} = renderHook(() => useAuth(), {wrapper});

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current).toHaveProperty('user');
        expect(result.current).toHaveProperty('token');
        expect(result.current).toHaveProperty('isAuthenticated');
        expect(result.current).toHaveProperty('isLoading');
        expect(result.current).toHaveProperty('login');
        expect(result.current).toHaveProperty('register');
        expect(result.current).toHaveProperty('logout');
        expect(result.current).toHaveProperty('updateUser');
    });

    it('provides correct initial state', async () => {
        const wrapper = ({children}: {children: React.ReactNode}): React.JSX.Element => (
            <AuthProvider>{children}</AuthProvider>
        );

        const {result} = renderHook(() => useAuth(), {wrapper});

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.user).toBeNull();
        expect(result.current.token).toBeNull();
        expect(result.current.isAuthenticated).toBe(false);
    });

    it('provides login function with correct signature', async () => {
        const wrapper = ({children}: {children: React.ReactNode}): React.JSX.Element => (
            <AuthProvider>{children}</AuthProvider>
        );

        const {result} = renderHook(() => useAuth(), {wrapper});

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(typeof result.current.login).toBe('function');
        expect(result.current.login.length).toBe(2);
    });

    it('provides register function with correct signature', async () => {
        const wrapper = ({children}: {children: React.ReactNode}): React.JSX.Element => (
            <AuthProvider>{children}</AuthProvider>
        );

        const {result} = renderHook(() => useAuth(), {wrapper});

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(typeof result.current.register).toBe('function');
        expect(result.current.register.length).toBe(1);
    });

    it('provides logout function with correct signature', async () => {
        const wrapper = ({children}: {children: React.ReactNode}): React.JSX.Element => (
            <AuthProvider>{children}</AuthProvider>
        );

        const {result} = renderHook(() => useAuth(), {wrapper});

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(typeof result.current.logout).toBe('function');
        expect(result.current.logout.length).toBe(0);
    });

    it('provides updateUser function with correct signature', async () => {
        const wrapper = ({children}: {children: React.ReactNode}): React.JSX.Element => (
            <AuthProvider>{children}</AuthProvider>
        );

        const {result} = renderHook(() => useAuth(), {wrapper});

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(typeof result.current.updateUser).toBe('function');
        expect(result.current.updateUser.length).toBe(1);
    });

    it('works with custom context value', () => {
        const mockContextValue = {
            user: mockUser,
            token: 'mock-token',
            isAuthenticated: true,
            isLoading: false,
            login: () => Promise.resolve(),
            register: () => Promise.resolve(),
            logout: () => {},
            updateUser: () => {}
        };

        const wrapper = ({children}: {children: React.ReactNode}): React.JSX.Element => (
            <AuthContext.Provider value={mockContextValue}>
                {children}
            </AuthContext.Provider>
        );

        const {result} = renderHook(() => useAuth(), {wrapper});

        expect(result.current.user).toEqual(mockUser);
        expect(result.current.token).toBe('mock-token');
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.isLoading).toBe(false);
    });
});
