import React, {
    useState, useCallback
} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {Button} from '@components/common/Button/Button.js';
import {Pagination} from '@components/common/Pagination/Pagination.js';
import {TransactionSummary} from '@features/transactions/components/TransactionSummary.js';
import {TransactionFilters} from '@features/transactions/components/TransactionFilters.js';
import {TransactionList} from '@features/transactions/components/TransactionList.js';
import {TransactionModal} from '@features/transactions/components/TransactionModal.js';
import {useTransactionFilters} from '@features/transactions/hooks/useTransactionFilters.js';
import {useTransactionForm} from '@features/transactions/hooks/useTransactionForm.js';
import {
    useTransactionsControllerRemove,
    useTransactionsControllerToggleActive,
    getTransactionsControllerFindAllQueryKey,
    getTransactionsControllerGetTotalsQueryKey
} from '@/api/transactions/transactions.js';
import {useCategoriesControllerFindAll} from '@/api/categories/categories.js';
import type {TransactionResponseDto} from '@/api/model/transactionResponseDto.js';
import '@pages/TransactionsPage.css';

export const TransactionsPage = (): React.JSX.Element => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const {
        filters, apiParams, data, isLoading, isError,
        updateFilter, setDateRange, clearFilters, setPage, queryKey
    } = useTransactionFilters();

    // Fetch categories for form select, list column, and filter dropdown.
    const {data: categoriesData} = useCategoriesControllerFindAll();
    const categories = categoriesData ?? [];

    const handleSuccess = useCallback((): void => {
        setIsModalOpen(false);
    }, []);

    const {
        formValues, errors, editTarget, isSubmitting,
        openCreate, openEdit, handleFieldChange, handleSubmit
    } = useTransactionForm({onSuccess: handleSuccess, queryKey});

    const {mutate: removeTransaction} = useTransactionsControllerRemove();
    const {mutate: toggleActive} = useTransactionsControllerToggleActive();

    const handleAddClick = (): void => {
        openCreate();
        setIsModalOpen(true);
    };

    const handleEdit = useCallback(
        (transaction: TransactionResponseDto): void => {
            openEdit(transaction);
            setIsModalOpen(true);
        },
        [openEdit]
    );

    const handleToggleActive = useCallback(
        (id: string): void => {
            toggleActive(
                {id},
                {
                    onSuccess: (): void => {
                        void queryClient.invalidateQueries({
                            queryKey: getTransactionsControllerFindAllQueryKey(apiParams),
                            exact: false
                        });
                        void queryClient.invalidateQueries({
                            queryKey: getTransactionsControllerGetTotalsQueryKey(),
                            exact: false
                        });
                    }
                }
            );
        },
        [toggleActive, queryClient, apiParams]
    );

    const handleDelete = useCallback(
        (id: string): void => {
            removeTransaction(
                {id},
                {
                    onSuccess: (): void => {
                        void queryClient.invalidateQueries({
                            queryKey: getTransactionsControllerFindAllQueryKey(apiParams),
                            exact: false
                        });
                        void queryClient.invalidateQueries({
                            queryKey: getTransactionsControllerGetTotalsQueryKey(),
                            exact: false
                        });
                    }
                }
            );
        },
        [removeTransaction, queryClient, apiParams]
    );

    const handleCloseModal = (): void => {
        setIsModalOpen(false);
    };

    const transactions = data?.data ?? [];
    const total = data?.total ?? 0;

    return (
        <div className="tx-page">
            <div className="tx-page__inner">
                {/* Header */}
                <div className="tx-page__header">
                    <h1 className="tx-page__title">Transactions</h1>
                    <Button variant="primary" onClick={handleAddClick}>
                        + Add Transaction
                    </Button>
                </div>

                {/* Summary */}
                <TransactionSummary startDate={filters.startDate} endDate={filters.endDate} />

                {/* Filters */}
                <TransactionFilters
                    filters={filters}
                    categories={categories}
                    onFilterChange={updateFilter}
                    onDateRangeChange={setDateRange}
                    onClear={clearFilters}
                />

                {/* List */}
                <TransactionList
                    transactions={transactions}
                    isLoading={isLoading}
                    isError={isError}
                    categories={categories}
                    onEdit={handleEdit}
                    onToggleActive={handleToggleActive}
                    onDelete={handleDelete}
                />

                {/* Pagination */}
                {!isLoading && total > filters.limit && (
                    <Pagination
                        page={filters.page}
                        total={total}
                        limit={filters.limit}
                        onPageChange={setPage}
                    />
                )}
            </div>

            {/* Modal */}
            <TransactionModal
                isOpen={isModalOpen}
                editTarget={editTarget}
                formValues={formValues}
                errors={errors}
                isSubmitting={isSubmitting}
                categories={categories}
                onFieldChange={handleFieldChange}
                onSubmit={handleSubmit}
                onClose={handleCloseModal}
            />
        </div>
    );
};

export default TransactionsPage;
