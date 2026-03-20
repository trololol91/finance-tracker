import {
    describe, it, expect, vi, beforeEach, afterEach
} from 'vitest';
import {
    render, screen, waitFor, act
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Component mocks ──────────────────────────────────────────────────────────
vi.mock('@features/scraper/components/MfaModal.js', () => ({
    MfaModal: ({
        isOpen, onSubmit, onCancel, challenge, isSubmitting
    }: {
        isOpen: boolean;
        challenge: string;
        isSubmitting: boolean;
        onSubmit: (code: string) => void;
        onCancel: () => void;
    }) => isOpen ? (
        <div role="dialog" data-testid="mfa-modal">
            <p data-testid="mfa-challenge">{challenge}</p>
            <button
                data-testid="mfa-submit"
                disabled={isSubmitting}
                onClick={() => { onSubmit('999888'); }}
            >
                Submit
            </button>
            <button data-testid="mfa-cancel" onClick={onCancel}>Cancel</button>
        </div>
    ) : null
}));

// ── Hook / router mocks ──────────────────────────────────────────────────────
const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
    useNavigate: vi.fn(),
    useSearchParams: vi.fn()
}));

vi.mock('@features/scraper/hooks/useSyncStream.js', () => ({
    useSyncStream: vi.fn()
}));

vi.mock('@features/scraper/hooks/useSyncJob.js', () => ({
    useSyncJob: vi.fn()
}));

import MfaPage from '@pages/MfaPage.js';
import {
    useNavigate, useSearchParams
} from 'react-router-dom';
import {useSyncStream} from '@features/scraper/hooks/useSyncStream.js';
import {useSyncJob} from '@features/scraper/hooks/useSyncJob.js';
import type {
    UseSyncStreamResult, SyncStreamEvent
} from '@features/scraper/types/scraper.types.js';
import type {UseSyncJobReturn} from '@features/scraper/hooks/useSyncJob.js';

const mockUseNavigate = vi.mocked(useNavigate);
const mockUseSearchParams = vi.mocked(useSearchParams);
const mockUseSyncStream = vi.mocked(useSyncStream);
const mockUseSyncJob = vi.mocked(useSyncJob);

// ── Helpers ──────────────────────────────────────────────────────────────────
const makeStreamResult = (
    event: Partial<SyncStreamEvent> = {},
    extras: Partial<Omit<UseSyncStreamResult, 'event'>> = {}
): UseSyncStreamResult => ({
    event: {status: 'idle', ...event},
    isConnected: false,
    error: null,
    ...extras
});

const makeSyncJobReturn = (
    overrides: Partial<UseSyncJobReturn> = {}
): UseSyncJobReturn => ({
    sessionId: null,
    isTriggeringId: null,
    trigger: vi.fn(),
    submitMfa: vi.fn(),
    clearSession: vi.fn(),
    isSubmittingMfa: false,
    ...overrides
});

const makeSearchParams = (params: Record<string, string> = {}): URLSearchParams =>
    new URLSearchParams(params);

