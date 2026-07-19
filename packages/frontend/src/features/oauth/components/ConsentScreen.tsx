import React, {useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {useOAuthControllerConsent} from '@/api/oauth/oauth.js';
import type {ConsentDecisionDtoCodeChallengeMethod} from '@/api/model/consentDecisionDtoCodeChallengeMethod.js';
import {Button} from '@components/common/Button/Button.js';
import '@features/oauth/components/ConsentScreen.css';

// Labels for the fixed scope set backend's src/oauth/oauth-scopes.ts can
// grant. Not the source of truth for WHAT gets granted — that's always the
// `scope` param on this page's own URL (set by GET /oauth/authorize from the
// real OAUTH_FIXED_SCOPES), so the list rendered below can never drift from
// what's actually issued, even if a scope is added/removed on the backend
// without a matching label here (falls back to the raw scope string).
const SCOPE_LABELS: Record<string, string> = {
    'transactions:read': 'View your transactions',
    'transactions:write': 'Add new transactions',
    'accounts:read': 'View your accounts',
    'categories:read': 'View your categories',
    'dashboard:read': 'View your dashboard summary'
};

interface OAuthRequestParams {
    client_id: string;
    redirect_uri: string;
    code_challenge: string;
    code_challenge_method: ConsentDecisionDtoCodeChallengeMethod;
    scopes: string[];
    state?: string;
}

const readOAuthParams = (searchParams: URLSearchParams): OAuthRequestParams | null => {
    const client_id = searchParams.get('client_id');
    const redirect_uri = searchParams.get('redirect_uri');
    const code_challenge = searchParams.get('code_challenge');
    const code_challenge_method = searchParams.get('code_challenge_method');
    const scope = searchParams.get('scope');
    if (!client_id || !redirect_uri || !code_challenge || !code_challenge_method || !scope) {
        return null;
    }
    return {
        client_id,
        redirect_uri,
        code_challenge,
        code_challenge_method: code_challenge_method as ConsentDecisionDtoCodeChallengeMethod,
        scopes: scope.split(' ').filter(Boolean),
        state: searchParams.get('state') ?? undefined
    };
};

// Module-scope, not inline in the component: assigning window.location.href
// directly inside a component body trips the react-hooks/immutability rule
// (it can't tell this hard-navigation escape hatch from a render-phase
// mutation of external state).
const navigateTo = (url: string): void => {
    window.location.href = url;
};

export const ConsentScreen = (): React.JSX.Element => {
    const [searchParams] = useSearchParams();
    const params = readOAuthParams(searchParams);
    const [apiError, setApiError] = useState('');
    const consent = useOAuthControllerConsent();

    const decide = async (approved: boolean): Promise<void> => {
        if (!params) return;
        setApiError('');
        try {
            // scopes is this page's own display concern — the backend always
            // (re)computes the actual granted set server-side from
            // OAUTH_FIXED_SCOPES, so it's not part of the consent request body.
            const {scopes: _scopes, ...decision} = params;
            const result = await consent.mutateAsync({data: {...decision, approved}});
            // redirectTo is validated server-side against the client's
            // registered redirect_uri before being returned here — safe to
            // navigate the browser to directly, including cross-origin.
            navigateTo(result.redirectTo);
        } catch {
            setApiError('Something went wrong. Please try again.');
        }
    };

    if (!params) {
        return (
            <div className="consent-screen">
                <p className="consent-screen__api-error" role="alert">
                    This link is missing required information and can&apos;t be completed.
                    Please restart the connection from Claude.
                </p>
            </div>
        );
    }

    return (
        <div className="consent-screen">
            <h1 className="consent-screen__title">Connect Claude to Finance Tracker</h1>
            <p className="consent-screen__description">
                Claude is requesting access to your Finance Tracker account. If you approve,
                it will be able to:
            </p>
            <ul className="consent-screen__permissions">
                {params.scopes.map((scope) => (
                    <li key={scope}>{SCOPE_LABELS[scope] ?? scope}</li>
                ))}
            </ul>

            {apiError && (
                <div className="consent-screen__api-error" role="alert">
                    {apiError}
                </div>
            )}

            <div className="consent-screen__actions">
                <Button
                    type="button"
                    variant="secondary"
                    isLoading={consent.isPending}
                    onClick={() => { void decide(false); }}
                >
                    Deny
                </Button>
                <Button
                    type="button"
                    variant="primary"
                    isLoading={consent.isPending}
                    onClick={() => { void decide(true); }}
                >
                    Approve
                </Button>
            </div>
        </div>
    );
};
