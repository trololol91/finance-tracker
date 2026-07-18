import {
    Navigate,
    useLocation
} from 'react-router-dom';
import type {ReactNode} from 'react';
import {useAuth} from '@features/auth/hooks/useAuth.js';
import {resolveRedirectTarget} from '@features/auth/utils/resolveRedirectTarget.js';
import {Loading} from '@components/common/Loading/Loading.js';
import {APP_ROUTES} from '@config/constants';

interface PublicRouteProps {
    children: ReactNode;
}

export const PublicRoute = ({children}: PublicRouteProps): React.JSX.Element => {
    const {isAuthenticated, isLoading, setupRequired} = useAuth();
    const location = useLocation();

    if (isLoading) {
        return <Loading size="large" />;
    }

    if (setupRequired) {
        return <Navigate to={APP_ROUTES.SETUP} replace />;
    }

    if (isAuthenticated) {
        // Same target LoginForm computes after submit, so the two don't race
        // to different destinations when login flips isAuthenticated to true.
        return <Navigate to={resolveRedirectTarget(location)} replace />;
    }

    return <>{children}</>;
};
