import React from 'react';
import styles from '@features/dashboard/components/SummaryCard.module.css';

interface SummaryCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    trend?: 'up' | 'down' | 'neutral';
}

const TREND_ICON: Record<NonNullable<SummaryCardProps['trend']>, string> = {
    up: '↑',
    down: '↓',
    neutral: '→'
};

export const SummaryCard = ({
    title,
    value,
    subtitle,
    trend
}: SummaryCardProps): React.JSX.Element => {
    return (
        <div className={styles.card}>
            <p className={styles.title}>{title}</p>
            <p className={styles.value}>{value}</p>
            {(trend ?? subtitle) && (
                <div className={styles.trendRow}>
                    {trend && (
                        <span
                            className={`${styles.trendIndicator} ${styles[`trendIndicator--${trend}`]}`}
                            aria-label={`Trend: ${trend}`}
                        >
                            {TREND_ICON[trend]}
                        </span>
                    )}
                    {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
                </div>
            )}
        </div>
    );
};
