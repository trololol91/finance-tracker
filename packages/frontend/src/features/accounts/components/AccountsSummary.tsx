import React from 'react';
import type {AccountResponseDto} from '@/api/model/accountResponseDto.js';
import styles from '@features/accounts/components/AccountsSummary.module.css';

interface AccountsSummaryProps {
    accounts: AccountResponseDto[];
}

const formatCurrency = (value: number): string =>
    new Intl.NumberFormat('en-CA', {style: 'currency', currency: 'CAD'}).format(value);

export const AccountsSummary = ({accounts}: AccountsSummaryProps): React.JSX.Element => {
    const active = accounts.filter((a) => a.isActive);
    const totalBalance = active.reduce((sum, a) => sum + a.currentBalance, 0);
    const totalTransactions = active.reduce((sum, a) => sum + a.transactionCount, 0);

    return (
        <div className={styles.bar} aria-label="Account totals">
            <div className={styles.stat}>
                <span className={styles.label}>Accounts</span>
                <span className={styles.value}>{active.length}</span>
            </div>
            <div className={styles.stat}>
                <span className={styles.label}>Net Balance</span>
                <span className={`${styles.value} ${totalBalance < 0 ? styles.negative : styles.positive}`}>
                    {formatCurrency(totalBalance)}
                </span>
            </div>
            <div className={styles.stat}>
                <span className={styles.label}>Total Transactions</span>
                <span className={styles.value}>{totalTransactions}</span>
            </div>
        </div>
    );
};