// ── Setup ────────────────────────────────────────────────────────────────────
beforeEach(() => {
    vi.clearAllMocks();
    mockUseNavigate.mockReturnValue(mockNavigate);
    mockUseSearchParams.mockReturnValue([makeSearchParams(), vi.fn() as never]);
    mockUseSyncStream.mockReturnValue(makeStreamResult());
    mockUseSyncJob.mockReturnValue(makeSyncJobReturn());
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────
describe('MfaPage', () => {
    describe('rendering', () => {
        it('renders "Multi-Factor Authentication" heading', () => {
            render(<MfaPage />);
            expect(
                screen.getByRole('heading', {name: /multi-factor authentication/i})
            ).toBeInTheDocument();
        });

        it('renders main landmark with aria-label', () => {
            render(<MfaPage />);
            expect(screen.getByRole('main', {name: /mfa authentication/i})).toBeInTheDocument();
        });
    });

    describe('idle / waiting state', () => {
        it('shows "Waiting for MFA prompt" when event is idle and no error', () => {
            render(<MfaPage />);
            expect(screen.getByText(/waiting for mfa prompt/i)).toBeInTheDocument();
        });

        it('MFA modal is not open when event is idle', () => {
            render(<MfaPage />);
            expect(screen.queryByTestId('mfa-modal')).not.toBeInTheDocument();
        });

        it('does not show error alert when there is no error', () => {
            render(<MfaPage />);
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        it('does not show "Sync completed" status when event is idle', () => {
            render(<MfaPage />);
            expect(screen.queryByRole('status')).not.toBeInTheDocument();
        });
    });

    describe('running state', () => {
        it('shows "Waiting" text while event is running', () => {
            mockUseSyncStream.mockReturnValue(
                makeStreamResult({status: 'running'})
            );
            render(<MfaPage />);
            expect(screen.getByText(/waiting for mfa prompt/i)).toBeInTheDocument();
        });

        it('does not show MFA modal when status is running', () => {
            mockUseSyncStream.mockReturnValue(
                makeStreamResult({status: 'running'})
            );
            render(<MfaPage />);
            expect(screen.queryByTestId('mfa-modal')).not.toBeInTheDocument();
        });
    });

    describe('error state — streamError', () => {
        it('shows error alert when streamError is set', () => {
            mockUseSyncStream.mockReturnValue(
                makeStreamResult({}, {error: 'Connection dropped'})
            );
            render(<MfaPage />);
            expect(screen.getByRole('alert')).toHaveTextContent('Connection dropped');
        });

        it('hides "Waiting" text when streamError is set', () => {
            mockUseSyncStream.mockReturnValue(
                makeStreamResult({}, {error: 'Timeout'})
            );
            render(<MfaPage />);
            expect(screen.queryByText(/waiting for mfa prompt/i)).not.toBeInTheDocument();
        });

        it('does not show MFA modal when there is a stream error', () => {
            mockUseSyncStream.mockReturnValue(
                makeStreamResult({}, {error: 'Error'})
            );
            render(<MfaPage />);
            expect(screen.queryByTestId('mfa-modal')).not.toBeInTheDocument();
        });
    });

    describe('error state — event.status failed', () => {
        it('shows error alert when event.status is failed', () => {
            mockUseSyncStream.mockReturnValue(
                makeStreamResult({status: 'failed', errorMessage: 'Bank timed out'})
            );
            render(<MfaPage />);
            expect(screen.getByRole('alert')).toHaveTextContent('Bank timed out');
        });

        it('shows fallback error message when errorMessage is undefined', () => {
            mockUseSyncStream.mockReturnValue(
                makeStreamResult({status: 'failed'})
            );
            render(<MfaPage />);
            expect(screen.getByRole('alert')).toHaveTextContent('Sync failed');
        });

        it('precedence: streamError is shown over failed event error', () => {
            mockUseSyncStream.mockReturnValue(
                makeStreamResult(
                    {status: 'failed', errorMessage: 'Event error'},
                    {error: 'Stream error'}
                )
            );
            render(<MfaPage />);
            expect(screen.getByRole('alert')).toHaveTextContent('Stream error');
        });
    });

    describe('mfa_required state', () => {
        it('opens MFA modal when event.status is mfa_required', () => {
            mockUseSyncStream.mockReturnValue(
                makeStreamResult({status: 'mfa_required', mfaChallenge: 'Enter your OTP'})
            );
            render(<MfaPage />);
            expect(screen.getByTestId('mfa-modal')).toBeInTheDocument();
        });

        it('passes mfaChallenge text to dialog', () => {
            mockUseSyncStream.mockReturnValue(
                makeStreamResult({status: 'mfa_required', mfaChallenge: 'Code from app'})
            );
            render(<MfaPage />);
            expect(screen.getByTestId('mfa-challenge')).toHaveTextContent('Code from app');
        });

        it('uses fallback "Enter your MFA code" when mfaChallenge is undefined', () => {
            mockUseSyncStream.mockReturnValue(
                makeStreamResult({status: 'mfa_required'})
            );
            render(<MfaPage />);
            expect(screen.getByTestId('mfa-challenge')).toHaveTextContent('Enter your MFA code');
        });

        it('hides "Waiting" text when MFA modal is open', () => {
            mockUseSyncStream.mockReturnValue(
                makeStreamResult({status: 'mfa_required', mfaChallenge: 'OTP'})
            );
            render(<MfaPage />);
            expect(screen.queryByText(/waiting for mfa prompt/i)).not.toBeInTheDocument();
        });
    });

    describe('completed state', () => {
        it('shows "Sync completed" status when event is completed', () => {
            mockUseSyncStream.mockReturnValue(makeStreamResult({status: 'completed'}));
            render(<MfaPage />);
            expect(screen.getByRole('status')).toHaveTextContent(/sync completed/i);
        });

        it('does not show MFA modal when sync is completed', () => {
            mockUseSyncStream.mockReturnValue(makeStreamResult({status: 'completed'}));
            render(<MfaPage />);
            expect(screen.queryByTestId('mfa-modal')).not.toBeInTheDocument();
        });

        it('does not show "Waiting" text when sync is completed', () => {
            mockUseSyncStream.mockReturnValue(makeStreamResult({status: 'completed'}));
            render(<MfaPage />);
            expect(screen.queryByText(/waiting for mfa prompt/i)).not.toBeInTheDocument();
        });

        it('navigates to /scraper after 2 seconds when sync completes', async () => {
            vi.useFakeTimers();
            mockUseSyncStream.mockReturnValue(makeStreamResult({status: 'completed'}));
            render(<MfaPage />);
            expect(mockNavigate).not.toHaveBeenCalled();
            await act(async () => {
                vi.advanceTimersByTime(2000);
                await Promise.resolve();
            });
            expect(mockNavigate).toHaveBeenCalledWith('/scraper');
        });

        it('does not navigate before 2 seconds have elapsed', async () => {
            vi.useFakeTimers();
            mockUseSyncStream.mockReturnValue(makeStreamResult({status: 'completed'}));
            render(<MfaPage />);
            await act(async () => {
                vi.advanceTimersByTime(1999);
                await Promise.resolve();
            });
            expect(mockNavigate).not.toHaveBeenCalled();
        });

        it('clears the timer on unmount to prevent navigation after unmount', async () => {
            vi.useFakeTimers();
            mockUseSyncStream.mockReturnValue(makeStreamResult({status: 'completed'}));
            const {unmount} = render(<MfaPage />);
            unmount();
            await act(async () => {
                vi.advanceTimersByTime(3000);
                await Promise.resolve();
            });
            expect(mockNavigate).not.toHaveBeenCalled();
        });
    });

    describe('cancel MFA', () => {
        it('navigates to /scraper when Cancel is clicked', async () => {
            const user = userEvent.setup();
            mockUseSyncStream.mockReturnValue(
                makeStreamResult({status: 'mfa_required', mfaChallenge: 'OTP'})
            );
            render(<MfaPage />);
            await user.click(screen.getByTestId('mfa-cancel'));
            expect(mockNavigate).toHaveBeenCalledWith('/scraper');
        });
    });

    describe('MFA submission', () => {
        it('calls submitMfa with sessionId and code from searchParams', async () => {
            const user = userEvent.setup();
            const submitMfa = vi.fn();
            mockUseSearchParams.mockReturnValue([
                makeSearchParams({scheduleId: 'sched-123', sessionId: 'sess-xyz'}),
                vi.fn() as never
            ]);
            mockUseSyncStream.mockReturnValue(
                makeStreamResult({status: 'mfa_required', mfaChallenge: 'OTP'})
            );
            mockUseSyncJob.mockReturnValue(makeSyncJobReturn({submitMfa}));
            render(<MfaPage />);
            await user.click(screen.getByTestId('mfa-submit'));
            expect(submitMfa).toHaveBeenCalledWith('sess-xyz', '999888');
        });

        it('does not call submitMfa when scheduleId is missing', async () => {
            const user = userEvent.setup();
            const submitMfa = vi.fn();
            mockUseSearchParams.mockReturnValue([
                makeSearchParams({sessionId: 'sess-xyz'}), // no scheduleId
                vi.fn() as never
            ]);
            mockUseSyncStream.mockReturnValue(
                makeStreamResult({status: 'mfa_required', mfaChallenge: 'OTP'})
            );
            mockUseSyncJob.mockReturnValue(makeSyncJobReturn({submitMfa}));
            render(<MfaPage />);
            await user.click(screen.getByTestId('mfa-submit'));
            expect(submitMfa).not.toHaveBeenCalled();
        });

        it('does not call submitMfa when sessionId is missing', async () => {
            const user = userEvent.setup();
            const submitMfa = vi.fn();
            mockUseSearchParams.mockReturnValue([
                makeSearchParams({scheduleId: 'sched-123'}), // no sessionId → null
                vi.fn() as never
            ]);
            mockUseSyncStream.mockReturnValue(
                makeStreamResult({status: 'mfa_required', mfaChallenge: 'OTP'})
            );
            mockUseSyncJob.mockReturnValue(makeSyncJobReturn({submitMfa}));
            render(<MfaPage />);
            await user.click(screen.getByTestId('mfa-submit'));
            expect(submitMfa).not.toHaveBeenCalled();
        });

        it('shows submit button as disabled while isSubmittingMfa is true', async () => {
            mockUseSyncStream.mockReturnValue(
                makeStreamResult({status: 'mfa_required', mfaChallenge: 'OTP'})
            );
            mockUseSyncJob.mockReturnValue(makeSyncJobReturn({isSubmittingMfa: true}));
            render(<MfaPage />);
            await waitFor(() => {
                expect(screen.getByTestId('mfa-submit')).toBeDisabled();
            });
        });
    });

    describe('useSyncStream receives sessionId from searchParams', () => {
        it('passes sessionId from searchParams to useSyncStream', () => {
            mockUseSearchParams.mockReturnValue([
                makeSearchParams({sessionId: 'sess-from-url'}),
                vi.fn() as never
            ]);
            render(<MfaPage />);
            expect(mockUseSyncStream).toHaveBeenCalledWith('sess-from-url');
        });

        it('passes null to useSyncStream when no sessionId in searchParams', () => {
            mockUseSearchParams.mockReturnValue([
                makeSearchParams({}),
                vi.fn() as never
            ]);
            render(<MfaPage />);
            expect(mockUseSyncStream).toHaveBeenCalledWith(null);
        });
    });
});
