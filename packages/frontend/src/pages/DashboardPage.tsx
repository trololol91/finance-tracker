import React from 'react';
import {useNavigate} from 'react-router-dom';
import {useAuth} from '@features/auth/hooks/useAuth.js';
import {Button} from '@components/common/Button/Button.js';
import {APP_ROUTES} from '@config/constants.js';

export const DashboardPage = (): React.JSX.Element => {
    const {logout, user} = useAuth();
    const navigate = useNavigate();

    const handleLogout = (): void => {
        logout();
        void navigate(APP_ROUTES.LOGIN, {replace: true});
    };

    return (
        <div>
            <h1>Dashboard</h1>
            <p>Welcome{user?.firstName ? `, ${user.firstName}` : ''}! Your financial overview will appear here.</p>
            <Button variant="secondary" onClick={handleLogout}>
                Log out
            </Button>
        </div>
    );
};

export default DashboardPage;
