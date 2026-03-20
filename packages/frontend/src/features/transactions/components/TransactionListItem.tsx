import React from 'react';
import {TransactionActions} from '@features/transactions/components/TransactionActions.js';
import type {CategoryResponseDto} from '@/api/model/categoryResponseDto.js';
import type {AccountResponseDto} from '@/api/model/accountResponseDto.js';
import type {TransactionResponseDto} from '@/api/model/transactionResponseDto.js';
import '@features/transactions/components/TransactionListItem.css';

interface TransactionListItemProps {
    transaction: TransactionResponseDto;
    categories?: CategoryResponseDto[];
    accounts?: AccountResponseDto[];
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
    categories = [],
    accounts = [],
    onEdit,
    onToggleActive,
    onDelete,
    isMutating = false
}: TransactionListItemProps): React.JSX.Element => {
    const amountClass = `tx-item__amount tx-item__amount--${transaction.transactionType}`;
    const category = categories.find((c) => c.id === transaction.categoryId) ?? null;
    const account = accounts.find((a) => a.id === transaction.accountId) ?? null;

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
            <td className="tx-item__type tx-item__hide-mobile">
                <span className={`tx-item__badge tx-item__badge--${transaction.transactionType}`}>
                    {transaction.transactionType}
                </span>
            </td>
            <td className="tx-item__category tx-item__hide-mobile">
                {category !== null ? (
                    <span className="tx-item__category-label">
                        {category.color !== null && (
                            <span
                                className="tx-item__category-swatch"
                                style={{backgroundColor: category.color}}
                                aria-hidden="true"
                            />
                        )}
                        {category.icon ? `${category.icon} ` : ''}{category.name}
                    </span>
                ) : (
                    <span className="tx-item__category-none">—</span>
                )}
            </td>
            <td className="tx-item__account tx-item__hide-mobile">
                {account !== null ? (
                    <span className="tx-item__account-label">{account.name}</span>
                ) : (
                    <span className="tx-item__account-none">—</span>
                )}
            </td>
            <td className="tx-item__status tx-item__hide-mobile">
                {transaction.isPending && (
                    <span className="tx-item__pending-badge">Pending</span>
                )}
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
