import {Navigate} from 'react-router-dom';
import type {ReactNode} from 'react';
import {useAuth} from '@features/auth/hooks/useAuth.js';
import {Loading} from '@components/common/Loading/Loading.js';
import {APP_ROUTES} from '@config/constants';

interface PrivateRouteProps {
    children: ReactNode;
}

export const PrivateRoute = ({children}: PrivateRouteProps): React.JSX.Element => {
    const {isAuthenticated, isLoading} = useAuth();

    if (isLoading) {
        return <Loading size="large" />;
    }

    if (!isAuthenticated) {
        return <Navigate to={APP_ROUTES.LOGIN} replace />;
    }

    return <>{children}</>;
};
