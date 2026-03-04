// Frontend-specific types for the Scraper / Import / Sync feature.
// Generated DTO types live in @/api/model/ — do not redefine them here.

/** Form values for creating or editing a sync schedule (all strings or bool). */
export interface SyncScheduleFormValues {
    accountId: string;
    bankId: string;
    username: string;
    password: string;
    /** Cron expression, e.g. "0 8 * * *" */
    cron: string;
    /** String representation so input remains controlled, e.g. "3" */
    lookbackDays: string;
    enabled: boolean;
}

export type SyncScheduleFormErrors = Partial<Record<keyof SyncScheduleFormValues, string>>;

/** Whether the sync schedule modal is open for create or edit. */
export type SyncScheduleModalMode = 'create' | 'edit' | null;

// ── SSE stream types ─────────────────────────────────────────────────────────

export type SseStatus = 'idle' | 'running' | 'mfa_required' | 'completed' | 'failed';

export interface SyncStreamEvent {
    status: SseStatus;
    progress?: number;
    message?: string;
    mfaChallenge?: string;
    importedCount?: number;
    skippedCount?: number;
    errorMessage?: string;
}

/** What the useSyncStream hook exposes. */
export interface UseSyncStreamResult {
    event: SyncStreamEvent;
    isConnected: boolean;
    error: string | null;
}
