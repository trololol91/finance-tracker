import React from 'react';
import {ImportJobStatusBadge} from '@features/scraper/components/ImportJobStatusBadge.js';
import type {ImportJobResponseDto} from '@/api/model/importJobResponseDto.js';
import styles from '@features/scraper/components/ImportJobList.module.css';

interface ImportJobListProps {
    jobs: ImportJobResponseDto[];
    isLoading: boolean;
    isError: boolean;
}

const formatDate = (dateStr: string): string => {
    try {
        return new Date(dateStr).toLocaleString('en-CA', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    } catch {
        return dateStr;
    }
};

export const ImportJobList = ({
    jobs,
    isLoading,
    isError
}: ImportJobListProps): React.JSX.Element => {
    if (isLoading) {
        return (
            <div className={styles.centered} aria-live="polite" aria-busy="true">
                <p className={styles.message}>Loading import history…</p>
            </div>
        );
    }

    if (isError) {
        return (
            <div className={styles.centered} role="alert">
                <p className={`${styles.message} ${styles.messageError}`}>
                    Failed to load import history. Please try again.
                </p>
            </div>
        );
    }

    if (jobs.length === 0) {
        return (
            <div className={styles.centered}>
                <p className={styles.message}>No imports yet. Upload a CSV file above.</p>
            </div>
        );
    }

    return (
        <div className={styles.tableWrapper}>
            <table className={styles.table} aria-label="Import history">
                <thead>
                    <tr>
                        <th scope="col" className={styles.th}>File</th>
                        <th scope="col" className={`${styles.th} ${styles.hideOnMobile}`}>Type</th>
                        <th scope="col" className={styles.th}>Status</th>
                        <th scope="col" className={`${styles.th} ${styles.thRight} ${styles.hideOnMobile}`}>Rows</th>
                        <th scope="col" className={`${styles.th} ${styles.thRight} ${styles.hideOnMobile}`}>Imported</th>
                        <th scope="col" className={`${styles.th} ${styles.thRight} ${styles.hideOnMobile}`}>Skipped</th>
                        <th scope="col" className={`${styles.th} ${styles.hideOnTablet}`}>Date</th>
                    </tr>
                </thead>
                <tbody>
                    {jobs.map((job) => (
                        <tr key={job.id} className={styles.row}>
                            <td className={styles.td}>
                                <span className={styles.filename}>{job.filename}</span>
                                {job.errorMessage !== null && (
                                    <span className={styles.errorMsg}>{job.errorMessage}</span>
                                )}
                            </td>
                            <td className={`${styles.td} ${styles.hideOnMobile}`}>
                                {job.fileType.toUpperCase()}
                            </td>
                            <td className={styles.td}>
                                <ImportJobStatusBadge status={job.status} />
                            </td>
                            <td className={`${styles.td} ${styles.thRight} ${styles.hideOnMobile}`}>
                                {job.rowCount}
                            </td>
                            <td className={`${styles.td} ${styles.thRight} ${styles.hideOnMobile}`}>
                                {job.importedCount}
                            </td>
                            <td className={`${styles.td} ${styles.thRight} ${styles.hideOnMobile}`}>
                                {job.skippedCount}
                            </td>
                            <td className={`${styles.td} ${styles.hideOnTablet}`}>
                                {formatDate(job.createdAt)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
