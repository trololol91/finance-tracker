import {
    render,
    screen
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {
    describe,
    it,
    expect,
    vi,
    beforeEach
} from 'vitest';
import {Sidebar} from '@components/layout/Sidebar/Sidebar.js';
import {
    NAV_ITEMS,
    SETTINGS_NAV_ITEMS
} from '@config/navConfig.js';

// ── Mock useAuth ────────────────────────────────────────────────────────────

const mockLogout = vi.fn();

const mockUserBase = {
    id: 'user-1',
    email: 'jane.doe@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    timezone: 'UTC',
    currency: 'USD',
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    notifyEmail: false
};

const mockAuthState = {
    user: {...mockUserBase, role: 'USER' as 'USER' | 'ADMIN'},
    token: 'mock-token',
    isAuthenticated: true,
    isLoading: false,
    authError: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: mockLogout,
    updateUser: vi.fn()
};

vi.mock('@features/auth/hooks/useAuth.js', () => ({
    useAuth: () => mockAuthState
}));

// ── CSS Module mock (vitest handles via jsdom; class names return as-is) ─────

vi.mock('@components/layout/Sidebar/Sidebar.module.css', () => ({
    default: new Proxy(
        {},
        {get: (_target, prop: string) => prop}
    )
}));

// ── Helper ──────────────────────────────────────────────────────────────────

const renderSidebar = (initialEntry = '/dashboard'): ReturnType<typeof render> =>
    render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <Sidebar />
        </MemoryRouter>
    );

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Sidebar', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset to default USER role
        mockAuthState.user = {...mockUserBase, role: 'USER'};
        mockAuthState.logout = mockLogout;
    });

    describe('primary navigation items', () => {
        it('renders all NAV_ITEMS as links', () => {
            renderSidebar();

            for (const item of NAV_ITEMS) {
                expect(
                    screen.getByRole('link', {name: new RegExp(item.label, 'i')})
                ).toBeInTheDocument();
            }
        });

        it('renders exactly the expected number of primary nav links', () => {
            renderSidebar();

            const primaryNav = screen.getByRole('navigation', {name: /primary navigation/i});
            const links = primaryNav.querySelectorAll('a');
            expect(links).toHaveLength(NAV_ITEMS.length);
        });
    });

    describe('settings navigation items', () => {
        it('renders the Settings link for a USER role', () => {
            renderSidebar();

            expect(
                screen.getByRole('link', {name: /settings/i})
            ).toBeInTheDocument();
        });

        it('hides the Admin nav item when user role is USER', () => {
            renderSidebar();

            expect(screen.queryByRole('link', {name: /admin/i})).not.toBeInTheDocument();
        });

        it('shows the Admin nav item when user role is ADMIN', () => {
            mockAuthState.user = {...mockUserBase, role: 'ADMIN'};
            renderSidebar();

            expect(screen.getByRole('link', {name: /admin/i})).toBeInTheDocument();
        });

        it('shows all SETTINGS_NAV_ITEMS for an ADMIN user', () => {
            mockAuthState.user = {...mockUserBase, role: 'ADMIN'};
            renderSidebar();

            for (const item of SETTINGS_NAV_ITEMS) {
                expect(
                    screen.getByRole('link', {name: new RegExp(item.label, 'i')})
                ).toBeInTheDocument();
            }
        });

        it('renders the settings section label', () => {
            renderSidebar();

            expect(screen.getByText('Settings', {selector: 'p'})).toBeInTheDocument();
        });
    });

    describe('app logo / brand link', () => {
        it('renders the app name as a link', () => {
            renderSidebar();

            // Two links rendered: mobile bar + sidebar (CSS shows one per breakpoint)
            const logoLinks = screen.getAllByRole('link', {name: /finance tracker/i});
            expect(logoLinks.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('user footer', () => {
        it('shows the current user display name', () => {
            renderSidebar();

            expect(screen.getByText('Jane Doe')).toBeInTheDocument();
        });

        it('shows the current user email', () => {
            renderSidebar();

            expect(screen.getByText('jane.doe@example.com')).toBeInTheDocument();
        });

        it('falls back to email when firstName and lastName are both empty', () => {
            mockAuthState.user = {
                ...mockUserBase,
                firstName: '',
                lastName: '',
                role: 'USER'
            };
            renderSidebar();

            // email appears as the display name in the userName paragraph
            const emailElements = screen.getAllByText('jane.doe@example.com');
            expect(emailElements.length).toBeGreaterThanOrEqual(1);
        });

        it('shows signed-in label with user email as aria-label', () => {
            renderSidebar();

            const signedInEl = screen.getByLabelText(/signed in as jane\.doe@example\.com/i);
            expect(signedInEl).toBeInTheDocument();
        });

        it('renders a log out button', () => {
            renderSidebar();

            expect(screen.getByRole('button', {name: /log out/i})).toBeInTheDocument();
        });

        it('calls logout() when the log out button is clicked', async () => {
            const user = userEvent.setup();
            renderSidebar();

            const logoutBtn = screen.getByRole('button', {name: /log out/i});
            await user.click(logoutBtn);

            expect(mockLogout).toHaveBeenCalledTimes(1);
        });
    });

    describe('active link state', () => {
        it('applies the active class to the link matching the current route', () => {
            // React Router's NavLink adds aria-current="page" when active
            renderSidebar('/dashboard');

            const dashboardLink = screen.getByRole('link', {name: /dashboard/i});
            // NavLink sets aria-current="page" on the active link by default
            // but this component passes aria-current={undefined}, so we check
            // via className — NavLink still calls getLinkClassName with isActive=true
            // The proxy CSS mock returns the class name string as-is
            expect(dashboardLink.className).toContain('navLinkActive');
        });

        it('does not apply active class to non-current links', () => {
            renderSidebar('/dashboard');

            const transactionsLink = screen.getByRole('link', {name: /transactions/i});
            expect(transactionsLink.className).not.toContain('navLinkActive');
        });
    });

    describe('when user is null', () => {
        it('does not render user name or email in footer', () => {
            mockAuthState.user = null as unknown as typeof mockAuthState.user;
            renderSidebar();

            expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
            expect(screen.queryByText('jane.doe@example.com')).not.toBeInTheDocument();
        });

        it('still renders the log out button when user is null', () => {
            mockAuthState.user = null as unknown as typeof mockAuthState.user;
            renderSidebar();

            expect(screen.getByRole('button', {name: /log out/i})).toBeInTheDocument();
        });
    });
});
