import React from 'react';
import type {SyncScheduleResponseDto} from '@/api/model/syncScheduleResponseDto.js';
import styles from '@features/scraper/components/SyncScheduleList.module.css';

interface SyncScheduleListProps {
    schedules: SyncScheduleResponseDto[];
    isLoading: boolean;
    isError: boolean;
    triggeringId: string | null;
    onEdit: (schedule: SyncScheduleResponseDto) => void;
    onDelete: (schedule: SyncScheduleResponseDto) => void;
    onTrigger: (schedule: SyncScheduleResponseDto) => void;
}

const formatDate = (dateStr: string | null | undefined): string => {
    if (dateStr === null || dateStr === undefined) return '—';
    try {
        return new Date(dateStr).toLocaleString('en-CA', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    } catch {
        return dateStr;
    }
};

export const SyncScheduleList = ({
    schedules,
    isLoading,
    isError,
    triggeringId,
    onEdit,
    onDelete,
    onTrigger
}: SyncScheduleListProps): React.JSX.Element => {
    if (isLoading) {
        return (
            <div className={styles.centered} aria-live="polite" aria-busy="true">
                <p className={styles.message}>Loading schedules…</p>
            </div>
        );
    }

    if (isError) {
        return (
            <div className={styles.centered} role="alert">
                <p className={`${styles.message} ${styles.messageError}`}>
                    Failed to load sync schedules. Please try again.
                </p>
            </div>
        );
    }

    if (schedules.length === 0) {
        return (
            <div className={styles.centered}>
                <p className={styles.message}>No sync schedules yet. Create one to get started.</p>
            </div>
        );
    }

    return (
        <div className={styles.tableWrapper}>
            <table className={styles.table} aria-label="Sync schedules">
                <thead>
                    <tr>
                        <th scope="col" className={styles.th}>Bank</th>
                        <th scope="col" className={`${styles.th} ${styles.hideOnMobile}`}>Schedule</th>
                        <th scope="col" className={`${styles.th} ${styles.hideOnMobile}`}>Status</th>
                        <th scope="col" className={`${styles.th} ${styles.hideOnTablet}`}>Last Run</th>
                        <th scope="col" className={`${styles.th} ${styles.thActions}`}>
                            <span className="sr-only">Actions</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {schedules.map((schedule) => (
                        <tr key={schedule.id} className={styles.row}>
                            <td className={styles.td}>
                                <span className={styles.bankName}>{schedule.displayName}</span>
                                {!schedule.enabled && (
                                    <span className={styles.disabledBadge}>Disabled</span>
                                )}
                            </td>
                            <td className={`${styles.td} ${styles.hideOnMobile}`}>
                                <code className={styles.cron}>{schedule.cron}</code>
                            </td>
                            <td className={`${styles.td} ${styles.hideOnMobile}`}>
                                <span className={`${styles.statusBadge} ${schedule.lastRunStatus !== null && schedule.lastRunStatus !== undefined ? styles[schedule.lastRunStatus] : ''}`}>
                                    {schedule.lastRunStatus ?? '—'}
                                </span>
                            </td>
                            <td className={`${styles.td} ${styles.hideOnTablet}`}>
                                {formatDate(schedule.lastRunAt)}
                            </td>
                            <td className={`${styles.td} ${styles.tdActions}`}>
                                <button
                                    type="button"
                                    className={styles.triggerBtn}
                                    disabled={triggeringId === schedule.id}
                                    aria-label={`Trigger sync for ${schedule.displayName}`}
                                    onClick={() => { onTrigger(schedule); }}
                                >
                                    {triggeringId === schedule.id ? '…' : '▶ Run'}
                                </button>
                                <button
                                    type="button"
                                    className={styles.editBtn}
                                    aria-label={`Edit ${schedule.displayName} schedule`}
                                    onClick={() => { onEdit(schedule); }}
                                >
                                    Edit
                                </button>
                                <button
                                    type="button"
                                    className={styles.deleteBtn}
                                    aria-label={`Delete ${schedule.displayName} schedule`}
                                    onClick={() => { onDelete(schedule); }}
                                >
                                    Delete
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
