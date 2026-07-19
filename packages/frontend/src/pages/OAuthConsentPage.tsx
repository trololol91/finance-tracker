import React from 'react';
import {ConsentScreen} from '@features/oauth/components/ConsentScreen.js';
import '@pages/LoginPage.css';

const OAuthConsentPage = (): React.JSX.Element => {
    return (
        <main className="login-page">
            <div className="login-page__card login-page__card--wide">
                <ConsentScreen />
            </div>
        </main>
    );
};

export default OAuthConsentPage;
