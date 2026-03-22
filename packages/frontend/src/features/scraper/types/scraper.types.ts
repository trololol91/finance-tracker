// Frontend-specific types for the Scraper / Import / Sync feature.
// Generated DTO types live in @/api/model/ — do not redefine them here.

/** Form values for creating or editing a sync schedule (all strings or bool). */
export interface SyncScheduleFormValues {
    accountId: string;
    bankId: string;
    /** Plugin-specific input fields — keys match the selected scraper's inputSchema. */
    inputs: Record<string, string>;
    /** Cron expression, e.g. "0 8 * * *" */
    cron: string;
    /** String representation so input remains controlled, e.g. "3" */
    lookbackDays: string;
    enabled: boolean;
    autoCategorizeLlm: boolean;
}

/**
 * Validation errors for the sync schedule form.
 * Top-level field errors use the field name as key.
 * Input field errors use dotted notation: 'inputs.username', 'inputs.password', etc.
 * `general` is used for server-side errors that are not tied to a specific field.
 */
export type SyncScheduleFormErrors = Partial<Record<keyof SyncScheduleFormValues, string>> &
    Record<string, string | undefined> & {general?: string};

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
