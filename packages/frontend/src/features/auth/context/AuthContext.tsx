/* eslint-disable react-refresh/only-export-components */
import React, {
    createContext,
    useState,
    useEffect,
    useCallback
} from 'react';
import type {
    AuthContextType,
    User,
    RegisterRequest
} from '@features/auth/types/auth.types.js';
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
 * Initialize authentication state from localStorage
 * @returns Promise that resolves when initialization is complete
 */
const loadStoredAuth = (): Promise<{
    token: string | null;
    user: User | null;
}> => {
    try {
        const storedToken = authStorage.getToken();
        const storedUser = authStorage.getUser();

        if (storedToken && storedUser) {
            // TODO: Validate token with backend in Phase 1.2
            // Add async/await when implementing:
            // const isValid = await authService.validateToken();
            // if (!isValid) {
            //     authStorage.clearAuth();
            //     return {token: null, user: null};
            // }
            return Promise.resolve({token: storedToken, user: storedUser});
        }

        return Promise.resolve({token: null, user: null});
    } catch (error) {
        console.error('Failed to load stored auth:', error);
        authStorage.clearAuth();
        return Promise.resolve({token: null, user: null});
    }
};

/**
 * Create authentication methods
 */
const createAuthMethods = (
    setToken: React.Dispatch<React.SetStateAction<string | null>>,
    setUser: React.Dispatch<React.SetStateAction<User | null>>
): Pick<AuthContextType, 'login' | 'register' | 'logout' | 'updateUser'> => {
    const login = (_email: string, _password: string): Promise<void> => {
        // TODO: Implement in Phase 1.2 with authService
        // Make this async and add await when implementing:
        // const response = await authService.login(email, password);
        // const {token: authToken, user: authUser} = response;
        // authStorage.saveToken(authToken);
        // authStorage.saveUser(authUser);
        // setToken(authToken);
        // setUser(authUser);
        return Promise.reject(
            new Error('Auth service not yet implemented. Complete Phase 1.2')
        );
    };

    const register = (_data: RegisterRequest): Promise<void> => {
        // TODO: Implement in Phase 1.2 with authService
        // Make this async and add await when implementing:
        // const response = await authService.register(data);
        // const {token: authToken, user: authUser} = response;
        // authStorage.saveToken(authToken);
        // authStorage.saveUser(authUser);
        // setToken(authToken);
        // setUser(authUser);
        return Promise.reject(
            new Error('Auth service not yet implemented. Complete Phase 1.2')
        );
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
        const initializeAuth = async (): Promise<void> => {
            try {
                const {token: storedToken, user: storedUser} = await loadStoredAuth();
                setToken(storedToken);
                setUser(storedUser);
            } catch (error) {
                console.error('Failed to initialize auth:', error);
            } finally {
                setIsLoading(false);
            }
        };

        void initializeAuth();
    }, []);

    const authMethods = useCallback(
        () => createAuthMethods(setToken, setUser),
        [setToken, setUser]
    );

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
