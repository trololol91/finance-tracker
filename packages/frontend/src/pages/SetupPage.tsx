import React from 'react';
import {SetupForm} from '@features/auth/components/SetupForm.js';
import {APP_NAME} from '@config/constants';
import '@pages/LoginPage.css';

const SetupPage = (): React.JSX.Element => {
    return (
        <main className="login-page">
            <div className="login-page__card login-page__card--wide">
                <header className="login-page__header">
                    <h1 className="login-page__title">{APP_NAME}</h1>
                    <p className="login-page__subtitle">Create your admin account to get started</p>
                </header>

                <SetupForm />
            </div>
        </main>
    );
};

export default SetupPage;
