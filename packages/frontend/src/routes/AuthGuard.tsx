import React from 'react';
import {
    Navigate,
    Outlet,
    useLocation
} from 'react-router-dom';
import {useAuth} from '@features/auth/hooks/useAuth.js';
import {Loading} from '@components/common/Loading/Loading.js';
import {APP_ROUTES} from '@config/constants';

/**
 * Layout-route compatible auth guard.
 * Used as the `element` of a parent route so that all child routes
 * inherit the authentication check via React Router's nested layout system.
 */
export const AuthGuard = (): React.JSX.Element => {
    const {isAuthenticated, isLoading, setupRequired} = useAuth();
    const location = useLocation();

    if (isLoading) {
        return <Loading size="large" />;
    }

    if (setupRequired) {
        return <Navigate to={APP_ROUTES.SETUP} replace />;
    }

    if (!isAuthenticated) {
        // Preserve where the user was headed (e.g. a deep link from a push
        // notification) so LoginForm can send them back after signing in.
        return <Navigate to={APP_ROUTES.LOGIN} replace state={{from: location}} />;
    }

    return <Outlet />;
};
