import React from 'react';
import {TransactionActions} from '@features/transactions/components/TransactionActions.js';
import type {TransactionResponseDto} from '@/api/model/transactionResponseDto.js';
import '@features/transactions/components/TransactionListItem.css';

interface TransactionListItemProps {
    transaction: TransactionResponseDto;
    onEdit: (transaction: TransactionResponseDto) => void;
    onToggleActive: (id: string) => void;
    onDelete: (id: string) => void;
    isMutating?: boolean;
}

const formatDate = (iso: string): string =>
    new Date(iso).toLocaleDateString('en-CA', {month: 'short', day: 'numeric', year: 'numeric'});

const formatAmount = (amount: number, type: string): string => {
    const formatted = new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: 'CAD'
    }).format(Math.abs(amount));
    return type === 'income' ? `+${formatted}` : type === 'expense' ? `-${formatted}` : formatted;
};

export const TransactionListItem = ({
    transaction,
    onEdit,
    onToggleActive,
    onDelete,
    isMutating = false
}: TransactionListItemProps): React.JSX.Element => {
    const amountClass = `tx-item__amount tx-item__amount--${transaction.transactionType}`;

    return (
        <tr
            className={`tx-item ${!transaction.isActive ? 'tx-item--inactive' : ''}`}
            aria-label={`${transaction.description}, ${formatAmount(transaction.amount, transaction.transactionType)}`}
        >
            <td className="tx-item__date">{formatDate(transaction.date)}</td>
            <td className="tx-item__description">
                <span className="tx-item__desc-text">{transaction.description}</span>
                {transaction.notes && (
                    <span className="tx-item__notes" title={transaction.notes}>
                        {transaction.notes}
                    </span>
                )}
            </td>
            <td className={amountClass}>
                {formatAmount(transaction.amount, transaction.transactionType)}
            </td>
            <td className="tx-item__type">
                <span className={`tx-item__badge tx-item__badge--${transaction.transactionType}`}>
                    {transaction.transactionType}
                </span>
            </td>
            <td className="tx-item__status">
                {!transaction.isActive && (
                    <span className="tx-item__inactive-badge">Inactive</span>
                )}
            </td>
            <td className="tx-item__actions">
                <TransactionActions
                    transaction={transaction}
                    onEdit={onEdit}
                    onToggleActive={onToggleActive}
                    onDelete={onDelete}
                    isLoading={isMutating}
                />
            </td>
        </tr>
    );
};
