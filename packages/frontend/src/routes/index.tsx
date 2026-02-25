import {createBrowserRouter} from 'react-router-dom';
import {PrivateRoute} from '@routes/PrivateRoute';
import {PublicRoute} from '@routes/PublicRoute';
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
const ProfilePage = lazy(() => import('@pages/ProfilePage.tsx'));
const NotFoundPage = lazy(() => import('@pages/NotFoundPage.tsx'));

export const router = createBrowserRouter([
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
    {
        path: APP_ROUTES.DASHBOARD,
        element: (
            <PrivateRoute>
                <DashboardPage />
            </PrivateRoute>
        )
    },
    {
        path: APP_ROUTES.TRANSACTIONS,
        element: (
            <PrivateRoute>
                <TransactionsPage />
            </PrivateRoute>
        )
    },
    {
        path: APP_ROUTES.CATEGORIES,
        element: (
            <PrivateRoute>
                <CategoriesPage />
            </PrivateRoute>
        )
    },
    {
        path: APP_ROUTES.ACCOUNTS,
        element: (
            <PrivateRoute>
                <AccountsPage />
            </PrivateRoute>
        )
    },
    {
        path: APP_ROUTES.BUDGETS,
        element: (
            <PrivateRoute>
                <BudgetsPage />
            </PrivateRoute>
        )
    },
    {
        path: APP_ROUTES.REPORTS,
        element: (
            <PrivateRoute>
                <ReportsPage />
            </PrivateRoute>
        )
    },
    {
        path: APP_ROUTES.SCRAPER,
        element: (
            <PrivateRoute>
                <ScraperPage />
            </PrivateRoute>
        )
    },
    {
        path: APP_ROUTES.PROFILE,
        element: (
            <PrivateRoute>
                <ProfilePage />
            </PrivateRoute>
        )
    },
    {
        path: '*',
        element: <NotFoundPage />
    }
]);
