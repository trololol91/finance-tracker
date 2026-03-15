import React from 'react';
import {
    Navigate,
    Outlet
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
    const {isAuthenticated, isLoading} = useAuth();

    if (isLoading) {
        return <Loading size="large" />;
    }

    if (!isAuthenticated) {
        return <Navigate to={APP_ROUTES.LOGIN} replace />;
    }

    return <Outlet />;
};
