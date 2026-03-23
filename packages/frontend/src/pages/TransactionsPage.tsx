import React, {
    useState, useCallback
} from 'react';
import {
    useQueryClient, useMutation
} from '@tanstack/react-query';
import {
    Plus, Wand2
} from 'lucide-react';
import {Button} from '@components/common/Button/Button.js';
import {Pagination} from '@components/common/Pagination/Pagination.js';
import {TransactionSummary} from '@features/transactions/components/TransactionSummary.js';
import {TransactionFilters} from '@features/transactions/components/TransactionFilters.js';
import {TransactionList} from '@features/transactions/components/TransactionList.js';
import {TransactionModal} from '@features/transactions/components/TransactionModal.js';
import {useTransactionFilters} from '@features/transactions/hooks/useTransactionFilters.js';
import {useTransactionForm} from '@features/transactions/hooks/useTransactionForm.js';
import {useAiStatus} from '@features/transactions/hooks/useAiStatus.js';
import {
    useTransactionsControllerRemove,
    useTransactionsControllerToggleActive,
    getTransactionsControllerFindAllQueryKey,
    getTransactionsControllerGetTotalsQueryKey
} from '@/api/transactions/transactions.js';
import {customInstance} from '@services/api/mutator.js';
import {useCategoriesControllerFindAll} from '@/api/categories/categories.js';
import {useAccountsControllerFindAll} from '@/api/accounts/accounts.js';
import type {BulkCategorizeResponseDto} from '@/api/model/bulkCategorizeResponseDto.js';
import type {TransactionResponseDto} from '@/api/model/transactionResponseDto.js';
import '@pages/TransactionsPage.css';

interface BulkCategorizeParams {
    accountId?: string;
    startDate?: string;
    endDate?: string;
}

const bulkCategorizeWithFilters = (
    params: BulkCategorizeParams
): Promise<BulkCategorizeResponseDto> =>
    customInstance<BulkCategorizeResponseDto>({
        url: '/transactions/bulk-categorize',
        method: 'POST',
        params: {
            ...(params.accountId ? {accountId: params.accountId} : {}),
            ...(params.startDate ? {startDate: params.startDate} : {}),
            ...(params.endDate ? {endDate: params.endDate} : {})
        }
    });

