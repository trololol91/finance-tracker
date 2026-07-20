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
    client_name: string;
    redirect_uri: string;
    code_challenge: string;
    code_challenge_method: ConsentDecisionDtoCodeChallengeMethod;
    scopes: string[];
    state?: string;
}

const readOAuthParams = (searchParams: URLSearchParams): OAuthRequestParams | null => {
    const client_id = searchParams.get('client_id');
    const client_name = searchParams.get('client_name');
    const redirect_uri = searchParams.get('redirect_uri');
    const code_challenge = searchParams.get('code_challenge');
    const code_challenge_method = searchParams.get('code_challenge_method');
    const scope = searchParams.get('scope');
    const hasAllRequiredParams = client_id && client_name && redirect_uri
        && code_challenge && code_challenge_method && scope;
    if (!hasAllRequiredParams) {
        return null;
    }
    return {
        client_id,
        client_name,
        redirect_uri,
        code_challenge,
        code_challenge_method: code_challenge_method as ConsentDecisionDtoCodeChallengeMethod,
        scopes: scope.split(' ').filter(Boolean),
        state: searchParams.get('state') ?? undefined
    };
};

/**
 * The redirect URI's domain, not the client's self-supplied name, is the
 * signal that can't be spoofed — an attacker who registers a client named
 * "Claude" still can't make this show anything but their own domain (see
 * implementation plan §11.2/§11.4). Falls back to the raw redirect_uri if
 * it isn't a parseable URL, or has no host (e.g. a non-http(s) scheme like
 * `javascript:` — the backend's RegisterClientDto now rejects those at
 * registration time, but this stays defensive rather than silently
 * rendering a blank domain if that guarantee is ever loosened).
 */
const redirectDomain = (redirectUri: string): string => {
    try {
        return new URL(redirectUri).host || redirectUri;
    } catch {
        return redirectUri;
    }
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
            // scopes/client_name are this page's own display concerns — the
            // backend always (re)computes the actual granted set server-side
            // from OAUTH_FIXED_SCOPES and re-looks-up the client itself, so
            // neither is part of the consent request body.
            const {scopes: _scopes, client_name: _clientName, ...decision} = params;
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
        // Any OAuth-registered client (not just Claude, since Phase 2) can send
        // a user here — read client_name directly rather than through
        // readOAuthParams, which returns null wholesale when ANY required
        // param is missing, so this is often still present even on fallback.
        const clientName = searchParams.get('client_name');
        return (
            <div className="consent-screen">
                <p className="consent-screen__api-error" role="alert">
                    This link is missing required information and can&apos;t be completed.{' '}
                    {clientName
                        ? `Please restart the connection from ${clientName}.`
                        : 'Please restart the connection from the app you were connecting.'}
                </p>
            </div>
        );
    }

    return (
        <div className="consent-screen">
            <h1 className="consent-screen__title">Connect {params.client_name} to Finance Tracker</h1>
            <p className="consent-screen__description">
                {params.client_name} is requesting access to your Finance Tracker account. If you
                approve, it will be able to:
            </p>
            <ul className="consent-screen__permissions">
                {params.scopes.map((scope) => (
                    <li key={scope}>{SCOPE_LABELS[scope] ?? scope}</li>
                ))}
            </ul>
            <p className="consent-screen__redirect-domain">
                You&apos;ll be redirected to: <strong>{redirectDomain(params.redirect_uri)}</strong>
            </p>

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
