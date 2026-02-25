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
import {
    authControllerLogin,
    authControllerRegister,
    authControllerGetProfile
} from '@/api/auth/auth.js';
import type {User} from '@features/auth/types/auth.types.js';
import type {UserResponseDto} from '@/api/model/userResponseDto.js';
import {UserResponseDtoRole} from '@/api/model/userResponseDtoRole.js';
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

// Mock Orval-generated auth API functions
vi.mock('@/api/auth/auth.js', () => ({
    authControllerLogin: vi.fn(),
    authControllerRegister: vi.fn(),
    authControllerGetProfile: vi.fn()
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

    /** Full UserResponseDto shape returned by GET /auth/me */
    const mockProfileResponse: UserResponseDto = {
        id: '1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        emailVerified: true,
        isActive: true,
        timezone: 'America/New_York',
        currency: 'USD',
        role: UserResponseDtoRole.USER,
        createdAt: '2026-01-15T00:00:00.000Z',
        updatedAt: '2026-01-15T00:00:00.000Z'
    };

    /** AuthResponseDto returned by POST /auth/login and POST /auth/register */
    const mockAuthResponse = {
        accessToken: mockToken,
        user: {
            id: '1',
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe'
        }
    };

    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
        // Default: no stored session
        vi.mocked(authStorage.getToken).mockReturnValue(null);
        // Default: profile endpoint resolves (overridden per-test as needed)
        vi.mocked(authControllerGetProfile).mockResolvedValue(mockProfileResponse);
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
            // authControllerGetProfile mock already set in beforeEach

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

            // Wait for token validation to finish
            await waitFor(() => {
                expect(screen.getByTestId('loading')).toHaveTextContent('false');
            });

            expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
            expect(screen.getByTestId('email')).toHaveTextContent('test@example.com');
            expect(authStorage.getToken).toHaveBeenCalledOnce();
            expect(authControllerGetProfile).toHaveBeenCalledOnce();
            expect(authStorage.saveUser).toHaveBeenCalledWith(mockUser);
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
            // clearAuth is NOT called: the error is thrown by getToken() before
            // the inner try-catch in initializeAuth, so it propagates directly
            // to init()'s catch handler which only logs — it does not clear.
            expect(authStorage.clearAuth).not.toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });
    });

    describe('login method', () => {
        it('authenticates the user and stores token and user', async () => {
            vi.mocked(authControllerLogin).mockResolvedValue(mockAuthResponse);
            // authControllerGetProfile mock already set in beforeEach

            const TestComponent = (): React.JSX.Element => {
                const context = React.useContext(AuthContext);
                const [done, setDone] = React.useState(false);

                const handleLogin = (): void => {
                    void context?.login('test@example.com', 'password123')
                        .then(() => { setDone(true); });
                };

                return (
                    <div>
                        <button onClick={handleLogin}>Login</button>
                        <span data-testid="authenticated">
                            {context?.isAuthenticated.toString()}
                        </span>
                        <span data-testid="email">
                            {context?.user?.email ?? 'no-user'}
                        </span>
                        {done && <span data-testid="done">done</span>}
                    </div>
                );
            };

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            // Wait for mount initialization to settle
            await waitFor(() => {
                expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
            });

            screen.getByRole('button').click();

            await waitFor(() => {
                expect(screen.getByTestId('done')).toBeInTheDocument();
            });

            expect(authControllerLogin).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'password123'
            });
            expect(authStorage.saveToken).toHaveBeenCalledWith(mockToken);
            expect(authControllerGetProfile).toHaveBeenCalled();
            expect(authStorage.saveUser).toHaveBeenCalledWith(mockUser);
            expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
            expect(screen.getByTestId('email')).toHaveTextContent('test@example.com');
        });

        it('propagates error when login API call fails', async () => {
            vi.mocked(authControllerLogin).mockRejectedValue(
                new Error('Invalid credentials')
            );

            const TestComponent = (): React.JSX.Element => {
                const context = React.useContext(AuthContext);
                const [error, setError] = React.useState<string>('');

                const handleLogin = (): void => {
                    void context?.login('test@example.com', 'wrong')
                        .catch((err: Error) => { setError(err.message); });
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
                expect(screen.getByTestId('error')).toHaveTextContent('Invalid credentials');
            });

            expect(authStorage.saveToken).not.toHaveBeenCalled();
        });
    });

    describe('register method', () => {
        it('registers the user and stores token and user', async () => {
            vi.mocked(authControllerRegister).mockResolvedValue(mockAuthResponse);
            // authControllerGetProfile mock already set in beforeEach

            const registerData = {
                email: 'test@example.com',
                password: 'password123',
                firstName: 'John',
                lastName: 'Doe'
            };

            const TestComponent = (): React.JSX.Element => {
                const context = React.useContext(AuthContext);
                const [done, setDone] = React.useState(false);

                const handleRegister = (): void => {
                    void context?.register(registerData)
                        .then(() => { setDone(true); });
                };

                return (
                    <div>
                        <button onClick={handleRegister}>Register</button>
                        <span data-testid="authenticated">
                            {context?.isAuthenticated.toString()}
                        </span>
                        <span data-testid="email">
                            {context?.user?.email ?? 'no-user'}
                        </span>
                        {done && <span data-testid="done">done</span>}
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

            screen.getByRole('button').click();

            await waitFor(() => {
                expect(screen.getByTestId('done')).toBeInTheDocument();
            });

            expect(authControllerRegister).toHaveBeenCalledWith(registerData);
            expect(authStorage.saveToken).toHaveBeenCalledWith(mockToken);
            expect(authControllerGetProfile).toHaveBeenCalled();
            expect(authStorage.saveUser).toHaveBeenCalledWith(mockUser);
            expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
            expect(screen.getByTestId('email')).toHaveTextContent('test@example.com');
        });

        it('propagates error when registration API call fails', async () => {
            vi.mocked(authControllerRegister).mockRejectedValue(
                new Error('Email already registered')
            );

            const TestComponent = (): React.JSX.Element => {
                const context = React.useContext(AuthContext);
                const [error, setError] = React.useState<string>('');

                const handleRegister = (): void => {
                    void context?.register({
                        email: 'test@example.com',
                        password: 'password123',
                        firstName: 'John',
                        lastName: 'Doe'
                    }).catch((err: Error) => { setError(err.message); });
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
                expect(screen.getByTestId('error')).toHaveTextContent('Email already registered');
            });

            expect(authStorage.saveToken).not.toHaveBeenCalled();
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

        it('is false when token validation fails', async () => {
            vi.mocked(authStorage.getToken).mockReturnValue(mockToken);
            // Simulate expired / invalid token
            vi.mocked(authControllerGetProfile).mockRejectedValue(
                new Error('Unauthorized')
            );

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

            expect(authStorage.clearAuth).toHaveBeenCalledOnce();
        });
    });
});
