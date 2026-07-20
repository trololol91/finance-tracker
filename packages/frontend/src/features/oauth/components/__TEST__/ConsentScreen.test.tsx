import {
    describe, it, expect, beforeEach, vi
} from 'vitest';
import {
    render, screen, waitFor
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {ConsentScreen} from '@features/oauth/components/ConsentScreen.js';

const mockMutateAsync = vi.fn();

vi.mock('@/api/oauth/oauth.js', () => ({
    useOAuthControllerConsent: () => ({mutateAsync: mockMutateAsync, isPending: false})
}));

const OAUTH_QUERY =
    '?client_id=claude-ai&client_name=Claude&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcallback' +
    '&code_challenge=challenge-value&code_challenge_method=S256' +
    '&scope=transactions%3Aread+transactions%3Awrite+accounts%3Aread+categories%3Aread+dashboard%3Aread' +
    '&state=xyz';

const renderConsentScreen = (search = OAUTH_QUERY): void => {
    render(
        <MemoryRouter initialEntries={[`/oauth/consent${search}`]}>
            <ConsentScreen />
        </MemoryRouter>
    );
};

describe('ConsentScreen', () => {
    const originalLocation = window.location;

    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(window, 'location', {
            value: {...originalLocation, href: ''},
            writable: true
        });
    });

    it('shows a fallback message when required OAuth params are missing from the URL', () => {
        renderConsentScreen('');

        expect(screen.getByRole('alert')).toHaveTextContent(/missing required information/i);
        expect(screen.getByRole('alert')).toHaveTextContent(/the app you were connecting/i);
        expect(mockMutateAsync).not.toHaveBeenCalled();
    });

    it('names the real requesting client in the fallback message when client_name is present but another param is missing', () => {
        renderConsentScreen(
            '?client_id=claude-ai&client_name=GitHub+Copilot&redirect_uri=https%3A%2F%2Fgithub.com%2Fcallback' +
            '&code_challenge=challenge-value&code_challenge_method=S256'
        );

        expect(screen.getByRole('alert')).toHaveTextContent(/restart the connection from GitHub Copilot/i);
    });

    it('shows the raw redirect_uri instead of a blank domain when it has no host component', () => {
        renderConsentScreen(
            '?client_id=abcd1234&client_name=Evil+App&redirect_uri=javascript%3Aalert(1)' +
            '&code_challenge=challenge-value&code_challenge_method=S256&scope=transactions%3Aread'
        );

        expect(screen.getByText('javascript:alert(1)')).toBeInTheDocument();
    });

    it('lists permissions driven by the scope param, not a hardcoded guess', () => {
        renderConsentScreen();

        expect(screen.getByText('View your transactions')).toBeInTheDocument();
        expect(screen.getByText('Add new transactions')).toBeInTheDocument();
    });

    it('renders an unrecognized scope as its raw string instead of silently omitting it', () => {
        renderConsentScreen(
            '?client_id=claude-ai&client_name=Claude&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcallback' +
            '&code_challenge=challenge-value&code_challenge_method=S256&scope=budgets%3Aread'
        );

        expect(screen.getByText('budgets:read')).toBeInTheDocument();
    });

    it('shows the fallback message when scope is missing from the URL, same as any other required param', () => {
        renderConsentScreen(
            '?client_id=claude-ai&client_name=Claude&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcallback' +
            '&code_challenge=challenge-value&code_challenge_method=S256'
        );

        expect(screen.getByRole('alert')).toHaveTextContent(/missing required information/i);
    });

    it('shows the fallback message when client_name is missing from the URL', () => {
        renderConsentScreen(
            '?client_id=claude-ai&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcallback' +
            '&code_challenge=challenge-value&code_challenge_method=S256&scope=transactions%3Aread'
        );

        expect(screen.getByRole('alert')).toHaveTextContent(/missing required information/i);
    });

    it('renders the real requesting client\'s name, not a hardcoded "Claude"', () => {
        renderConsentScreen(
            '?client_id=abcd1234&client_name=GitHub+Copilot&redirect_uri=https%3A%2F%2Fgithub.com%2Fcallback' +
            '&code_challenge=challenge-value&code_challenge_method=S256&scope=transactions%3Aread'
        );

        expect(screen.getByText(/Connect GitHub Copilot to Finance Tracker/)).toBeInTheDocument();
        expect(screen.getByText(/GitHub Copilot is requesting access/)).toBeInTheDocument();
    });

    it('shows the redirect URI\'s domain — the signal that can\'t be spoofed by a self-chosen client_name', () => {
        renderConsentScreen(
            '?client_id=abcd1234&client_name=Claude&redirect_uri=https%3A%2F%2Fattacker.evil%2Fcallback%3Fx%3D1' +
            '&code_challenge=challenge-value&code_challenge_method=S256&scope=transactions%3Aread'
        );

        expect(screen.getByText('attacker.evil')).toBeInTheDocument();
    });

    it('submits approved: true and redirects to the returned redirectTo on Approve', async () => {
        const user = userEvent.setup();
        mockMutateAsync.mockResolvedValue({redirectTo: 'https://claude.ai/callback?code=abc&state=xyz'});
        renderConsentScreen();

        await user.click(screen.getByRole('button', {name: /approve/i}));

        expect(mockMutateAsync).toHaveBeenCalledWith({
            data: {
                client_id: 'claude-ai',
                redirect_uri: 'https://claude.ai/callback',
                code_challenge: 'challenge-value',
                code_challenge_method: 'S256',
                state: 'xyz',
                approved: true
            }
        });
        await waitFor(() => {
            expect(window.location.href).toBe('https://claude.ai/callback?code=abc&state=xyz');
        });
    });

    it('submits approved: false on Deny', async () => {
        const user = userEvent.setup();
        mockMutateAsync.mockResolvedValue({redirectTo: 'https://claude.ai/callback?error=access_denied&state=xyz'});
        renderConsentScreen();

        await user.click(screen.getByRole('button', {name: /deny/i}));

        expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({approved: false})
        }));
    });

    it('shows an error message if the consent request fails', async () => {
        const user = userEvent.setup();
        mockMutateAsync.mockRejectedValue(new Error('network error'));
        renderConsentScreen();

        await user.click(screen.getByRole('button', {name: /approve/i}));

        expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong/i);
    });
});
