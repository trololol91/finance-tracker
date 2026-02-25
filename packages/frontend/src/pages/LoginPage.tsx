import React from 'react';
import {LoginForm} from '@features/auth/components/LoginForm.js';
import {APP_NAME} from '@config/constants';
import '@pages/LoginPage.css';

const LoginPage = (): React.JSX.Element => {
    return (
        <main className="login-page">
            <div className="login-page__card">
                <header className="login-page__header">
                    <h1 className="login-page__title">{APP_NAME}</h1>
                    <p className="login-page__subtitle">Sign in to your account</p>
                </header>

                <LoginForm />
            </div>
        </main>
    );
};

export default LoginPage;
