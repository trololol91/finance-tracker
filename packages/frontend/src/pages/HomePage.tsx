import React from 'react';
import {useNavigate} from 'react-router-dom';
import {Button} from '@components/common/Button/Button.js';
import {
    APP_NAME,
    APP_ROUTES
} from '@config/constants';
import '@pages/HomePage.css';

export const HomePage = (): React.JSX.Element => {
    const navigate = useNavigate();

    return (
        <main className="home-page">
            <div className="home-page__hero">
                <h1 className="home-page__title">{APP_NAME}</h1>
                <p className="home-page__subtitle">
                    Track your spending, understand your finances,
                    and take control of your money.
                </p>
                <div className="home-page__actions">
                    <Button
                        variant="primary"
                        size="large"
                        onClick={() => { void navigate(APP_ROUTES.LOGIN); }}
                    >
                        Sign in
                    </Button>
                    <Button
                        variant="secondary"
                        size="large"
                        onClick={() => { void navigate(APP_ROUTES.REGISTER); }}
                    >
                        Create account
                    </Button>
                </div>
            </div>
        </main>
    );
};

export default HomePage;

