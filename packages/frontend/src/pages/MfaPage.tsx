import React, {
    useCallback, useEffect
} from 'react';
import {
    useNavigate,
    useSearchParams
} from 'react-router-dom';
import {MfaModal} from '@features/scraper/components/MfaModal.js';
import {useSyncStream} from '@features/scraper/hooks/useSyncStream.js';
import {useSyncJob} from '@features/scraper/hooks/useSyncJob.js';
import {APP_ROUTES} from '@config/constants.js';
import styles from '@pages/MfaPage.module.css';

const MfaPageInner = (): React.JSX.Element => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const scheduleId = searchParams.get('scheduleId') ?? '';
    const sessionId = searchParams.get('sessionId') ?? null;

    const {event, error: streamError} = useSyncStream(sessionId);
    const {submitMfa, isSubmittingMfa, cancelSync} = useSyncJob();

    // Derive display values directly from the SSE event — no setState in effects
    const isDone = event.status === 'completed';
    const mfaChallenge =
        event.status === 'mfa_required' ? (event.mfaChallenge ?? 'Enter your MFA code') : '';
    const errorMsg: string | null =
        streamError ?? (event.status === 'failed' ? (event.errorMessage ?? 'Sync failed') : null);

    useEffect(() => {
        if (!isDone) return;
        const t = setTimeout(() => {
            void navigate(APP_ROUTES.SCRAPER);
        }, 2000);
        return (): void => { clearTimeout(t); };
    }, [isDone, navigate]);

    const handleMfaSubmit = useCallback(
        (code: string): void => {
            if (scheduleId !== '' && sessionId !== null) {
                submitMfa(sessionId, code);
            }
        },
        [scheduleId, sessionId, submitMfa]
    );

    const handleMfaCancel = useCallback((): void => {
        if (sessionId !== null) {
            cancelSync(sessionId);
        }
        void navigate(APP_ROUTES.SCRAPER);
    }, [sessionId, cancelSync, navigate]);

    return (
        <main className={styles.page} aria-label="MFA Authentication">
            <div className={styles.inner}>
                <h1 className={styles.title}>Multi-Factor Authentication</h1>

                {errorMsg !== null && (
                    <p role="alert" className={styles.error}>{errorMsg}</p>
                )}

                {isDone && (
                    <p className={styles.success} role="status">
                        Sync completed! Redirecting…
                    </p>
                )}

                {!isDone && errorMsg === null && mfaChallenge === '' && (
                    <p className={styles.waiting}>
                        Waiting for MFA prompt from bank…
                    </p>
                )}
            </div>

            <MfaModal
                isOpen={mfaChallenge !== ''}
                challenge={mfaChallenge}
                isSubmitting={isSubmittingMfa}
                onSubmit={handleMfaSubmit}
                onCancel={handleMfaCancel}
            />
        </main>
    );
};

const MfaPage = (): React.JSX.Element => <MfaPageInner />;

export default MfaPage;
