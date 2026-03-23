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
import {AdminRoute} from '@/guards/AdminRoute.js';
import {APP_ROUTES} from '@config/constants.js';

// ── Mock useAuth ─────────────────────────────────────────────────────────────

const mockAuthState = {
    user: {
        id: 'user-1',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        timezone: 'UTC',
        currency: 'USD',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        role: 'ADMIN' as 'ADMIN' | 'USER',
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

// ── Helper ───────────────────────────────────────────────────────────────────

/**
 * Wraps AdminRoute inside a realistic nested routing context.
 * AdminRoute renders <Outlet /> for ADMIN or <Navigate> for others.
 * A sentinel route at the redirect target lets us assert redirects occurred.
 */
const renderAdminRoute = (): ReturnType<typeof render> =>
    render(
        <MemoryRouter initialEntries={['/admin']}>
            <Routes>
                {/* Redirect target — rendered when AdminRoute sends user away */}
                <Route
                    path={APP_ROUTES.DASHBOARD}
                    element={<div data-testid="dashboard-page">Dashboard</div>}
                />
                {/* Protected admin area */}
                <Route element={<AdminRoute />}>
                    <Route
                        path="/admin"
                        element={<div data-testid="admin-page">Admin content</div>}
                    />
                </Route>
            </Routes>
        </MemoryRouter>
    );

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AdminRoute', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('when user role is ADMIN', () => {
        it('renders the Outlet (child route content)', () => {
            mockAuthState.user = {...mockAuthState.user, role: 'ADMIN'};
            renderAdminRoute();

            expect(screen.getByTestId('admin-page')).toBeInTheDocument();
        });

        it('does not redirect to dashboard', () => {
            mockAuthState.user = {...mockAuthState.user, role: 'ADMIN'};
            renderAdminRoute();

            expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
        });
    });

    describe('when user role is USER', () => {
        it('redirects to the dashboard', () => {
            mockAuthState.user = {...mockAuthState.user, role: 'USER'};
            renderAdminRoute();

            expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
        });

        it('does not render admin content', () => {
            mockAuthState.user = {...mockAuthState.user, role: 'USER'};
            renderAdminRoute();

            expect(screen.queryByTestId('admin-page')).not.toBeInTheDocument();
        });
    });

    describe('when user is null (unauthenticated)', () => {
        it('redirects to the dashboard', () => {
            mockAuthState.user = null as unknown as typeof mockAuthState.user;
            renderAdminRoute();

            expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
        });

        it('does not render admin content', () => {
            mockAuthState.user = null as unknown as typeof mockAuthState.user;
            renderAdminRoute();

            expect(screen.queryByTestId('admin-page')).not.toBeInTheDocument();
        });
    });
});
