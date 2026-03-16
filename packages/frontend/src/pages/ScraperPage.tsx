import React, {
    useState, useCallback
} from 'react';
import {ScraperErrorBoundary} from '@features/scraper/components/ScraperErrorBoundary.js';
import {FileImportDropzone} from '@features/scraper/components/FileImportDropzone.js';
import {ImportJobList} from '@features/scraper/components/ImportJobList.js';
import {SyncScheduleList} from '@features/scraper/components/SyncScheduleList.js';
import {SyncScheduleModal} from '@features/scraper/components/SyncScheduleModal.js';
import {SyncStatusPanel} from '@features/scraper/components/SyncStatusPanel.js';
import {MfaModal} from '@features/scraper/components/MfaModal.js';
import {useImportJob} from '@features/scraper/hooks/useImportJob.js';
import {useSyncSchedule} from '@features/scraper/hooks/useSyncSchedule.js';
import {useSyncJob} from '@features/scraper/hooks/useSyncJob.js';
import type {SyncScheduleResponseDto} from '@/api/model/syncScheduleResponseDto.js';
import styles from '@pages/ScraperPage.module.css';

type Tab = 'import' | 'sync';

const ScraperPageInner = (): React.JSX.Element => {
    const [activeTab, setActiveTab] = useState<Tab>('import');
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [mfaChallenge, setMfaChallenge] = useState<string>('');
    const [activeScheduleId, setActiveScheduleId] = useState<string>('');

    // Import hooks
    const {jobs, isLoading: jobsLoading, isError: jobsError, upload, isUploading} = useImportJob();

    // Sync schedule CRUD hooks
    const {
        schedules,
        isLoading: schedulesLoading,
        isError: schedulesError,
        modalMode,
        formValues,
        errors: formErrors,
        isSubmitting,
        openCreate,
        openEdit,
        closeModal,
        handleFieldChange,
        handleInputChange,
        handleSubmit,
        handleDelete: deleteSchedule
    } = useSyncSchedule();

    // Sync job trigger + MFA
    const {
        sessionId,
        isTriggeringId,
        trigger,
        submitMfa,
        clearSession,
        isSubmittingMfa
    } = useSyncJob();

    const handleDeleteSchedule = useCallback(
        (schedule: SyncScheduleResponseDto): void => {
            if (window.confirm(`Delete sync schedule for "${schedule.displayName}"? This cannot be undone.`)) {
                deleteSchedule(schedule.id);
            }
        },
        [deleteSchedule]
    );

    const handleTriggerSchedule = useCallback(
        (schedule: SyncScheduleResponseDto): void => {
            setActiveScheduleId(schedule.id);
            trigger(schedule.id);
        },
        [trigger]
    );

    const handleMfaRequired = useCallback((challenge: string): void => {
        setMfaChallenge(challenge);
    }, []);

    const handleMfaSubmit = useCallback(
        (code: string): void => {
            if (sessionId !== null) {
                submitMfa(activeScheduleId, code, sessionId);
                setMfaChallenge('');
            }
        },
        [sessionId, activeScheduleId, submitMfa]
    );

    const handleMfaCancel = useCallback((): void => {
        setMfaChallenge('');
    }, []);

    const handleSyncComplete = useCallback((): void => {
        // Panel will show completion state; user can dismiss manually
    }, []);

    const handleClosePanel = useCallback((): void => {
        clearSession();
    }, [clearSession]);

    const handleFile = useCallback(
        async (file: File): Promise<void> => {
            setUploadError(null);
            try {
                await upload(file);
            } catch (err) {
                setUploadError((err as {message?: string}).message ?? 'Upload failed');
            }
        },
        [upload]
    );

    return (
        <main className={styles.page} aria-label="Bank Scraper">
            <div className={styles.inner}>
                <header className={styles.header}>
                    <h1 className={styles.title}>Bank Scraper</h1>
                </header>

                {/* Tab bar */}
                <div className={styles.tabs} role="tablist" aria-label="Scraper sections">
                    <button
                        role="tab"
                        type="button"
                        id="tab-import"
                        aria-controls="panel-import"
                        aria-selected={activeTab === 'import'}
                        className={`${styles.tab} ${activeTab === 'import' ? styles.tabActive : ''}`}
                        onClick={() => { setActiveTab('import'); }}
                    >
                        Import
                    </button>
                    <button
                        role="tab"
                        type="button"
                        id="tab-sync"
                        aria-controls="panel-sync"
                        aria-selected={activeTab === 'sync'}
                        className={`${styles.tab} ${activeTab === 'sync' ? styles.tabActive : ''}`}
                        onClick={() => { setActiveTab('sync'); }}
                    >
                        Sync
                    </button>
                </div>

                {/* Import tab */}
                <div
                    id="panel-import"
                    role="tabpanel"
                    aria-labelledby="tab-import"
                    hidden={activeTab !== 'import'}
                    className={styles.panel}
                >
                    <section className={styles.section} aria-label="Upload file">
                        <h2 className={styles.sectionTitle}>Upload File</h2>
                        <FileImportDropzone
                            onFile={(file) => { void handleFile(file); }}
                            isUploading={isUploading}
                        />
                        {uploadError !== null && (
                            <p role="alert" className={styles.uploadError}>{uploadError}</p>
                        )}
                    </section>

                    <section className={styles.section} aria-label="Import history">
                        <h2 className={styles.sectionTitle}>Import History</h2>
                        <ImportJobList
                            jobs={jobs}
                            isLoading={jobsLoading}
                            isError={jobsError}
                        />
                    </section>
                </div>

                {/* Sync tab */}
                <div
                    id="panel-sync"
                    role="tabpanel"
                    aria-labelledby="tab-sync"
                    hidden={activeTab !== 'sync'}
                    className={styles.panel}
                >
                    <section className={styles.section} aria-label="Sync schedules">
                        <div className={styles.sectionHeader}>
                            <h2 className={styles.sectionTitle}>Sync Schedules</h2>
                            <button
                                type="button"
                                className={styles.newBtn}
                                onClick={openCreate}
                                aria-label="Create new sync schedule"
                            >
                                + New Schedule
                            </button>
                        </div>
                        <SyncScheduleList
                            schedules={schedules}
                            isLoading={schedulesLoading}
                            isError={schedulesError}
                            triggeringId={isTriggeringId}
                            onEdit={openEdit}
                            onDelete={handleDeleteSchedule}
                            onTrigger={handleTriggerSchedule}
                        />
                    </section>

                    {sessionId !== null && (
                        <section className={styles.section} aria-label="Live sync status">
                            <SyncStatusPanel
                                sessionId={sessionId}
                                onMfaRequired={handleMfaRequired}
                                onComplete={handleSyncComplete}
                                onClose={handleClosePanel}
                            />
                        </section>
                    )}
                </div>
            </div>

            {/* Modals */}
            <SyncScheduleModal
                mode={modalMode}
                values={formValues}
                errors={formErrors}
                isSubmitting={isSubmitting}
                onClose={closeModal}
                onChange={handleFieldChange}
                onInputChange={handleInputChange}
                onSubmit={handleSubmit}
            />

            <MfaModal
                key={mfaChallenge !== '' ? mfaChallenge : 'mfa-closed'}
                isOpen={mfaChallenge !== ''}
                challenge={mfaChallenge}
                isSubmitting={isSubmittingMfa}
                onSubmit={handleMfaSubmit}
                onCancel={handleMfaCancel}
            />
        </main>
    );
};

const ScraperPage = (): React.JSX.Element => (
    <ScraperErrorBoundary>
        <ScraperPageInner />
    </ScraperErrorBoundary>
);

export default ScraperPage;
