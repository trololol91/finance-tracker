import React from 'react';
import {useDashboardControllerGetSpendingByCategory} from '@/api/dashboard/dashboard.js';
import type {SpendingByCategoryItemDto} from '@/api/model/spendingByCategoryItemDto.js';
import styles from '@features/dashboard/components/SpendingByCategoryPanel.module.css';

const DEFAULT_COLOR = '#64748b';

const resolveColor = (color: unknown): string => {
    if (typeof color === 'string') return color;
    return DEFAULT_COLOR;
};

const formatCurrency = (value: number): string =>
    new Intl.NumberFormat('en-CA', {style: 'currency', currency: 'CAD'}).format(value);

interface SpendingByCategoryPanelProps {
    month?: string;
}

const SkeletonRows = (): React.JSX.Element => (
    <ul className={styles.list} aria-hidden="true">
        {[80, 60, 45, 30].map((w) => (
            <li key={w} className={styles.skeletonItem}>
                <span className={styles.skeletonCircle} />
                <span className={styles.skeletonBar} style={{flex: 1, width: `${w}%`}} />
                <span className={styles.skeletonBar} style={{width: '3.5rem'}} />
            </li>
        ))}
    </ul>
);

const CategoryRow = ({item}: {item: SpendingByCategoryItemDto}): React.JSX.Element => {
    const color = resolveColor(item.color);
    return (
        <li className={styles.item}>
            <span
                className={styles.swatch}
                style={{backgroundColor: color}}
                aria-hidden="true"
            />
            <span className={styles.itemName}>{item.categoryName}</span>
            <div className={styles.itemRight}>
                <span className={styles.itemAmount}>{formatCurrency(item.total)}</span>
                <span className={styles.itemPct}>{item.percentage.toFixed(1)}%</span>
            </div>
        </li>
    );
};

export const SpendingByCategoryPanel = (
    {month}: SpendingByCategoryPanelProps
): React.JSX.Element => {
    const params = month ? {month} : undefined;
    const {data, isLoading, isError} = useDashboardControllerGetSpendingByCategory(params);

    const renderContent = (): React.JSX.Element => {
        if (isLoading) {
            return (
                <div aria-busy="true" aria-live="polite">
                    <SkeletonRows />
                </div>
            );
        }

        if (isError) {
            return (
                <p className={`${styles.centered} ${styles.error}`} role="alert">
                    Failed to load spending data. Please try again.
                </p>
            );
        }

        const items = data?.items ?? [];

        if (items.length === 0) {
            return (
                <p className={styles.centered}>
                    No spending recorded for this month.
                </p>
            );
        }

        return (
            <ul className={styles.list} aria-label="Spending by category">
                {items.map((item) => (
                    <CategoryRow key={item.categoryId ?? 'uncategorised'} item={item} />
                ))}
            </ul>
        );
    };

    return (
        <section className={styles.panel} aria-labelledby="spending-by-category-heading">
            <h2 id="spending-by-category-heading" className={styles.heading}>
                Spending by Category
            </h2>
            {renderContent()}
        </section>
    );
};
