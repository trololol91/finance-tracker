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
import {PublicRoute} from '@/routes/PublicRoute.js';
import {APP_ROUTES} from '@config/constants.js';

// ── Mock useAuth ─────────────────────────────────────────────────────────────

const mockAuthState = {
    isAuthenticated: false,
    isLoading: false,
    setupRequired: false
};

vi.mock('@features/auth/hooks/useAuth.js', () => ({
    useAuth: () => mockAuthState
}));

// ── Mock Loading component ─────────────────────────────────────────────────

vi.mock('@components/common/Loading/Loading.js', () => ({
    Loading: ({size}: {size?: string}) => (
        <div data-testid="loading" data-size={size}>Loading…</div>
    )
}));

// ── Helper ────────────────────────────────────────────────────────────────────

const renderPublicRoute = (initialEntry = '/login'): ReturnType<typeof render> =>
    render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
                <Route
                    path={APP_ROUTES.DASHBOARD}
                    element={<div data-testid="dashboard-page">Dashboard</div>}
                />
                <Route
                    path={APP_ROUTES.SETUP}
                    element={<div data-testid="setup-page">Setup</div>}
                />
                <Route
                    path={APP_ROUTES.LOGIN}
                    element={
                        <PublicRoute>
                            <div data-testid="login-page">Login</div>
                        </PublicRoute>
                    }
                />
            </Routes>
        </MemoryRouter>
    );

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PublicRoute', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuthState.isAuthenticated = false;
        mockAuthState.isLoading = false;
        mockAuthState.setupRequired = false;
    });

    describe('when unauthenticated and setup is not required', () => {
        it('renders children', () => {
            renderPublicRoute();

            expect(screen.getByTestId('login-page')).toBeInTheDocument();
        });
    });

    describe('when authenticated', () => {
        beforeEach(() => {
            mockAuthState.isAuthenticated = true;
        });

        it('redirects to dashboard', () => {
            renderPublicRoute();

            expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
            expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
        });
    });

    describe('while loading', () => {
        beforeEach(() => {
            mockAuthState.isLoading = true;
        });

        it('renders the Loading component', () => {
            renderPublicRoute();

            expect(screen.getByTestId('loading')).toBeInTheDocument();
        });

        it('does not render children while loading', () => {
            renderPublicRoute();

            expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
        });
    });

    describe('when setup is required', () => {
        beforeEach(() => {
            mockAuthState.setupRequired = true;
        });

        it('redirects to setup page', () => {
            renderPublicRoute();

            expect(screen.getByTestId('setup-page')).toBeInTheDocument();
            expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
        });
    });
});
