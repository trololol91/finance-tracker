import React from 'react';
import {TransactionListItem} from '@features/transactions/components/TransactionListItem.js';
import {Loading} from '@components/common/Loading/Loading.js';
import type {CategoryResponseDto} from '@/api/model/categoryResponseDto.js';
import type {AccountResponseDto} from '@/api/model/accountResponseDto.js';
import type {TransactionResponseDto} from '@/api/model/transactionResponseDto.js';
import '@features/transactions/components/TransactionList.css';

interface TransactionListProps {
    transactions: TransactionResponseDto[];
    isLoading: boolean;
    isError: boolean;
    categories?: CategoryResponseDto[];
    accounts?: AccountResponseDto[];
    onEdit: (transaction: TransactionResponseDto) => void;
    onToggleActive: (id: string) => void;
    onDelete: (id: string) => void;
}

export const TransactionList = ({
    transactions,
    isLoading,
    isError,
    categories = [],
    accounts = [],
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
                            <th scope="col" className="tx-list__th tx-list__th--hide-mobile">Type</th>
                            <th scope="col" className="tx-list__th tx-list__th--hide-mobile">Category</th>
                            <th scope="col" className="tx-list__th tx-list__th--hide-mobile">Account</th>
                            <th scope="col" className="tx-list__th tx-list__th--hide-mobile">Status</th>
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
                                categories={categories}
                                accounts={accounts}
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
