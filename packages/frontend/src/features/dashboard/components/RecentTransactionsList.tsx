import React from 'react';
import {Link} from 'react-router-dom';
import {APP_ROUTES} from '@config/constants.js';
import type {TransactionSummaryItemDto} from '@/api/model/transactionSummaryItemDto.js';
import styles from '@features/dashboard/components/RecentTransactionsList.module.css';

const formatDate = (iso: string): string =>
    new Date(iso).toLocaleDateString('en-CA', {month: 'short', day: 'numeric'});

const formatAmount = (amount: number, type: string): string => {
    const formatted = new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: 'CAD'
    }).format(Math.abs(amount));
    if (type === 'income') return `+${formatted}`;
    if (type === 'expense') return `-${formatted}`;
    return formatted;
};

const TYPE_INITIAL: Record<string, string> = {
    income: 'I',
    expense: 'E',
    transfer: 'T'
};

interface RecentTransactionsListProps {
    transactions: TransactionSummaryItemDto[];
    isLoading: boolean;
    isError: boolean;
}

const SkeletonRows = (): React.JSX.Element => (
    <>
        {[1, 2, 3, 4, 5].map((n) => (
            <li key={n} className={styles.skeletonItem} aria-hidden="true">
                <span className={styles.skeletonCircle} />
                <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '0.375rem'}}>
                    <span className={styles.skeletonLine} style={{width: '60%'}} />
                    <span className={styles.skeletonLine} style={{width: '35%'}} />
                </div>
                <span className={styles.skeletonLine} style={{width: '4rem'}} />
            </li>
        ))}
    </>
);

export const RecentTransactionsList = ({
    transactions,
    isLoading,
    isError
}: RecentTransactionsListProps): React.JSX.Element => {
    const renderContent = (): React.JSX.Element => {
        if (isLoading) {
            return (
                <ul className={styles.list} aria-busy="true" aria-live="polite" aria-label="Loading recent transactions">
                    <SkeletonRows />
                </ul>
            );
        }

        if (isError) {
            return (
                <p className={`${styles.centered} ${styles.error}`} role="alert">
                    Failed to load recent transactions.
                </p>
            );
        }

        if (transactions.length === 0) {
            return (
                <p className={styles.centered}>No recent transactions to display.</p>
            );
        }

        return (
            <ul className={styles.list} aria-label="Recent transactions">
                {transactions.map((tx) => (
                    <li key={tx.id} className={styles.item}>
                        <span
                            className={`${styles.typeBadge} ${styles[`typeBadge--${tx.transactionType}`]}`}
                            aria-hidden="true"
                        >
                            {TYPE_INITIAL[tx.transactionType]
                                ?? tx.transactionType[0].toUpperCase()}
                        </span>
                        <div className={styles.itemBody}>
                            <p className={styles.description}>{tx.description}</p>
                            <div className={styles.meta}>
                                <span>{formatDate(tx.date)}</span>
                                {tx.categoryName !== null && (
                                    <>
                                        <span aria-hidden="true">·</span>
                                        <span>{tx.categoryName}</span>
                                    </>
                                )}
                                {tx.accountName !== null && (
                                    <>
                                        <span aria-hidden="true">·</span>
                                        <span>{tx.accountName}</span>
                                    </>
                                )}
                            </div>
                        </div>
                        <span
                            className={`${styles.amount} ${styles[`amount--${tx.transactionType}`]}`}
                            aria-label={`${tx.transactionType}: ${formatAmount(tx.amount, tx.transactionType)}`}
                        >
                            {formatAmount(tx.amount, tx.transactionType)}
                        </span>
                    </li>
                ))}
            </ul>
        );
    };

    return (
        <section className={styles.panel} aria-labelledby="recent-transactions-heading">
            <div className={styles.panelHeader}>
                <h2 id="recent-transactions-heading" className={styles.heading}>
                    Recent Transactions
                </h2>
                <Link to={APP_ROUTES.TRANSACTIONS} className={styles.viewAllLink}>
                    View all
                </Link>
            </div>
            {renderContent()}
        </section>
    );
};
