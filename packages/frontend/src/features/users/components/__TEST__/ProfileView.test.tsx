import {
    describe,
    it,
    expect,
    vi,
    beforeEach
} from 'vitest';
import {
    render,
    screen
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ProfileView} from '@features/users/components/ProfileView.js';
import type {ProfileDisplayData} from '@features/users/types/user.types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockDisplayData: ProfileDisplayData = {
    id: 'user-123',
    email: 'sarah@example.com',
    firstName: 'Sarah',
    lastName: 'Johnson',
    timezone: 'America/New_York',
    currency: 'USD',
    isActive: true,
    createdAt: '2026-01-15T00:00:00.000Z'
};

const defaultProps = {
    displayData: mockDisplayData as ProfileDisplayData | null,
    successMessage: '',
    isLoading: false,
    onEdit: vi.fn(),
    onDeleteRequest: vi.fn()
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const renderProfileView = (overrides: Partial<typeof defaultProps> = {}): void => {
    render(<ProfileView {...{...defaultProps, ...overrides}} />);
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProfileView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('rendering', () => {
        it('renders the page heading', () => {
            renderProfileView();

            expect(
                screen.getByRole('heading', {name: /my profile/i, level: 1})
            ).toBeInTheDocument();
        });

        it('renders personal information section with user data', () => {
            renderProfileView();

            expect(screen.getByText('First Name')).toBeInTheDocument();
            expect(screen.getByText('Sarah')).toBeInTheDocument();
            expect(screen.getByText('Last Name')).toBeInTheDocument();
            expect(screen.getByText('Johnson')).toBeInTheDocument();
            expect(screen.getByText('Email')).toBeInTheDocument();
            expect(screen.getByText('sarah@example.com')).toBeInTheDocument();
        });

        it('renders preferences section', () => {
            renderProfileView();

            expect(screen.getByText('Timezone')).toBeInTheDocument();
            expect(screen.getByText('Currency')).toBeInTheDocument();
            expect(screen.getByText('USD')).toBeInTheDocument();
        });

        it('renders account information section', () => {
            renderProfileView();

            expect(screen.getByText('Status')).toBeInTheDocument();
            expect(screen.getByText('Active')).toBeInTheDocument();
            expect(screen.getByText('Member Since')).toBeInTheDocument();
        });

        it('shows "Not set" when firstName is null', () => {
            renderProfileView({
                displayData: {...mockDisplayData, firstName: null}
            });

            expect(screen.getAllByText('Not set').length).toBeGreaterThan(0);
        });

        it('shows "Not set" when lastName is null', () => {
            renderProfileView({
                displayData: {...mockDisplayData, lastName: null}
            });

            expect(screen.getAllByText('Not set').length).toBeGreaterThan(0);
        });

        it('shows Inactive status when isActive is false', () => {
            renderProfileView({
                displayData: {...mockDisplayData, isActive: false}
            });

            expect(screen.getByText('Inactive')).toBeInTheDocument();
        });

        it('renders Edit Profile button', () => {
            renderProfileView();

            expect(
                screen.getByRole('button', {name: /edit profile/i})
            ).toBeInTheDocument();
        });

        it('renders Delete My Account button', () => {
            renderProfileView();

            expect(
                screen.getByRole('button', {name: /delete my account/i})
            ).toBeInTheDocument();
        });

        it('renders the danger zone section', () => {
            renderProfileView();

            expect(
                screen.getByRole('heading', {name: /danger zone/i})
            ).toBeInTheDocument();
        });
    });

    describe('success message', () => {
        it('shows success message when provided', () => {
            renderProfileView({successMessage: 'Profile updated successfully.'});

            expect(screen.getByRole('status')).toHaveTextContent(
                'Profile updated successfully.'
            );
        });

        it('does not render status element when successMessage is empty', () => {
            renderProfileView({successMessage: ''});

            expect(screen.queryByRole('status')).not.toBeInTheDocument();
        });
    });

    describe('loading state', () => {
        it('disables Edit Profile button when isLoading is true', () => {
            renderProfileView({isLoading: true});

            expect(
                screen.getByRole('button', {name: /edit profile/i})
            ).toBeDisabled();
        });

        it('enables Edit Profile button when isLoading is false', () => {
            renderProfileView({isLoading: false});

            expect(
                screen.getByRole('button', {name: /edit profile/i})
            ).not.toBeDisabled();
        });
    });

    describe('interactions', () => {
        it('calls onEdit when Edit Profile is clicked', async () => {
            const onEdit = vi.fn();
            renderProfileView({onEdit});

            await userEvent.click(screen.getByRole('button', {name: /edit profile/i}));

            expect(onEdit).toHaveBeenCalledTimes(1);
        });

        it('calls onDeleteRequest when Delete My Account is clicked', async () => {
            const onDeleteRequest = vi.fn();
            renderProfileView({onDeleteRequest});

            await userEvent.click(
                screen.getByRole('button', {name: /delete my account/i})
            );

            expect(onDeleteRequest).toHaveBeenCalledTimes(1);
        });
    });

    describe('null displayData', () => {
        it('renders without crashing when displayData is null', () => {
            renderProfileView({displayData: null});

            expect(
                screen.getByRole('heading', {name: /my profile/i})
            ).toBeInTheDocument();
        });
    });
});
