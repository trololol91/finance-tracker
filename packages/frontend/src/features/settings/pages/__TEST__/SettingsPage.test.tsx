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
import React from 'react';
import {SettingsPage} from '@features/settings/pages/SettingsPage.js';

// ── Stub feature components so tests stay focused on SettingsPage logic ────

vi.mock('@features/settings/components/ProfileForm.js', () => ({
    ProfileForm: (): React.JSX.Element => <div data-testid="profile-form" />
}));

vi.mock('@features/settings/components/NotificationsForm.js', () => ({
    NotificationsForm: (): React.JSX.Element => <div data-testid="notifications-form" />
}));

vi.mock('@features/settings/components/ApiTokens.js', () => ({
    ApiTokens: (): React.JSX.Element => <div data-testid="api-tokens" />
}));

vi.mock('@features/settings/components/SettingsErrorBoundary.js', () => ({
    SettingsErrorBoundary: ({children}: {children: React.ReactNode}): React.JSX.Element => (
        <>{children}</>
    )
}));

// ── Helpers ────────────────────────────────────────────────────────────────

const renderPage = (): void => {
    render(<SettingsPage />);
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('SettingsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('layout', () => {
        it('renders the "Settings" page heading', () => {
            renderPage();
            expect(
                screen.getByRole('heading', {name: 'Settings', level: 1})
            ).toBeInTheDocument();
        });

        it('renders a navigation landmark with accessible label', () => {
            renderPage();
            expect(
                screen.getByRole('navigation', {name: /settings sections/i})
            ).toBeInTheDocument();
        });

        it('renders Profile tab button', () => {
            renderPage();
            expect(screen.getByRole('tab', {name: /profile/i})).toBeInTheDocument();
        });

        it('renders Notifications tab button', () => {
            renderPage();
            expect(screen.getByRole('tab', {name: /notifications/i})).toBeInTheDocument();
        });

        it('renders API Tokens tab button', () => {
            renderPage();
            expect(screen.getByRole('tab', {name: /api tokens/i})).toBeInTheDocument();
        });
    });

    describe('default tab', () => {
        it('selects the Profile tab by default', () => {
            renderPage();
            expect(screen.getByRole('tab', {name: /profile/i})).toHaveAttribute(
                'aria-selected',
                'true'
            );
        });

        it('shows the ProfileForm on initial render', () => {
            renderPage();
            expect(screen.getByTestId('profile-form')).toBeInTheDocument();
        });

        it('does not show the NotificationsForm on initial render', () => {
            renderPage();
            expect(screen.queryByTestId('notifications-form')).not.toBeInTheDocument();
        });
    });

    describe('tab switching', () => {
        it('shows NotificationsForm when Notifications tab is clicked', async () => {
            const user = userEvent.setup();
            renderPage();
            await user.click(screen.getByRole('tab', {name: /notifications/i}));
            expect(screen.getByTestId('notifications-form')).toBeInTheDocument();
        });

        it('hides ProfileForm after switching to Notifications tab', async () => {
            const user = userEvent.setup();
            renderPage();
            await user.click(screen.getByRole('tab', {name: /notifications/i}));
            expect(screen.queryByTestId('profile-form')).not.toBeInTheDocument();
        });

        it('marks Notifications tab as selected after clicking it', async () => {
            const user = userEvent.setup();
            renderPage();
            await user.click(screen.getByRole('tab', {name: /notifications/i}));
            expect(screen.getByRole('tab', {name: /notifications/i})).toHaveAttribute(
                'aria-selected',
                'true'
            );
        });

        it('deselects Profile tab after switching to Notifications', async () => {
            const user = userEvent.setup();
            renderPage();
            await user.click(screen.getByRole('tab', {name: /notifications/i}));
            expect(screen.getByRole('tab', {name: /profile/i})).toHaveAttribute(
                'aria-selected',
                'false'
            );
        });

        it('returns to Profile tab when Profile tab is clicked again', async () => {
            const user = userEvent.setup();
            renderPage();
            await user.click(screen.getByRole('tab', {name: /notifications/i}));
            await user.click(screen.getByRole('tab', {name: /profile/i}));
            expect(screen.getByTestId('profile-form')).toBeInTheDocument();
            expect(screen.queryByTestId('notifications-form')).not.toBeInTheDocument();
        });
    });

    describe('API Tokens tab', () => {
        it('shows ApiTokens component when API Tokens tab is clicked', async () => {
            const user = userEvent.setup();
            renderPage();
            await user.click(screen.getByRole('tab', {name: /api tokens/i}));
            expect(screen.getByTestId('api-tokens')).toBeInTheDocument();
        });

        it('hides ProfileForm after switching to API Tokens tab', async () => {
            const user = userEvent.setup();
            renderPage();
            await user.click(screen.getByRole('tab', {name: /api tokens/i}));
            expect(screen.queryByTestId('profile-form')).not.toBeInTheDocument();
        });

        it('marks API Tokens tab as selected after clicking it', async () => {
            const user = userEvent.setup();
            renderPage();
            await user.click(screen.getByRole('tab', {name: /api tokens/i}));
            expect(screen.getByRole('tab', {name: /api tokens/i})).toHaveAttribute(
                'aria-selected',
                'true'
            );
        });
    });

    describe('ARIA wiring', () => {
        it('Profile tab controls the profile panel', () => {
            renderPage();
            expect(screen.getByRole('tab', {name: /profile/i})).toHaveAttribute(
                'aria-controls',
                'panel-profile'
            );
        });

        it('Notifications tab controls the notifications panel', () => {
            renderPage();
            expect(screen.getByRole('tab', {name: /notifications/i})).toHaveAttribute(
                'aria-controls',
                'panel-notifications'
            );
        });

        it('API Tokens tab controls the api-tokens panel', () => {
            renderPage();
            expect(screen.getByRole('tab', {name: /api tokens/i})).toHaveAttribute(
                'aria-controls',
                'panel-api-tokens'
            );
        });
    });

    describe('keyboard navigation', () => {
        it('ArrowRight moves focus from Profile to Notifications tab', async () => {
            const user = userEvent.setup();
            renderPage();
            const profileTab = screen.getByRole('tab', {name: /profile/i});
            profileTab.focus();
            await user.keyboard('{ArrowRight}');
            expect(screen.getByRole('tab', {name: /notifications/i})).toHaveAttribute(
                'aria-selected',
                'true'
            );
        });

        it('ArrowLeft moves focus from Notifications back to Profile tab', async () => {
            const user = userEvent.setup();
            renderPage();
            // First go to Notifications
            await user.click(screen.getByRole('tab', {name: /notifications/i}));
            const notifTab = screen.getByRole('tab', {name: /notifications/i});
            notifTab.focus();
            await user.keyboard('{ArrowLeft}');
            expect(screen.getByRole('tab', {name: /profile/i})).toHaveAttribute(
                'aria-selected',
                'true'
            );
        });

        it('Home key moves to first tab', async () => {
            const user = userEvent.setup();
            renderPage();
            await user.click(screen.getByRole('tab', {name: /notifications/i}));
            const notifTab = screen.getByRole('tab', {name: /notifications/i});
            notifTab.focus();
            await user.keyboard('{Home}');
            expect(screen.getByRole('tab', {name: /profile/i})).toHaveAttribute(
                'aria-selected',
                'true'
            );
        });

        it('End key moves to last tab (API Tokens)', async () => {
            const user = userEvent.setup();
            renderPage();
            const profileTab = screen.getByRole('tab', {name: /profile/i});
            profileTab.focus();
            await user.keyboard('{End}');
            expect(screen.getByRole('tab', {name: /api tokens/i})).toHaveAttribute(
                'aria-selected',
                'true'
            );
        });

        it('ArrowRight from Notifications moves to API Tokens tab', async () => {
            const user = userEvent.setup();
            renderPage();
            await user.click(screen.getByRole('tab', {name: /notifications/i}));
            const notifTab = screen.getByRole('tab', {name: /notifications/i});
            notifTab.focus();
            await user.keyboard('{ArrowRight}');
            expect(screen.getByRole('tab', {name: /api tokens/i})).toHaveAttribute(
                'aria-selected',
                'true'
            );
        });

        it('ArrowRight wraps from API Tokens (last) tab to Profile (first)', async () => {
            const user = userEvent.setup();
            renderPage();
            await user.click(screen.getByRole('tab', {name: /api tokens/i}));
            const apiTokensTab = screen.getByRole('tab', {name: /api tokens/i});
            apiTokensTab.focus();
            await user.keyboard('{ArrowRight}');
            expect(screen.getByRole('tab', {name: /profile/i})).toHaveAttribute(
                'aria-selected',
                'true'
            );
        });
    });
});
