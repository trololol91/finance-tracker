import React from 'react';
import {Button} from '@components/common/Button/Button.js';
import {Input} from '@components/common/Input/Input.js';
import {DateRangePicker} from '@components/common/DateRangePicker/DateRangePicker.js';
import {MultiSelectDropdown} from '@components/common/MultiSelectDropdown/MultiSelectDropdown.js';
import {TransactionsControllerFindAllIsActive} from '@/api/model/transactionsControllerFindAllIsActive.js';
import type {CategoryResponseDto} from '@/api/model/categoryResponseDto.js';
import type {AccountResponseDto} from '@/api/model/accountResponseDto.js';
import type {
    TransactionFilterState, ScalarFilterKey, MultiFilterKey
} from '@features/transactions/types/transaction.types.js';
import '@features/transactions/components/TransactionFilters.css';

interface TransactionFiltersProps {
    filters: TransactionFilterState;
    categories?: CategoryResponseDto[];
    accounts?: AccountResponseDto[];
    onFilterChange: (key: ScalarFilterKey, value: string | number) => void;
    onMultiFilterChange: (key: MultiFilterKey, values: string[]) => void;
    onDateRangeChange: (startDate: string, endDate: string) => void;
    onClear: () => void;
}

const TYPE_OPTIONS = [
    {value: 'income', label: 'Income'},
    {value: 'expense', label: 'Expense'},
    {value: 'transfer', label: 'Transfer'}
];

export const TransactionFilters = ({
    filters,
    categories = [],
    accounts = [],
    onFilterChange,
    onMultiFilterChange,
    onDateRangeChange,
    onClear
}: TransactionFiltersProps): React.JSX.Element => {
    const handleDateRange = (range: {startDate: string, endDate: string}): void => {
        onDateRangeChange(range.startDate, range.endDate);
    };

    const activeCategories = categories.filter((c) => c.isActive);
    const activeAccounts = accounts.filter((a) => a.isActive);

    const categoryOptions = activeCategories.map((c) => ({
        value: c.id,
        label: `${c.icon ? `${c.icon} ` : ''}${c.name}`
    }));

    const accountOptions = activeAccounts.map((a) => ({
        value: a.id,
        label: a.name
    }));

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
                    <MultiSelectDropdown
                        id="tx-filter-type"
                        options={TYPE_OPTIONS}
                        value={filters.transactionType}
                        onChange={(values) => { onMultiFilterChange('transactionType', values); }}
                        placeholder="Types"
                    />
                </div>

                <div className="tx-filters__group">
                    <label htmlFor="tx-filter-category" className="tx-filters__label">Category</label>
                    <MultiSelectDropdown
                        id="tx-filter-category"
                        options={categoryOptions}
                        value={filters.categoryId}
                        onChange={(values) => { onMultiFilterChange('categoryId', values); }}
                        placeholder="Categories"
                    />
                </div>

                <div className="tx-filters__group">
                    <label htmlFor="tx-filter-account" className="tx-filters__label">Account</label>
                    <MultiSelectDropdown
                        id="tx-filter-account"
                        options={accountOptions}
                        value={filters.accountId}
                        onChange={(values) => { onMultiFilterChange('accountId', values); }}
                        placeholder="Accounts"
                    />
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
