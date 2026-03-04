import React, {useEffect} from 'react';
import {useSyncStream} from '@features/scraper/hooks/useSyncStream.js';
import styles from '@features/scraper/components/SyncStatusPanel.module.css';

interface SyncStatusPanelProps {
    sessionId: string | null;
    onMfaRequired: (challenge: string) => void;
    onComplete: () => void;
    onClose: () => void;
}

export const SyncStatusPanel = ({
    sessionId,
    onMfaRequired,
    onComplete,
    onClose
}: SyncStatusPanelProps): React.JSX.Element | null => {
    const {event, isConnected, error} = useSyncStream(sessionId);

    useEffect(() => {
        if (event.status === 'mfa_required') {
            onMfaRequired(event.mfaChallenge ?? '');
        }
    }, [event, onMfaRequired]);

    useEffect(() => {
        if (event.status === 'completed') {
            onComplete();
        }
    }, [event, onComplete]);

    if (sessionId === null) return null;

    const statusLabel: Record<string, string> = {
        idle: 'Connecting…',
        running: event.message ?? 'Running…',
        mfa_required: 'Waiting for MFA code…',
        completed: 'Sync completed',
        failed: 'Sync failed'
    };

    const label = statusLabel[event.status] ?? 'Working…';

    return (
        <div
            className={styles.panel}
            role="status"
            aria-label="Sync status"
        >
            <div className={styles.header}>
                <span className={styles.title}>Sync Status</span>
                <button
                    type="button"
                    className={styles.closeBtn}
                    aria-label="Close status panel"
                    onClick={onClose}
                >
                    ✕
                </button>
            </div>

            <div className={styles.body}>
                {error !== null && (
                    <p className={styles.errorMsg} role="alert">{error}</p>
                )}

                <div className={`${styles.indicator} ${styles[event.status]}`}>
                    {isConnected && event.status === 'running' && (
                        <span className={styles.spinner} aria-hidden="true" />
                    )}
                    <span>{label}</span>
                </div>

                {event.status === 'completed' && (
                    <dl className={styles.stats}>
                        <div className={styles.stat}>
                            <dt>Imported</dt>
                            <dd>{event.importedCount ?? 0}</dd>
                        </div>
                        <div className={styles.stat}>
                            <dt>Skipped</dt>
                            <dd>{event.skippedCount ?? 0}</dd>
                        </div>
                    </dl>
                )}

                {event.status === 'failed' && event.errorMessage !== undefined && (
                    <p className={styles.failMsg}>{event.errorMessage}</p>
                )}
            </div>
        </div>
    );
};
