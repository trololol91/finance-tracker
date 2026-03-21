import React from 'react';
import {
    Navigate,
    Outlet
} from 'react-router-dom';
import {useAuth} from '@features/auth/hooks/useAuth.js';
import {Loading} from '@components/common/Loading/Loading.js';
import {APP_ROUTES} from '@config/constants';

/**
 * Route guard for the setup page.
 * Accessible only when no users exist (setupRequired === true) and not authenticated.
 */
export const SetupRoute = (): React.JSX.Element => {
    const {isLoading, setupRequired, isAuthenticated} = useAuth();

    if (isLoading) {
        return <Loading size="large" />;
    }

    if (isAuthenticated) {
        return <Navigate to={APP_ROUTES.DASHBOARD} replace />;
    }

    if (!setupRequired) {
        return <Navigate to={APP_ROUTES.LOGIN} replace />;
    }

    return <Outlet />;
};
