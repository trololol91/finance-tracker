import {Navigate} from 'react-router-dom';
import type {ReactNode} from 'react';
import {storage} from '@services/storage/localStorage';
import {APP_ROUTES} from '@config/constants';

interface PrivateRouteProps {
    children: ReactNode;
}

export const PrivateRoute = ({children}: PrivateRouteProps): React.JSX.Element => {
    const token = storage.getAuthToken();

    if (!token) {
        return <Navigate to={APP_ROUTES.LOGIN} replace />;
    }

    return <>{children}</>;
};
