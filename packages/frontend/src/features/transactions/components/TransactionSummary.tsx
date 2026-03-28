import React from 'react';
import {useTransactionsControllerGetTotals} from '@/api/transactions/transactions.js';
import {Loading} from '@components/common/Loading/Loading.js';
import {formatCurrency} from '@utils/currency.js';
import type {TransactionsControllerGetTotalsTransactionTypeItem} from '@features/transactions/types/transaction.types.js';
import '@features/transactions/components/TransactionSummary.css';

interface TransactionSummaryProps {
    startDate: string;
    endDate: string;
    accountId?: string[];
    categoryId?: string[];
    transactionType?: TransactionsControllerGetTotalsTransactionTypeItem[];
    search?: string;
}

export const TransactionSummary = (
    {startDate, endDate, accountId, categoryId, transactionType, search}: TransactionSummaryProps
): React.JSX.Element => {
    const {data: totals, isLoading, isError} = useTransactionsControllerGetTotals(
        {startDate, endDate, accountId, categoryId, transactionType, search},
        {query: {enabled: startDate !== '' && endDate !== ''}}
    );

    if (isLoading) {
        return (
            <div className="tx-summary tx-summary--loading">
                <Loading size="small" text="Loading totals..." />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="tx-summary tx-summary--error" role="alert">
                <p className="tx-summary__error-text">Could not load totals. Please try again.</p>
            </div>
        );
    }

    const income = totals?.totalIncome ?? 0;
    const expense = totals?.totalExpense ?? 0;
    const net = totals?.netTotal ?? 0;

    return (
        <div className="tx-summary" role="region" aria-label="Transaction totals">
            <div className="tx-summary__item">
                <span className="tx-summary__label">Income</span>
                <span className="tx-summary__value tx-summary__value--income">
                    {formatCurrency(income)}
                </span>
            </div>
            <div className="tx-summary__divider" aria-hidden="true" />
            <div className="tx-summary__item">
                <span className="tx-summary__label">Expenses</span>
                <span className="tx-summary__value tx-summary__value--expense">
                    {formatCurrency(expense)}
                </span>
            </div>
            <div className="tx-summary__divider" aria-hidden="true" />
            <div className="tx-summary__item">
                <span className="tx-summary__label">Net</span>
                <span className={`tx-summary__value ${net >= 0 ? 'tx-summary__value--income' : 'tx-summary__value--expense'}`}>
                    {formatCurrency(net)}
                </span>
            </div>
        </div>
    );
};
