import {
    render,
    screen
} from '@testing-library/react';
import {
    MemoryRouter,
    Route,
    Routes
} from 'react-router-dom';
import {
    describe,
    it,
    expect,
    vi,
    beforeEach
} from 'vitest';
import {AuthGuard} from '@/routes/AuthGuard.js';
import {APP_ROUTES} from '@config/constants.js';

// ── Mock useAuth ─────────────────────────────────────────────────────────────

const mockAuthState = {
    user: {
        id: 'user-1',
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        timezone: 'UTC',
        currency: 'USD',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        role: 'USER' as const,
        notifyPush: false,
        notifyEmail: false
    },
    token: 'mock-token',
    isAuthenticated: true,
    isLoading: false,
    authError: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn()
};

vi.mock('@features/auth/hooks/useAuth.js', () => ({
    useAuth: () => mockAuthState
}));

// ── Mock Loading component ────────────────────────────────────────────────────

vi.mock('@components/common/Loading/Loading.js', () => ({
    Loading: ({size}: {size?: string}) => (
        <div data-testid="loading" data-size={size}>
            Loading…
        </div>
    )
}));

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Renders AuthGuard inside a routing context that has:
 *  - a login page at APP_ROUTES.LOGIN (redirect target when unauthenticated)
 *  - a protected child route at /dashboard
 */
const renderAuthGuard = (initialEntry = '/dashboard'): ReturnType<typeof render> =>
    render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
                {/* Public page — rendered when guard redirects unauthenticated users */}
                <Route
                    path={APP_ROUTES.LOGIN}
                    element={<div data-testid="login-page">Login</div>}
                />
                {/* Guarded section */}
                <Route element={<AuthGuard />}>
                    <Route
                        path="/dashboard"
                        element={<div data-testid="protected-page">Protected content</div>}
                    />
                </Route>
            </Routes>
        </MemoryRouter>
    );

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuthGuard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset to default authenticated, not loading state
        mockAuthState.isAuthenticated = true;
        mockAuthState.isLoading = false;
        mockAuthState.user = {
            id: 'user-1',
            email: 'jane@example.com',
            firstName: 'Jane',
            lastName: 'Doe',
            timezone: 'UTC',
            currency: 'USD',
            isActive: true,
            createdAt: '2024-01-01T00:00:00.000Z',
            role: 'USER',
            notifyPush: false,
            notifyEmail: false
        };
    });

    describe('when authenticated', () => {
        it('renders the Outlet (child route content)', () => {
            renderAuthGuard();

            expect(screen.getByTestId('protected-page')).toBeInTheDocument();
        });

        it('does not redirect to login', () => {
            renderAuthGuard();

            expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
        });

        it('does not show the loading indicator', () => {
            renderAuthGuard();

            expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
        });
    });

    describe('when not authenticated (user is null)', () => {
        beforeEach(() => {
            mockAuthState.isAuthenticated = false;
            mockAuthState.user = null as unknown as typeof mockAuthState.user;
        });

        it('redirects to the login page', () => {
            renderAuthGuard();

            expect(screen.getByTestId('login-page')).toBeInTheDocument();
        });

        it('does not render protected content', () => {
            renderAuthGuard();

            expect(screen.queryByTestId('protected-page')).not.toBeInTheDocument();
        });
    });

    describe('while authentication is loading', () => {
        beforeEach(() => {
            mockAuthState.isLoading = true;
            mockAuthState.isAuthenticated = false;
        });

        it('renders the Loading component', () => {
            renderAuthGuard();

            expect(screen.getByTestId('loading')).toBeInTheDocument();
        });

        it('renders Loading with size="large"', () => {
            renderAuthGuard();

            expect(screen.getByTestId('loading')).toHaveAttribute('data-size', 'large');
        });

        it('does not render protected content while loading', () => {
            renderAuthGuard();

            expect(screen.queryByTestId('protected-page')).not.toBeInTheDocument();
        });

        it('does not redirect to login while loading', () => {
            renderAuthGuard();

            expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
        });
    });
});
