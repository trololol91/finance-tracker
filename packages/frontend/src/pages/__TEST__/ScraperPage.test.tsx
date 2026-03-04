import {
    describe, it, expect, vi, beforeEach, afterEach
} from 'vitest';
import {
    render, screen, waitFor
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ── Component mocks ──────────────────────────────────────────────────────────
vi.mock('@features/scraper/components/ScraperErrorBoundary.js', () => ({
    ScraperErrorBoundary: ({children}: {children: React.ReactNode}) => <>{children}</>
}));

vi.mock('@features/scraper/components/FileImportDropzone.js', () => ({
    FileImportDropzone: ({
        onFile, isUploading
    }: {onFile: (f: File) => void, isUploading: boolean}) => (
        <div data-testid="dropzone">
            <span>{isUploading ? 'Uploading…' : 'Drop zone'}</span>
            <button
                data-testid="trigger-upload"
                onClick={() => { onFile(new File([''], 'test.csv', {type: 'text/csv'})); }}
            >
                Upload
            </button>
        </div>
    )
}));

vi.mock('@features/scraper/components/ImportJobList.js', () => ({
    ImportJobList: () => <div data-testid="import-job-list">Job list</div>
}));

vi.mock('@features/scraper/components/SyncScheduleList.js', () => ({
    SyncScheduleList: ({
        schedules,
        onTrigger,
        onEdit,
        onDelete
    }: {
        schedules: {id: string, displayName: string}[];
        onTrigger: (s: {id: string, displayName: string}) => void;
        onEdit: (s: {id: string, displayName: string}) => void;
        onDelete: (s: {id: string, displayName: string}) => void;
    }) => (
        <div data-testid="sync-schedule-list">
            {schedules.map(s => (
                <div key={s.id}>
                    <span>{s.displayName}</span>
                    <button onClick={() => { onTrigger(s); }}>Trigger</button>
                    <button onClick={() => { onEdit(s); }}>Edit</button>
                    <button onClick={() => { onDelete(s); }}>Delete</button>
                </div>
            ))}
        </div>
    )
}));

vi.mock('@features/scraper/components/SyncScheduleModal.js', () => ({
    SyncScheduleModal: ({
        mode, onClose
    }: {mode: string | null, onClose: () => void}) =>
        mode !== null ? (
            <div role="dialog" data-testid="schedule-modal">
                <button onClick={onClose}>Close modal</button>
            </div>
        ) : null
}));

vi.mock('@features/scraper/components/SyncStatusPanel.js', () => ({
    SyncStatusPanel: ({
        sessionId, onClose, onMfaRequired
    }: {
        sessionId: string | null;
        onClose: () => void;
        onMfaRequired: (challenge: string) => void;
    }) => sessionId !== null ? (
        <div data-testid="sync-status-panel">
            <button data-testid="close-panel" onClick={onClose}>Close panel</button>
            <button
                data-testid="trigger-mfa"
                onClick={() => { onMfaRequired('Enter the OTP from your bank app'); }}
            >
                Trigger MFA
            </button>
        </div>
    ) : null
}));

vi.mock('@features/scraper/components/MfaModal.js', () => ({
    MfaModal: ({
        isOpen, onSubmit, onCancel
    }: {
        isOpen: boolean;
        challenge: string;
        isSubmitting: boolean;
        onSubmit: (code: string) => void;
        onCancel: () => void;
    }) => isOpen ? (
        <div role="dialog" data-testid="mfa-modal">
            <button data-testid="mfa-submit" onClick={() => { onSubmit('654321'); }}>Submit MFA</button>
            <button data-testid="mfa-cancel" onClick={onCancel}>Cancel MFA</button>
        </div>
    ) : null
}));

// ── Hook mocks ───────────────────────────────────────────────────────────────
vi.mock('@features/scraper/hooks/useImportJob.js', () => ({
    useImportJob: vi.fn()
}));
vi.mock('@features/scraper/hooks/useSyncSchedule.js', () => ({
    useSyncSchedule: vi.fn()
}));
vi.mock('@features/scraper/hooks/useSyncJob.js', () => ({
    useSyncJob: vi.fn()
}));

import ScraperPage from '@pages/ScraperPage.js';
import {useImportJob} from '@features/scraper/hooks/useImportJob.js';
import {useSyncSchedule} from '@features/scraper/hooks/useSyncSchedule.js';
import {useSyncJob} from '@features/scraper/hooks/useSyncJob.js';
import type {SyncScheduleResponseDto} from '@/api/model/syncScheduleResponseDto.js';
import type {
    SyncScheduleFormValues, SyncScheduleFormErrors
} from '@features/scraper/types/scraper.types.js';
import type {UseSyncScheduleReturn} from '@features/scraper/hooks/useSyncSchedule.js';
import type {UseSyncJobReturn} from '@features/scraper/hooks/useSyncJob.js';

// ── Typed mocks ──────────────────────────────────────────────────────────────
const mockImportJob = vi.mocked(useImportJob);
const mockSyncSchedule = vi.mocked(useSyncSchedule);
const mockSyncJob = vi.mocked(useSyncJob);

// ── Helpers ──────────────────────────────────────────────────────────────────
const defaultFormValues: SyncScheduleFormValues = {
    accountId: '', bankId: '', username: '', password: '',
    cron: '0 8 * * *', lookbackDays: '3', enabled: true
};

const makeSchedule = (
    overrides: Partial<SyncScheduleResponseDto> = {}
): SyncScheduleResponseDto => ({
    id: 's-1',
    accountId: 'a-1',
    bankId: 'td',
    displayName: 'TD Chequing',
    cron: '0 8 * * *',
    enabled: true,
    lookbackDays: 7,
    requiresMfaOnEveryRun: false,
    maxLookbackDays: 90,
    pendingTransactionsIncluded: false,
    lastRunAt: null,
    lastRunStatus: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
});

const makeImportJobReturn = (
    overrides: Partial<ReturnType<typeof useImportJob>> = {}
): ReturnType<typeof useImportJob> => ({
    jobs: [],
    isLoading: false,
    isError: false,
    upload: vi.fn().mockResolvedValue(undefined),
    isUploading: false,
    ...overrides
} as ReturnType<typeof useImportJob>);

const makeSyncScheduleReturn = (
    overrides: Partial<UseSyncScheduleReturn> = {}
): UseSyncScheduleReturn => ({
    schedules: [],
    isLoading: false,
    isError: false,
    modalMode: null,
    formValues: defaultFormValues,
    errors: {} as SyncScheduleFormErrors,
    isSubmitting: false,
    editTarget: null,
    openCreate: vi.fn(),
    openEdit: vi.fn(),
    closeModal: vi.fn(),
    handleFieldChange: vi.fn(),
    handleSubmit: vi.fn(),
    handleDelete: vi.fn(),
    ...overrides
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

// ── Setup ────────────────────────────────────────────────────────────────────
beforeEach(() => {
    vi.clearAllMocks();
    mockImportJob.mockReturnValue(makeImportJobReturn());
    mockSyncSchedule.mockReturnValue(makeSyncScheduleReturn());
    mockSyncJob.mockReturnValue(makeSyncJobReturn());
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────
describe('ScraperPage', () => {
    describe('rendering', () => {
        it('renders "Bank Scraper" heading', () => {
            render(<ScraperPage />);
            expect(screen.getByRole('heading', {name: /bank scraper/i})).toBeInTheDocument();
        });

        it('renders main landmark with aria-label', () => {
            render(<ScraperPage />);
            expect(screen.getByRole('main', {name: /bank scraper/i})).toBeInTheDocument();
        });

        it('renders tablist with two tabs', () => {
            render(<ScraperPage />);
            expect(screen.getByRole('tablist', {name: /scraper sections/i})).toBeInTheDocument();
            expect(screen.getByRole('tab', {name: 'Import'})).toBeInTheDocument();
            expect(screen.getByRole('tab', {name: 'Sync'})).toBeInTheDocument();
        });
    });

    describe('tab navigation', () => {
        it('Import tab is selected by default', () => {
            render(<ScraperPage />);
            expect(screen.getByRole('tab', {name: 'Import'}))
                .toHaveAttribute('aria-selected', 'true');
            expect(screen.getByRole('tab', {name: 'Sync'}))
                .toHaveAttribute('aria-selected', 'false');
        });

        it('Import panel is visible by default', () => {
            render(<ScraperPage />);
            expect(document.getElementById('panel-import')).not.toHaveAttribute('hidden');
        });

        it('Sync panel is hidden by default', () => {
            render(<ScraperPage />);
            expect(document.getElementById('panel-sync')).toHaveAttribute('hidden');
        });

        it('clicking Sync tab activates Sync panel', async () => {
            const user = userEvent.setup();
            render(<ScraperPage />);
            await user.click(screen.getByRole('tab', {name: 'Sync'}));
            expect(screen.getByRole('tab', {name: 'Sync'}))
                .toHaveAttribute('aria-selected', 'true');
            expect(document.getElementById('panel-import')).toHaveAttribute('hidden');
            expect(document.getElementById('panel-sync')).not.toHaveAttribute('hidden');
        });

        it('clicking Import tab switches back from Sync', async () => {
            const user = userEvent.setup();
            render(<ScraperPage />);
            await user.click(screen.getByRole('tab', {name: 'Sync'}));
            await user.click(screen.getByRole('tab', {name: 'Import'}));
            expect(screen.getByRole('tab', {name: 'Import'}))
                .toHaveAttribute('aria-selected', 'true');
            expect(document.getElementById('panel-import')).not.toHaveAttribute('hidden');
            expect(document.getElementById('panel-sync')).toHaveAttribute('hidden');
        });

        it('Import tab has aria-controls="panel-import"', () => {
            render(<ScraperPage />);
            expect(screen.getByRole('tab', {name: 'Import'}))
                .toHaveAttribute('aria-controls', 'panel-import');
        });

        it('Sync tab has aria-controls="panel-sync"', () => {
            render(<ScraperPage />);
            expect(screen.getByRole('tab', {name: 'Sync'}))
                .toHaveAttribute('aria-controls', 'panel-sync');
        });
    });

    describe('import tab content', () => {
        it('renders the file dropzone', () => {
            render(<ScraperPage />);
            expect(screen.getByTestId('dropzone')).toBeInTheDocument();
        });

        it('renders the import job list', () => {
            render(<ScraperPage />);
            expect(screen.getByTestId('import-job-list')).toBeInTheDocument();
        });

        it('shows upload error alert when upload rejects with message', async () => {
            const user = userEvent.setup();
            const upload = vi.fn().mockRejectedValue(new Error('Network error'));
            mockImportJob.mockReturnValue(makeImportJobReturn({upload}));
            render(<ScraperPage />);
            await user.click(screen.getByTestId('trigger-upload'));
            expect(await screen.findByRole('alert')).toHaveTextContent('Network error');
        });

        it('shows "Upload failed" fallback when error has no message', async () => {
            const user = userEvent.setup();
            const upload = vi.fn().mockRejectedValue({});
            mockImportJob.mockReturnValue(makeImportJobReturn({upload}));
            render(<ScraperPage />);
            await user.click(screen.getByTestId('trigger-upload'));
            expect(await screen.findByRole('alert')).toHaveTextContent('Upload failed');
        });

        it('clears upload error when a subsequent upload succeeds', async () => {
            const user = userEvent.setup();
            const upload = vi.fn()
                .mockRejectedValueOnce(new Error('Rejected'))
                .mockResolvedValueOnce(undefined);
            mockImportJob.mockReturnValue(makeImportJobReturn({upload}));
            render(<ScraperPage />);
            await user.click(screen.getByTestId('trigger-upload'));
            await screen.findByRole('alert');
            await user.click(screen.getByTestId('trigger-upload'));
            await waitFor(() => {
                expect(screen.queryByRole('alert')).not.toBeInTheDocument();
            });
        });

        it('upload error is not shown initially', () => {
            render(<ScraperPage />);
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });
    });

    describe('sync tab — schedule list', () => {
        it('shows "+ New Schedule" button in sync panel', async () => {
            const user = userEvent.setup();
            render(<ScraperPage />);
            await user.click(screen.getByRole('tab', {name: 'Sync'}));
            expect(
                screen.getByRole('button', {name: /create new sync schedule/i})
            ).toBeInTheDocument();
        });

        it('calls openCreate when "+ New Schedule" is clicked', async () => {
            const user = userEvent.setup();
            const openCreate = vi.fn();
            mockSyncSchedule.mockReturnValue(makeSyncScheduleReturn({openCreate}));
            render(<ScraperPage />);
            await user.click(screen.getByRole('tab', {name: 'Sync'}));
            await user.click(screen.getByRole('button', {name: /create new sync schedule/i}));
            expect(openCreate).toHaveBeenCalledOnce();
        });

        it('renders schedule display names in the list', async () => {
            const user = userEvent.setup();
            mockSyncSchedule.mockReturnValue(makeSyncScheduleReturn({
                schedules: [makeSchedule({displayName: 'CIBC Visa'})]
            }));
            render(<ScraperPage />);
            await user.click(screen.getByRole('tab', {name: 'Sync'}));
            expect(screen.getByText('CIBC Visa')).toBeInTheDocument();
        });

        it('calls openEdit with the full schedule when Edit is clicked', async () => {
            const user = userEvent.setup();
            const openEdit = vi.fn();
            const schedule = makeSchedule({id: 's-edit', displayName: 'Edit Me'});
            mockSyncSchedule.mockReturnValue(makeSyncScheduleReturn({
                schedules: [schedule],
                openEdit
            }));
            render(<ScraperPage />);
            await user.click(screen.getByRole('tab', {name: 'Sync'}));
            await user.click(screen.getByRole('button', {name: 'Edit'}));
            expect(openEdit).toHaveBeenCalledWith(schedule);
        });

        it('calls trigger with schedule id when Trigger is clicked', async () => {
            const user = userEvent.setup();
            const trigger = vi.fn();
            mockSyncSchedule.mockReturnValue(makeSyncScheduleReturn({
                schedules: [makeSchedule({id: 'sched-run'})]
            }));
            mockSyncJob.mockReturnValue(makeSyncJobReturn({trigger}));
            render(<ScraperPage />);
            await user.click(screen.getByRole('tab', {name: 'Sync'}));
            await user.click(screen.getByRole('button', {name: 'Trigger'}));
            expect(trigger).toHaveBeenCalledWith('sched-run');
        });
    });

    describe('delete schedule flow', () => {
        const schedule = makeSchedule({id: 's-del', displayName: 'TD Chequing'});

        it('prompts window.confirm before deleting', async () => {
            const user = userEvent.setup();
            const handleDelete = vi.fn();
            mockSyncSchedule.mockReturnValue(makeSyncScheduleReturn({
                schedules: [schedule],
                handleDelete
            }));
            vi.spyOn(window, 'confirm').mockReturnValue(false);
            render(<ScraperPage />);
            await user.click(screen.getByRole('tab', {name: 'Sync'}));
            await user.click(screen.getByRole('button', {name: 'Delete'}));
            expect(window.confirm).toHaveBeenCalledWith(
                expect.stringContaining('TD Chequing')
            );
        });

        it('calls handleDelete when confirm is accepted', async () => {
            const user = userEvent.setup();
            const handleDelete = vi.fn();
            mockSyncSchedule.mockReturnValue(makeSyncScheduleReturn({
                schedules: [schedule],
                handleDelete
            }));
            vi.spyOn(window, 'confirm').mockReturnValue(true);
            render(<ScraperPage />);
            await user.click(screen.getByRole('tab', {name: 'Sync'}));
            await user.click(screen.getByRole('button', {name: 'Delete'}));
            expect(handleDelete).toHaveBeenCalledWith(schedule.id);
        });

        it('does NOT call handleDelete when confirm is cancelled', async () => {
            const user = userEvent.setup();
            const handleDelete = vi.fn();
            mockSyncSchedule.mockReturnValue(makeSyncScheduleReturn({
                schedules: [schedule],
                handleDelete
            }));
            vi.spyOn(window, 'confirm').mockReturnValue(false);
            render(<ScraperPage />);
            await user.click(screen.getByRole('tab', {name: 'Sync'}));
            await user.click(screen.getByRole('button', {name: 'Delete'}));
            expect(handleDelete).not.toHaveBeenCalled();
        });
    });

    describe('schedule modal', () => {
        it('SyncScheduleModal is hidden when modalMode is null', () => {
            render(<ScraperPage />);
            expect(screen.queryByTestId('schedule-modal')).not.toBeInTheDocument();
        });

        it('shows SyncScheduleModal when modalMode is "create"', () => {
            mockSyncSchedule.mockReturnValue(makeSyncScheduleReturn({modalMode: 'create'}));
            render(<ScraperPage />);
            expect(screen.getByTestId('schedule-modal')).toBeInTheDocument();
        });

        it('shows SyncScheduleModal when modalMode is "edit"', () => {
            mockSyncSchedule.mockReturnValue(makeSyncScheduleReturn({modalMode: 'edit'}));
            render(<ScraperPage />);
            expect(screen.getByTestId('schedule-modal')).toBeInTheDocument();
        });

        it('calls closeModal when modal close button is clicked', async () => {
            const user = userEvent.setup();
            const closeModal = vi.fn();
            mockSyncSchedule.mockReturnValue(makeSyncScheduleReturn({
                modalMode: 'create',
                closeModal
            }));
            render(<ScraperPage />);
            await user.click(screen.getByRole('button', {name: /close modal/i}));
            expect(closeModal).toHaveBeenCalledOnce();
        });
    });

    describe('sync status panel', () => {
        it('does not render status panel when sessionId is null', async () => {
            const user = userEvent.setup();
            render(<ScraperPage />);
            await user.click(screen.getByRole('tab', {name: 'Sync'}));
            expect(screen.queryByTestId('sync-status-panel')).not.toBeInTheDocument();
        });

        it('renders status panel when sessionId is non-null', async () => {
            const user = userEvent.setup();
            mockSyncJob.mockReturnValue(makeSyncJobReturn({sessionId: 'sess-abc'}));
            render(<ScraperPage />);
            await user.click(screen.getByRole('tab', {name: 'Sync'}));
            expect(screen.getByTestId('sync-status-panel')).toBeInTheDocument();
        });

        it('calls clearSession when close panel button is clicked', async () => {
            const user = userEvent.setup();
            const clearSession = vi.fn();
            mockSyncJob.mockReturnValue(makeSyncJobReturn({
                sessionId: 'sess-close',
                clearSession
            }));
            render(<ScraperPage />);
            await user.click(screen.getByRole('tab', {name: 'Sync'}));
            await user.click(screen.getByTestId('close-panel'));
            expect(clearSession).toHaveBeenCalledOnce();
        });
    });

    describe('MFA modal', () => {
        it('MFA modal is not visible initially', () => {
            render(<ScraperPage />);
            expect(screen.queryByTestId('mfa-modal')).not.toBeInTheDocument();
        });

        it('opens MFA modal after SyncStatusPanel triggers onMfaRequired', async () => {
            const user = userEvent.setup();
            mockSyncJob.mockReturnValue(makeSyncJobReturn({sessionId: 'sess-mfa'}));
            render(<ScraperPage />);
            await user.click(screen.getByRole('tab', {name: 'Sync'}));
            await user.click(screen.getByTestId('trigger-mfa'));
            expect(screen.getByTestId('mfa-modal')).toBeInTheDocument();
        });

        it('closes MFA modal when onCancel is called', async () => {
            const user = userEvent.setup();
            mockSyncJob.mockReturnValue(makeSyncJobReturn({sessionId: 'sess-mfa'}));
            render(<ScraperPage />);
            await user.click(screen.getByRole('tab', {name: 'Sync'}));
            await user.click(screen.getByTestId('trigger-mfa'));
            await user.click(screen.getByTestId('mfa-cancel'));
            expect(screen.queryByTestId('mfa-modal')).not.toBeInTheDocument();
        });

        it('calls submitMfa when MFA code is submitted', async () => {
            const user = userEvent.setup();
            const submitMfa = vi.fn();
            mockSyncJob.mockReturnValue(makeSyncJobReturn({
                sessionId: 'sess-submit',
                submitMfa
            }));
            render(<ScraperPage />);
            await user.click(screen.getByRole('tab', {name: 'Sync'}));
            await user.click(screen.getByTestId('trigger-mfa'));
            await user.click(screen.getByTestId('mfa-submit'));
            expect(submitMfa).toHaveBeenCalledWith(
                expect.any(String), // activeScheduleId
                '654321',
                'sess-submit'
            );
        });

        it('closes MFA modal after submitting code', async () => {
            const user = userEvent.setup();
            mockSyncJob.mockReturnValue(makeSyncJobReturn({
                sessionId: 'sess-submit',
                submitMfa: vi.fn()
            }));
            render(<ScraperPage />);
            await user.click(screen.getByRole('tab', {name: 'Sync'}));
            await user.click(screen.getByTestId('trigger-mfa'));
            await user.click(screen.getByTestId('mfa-submit'));
            expect(screen.queryByTestId('mfa-modal')).not.toBeInTheDocument();
        });

        it('does not call submitMfa when sessionId is null', () => {
            // If sessionId is null the MFA modal should not even be open,
            // but the guard is also inside handleMfaSubmit.
            const submitMfa = vi.fn();
            mockSyncJob.mockReturnValue(makeSyncJobReturn({
                sessionId: null,
                submitMfa
            }));
            render(<ScraperPage />);
            // No way to open the MFA modal without a sessionId = correct behavior
            expect(screen.queryByTestId('mfa-modal')).not.toBeInTheDocument();
            expect(submitMfa).not.toHaveBeenCalled();
        });
    });
});
