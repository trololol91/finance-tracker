import React from 'react';
import type {ImportJobResponseDtoStatus} from '@/api/model/importJobResponseDtoStatus.js';
import styles from '@features/scraper/components/ImportJobStatusBadge.module.css';

interface ImportJobStatusBadgeProps {
    status: ImportJobResponseDtoStatus;
}

const STATUS_LABEL: Record<ImportJobResponseDtoStatus, string> = {
    pending: 'Pending',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed'
};

export const ImportJobStatusBadge = ({status}: ImportJobStatusBadgeProps): React.JSX.Element => (
    <span className={`${styles.badge} ${styles[status]}`}>
        {STATUS_LABEL[status]}
    </span>
);
