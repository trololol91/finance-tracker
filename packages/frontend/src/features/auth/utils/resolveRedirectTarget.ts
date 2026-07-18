import type {Location} from 'react-router-dom';
import {helpers} from '@utils/helpers.js';
import {APP_ROUTES} from '@config/constants';

/**
 * Where to send a user once they're authenticated on `/login` (or another
 * PublicRoute-guarded page). Prefers the location AuthGuard redirected from
 * (client-side nav to a protected route while signed out), then a
 * `?redirect=` query param (set by the axios interceptor's hard redirect
 * when a refresh attempt fails), then falls back to the dashboard. Both
 * sources are validated as same-origin relative paths to avoid an open
 * redirect via a crafted `from`/`redirect` value.
 *
 * Used by both LoginForm (imperative navigate after submit) and PublicRoute
 * (declarative redirect once `isAuthenticated` flips true) so they agree on
 * the same target instead of racing each other.
 */
export const resolveRedirectTarget = (location: Location): string => {
    const state = location.state as {from?: {pathname: string, search: string}} | null;
    if (state?.from) {
        const target = state.from.pathname + state.from.search;
        if (helpers.isSafeRedirectPath(target)) return target;
    }

    const redirectParam = new URLSearchParams(location.search).get('redirect');
    if (redirectParam && helpers.isSafeRedirectPath(redirectParam)) {
        return redirectParam;
    }

    return APP_ROUTES.DASHBOARD;
};
