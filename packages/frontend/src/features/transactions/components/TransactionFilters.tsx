import React from 'react';
import {Button} from '@components/common/Button/Button.js';
import {Input} from '@components/common/Input/Input.js';
import {DateRangePicker} from '@components/common/DateRangePicker/DateRangePicker.js';
import {TransactionsControllerFindAllIsActive} from '@/api/model/transactionsControllerFindAllIsActive.js';
import {TransactionsControllerFindAllTransactionType} from '@/api/model/transactionsControllerFindAllTransactionType.js';
import type {CategoryResponseDto} from '@/api/model/categoryResponseDto.js';
import type {AccountResponseDto} from '@/api/model/accountResponseDto.js';
import type {TransactionFilterState} from '@features/transactions/types/transaction.types.js';
import '@features/transactions/components/TransactionFilters.css';

interface TransactionFiltersProps {
    filters: TransactionFilterState;
    categories?: CategoryResponseDto[];
    accounts?: AccountResponseDto[];
    onFilterChange: (key: keyof TransactionFilterState, value: string | number) => void;
    onDateRangeChange: (startDate: string, endDate: string) => void;
    onClear: () => void;
}

export const TransactionFilters = ({
    filters,
    categories = [],
    accounts = [],
    onFilterChange,
    onDateRangeChange,
    onClear
}: TransactionFiltersProps): React.JSX.Element => {
    const handleDateRange = (range: {startDate: string, endDate: string}): void => {
        onDateRangeChange(range.startDate, range.endDate);
    };

    const activeCategories = categories.filter((c) => c.isActive);
    const activeAccounts = accounts.filter((a) => a.isActive);

    return (
        <div className="tx-filters" role="search" aria-label="Transaction filters">
            <div className="tx-filters__row">
                <div className="tx-filters__group">
                    <label className="tx-filters__label">Date Range</label>
                    <DateRangePicker
                        startDate={filters.startDate}
                        endDate={filters.endDate}
                        onChange={handleDateRange}
                    />
                </div>

                <div className="tx-filters__group">
                    <label htmlFor="tx-filter-type" className="tx-filters__label">Type</label>
                    <select
                        id="tx-filter-type"
                        className="tx-filters__select"
                        value={filters.transactionType}
                        onChange={(e) => { onFilterChange('transactionType', e.target.value); }}
                    >
                        <option value="">All Types</option>
                        <option value={TransactionsControllerFindAllTransactionType.income}>
                            Income
                        </option>
                        <option value={TransactionsControllerFindAllTransactionType.expense}>
                            Expense
                        </option>
                        <option value={TransactionsControllerFindAllTransactionType.transfer}>
                            Transfer
                        </option>
                    </select>
                </div>

                <div className="tx-filters__group">
                    <label htmlFor="tx-filter-category" className="tx-filters__label">Category</label>
                    <select
                        id="tx-filter-category"
                        className="tx-filters__select"
                        value={filters.categoryId}
                        onChange={(e) => { onFilterChange('categoryId', e.target.value); }}
                    >
                        <option value="">All Categories</option>
                        {activeCategories.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.icon ? `${c.icon} ` : ''}{c.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="tx-filters__group">
                    <label htmlFor="tx-filter-account" className="tx-filters__label">Account</label>
                    <select
                        id="tx-filter-account"
                        className="tx-filters__select"
                        value={filters.accountId}
                        onChange={(e) => { onFilterChange('accountId', e.target.value); }}
                    >
                        <option value="">All Accounts</option>
                        {activeAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="tx-filters__group">
                    <label htmlFor="tx-filter-status" className="tx-filters__label">Status</label>
                    <select
                        id="tx-filter-status"
                        className="tx-filters__select"
                        value={filters.isActive}
                        onChange={(e) => { onFilterChange('isActive', e.target.value); }}
                    >
                        <option value={TransactionsControllerFindAllIsActive.true}>
                            Active
                        </option>
                        <option value={TransactionsControllerFindAllIsActive.false}>
                            Inactive
                        </option>
                        <option value={TransactionsControllerFindAllIsActive.all}>All</option>
                    </select>
                </div>

                <div className="tx-filters__group tx-filters__group--search">
                    <Input
                        label="Search"
                        type="search"
                        placeholder="Search transactions..."
                        value={filters.search}
                        onChange={(e) => { onFilterChange('search', e.target.value); }}
                        aria-label="Search transactions by description"
                    />
                </div>

                <div className="tx-filters__actions">
                    <Button variant="secondary" size="small" type="button" onClick={onClear}>
                        Clear
                    </Button>
                </div>
            </div>
        </div>
    );
};
