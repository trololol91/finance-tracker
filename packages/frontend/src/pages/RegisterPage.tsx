import React from 'react';
import {RegisterForm} from '@features/auth/components/RegisterForm.js';
import {APP_NAME} from '@config/constants';
import '@pages/RegisterPage.css';

const RegisterPage = (): React.JSX.Element => {
    return (
        <main className="register-page">
            <div className="register-page__card">
                <header className="register-page__header">
                    <h1 className="register-page__title">{APP_NAME}</h1>
                    <p className="register-page__subtitle">Create your account</p>
                </header>

                <RegisterForm />
            </div>
        </main>
    );
};

export default RegisterPage;
