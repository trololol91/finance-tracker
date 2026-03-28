import React from 'react';
import {Link} from 'react-router-dom';
import {APP_ROUTES} from '@config/constants.js';
import {formatCurrency} from '@utils/currency.js';
import type {AccountBalanceSummaryItemDto} from '@/api/model/accountBalanceSummaryItemDto.js';
import styles from '@features/dashboard/components/AccountsPanel.module.css';

interface AccountsPanelProps {
    accounts: AccountBalanceSummaryItemDto[];
    isLoading: boolean;
}

const SkeletonRows = (): React.JSX.Element => (
    <>
        {[1, 2, 3].map((n) => (
            <li key={n} className={styles.skeletonItem} aria-hidden="true">
                <span className={styles.skeletonLine} style={{flex: 1}} />
                <span className={styles.skeletonLine} style={{width: '4.5rem'}} />
            </li>
        ))}
    </>
);

export const AccountsPanel = ({accounts, isLoading}: AccountsPanelProps): React.JSX.Element => {
    const renderContent = (): React.JSX.Element => {
        if (isLoading) {
            return (
                <ul className={styles.list} aria-busy="true" aria-live="polite" aria-label="Loading accounts">
                    <SkeletonRows />
                </ul>
            );
        }

        if (accounts.length === 0) {
            return (
                <p className={styles.centered}>No accounts found.</p>
            );
        }

        return (
            <ul className={styles.list} aria-label="Account balances">
                {accounts.map((account) => (
                    <li key={account.id} className={styles.item}>
                        <span className={styles.accountName}>{account.name}</span>
                        <span className={styles.currency}>{account.currency}</span>
                        <span
                            className={`${styles.balance} ${account.balance < 0 ? styles['balance--negative'] : styles['balance--positive']}`}
                        >
                            {formatCurrency(account.balance, account.currency)}
                        </span>
                    </li>
                ))}
            </ul>
        );
    };

    return (
        <section className={styles.panel} aria-labelledby="accounts-panel-heading">
            <div className={styles.panelHeader}>
                <h2 id="accounts-panel-heading" className={styles.heading}>
                    Accounts
                </h2>
                <Link to={APP_ROUTES.ACCOUNTS} className={styles.viewAllLink}>
                    Manage accounts
                </Link>
            </div>
            {renderContent()}
        </section>
    );
};
