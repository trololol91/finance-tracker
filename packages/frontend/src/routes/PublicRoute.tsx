import {Navigate} from 'react-router-dom';
import type {ReactNode} from 'react';
import {storage} from '@services/storage/localStorage';
import {APP_ROUTES} from '@config/constants';

interface PublicRouteProps {
    children: ReactNode;
}

export const PublicRoute = ({children}: PublicRouteProps): React.JSX.Element => {
    const token = storage.getAuthToken();

    if (token) {
        return <Navigate to={APP_ROUTES.DASHBOARD} replace />;
    }

    return <>{children}</>;
};
