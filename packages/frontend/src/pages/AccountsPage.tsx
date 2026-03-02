import React, {
    useState, useCallback
} from 'react';
import {useAccountsControllerFindAll} from '@/api/accounts/accounts.js';
import {AccountList} from '@features/accounts/components/AccountList.js';
import {AccountModal} from '@features/accounts/components/AccountModal.js';
import {AccountsSummary} from '@features/accounts/components/AccountsSummary.js';
import {AccountsErrorBoundary} from '@features/accounts/components/AccountsErrorBoundary.js';
import {useAccountForm} from '@features/accounts/hooks/useAccountForm.js';
import type {AccountResponseDto} from '@/api/model/accountResponseDto.js';
import styles from '@pages/AccountsPage.module.css';

const AccountsPageInner = (): React.JSX.Element => {
    const [showInactive, setShowInactive] = useState(false);

    const {data, isLoading, isError} = useAccountsControllerFindAll();
    const accounts: AccountResponseDto[] = data ?? [];

    const {
        formValues,
        errors,
        modalMode,
        isSubmitting,
        openCreate,
        openEdit,
        closeModal,
        handleFieldChange,
        handleSubmit,
        handleDelete
    } = useAccountForm();

    const handleDeleteAccount = useCallback(
        (account: AccountResponseDto): void => {
            if (account.transactionCount > 0) {
                if (window.confirm(
                    `"${account.name}" has ${account.transactionCount} transaction(s). It will be deactivated instead of deleted. Continue?`
                )) {
                    handleDelete(account.id);
                }
            } else if (window.confirm(`Delete account "${account.name}"? This cannot be undone.`)) {
                handleDelete(account.id);
            }
        },
        [handleDelete]
    );

    return (
        <main className={styles.page} aria-label="Accounts">
            <div className={styles.inner}>
                <header className={styles.header}>
                    <h1 className={styles.title}>Accounts</h1>
                    <button
                        type="button"
                        className={styles.newBtn}
                        onClick={openCreate}
                        aria-label="Create new account"
                    >
                        + New Account
                    </button>
                </header>

                {!isLoading && !isError && accounts.length > 0 && (
                    <AccountsSummary accounts={accounts} />
                )}

                <div className={styles.toolbar} aria-label="Account list options">
                    <label className={styles.toggleLabel}>
                        <input
                            type="checkbox"
                            className={styles.toggleCheckbox}
                            checked={showInactive}
                            onChange={(e) => { setShowInactive(e.target.checked); }}
                        />
                        Show inactive
                    </label>
                    <span className={styles.count} aria-live="polite">
                        {accounts.filter((a) => showInactive || a.isActive).length} account(s)
                    </span>
                </div>

                <AccountList
                    accounts={accounts}
                    isLoading={isLoading}
                    isError={isError}
                    showInactive={showInactive}
                    onEdit={openEdit}
                    onDelete={handleDeleteAccount}
                />
            </div>

            <AccountModal
                mode={modalMode}
                values={formValues}
                errors={errors}
                isSubmitting={isSubmitting}
                onClose={closeModal}
                onChange={handleFieldChange}
                onSubmit={handleSubmit}
            />
        </main>
    );
};

export const AccountsPage = (): React.JSX.Element => (
    <AccountsErrorBoundary>
        <AccountsPageInner />
    </AccountsErrorBoundary>
);

export default AccountsPage;
