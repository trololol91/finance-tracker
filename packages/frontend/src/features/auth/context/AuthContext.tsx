/* eslint-disable react-refresh/only-export-components */
import React, {
    createContext,
    useState,
    useEffect,
    useCallback
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
    createdAt: dto.createdAt
});

/**
 * Validate a stored token by calling GET /auth/me.
 * Returns the full user profile on success, or null if the token is
 * invalid/expired (network errors are treated as invalid).
 */
const fetchCurrentUser = async (): Promise<User | null> => {
    try {
        const profile = await authControllerGetProfile();
        return mapToUser(profile);
    } catch {
        return null;
    }
};

/**
 * Validate the stored token against the backend and populate auth state.
 * If the token is missing, does nothing.
 * If the token is present but invalid, clears auth storage.
 * Throws if localStorage itself is unavailable (propagates to caller).
 */
const initializeAuth = async (
    setToken: React.Dispatch<React.SetStateAction<string | null>>,
    setUser: React.Dispatch<React.SetStateAction<User | null>>
): Promise<void> => {
    const storedToken = authStorage.getToken(); // may throw — propagates to caller
    if (!storedToken) {
        return;
    }

    // Token exists — validate with backend to get fresh profile data
    const user = await fetchCurrentUser();
    if (user) {
        authStorage.saveUser(user);
        setToken(storedToken);
        setUser(user);
    } else {
        // Token invalid or expired
        authStorage.clearAuth();
    }
};

/**
 * AuthProvider Component
 * Manages authentication state and provides auth methods to child components
 */
export const AuthProvider = ({children}: AuthProviderProps): React.JSX.Element => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const init = async (): Promise<void> => {
            try {
                await initializeAuth(setToken, setUser);
            } catch (error) {
                console.error('Failed to initialize auth:', error);
            } finally {
                setIsLoading(false);
            }
        };

        void init();
    }, []);

    const authMethods = useCallback(() => {
        const login = async (email: string, password: string): Promise<void> => {
            const response = await authControllerLogin({email, password});
            // Save token before calling getProfile so the request interceptor
            // includes the Authorization header.
            authStorage.saveToken(response.accessToken);
            const profile = await authControllerGetProfile();
            const authUser = mapToUser(profile);
            authStorage.saveUser(authUser);
            setToken(response.accessToken);
            setUser(authUser);
        };

        const register = async (data: CreateUserDto): Promise<void> => {
            const response = await authControllerRegister(data);
            authStorage.saveToken(response.accessToken);
            const profile = await authControllerGetProfile();
            const authUser = mapToUser(profile);
            authStorage.saveUser(authUser);
            setToken(response.accessToken);
            setUser(authUser);
        };

        const logout = (): void => {
            authStorage.clearAuth();
            setToken(null);
            setUser(null);
        };

        const updateUser = (updatedUser: User): void => {
            authStorage.saveUser(updatedUser);
            setUser(updatedUser);
        };

        return {login, register, logout, updateUser};
    }, [setToken, setUser]);

    const {login, register, logout, updateUser} = authMethods();
    const isAuthenticated = Boolean(token && user);

    const value: AuthContextType = {
        user,
        token,
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
        updateUser
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
