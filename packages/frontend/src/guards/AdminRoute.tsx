import React from 'react';
import {
    Navigate,
    Outlet
} from 'react-router-dom';
import {useAuth} from '@features/auth/hooks/useAuth.js';
import {APP_ROUTES} from '@config/constants.js';

export const AdminRoute = (): React.JSX.Element => {
    const {user} = useAuth();

    // isLoading is intentionally not checked here — AuthGuard (which wraps this
    // component in the route tree) already blocks rendering until auth resolves,
    // so by the time AdminRoute renders, the user value is definitive.
    if (user?.role !== 'ADMIN') {
        return <Navigate to={APP_ROUTES.DASHBOARD} replace />;
    }

    return <Outlet />;
};
