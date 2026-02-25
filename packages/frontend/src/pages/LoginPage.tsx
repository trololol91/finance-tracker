import React from 'react';
import {Link} from 'react-router-dom';
import {LoginForm} from '@features/auth/components/LoginForm.js';
import {
    APP_NAME,
    APP_ROUTES
} from '@config/constants';
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

                <div className="login-page__footer">
                    <p className="login-page__footer-text">Don&apos;t have an account?</p>
                    <Link to={APP_ROUTES.REGISTER} className="login-page__register-btn">
                        Create account
                    </Link>
                </div>
            </div>
        </main>
    );
};

export default LoginPage;
