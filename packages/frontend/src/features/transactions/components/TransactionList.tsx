import React from 'react';
import {TransactionListItem} from '@features/transactions/components/TransactionListItem.js';
import {Loading} from '@components/common/Loading/Loading.js';
import type {CategoryResponseDto} from '@/api/model/categoryResponseDto.js';
import type {AccountResponseDto} from '@/api/model/accountResponseDto.js';
import type {TransactionResponseDto} from '@/api/model/transactionResponseDto.js';
import {TransactionsControllerFindAllSortField} from '@/api/model/transactionsControllerFindAllSortField.js';
import {TransactionsControllerFindAllSortDirection} from '@/api/model/transactionsControllerFindAllSortDirection.js';
import '@features/transactions/components/TransactionList.css';

type SortField = TransactionsControllerFindAllSortField;
type SortDirection = TransactionsControllerFindAllSortDirection;

interface TransactionListProps {
    transactions: TransactionResponseDto[];
    isLoading: boolean;
    isError: boolean;
    categories?: CategoryResponseDto[];
    accounts?: AccountResponseDto[];
    onEdit: (transaction: TransactionResponseDto) => void;
    onToggleActive: (id: string) => void;
    onDelete: (id: string) => void;
    sortField: SortField;
    sortDirection: SortDirection;
    onSort: (field: SortField, direction: SortDirection) => void;
}

const SORT_FIELDS: {label: string, field: SortField}[] = [
    {label: 'Date', field: TransactionsControllerFindAllSortField.date},
    {label: 'Amount', field: TransactionsControllerFindAllSortField.amount},
    {label: 'Description', field: TransactionsControllerFindAllSortField.description}
];

interface SortButtonProps {
    field: SortField;
    label: string;
    currentField: SortField;
    currentDirection: SortDirection;
    onSort: (field: SortField, direction: SortDirection) => void;
    className?: string;
}

const SortButton = (
    {field, label, currentField, currentDirection, onSort, className}: SortButtonProps
): React.JSX.Element => {
    const isActive = currentField === field;
    const asc = TransactionsControllerFindAllSortDirection.asc;
    const desc = TransactionsControllerFindAllSortDirection.desc;
    const nextDirection = isActive && currentDirection === desc ? asc : desc;

    const ariaSort = isActive
        ? (currentDirection === asc ? 'ascending' : 'descending')
        : undefined;

    return (
        <th
            scope="col"
            className={`tx-list__th tx-list__th--sortable${className ? ` ${className}` : ''}`}
            aria-sort={ariaSort}
        >
            <button
                className={`tx-list__sort-btn${isActive ? ' tx-list__sort-btn--active' : ''}`}
                onClick={() => { onSort(field, nextDirection); }}
                aria-label={`Sort by ${label}${isActive ? `, currently ${currentDirection}ending` : ''}`}
            >
                {label}
                <span className="tx-list__sort-icon" aria-hidden="true">
                    {isActive ? (currentDirection === asc ? '↑' : '↓') : '↕'}
                </span>
            </button>
        </th>
    );
};

export const TransactionList = ({
    transactions,
    isLoading,
    isError,
    categories = [],
    accounts = [],
    onEdit,
    onToggleActive,
    onDelete,
    sortField,
    sortDirection,
    onSort
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
            {/* Mobile-only sort bar (thead is hidden on mobile) */}
            <div className="tx-list__mobile-sort" aria-label="Sort options">
                <label className="tx-list__mobile-sort-label" htmlFor="mobile-sort-field">Sort by</label>
                <select
                    id="mobile-sort-field"
                    className="tx-list__mobile-sort-select"
                    value={sortField}
                    onChange={(e) => { onSort(e.target.value as SortField, sortDirection); }}
                >
                    {SORT_FIELDS.map(({label, field}) => (
                        <option key={field} value={field}>{label}</option>
                    ))}
                </select>
                <select
                    aria-label="Sort direction"
                    className="tx-list__mobile-sort-select"
                    value={sortDirection}
                    onChange={(e) => { onSort(sortField, e.target.value as SortDirection); }}
                >
                    <option value={TransactionsControllerFindAllSortDirection.desc}>Desc</option>
                    <option value={TransactionsControllerFindAllSortDirection.asc}>Asc</option>
                </select>
            </div>

            <div className="tx-list__scroll">
                <table className="tx-list__table" aria-label="Transactions">
                    <thead>
                        <tr>
                            <SortButton
                                field={TransactionsControllerFindAllSortField.date}
                                label="Date"
                                currentField={sortField}
                                currentDirection={sortDirection}
                                onSort={onSort}
                            />
                            <SortButton
                                field={TransactionsControllerFindAllSortField.description}
                                label="Description"
                                currentField={sortField}
                                currentDirection={sortDirection}
                                onSort={onSort}
                            />
                            <SortButton
                                field={TransactionsControllerFindAllSortField.amount}
                                label="Amount"
                                currentField={sortField}
                                currentDirection={sortDirection}
                                onSort={onSort}
                                className="tx-list__th--right"
                            />
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
