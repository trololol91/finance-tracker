import React from 'react';
import {TransactionListItem} from '@features/transactions/components/TransactionListItem.js';
import {Loading} from '@components/common/Loading/Loading.js';
import type {TransactionResponseDto} from '@/api/model/transactionResponseDto.js';
import '@features/transactions/components/TransactionList.css';

interface TransactionListProps {
    transactions: TransactionResponseDto[];
    isLoading: boolean;
    isError: boolean;
    onEdit: (transaction: TransactionResponseDto) => void;
    onToggleActive: (id: string) => void;
    onDelete: (id: string) => void;
}

export const TransactionList = ({
    transactions,
    isLoading,
    isError,
    onEdit,
    onToggleActive,
    onDelete
}: TransactionListProps): React.JSX.Element => {
    if (isLoading) {
        return (
            <div className="tx-list tx-list--centered">
                <Loading text="Loading transactions..." />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="tx-list tx-list--centered" role="alert">
                <p className="tx-list__error">Failed to load transactions. Please try again.</p>
            </div>
        );
    }

    if (transactions.length === 0) {
        return (
            <div className="tx-list tx-list--centered">
                <p className="tx-list__empty">No transactions found for the selected filters.</p>
            </div>
        );
    }

    return (
        <div className="tx-list">
            <div className="tx-list__scroll">
                <table className="tx-list__table" aria-label="Transactions">
                    <thead>
                        <tr>
                            <th scope="col" className="tx-list__th">Date</th>
                            <th scope="col" className="tx-list__th">Description</th>
                            <th scope="col" className="tx-list__th tx-list__th--right">Amount</th>
                            <th scope="col" className="tx-list__th">Type</th>
                            <th scope="col" className="tx-list__th">Status</th>
                            <th scope="col" className="tx-list__th tx-list__th--right">
                                <span className="sr-only">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map((tx) => (
                            <TransactionListItem
                                key={tx.id}
                                transaction={tx}
                                onEdit={onEdit}
                                onToggleActive={onToggleActive}
                                onDelete={onDelete}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