export const TransactionsPage = (): React.JSX.Element => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [bulkCategorizeMessage, setBulkCategorizeMessage] = useState<string | null>(null);

    const {
        filters, apiParams, data, isLoading, isError,
        updateFilter, setDateRange, clearFilters, setPage
    } = useTransactionFilters();

    const {available: aiAvailable} = useAiStatus();

    // Fetch categories for form select, list column, and filter dropdown.
    const {data: categoriesData} = useCategoriesControllerFindAll();
    const categories = categoriesData ?? [];

    // Fetch accounts for form select, list column, and filter dropdown.
    const {data: accountsData} = useAccountsControllerFindAll();
    const accounts = accountsData ?? [];

    const handleSuccess = useCallback((): void => {
        setIsModalOpen(false);
    }, []);

    const {
        formValues, errors, editTarget, isSubmitting,
        isSuggestingCategory, openCreate, openEdit,
        handleFieldChange, handleSubmit, handleSuggestCategory
    } = useTransactionForm({onSuccess: handleSuccess});

    const {mutate: removeTransaction} = useTransactionsControllerRemove();
    const {mutate: toggleActive} = useTransactionsControllerToggleActive();

    const bulkCategorizeMutation = useMutation<
        BulkCategorizeResponseDto,
        Error,
        BulkCategorizeParams
    >({
        mutationFn: bulkCategorizeWithFilters
    });

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
                            queryKey: getTransactionsControllerGetTotalsQueryKey({
                                // startDate/endDate always set — defaulted to this month
                                startDate: apiParams.startDate!,
                                endDate: apiParams.endDate!,
                                accountId: apiParams.accountId,
                                categoryId: apiParams.categoryId,
                                transactionType: apiParams.transactionType,
                                search: apiParams.search
                            }),
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
                            queryKey: getTransactionsControllerGetTotalsQueryKey({
                                // startDate/endDate always set — defaulted to this month
                                startDate: apiParams.startDate!,
                                endDate: apiParams.endDate!,
                                accountId: apiParams.accountId,
                                categoryId: apiParams.categoryId,
                                transactionType: apiParams.transactionType,
                                search: apiParams.search
                            }),
                            exact: false
                        });
                    }
                }
            );
        },
        [removeTransaction, queryClient, apiParams]
    );

    const handleBulkCategorize = (): void => {
        setBulkCategorizeMessage(null);
        bulkCategorizeMutation.mutate(
            {
                accountId: filters.accountId || undefined,
                startDate: filters.startDate || undefined,
                endDate: filters.endDate || undefined
            },
            {
                onSuccess: (result: BulkCategorizeResponseDto): void => {
                    const count = result.categorized;
                    setBulkCategorizeMessage(
                        `${count} transaction${count !== 1 ? 's' : ''} categorized`
                    );
                    void queryClient.invalidateQueries({
                        queryKey: getTransactionsControllerFindAllQueryKey(apiParams),
                        exact: false
                    });
                    void queryClient.invalidateQueries({
                        queryKey: getTransactionsControllerGetTotalsQueryKey({
                            // startDate/endDate always set — defaulted to this month
                            startDate: apiParams.startDate!,
                            endDate: apiParams.endDate!,
                            accountId: apiParams.accountId,
                            categoryId: apiParams.categoryId,
                            transactionType: apiParams.transactionType,
                            search: apiParams.search
                        }),
                        exact: false
                    });
                    setTimeout(() => { setBulkCategorizeMessage(null); }, 4000);
                },
                onError: (): void => {
                    setBulkCategorizeMessage('Auto-categorization failed');
                    setTimeout(() => { setBulkCategorizeMessage(null); }, 4000);
                }
            }
        );
    };

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
                    <div className="tx-page__actions">
                        {aiAvailable && (
                            <Button
                                variant="secondary"
                                onClick={handleBulkCategorize}
                                disabled={bulkCategorizeMutation.isPending}
                                className="tx-btn-icon"
                                title="Auto-categorize"
                            >
                                <Wand2 size={15} aria-hidden="true" />
                                <span className="tx-btn-label">
                                    {bulkCategorizeMutation.isPending
                                        ? 'Categorizing\u2026'
                                        : 'Auto-categorize'}
                                </span>
                            </Button>
                        )}
                        {bulkCategorizeMessage !== null && (
                            <span className="tx-page__bulk-msg">{bulkCategorizeMessage}</span>
                        )}
                        <Button
                            variant="primary"
                            onClick={handleAddClick}
                            className="tx-btn-icon"
                            title="Add Transaction"
                        >
                            <Plus size={15} aria-hidden="true" />
                            <span className="tx-btn-label">Add Transaction</span>
                        </Button>
                    </div>
                </div>

                {/* Summary */}
                <TransactionSummary
                    startDate={filters.startDate}
                    endDate={filters.endDate}
                    accountId={filters.accountId || undefined}
                    categoryId={filters.categoryId || undefined}
                    transactionType={filters.transactionType || undefined}
                    search={filters.search || undefined}
                />

                {/* Filters */}
                <TransactionFilters
                    filters={filters}
                    categories={categories}
                    accounts={accounts}
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
                    accounts={accounts}
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
                accounts={accounts}
                onFieldChange={handleFieldChange}
                onSubmit={handleSubmit}
                onClose={handleCloseModal}
                onSuggestCategory={handleSuggestCategory}
                isSuggestingCategory={isSuggestingCategory}
            />
        </div>
    );
};

export default TransactionsPage;
