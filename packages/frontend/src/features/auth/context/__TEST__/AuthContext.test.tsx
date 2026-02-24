import {
    describe,
    it,
    expect,
    beforeEach,
    vi
} from 'vitest';
import {
    render,
    screen,
    waitFor
} from '@testing-library/react';
import {
    AuthProvider,
    AuthContext
} from '@features/auth/context/AuthContext.js';
import {authStorage} from '@services/storage/authStorage.js';
import type {User} from '@features/auth/types/auth.types.js';
import React from 'react';

// Mock authStorage
vi.mock('@services/storage/authStorage.js', () => ({
    authStorage: {
        getToken: vi.fn(),
        saveToken: vi.fn(),
        removeToken: vi.fn(),
        getUser: vi.fn(),
        saveUser: vi.fn(),
        removeUser: vi.fn(),
        clearAuth: vi.fn()
    }
}));

describe('AuthProvider', () => {
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

    const mockToken = 'mock-jwt-token-12345';

    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    describe('initialization', () => {
        it('renders children', () => {
            vi.mocked(authStorage.getToken).mockReturnValue(null);
            vi.mocked(authStorage.getUser).mockReturnValue(null);

            render(
                <AuthProvider>
                    <div>Test Child</div>
                </AuthProvider>
            );

            expect(screen.getByText('Test Child')).toBeInTheDocument();
        });

        it('loads auth state from storage on mount', async () => {
            vi.mocked(authStorage.getToken).mockReturnValue(mockToken);
            vi.mocked(authStorage.getUser).mockReturnValue(mockUser);

            const TestComponent = (): React.JSX.Element => {
                const context = React.useContext(AuthContext);
                return (
                    <div>
                        <span data-testid="loading">
                            {context?.isLoading.toString()}
                        </span>
                        <span data-testid="authenticated">
                            {context?.isAuthenticated.toString()}
                        </span>
                        <span data-testid="email">
                            {context?.user?.email ?? 'no-user'}
                        </span>
                    </div>
                );
            };

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            // Initially loading
            expect(screen.getByTestId('loading')).toHaveTextContent('true');

            // Wait for loading to finish
            await waitFor(() => {
                expect(screen.getByTestId('loading')).toHaveTextContent('false');
            });

            expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
            expect(screen.getByTestId('email')).toHaveTextContent('test@example.com');
            expect(authStorage.getToken).toHaveBeenCalledOnce();
            expect(authStorage.getUser).toHaveBeenCalledOnce();
        });

        it('initializes with null state when no stored auth', async () => {
            vi.mocked(authStorage.getToken).mockReturnValue(null);
            vi.mocked(authStorage.getUser).mockReturnValue(null);

            const TestComponent = (): React.JSX.Element => {
                const context = React.useContext(AuthContext);
                return (
                    <div>
                        <span data-testid="authenticated">
                            {context?.isAuthenticated.toString()}
                        </span>
                        <span data-testid="user">
                            {context?.user ? 'has-user' : 'no-user'}
                        </span>
                    </div>
                );
            };

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
            });

            expect(screen.getByTestId('user')).toHaveTextContent('no-user');
        });

        it('handles errors during initialization', async () => {
            const consoleErrorSpy = vi.spyOn(console, 'error')
                .mockImplementation(() => undefined);
            vi.mocked(authStorage.getToken).mockImplementation(() => {
                throw new Error('Storage error');
            });

            const TestComponent = (): React.JSX.Element => {
                const context = React.useContext(AuthContext);
                return (
                    <div data-testid="loading">
                        {context?.isLoading.toString()}
                    </div>
                );
            };

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('loading')).toHaveTextContent('false');
            });

            expect(consoleErrorSpy).toHaveBeenCalled();
            // Note: clearAuth is NOT called because the error happens
            // in loadStoredAuth which catches and returns null values
            // The clearAuth only happens inside the catch block which
            // is inside loadStoredAuth's promise chain

            consoleErrorSpy.mockRestore();
        });
    });

    describe('login method', () => {
        it('rejects with error when auth service not implemented', async () => {
            vi.mocked(authStorage.getToken).mockReturnValue(null);
            vi.mocked(authStorage.getUser).mockReturnValue(null);

            const TestComponent = (): React.JSX.Element => {
                const context = React.useContext(AuthContext);
                const [error, setError] = React.useState<string>('');

                const handleLogin = (): void => {
                    context?.login('test@example.com', 'password')
                        .catch((err: Error) => {
                            setError(err.message);
                        });
                };

                return (
                    <div>
                        <button onClick={handleLogin}>Login</button>
                        <span data-testid="error">{error}</span>
                    </div>
                );
            };

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(screen.getByRole('button')).toBeInTheDocument();
            });

            screen.getByRole('button').click();

            await waitFor(() => {
                expect(screen.getByTestId('error')).toHaveTextContent(
                    'Auth service not yet implemented'
                );
            });
        });
    });

    describe('register method', () => {
        it('rejects with error when auth service not implemented', async () => {
            vi.mocked(authStorage.getToken).mockReturnValue(null);
            vi.mocked(authStorage.getUser).mockReturnValue(null);

            const TestComponent = (): React.JSX.Element => {
                const context = React.useContext(AuthContext);
                const [error, setError] = React.useState<string>('');

                const handleRegister = (): void => {
                    context?.register({
                        email: 'test@example.com',
                        password: 'password',
                        firstName: 'John',
                        lastName: 'Doe'
                    }).catch((err: Error) => {
                        setError(err.message);
                    });
                };

                return (
                    <div>
                        <button onClick={handleRegister}>Register</button>
                        <span data-testid="error">{error}</span>
                    </div>
                );
            };

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(screen.getByRole('button')).toBeInTheDocument();
            });

            screen.getByRole('button').click();

            await waitFor(() => {
                expect(screen.getByTestId('error')).toHaveTextContent(
                    'Auth service not yet implemented'
                );
            });
        });
    });

    describe('logout method', () => {
        it('clears auth state and storage', async () => {
            vi.mocked(authStorage.getToken).mockReturnValue(mockToken);
            vi.mocked(authStorage.getUser).mockReturnValue(mockUser);

            const TestComponent = (): React.JSX.Element => {
                const context = React.useContext(AuthContext);
                return (
                    <div>
                        <button onClick={context?.logout}>Logout</button>
                        <span data-testid="authenticated">
                            {context?.isAuthenticated.toString()}
                        </span>
                    </div>
                );
            };

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            // Wait for initial load
            await waitFor(() => {
                expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
            });

            // Click logout
            screen.getByRole('button').click();

            await waitFor(() => {
                expect(authStorage.clearAuth).toHaveBeenCalledOnce();
            });

            expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
        });
    });

    describe('updateUser method', () => {
        it('updates user in state and storage', async () => {
            vi.mocked(authStorage.getToken).mockReturnValue(mockToken);
            vi.mocked(authStorage.getUser).mockReturnValue(mockUser);

            const updatedUser: User = {
                ...mockUser,
                firstName: 'Jane',
                lastName: 'Smith'
            };

            const TestComponent = (): React.JSX.Element => {
                const context = React.useContext(AuthContext);

                const handleUpdate = (): void => {
                    context?.updateUser(updatedUser);
                };

                return (
                    <div>
                        <button onClick={handleUpdate}>Update</button>
                        <span data-testid="name">
                            {context?.user?.firstName} {context?.user?.lastName}
                        </span>
                    </div>
                );
            };

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            // Wait for initial load
            await waitFor(() => {
                expect(screen.getByTestId('name')).toHaveTextContent('John Doe');
            });

            // Click update
            screen.getByRole('button').click();

            await waitFor(() => {
                expect(authStorage.saveUser).toHaveBeenCalledWith(updatedUser);
            });

            expect(screen.getByTestId('name')).toHaveTextContent('Jane Smith');
        });
    });

    describe('isAuthenticated', () => {
        it('is true when both token and user exist', async () => {
            vi.mocked(authStorage.getToken).mockReturnValue(mockToken);
            vi.mocked(authStorage.getUser).mockReturnValue(mockUser);

            const TestComponent = (): React.JSX.Element => {
                const context = React.useContext(AuthContext);
                return (
                    <div data-testid="authenticated">
                        {context?.isAuthenticated.toString()}
                    </div>
                );
            };

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
            });
        });

        it('is false when token is missing', async () => {
            vi.mocked(authStorage.getToken).mockReturnValue(null);
            vi.mocked(authStorage.getUser).mockReturnValue(mockUser);

            const TestComponent = (): React.JSX.Element => {
                const context = React.useContext(AuthContext);
                return (
                    <div data-testid="authenticated">
                        {context?.isAuthenticated.toString()}
                    </div>
                );
            };

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
            });
        });

        it('is false when user is missing', async () => {
            vi.mocked(authStorage.getToken).mockReturnValue(mockToken);
            vi.mocked(authStorage.getUser).mockReturnValue(null);

            const TestComponent = (): React.JSX.Element => {
                const context = React.useContext(AuthContext);
                return (
                    <div data-testid="authenticated">
                        {context?.isAuthenticated.toString()}
                    </div>
                );
            };

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
            });
        });
    });
});
