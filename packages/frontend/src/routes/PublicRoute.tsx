import {Navigate} from 'react-router-dom';
import type {ReactNode} from 'react';
import {useAuth} from '@features/auth/hooks/useAuth.js';
import {Loading} from '@components/common/Loading/Loading.js';
import {APP_ROUTES} from '@config/constants';

interface PublicRouteProps {
    children: ReactNode;
}

export const PublicRoute = ({children}: PublicRouteProps): React.JSX.Element => {
    const {isAuthenticated, isLoading, setupRequired} = useAuth();

    if (isLoading) {
        return <Loading size="large" />;
    }

    if (setupRequired) {
        return <Navigate to={APP_ROUTES.SETUP} replace />;
    }

    if (isAuthenticated) {
        return <Navigate to={APP_ROUTES.DASHBOARD} replace />;
    }

    return <>{children}</>;
};
