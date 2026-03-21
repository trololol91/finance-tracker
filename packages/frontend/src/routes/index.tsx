import {
    createBrowserRouter,
    Navigate
} from 'react-router-dom';
import {PublicRoute} from '@routes/PublicRoute';
import {AuthGuard} from '@routes/AuthGuard';
import {SetupRoute} from '@routes/SetupRoute';
import {AdminRoute} from '@/guards/AdminRoute';
import {AppShell} from '@components/layout/AppShell/AppShell';
import {APP_ROUTES} from '@config/constants';

// Lazy load pages
import {lazy} from 'react';

const LoginPage = lazy(() => import('@pages/LoginPage.tsx'));
const RegisterPage = lazy(() => import('@pages/RegisterPage.tsx'));
const DashboardPage = lazy(() => import('@pages/DashboardPage.tsx'));
const TransactionsPage = lazy(() => import('@pages/TransactionsPage.tsx'));
const CategoriesPage = lazy(() => import('@pages/CategoriesPage.tsx'));
const AccountsPage = lazy(() => import('@pages/AccountsPage.tsx'));
const BudgetsPage = lazy(() => import('@pages/BudgetsPage.tsx'));
const ReportsPage = lazy(() => import('@pages/ReportsPage.tsx'));
const ScraperPage = lazy(() => import('@pages/ScraperPage.tsx'));
const MfaPage = lazy(() => import('@pages/MfaPage.tsx'));
const SettingsPage = lazy(() => import('@pages/SettingsPage.tsx'));
const AdminPage = lazy(() => import('@pages/AdminPage.tsx'));
const NotFoundPage = lazy(() => import('@pages/NotFoundPage.tsx'));
const SetupPage = lazy(() => import('@pages/SetupPage.tsx'));

export const router = createBrowserRouter([
    // Setup route — only accessible when no users exist
    {
        element: <SetupRoute />,
        children: [{path: APP_ROUTES.SETUP, element: <SetupPage />}]
    },

    // Public routes
    {
        path: APP_ROUTES.HOME,
        element: (
            <PublicRoute>
                <LoginPage />
            </PublicRoute>
        )
    },
    {
        path: APP_ROUTES.LOGIN,
        element: (
            <PublicRoute>
                <LoginPage />
            </PublicRoute>
        )
    },
    {
        path: APP_ROUTES.REGISTER,
        element: (
            <PublicRoute>
                <RegisterPage />
            </PublicRoute>
        )
    },

    // Private routes — all wrapped in AuthGuard then AppShell layout
    {
        element: <AuthGuard />,
        children: [
            {
                element: <AppShell />,
                children: [
                    {path: APP_ROUTES.DASHBOARD, element: <DashboardPage />},
                    {path: APP_ROUTES.TRANSACTIONS, element: <TransactionsPage />},
                    {path: APP_ROUTES.CATEGORIES, element: <CategoriesPage />},
                    {path: APP_ROUTES.ACCOUNTS, element: <AccountsPage />},
                    {path: APP_ROUTES.BUDGETS, element: <BudgetsPage />},
                    {path: APP_ROUTES.REPORTS, element: <ReportsPage />},
                    {path: APP_ROUTES.SCRAPER, element: <ScraperPage />},
                    {path: APP_ROUTES.MFA, element: <MfaPage />},
                    {path: APP_ROUTES.SETTINGS, element: <SettingsPage />},
                    // Redirect legacy /profile to /settings
                    {
                        path: APP_ROUTES.PROFILE,
                        element: <Navigate to={APP_ROUTES.SETTINGS} replace />
                    },
                    // Admin-only routes
                    {
                        element: <AdminRoute />,
                        children: [
                            {path: APP_ROUTES.ADMIN, element: <AdminPage />}
                        ]
                    }
                ]
            }
        ]
    },

    {
        path: '*',
        element: <NotFoundPage />
    }
]);
