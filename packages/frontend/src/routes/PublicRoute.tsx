import {Navigate} from 'react-router-dom';
import type {ReactNode} from 'react';
import {authStorage} from '@services/storage/authStorage.js';
import {APP_ROUTES} from '@config/constants';

interface PublicRouteProps {
    children: ReactNode;
}

export const PublicRoute = ({children}: PublicRouteProps): React.JSX.Element => {
    const token = authStorage.getToken();

    if (token) {
        return <Navigate to={APP_ROUTES.DASHBOARD} replace />;
    }

    return <>{children}</>;
};
