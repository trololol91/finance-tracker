import React from 'react';
import type {AccountResponseDto} from '@/api/model/accountResponseDto.js';
import styles from '@features/accounts/components/AccountList.module.css';

interface AccountListProps {
    accounts: AccountResponseDto[];
    isLoading: boolean;
    isError: boolean;
    showInactive: boolean;
    onEdit: (account: AccountResponseDto) => void;
    onDelete: (account: AccountResponseDto) => void;
}

const formatCurrency = (value: number, currency: string): string =>
    new Intl.NumberFormat('en-CA', {style: 'currency', currency}).format(value);

const TYPE_LABELS: Record<string, string> = {
    checking: 'Checking',
    savings: 'Savings',
    credit: 'Credit',
    investment: 'Investment',
    loan: 'Loan',
    other: 'Other'
};

export const AccountList = ({
    accounts,
    isLoading,
    isError,
    showInactive,
    onEdit,
    onDelete
}: AccountListProps): React.JSX.Element => {
    if (isLoading) {
        return (
            <div className={styles.centered} aria-live="polite" aria-busy="true">
                <p className={styles.message}>Loading accounts…</p>
            </div>
        );
    }

    if (isError) {
        return (
            <div className={styles.centered} role="alert">
                <p className={`${styles.message} ${styles.messageError}`}>
                    Failed to load accounts. Please try again.
                </p>
            </div>
        );
    }

    const visible = showInactive ? accounts : accounts.filter((a) => a.isActive);

    if (visible.length === 0) {
        return (
            <div className={styles.centered}>
                <p className={styles.message}>
                    {showInactive
                        ? 'No accounts found. Create your first account.'
                        : 'No active accounts. Create one or show inactive.'}
                </p>
            </div>
        );
    }

    return (
        <div className={styles.tableWrapper}>
            <table className={styles.table} aria-label="Accounts">
                <thead>
                    <tr>
                        <th scope="col" className={styles.th}>Name</th>
                        <th scope="col" className={`${styles.th} ${styles.hideOnMobile}`}>Type</th>
                        <th scope="col" className={`${styles.th} ${styles.hideOnMobile}`}>Institution</th>
                        <th scope="col" className={`${styles.th} ${styles.thRight}`}>Balance</th>
                        <th scope="col" className={`${styles.th} ${styles.hideOnTablet} ${styles.thRight}`}>Transactions</th>
                        <th scope="col" className={`${styles.th} ${styles.hideOnMobile}`}>Status</th>
                        <th scope="col" className={`${styles.th} ${styles.thActions}`}>
                            <span className="sr-only">Actions</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {visible.map((account) => (
                        <tr
                            key={account.id}
                            className={`${styles.row} ${!account.isActive ? styles.rowInactive : ''}`}
                        >
                            <td className={styles.td}>
                                <span className={styles.nameCell}>
                                    {account.color !== null && (
                                        <span
                                            className={styles.colorSwatch}
                                            style={{backgroundColor: account.color}}
                                            aria-hidden="true"
                                        />
                                    )}
                                    <span className={styles.accountName}>{account.name}</span>
                                    {account.notes !== null && (
                                        <span className={styles.notesHint} title={account.notes} aria-label={`Notes: ${account.notes}`}>
                                            ℹ
                                        </span>
                                    )}
                                </span>
                            </td>
                            <td className={`${styles.td} ${styles.hideOnMobile}`}>
                                <span className={`${styles.badge} ${styles[`badge--${account.type}`]}`}>
                                    {TYPE_LABELS[account.type] ?? account.type}
                                </span>
                            </td>
                            <td className={`${styles.td} ${styles.hideOnMobile} ${styles.muted}`}>
                                {account.institution ?? '—'}
                            </td>
                            <td className={`${styles.td} ${styles.tdRight}`}>
                                <span
                                    className={
                                        account.currentBalance < 0
                                            ? styles.negative
                                            : styles.positive
                                    }
                                >
                                    {formatCurrency(account.currentBalance, account.currency)}
                                </span>
                                {account.currentBalance !== account.openingBalance && (
                                    <span className={styles.openingBalance}>
                                        opened{' '}
                                        {formatCurrency(
                                            account.openingBalance,
                                            account.currency
                                        )}
                                    </span>
                                )}
                            </td>
                            <td className={`${styles.td} ${styles.tdRight} ${styles.hideOnTablet}`}>
                                {account.transactionCount}
                            </td>
                            <td className={`${styles.td} ${styles.hideOnMobile}`}>
                                {account.isActive
                                    ? <span className={styles.activeTag}>Active</span>
                                    : <span className={styles.inactiveTag}>Inactive</span>}
                            </td>
                            <td className={`${styles.td} ${styles.tdActions}`}>
                                <button
                                    type="button"
                                    className={styles.actionBtn}
                                    aria-label={`Edit ${account.name}`}
                                    onClick={() => { onEdit(account); }}
                                >
                                    Edit
                                </button>
                                <button
                                    type="button"
                                    className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                                    aria-label={account.transactionCount > 0
                                        ? `Deactivate ${account.name}`
                                        : `Delete ${account.name}`}
                                    onClick={() => { onDelete(account); }}
                                >
                                    {account.transactionCount > 0 ? 'Deactivate' : 'Delete'}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
