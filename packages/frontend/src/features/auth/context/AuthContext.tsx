/* eslint-disable react-refresh/only-export-components */
import React, {
    createContext,
    useState,
    useEffect,
    useCallback,
    useMemo
} from 'react';
import type {
    AuthContextType,
    User
} from '@features/auth/types/auth.types.js';
import type {CreateUserDto} from '@/api/model/createUserDto.js';
import type {UserResponseDto} from '@/api/model/userResponseDto.js';
import {
    authControllerLogin,
    authControllerRegister,
    authControllerGetProfile
} from '@/api/auth/auth.js';
import {authStorage} from '@services/storage/authStorage.js';

/**
 * Authentication Context
 * Provides authentication state and methods throughout the app
 */
export const AuthContext = createContext<AuthContextType | undefined>(
    undefined
);

interface AuthProviderProps {
    children: React.ReactNode;
}

/**
 * Map an Orval-generated UserResponseDto to the local User type.
 * Provides empty-string defaults for nullable firstName/lastName.
 */
const mapToUser = (dto: UserResponseDto): User => ({
    id: dto.id,
    email: dto.email,
    firstName: dto.firstName ?? '',
    lastName: dto.lastName ?? '',
    timezone: dto.timezone,
    currency: dto.currency,
    isActive: dto.isActive,
    createdAt: dto.createdAt,
    role: dto.role,
    notifyPush: dto.notifyPush,
    notifyEmail: dto.notifyEmail
});

/**
 * Thrown when the backend returns 401 / 403 — token is expired or invalid.
 * The stored token should be cleared.
 */
class AuthExpiredError extends Error {
    constructor() { super('Auth token expired or invalid'); }
}

/**
 * Thrown when the backend is unreachable or returns 5xx.
 * The stored token should be preserved so the user is not logged out
 * during a transient network outage.
 */
class NetworkError extends Error {
    constructor(message: string) { super(message); }
}

/**
 * Validate a stored token by calling GET /auth/me.
 * Throws AuthExpiredError on 401/403, NetworkError on everything else.
 */
const fetchCurrentUser = async (): Promise<User> => {
    try {
        const profile = await authControllerGetProfile();
        return mapToUser(profile);
    } catch (err: unknown) {
        const status = (err as {response?: {status?: number}}).response?.status;
        if (status === 401 || status === 403) throw new AuthExpiredError();
        throw new NetworkError(err instanceof Error ? err.message : 'Network error');
    }
};

/**
 * Validate the stored token against the backend and populate auth state.
 * If the token is missing, does nothing.
 * Throws AuthExpiredError if the token is invalid/expired.
 * Throws NetworkError if the backend is unreachable.
 */
const initializeAuth = async (
    setToken: React.Dispatch<React.SetStateAction<string | null>>,
    setUser: React.Dispatch<React.SetStateAction<User | null>>
): Promise<void> => {
    const storedToken = authStorage.getToken(); // may throw — propagates to caller
    if (!storedToken) {
        return;
    }

    // Token exists — validate with backend to get fresh profile data.
    // fetchCurrentUser throws on failure; let the caller handle it.
    const user = await fetchCurrentUser();
    authStorage.saveUser(user);
    setToken(storedToken);
    setUser(user);
};

/**
 * AuthProvider Component
 * Manages authentication state and provides auth methods to child components
 */
export const AuthProvider = ({children}: AuthProviderProps): React.JSX.Element => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [authError, setAuthError] = useState<string | null>(null);

    useEffect(() => {
        const init = async (): Promise<void> => {
            try {
                await initializeAuth(setToken, setUser);
            } catch (error) {
                if (error instanceof AuthExpiredError) {
                    // Token is definitively invalid — clear storage.
                    // PrivateRoute will redirect to /login naturally.
                    authStorage.clearAuth();
                } else if (error instanceof NetworkError) {
                    // Backend is temporarily unreachable — preserve the token and
                    // show a user-visible message instead of silently redirecting.
                    setAuthError('Unable to reach the server. Please check your connection.');
                } else {
                    console.error('[AuthContext] Unexpected auth init error:', error);
                }
            } finally {
                setIsLoading(false);
            }
        };

        void init();
    }, []);

    const login = useCallback(async (email: string, password: string): Promise<void> => {
        const response = await authControllerLogin({email, password});
        // Save token before calling getProfile so the request interceptor
        // includes the Authorization header.
        authStorage.saveToken(response.accessToken);
        const profile = await authControllerGetProfile();
        const authUser = mapToUser(profile);
        authStorage.saveUser(authUser);
        setToken(response.accessToken);
        setUser(authUser);
    }, []);

    const register = useCallback(async (data: CreateUserDto): Promise<void> => {
        const response = await authControllerRegister(data);
        authStorage.saveToken(response.accessToken);
        const profile = await authControllerGetProfile();
        const authUser = mapToUser(profile);
        authStorage.saveUser(authUser);
        setToken(response.accessToken);
        setUser(authUser);
    }, []);

    const logout = useCallback((): void => {
        authStorage.clearAuth();
        setToken(null);
        setUser(null);
    }, []);

    const updateUser = useCallback((updatedUser: User): void => {
        authStorage.saveUser(updatedUser);
        setUser(updatedUser);
    }, []);

    const isAuthenticated = Boolean(token && user);

    const value = useMemo<AuthContextType>(() => ({
        user,
        token,
        isAuthenticated,
        isLoading,
        authError,
        login,
        register,
        logout,
        updateUser
    }), [user, token, isAuthenticated, isLoading, authError, login, register, logout, updateUser]);

    return (
        <AuthContext.Provider value={value}>
            {authError !== null && (
                <div
                    role="alert"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        zIndex: 9999,
                        background: '#fef3c7',
                        borderBottom: '1px solid #f59e0b',
                        color: '#92400e',
                        padding: '0.75rem 1.5rem',
                        textAlign: 'center',
                        fontWeight: 500
                    }}
                >
                    {authError}
                </div>
            )}
            {children}
        </AuthContext.Provider>
    );
};
