import React from 'react';
import {useDashboardControllerGetSummary} from '@/api/dashboard/dashboard.js';
import {SummaryCard} from '@features/dashboard/components/SummaryCard.js';
import {SpendingByCategoryPanel} from '@features/dashboard/components/SpendingByCategoryPanel.js';
import {RecentTransactionsList} from '@features/dashboard/components/RecentTransactionsList.js';
import {AccountsPanel} from '@features/dashboard/components/AccountsPanel.js';
import {DashboardErrorBoundary} from '@features/dashboard/components/DashboardErrorBoundary.js';
import styles from '@features/dashboard/components/DashboardPage.module.css';

const formatCurrency = (value: number): string =>
    new Intl.NumberFormat('en-CA', {style: 'currency', currency: 'CAD'}).format(value);

const formatPercent = (value: number | null): string =>
    value === null ? 'N/A' : `${value.toFixed(1)}%`;

const getCurrentMonth = (): string => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

const DashboardPageInner = (): React.JSX.Element => {
    const {data, isLoading, isError, refetch} = useDashboardControllerGetSummary();
    const currentMonth = getCurrentMonth();

    if (isError) {
        return (
            <main className={styles.page} aria-label="Dashboard">
                <div className={styles.inner}>
                    <div className={styles.errorState} role="alert">
                        <h1 className={styles.errorHeading}>Failed to load dashboard</h1>
                        <p>
                            There was a problem fetching your financial summary.
                            Please try again.
                        </p>
                        <button
                            type="button"
                            className={styles.retryBtn}
                            onClick={(): void => { void refetch(); }}
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    const totalIncome = data?.totalIncome ?? 0;
    const totalExpenses = data?.totalExpenses ?? 0;
    const netBalance = data?.netBalance ?? 0;
    const savingsRate = data?.savingsRate ?? null;
    const accounts = data?.accounts ?? [];
    const recentTransactions = data?.recentTransactions ?? [];

    const incomeTrend: 'up' | 'down' | 'neutral' =
        totalIncome > 0 ? 'up' : totalIncome < 0 ? 'down' : 'neutral';
    const expenseTrend: 'up' | 'down' | 'neutral' =
        totalExpenses > 0 ? 'up' : 'neutral';
    const netTrend: 'up' | 'down' | 'neutral' =
        netBalance > 0 ? 'up' : netBalance < 0 ? 'down' : 'neutral';
    const savingsTrend: 'up' | 'down' | 'neutral' =
        savingsRate !== null && savingsRate > 0 ? 'up' :
            savingsRate !== null && savingsRate < 0 ? 'down' : 'neutral';

    return (
        <main className={styles.page} aria-label="Dashboard">
            <div className={styles.inner}>
                <header className={styles.header}>
                    <h1 className={styles.title}>Dashboard</h1>
                    <p className={styles.subtitle}>
                        {isLoading ? 'Loading…' : `Summary for ${data?.month ?? currentMonth}`}
                    </p>
                </header>

                <section aria-label="Financial summary">
                    <div className={styles.summaryGrid}>
                        <SummaryCard
                            title="Monthly Income"
                            value={isLoading ? '—' : formatCurrency(totalIncome)}
                            trend={isLoading ? undefined : incomeTrend}
                            subtitle="This month"
                        />
                        <SummaryCard
                            title="Monthly Expenses"
                            value={isLoading ? '—' : formatCurrency(totalExpenses)}
                            trend={isLoading ? undefined : expenseTrend}
                            subtitle="This month"
                        />
                        <SummaryCard
                            title="Net Balance"
                            value={isLoading ? '—' : formatCurrency(netBalance)}
                            trend={isLoading ? undefined : netTrend}
                            subtitle="Income minus expenses"
                        />
                        <SummaryCard
                            title="Savings Rate"
                            value={isLoading ? '—' : formatPercent(savingsRate)}
                            trend={isLoading ? undefined : savingsTrend}
                            subtitle="Of monthly income"
                        />
                    </div>
                </section>

                <div className={styles.panelsRow}>
                    <SpendingByCategoryPanel month={currentMonth} />
                    <RecentTransactionsList
                        transactions={recentTransactions}
                        isLoading={isLoading}
                        isError={isError}
                    />
                </div>

                <AccountsPanel accounts={accounts} isLoading={isLoading} />
            </div>
        </main>
    );
};

export const DashboardPage = (): React.JSX.Element => (
    <DashboardErrorBoundary>
        <DashboardPageInner />
    </DashboardErrorBoundary>
);

export default DashboardPage;
