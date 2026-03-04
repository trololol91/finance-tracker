/**
 * String constants for SyncJob.status values.
 *
 * The Prisma schema uses `status String` (no enum) so these are runtime
 * string constants — no migration is needed to add them.
 *
 * Using a const object instead of inline literals prevents typos from
 * silently producing wrong behaviour (e.g. 'completed' vs 'complete').
 */
export const SyncJobStatus = {
    pending: 'pending',
    loggingIn: 'logging_in',
    running: 'running',
    mfaRequired: 'mfa_required',
    complete: 'complete',
    failed: 'failed'
} as const;

export type SyncJobStatusValue = typeof SyncJobStatus[keyof typeof SyncJobStatus];

/**
 * String constants for SyncSchedule.lastRunStatus values.
 * Kept separate from SyncJobStatus because the two fields have different
 * valid sets ('success' only appears on the schedule, not the job).
 */
export const SyncRunStatus = {
    success: 'success',
    failed: 'failed'
} as const;

export type SyncRunStatusValue = typeof SyncRunStatus[keyof typeof SyncRunStatus];
