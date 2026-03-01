import {useCallback} from 'react';
import {useSearchParams} from 'react-router-dom';
import {
    useTransactionsControllerFindAll,
    getTransactionsControllerFindAllQueryKey
} from '@/api/transactions/transactions.js';
import {TransactionsControllerFindAllIsActive} from '@/api/model/transactionsControllerFindAllIsActive.js';
import type {TransactionsControllerFindAllTransactionType} from '@/api/model/transactionsControllerFindAllTransactionType.js';
import type {TransactionsControllerFindAllParams} from '@/api/model/transactionsControllerFindAllParams.js';
import type {PaginatedTransactionsResponseDto} from '@/api/model/paginatedTransactionsResponseDto.js';
import type {
    TransactionFilterState, TransactionType
} from '@features/transactions/types/transaction.types.js';

/** Returns the ISO range for the current calendar month using UTC boundaries. */
const getThisMonthRange = (): {startDate: string, endDate: string} => {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    return {
        startDate: new Date(Date.UTC(y, m, 1, 0, 0, 0, 0)).toISOString(),
        endDate: new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999)).toISOString()
    };
};

interface UseTransactionFiltersReturn {
    filters: TransactionFilterState;
    apiParams: TransactionsControllerFindAllParams;
    data: PaginatedTransactionsResponseDto | undefined;
    isLoading: boolean;
    isError: boolean;
    updateFilter: (key: keyof TransactionFilterState, value: string | number) => void;
    setDateRange: (startDate: string, endDate: string) => void;
    clearFilters: () => void;
    setPage: (page: number) => void;
    queryKey: ReturnType<typeof getTransactionsControllerFindAllQueryKey>;
}

/**
 * Manages transaction filter state (mirrored to URL search params) and
 * calls the Orval-generated useTransactionsControllerFindAll hook.
 */
export const useTransactionFilters = (): UseTransactionFiltersReturn => {
    const [searchParams, setSearchParams] = useSearchParams();
    const {startDate: defaultStart, endDate: defaultEnd} = getThisMonthRange();

    const filters: TransactionFilterState = {
        startDate: searchParams.get('startDate') ?? defaultStart,
        endDate: searchParams.get('endDate') ?? defaultEnd,
        transactionType: (searchParams.get('transactionType') ?? '') as TransactionType | '',
        isActive: (
            searchParams.get('isActive') ?? TransactionsControllerFindAllIsActive.true
        ) as TransactionsControllerFindAllIsActive,
        search: searchParams.get('search') ?? '',
        page: Number(searchParams.get('page') ?? '1'),
        limit: Number(searchParams.get('limit') ?? '50')
    };

    const apiParams: TransactionsControllerFindAllParams = {
        startDate: filters.startDate,
        endDate: filters.endDate,
        transactionType: filters.transactionType
            ? (filters.transactionType as TransactionsControllerFindAllTransactionType)
            : undefined,
        isActive: filters.isActive,
        search: filters.search || undefined,
        page: filters.page,
        limit: filters.limit
    };

    const {data, isLoading, isError} = useTransactionsControllerFindAll(apiParams);

    const updateFilter = useCallback(
        (key: keyof TransactionFilterState, value: string | number): void => {
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                if (value === '') {
                    next.delete(key);
                } else {
                    next.set(key, String(value));
                }
                // Reset to page 1 on any filter change except page itself
                if (key !== 'page') next.set('page', '1');
                return next;
            });
        },
        [setSearchParams]
    );

    const setDateRange = useCallback(
        (start: string, end: string): void => {
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set('startDate', start);
                next.set('endDate', end);
                next.set('page', '1');
                return next;
            });
        },
        [setSearchParams]
    );

    const clearFilters = useCallback((): void => {
        const {startDate, endDate} = getThisMonthRange();
        setSearchParams({
            startDate,
            endDate,
            isActive: TransactionsControllerFindAllIsActive.true,
            page: '1',
            limit: '50'
        });
    }, [setSearchParams]);

    const setPage = useCallback(
        (page: number): void => {
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set('page', String(page));
                return next;
            });
        },
        [setSearchParams]
    );

    return {
        filters,
        apiParams,
        data,
        isLoading,
        isError,
        updateFilter,
        setDateRange,
        clearFilters,
        setPage,
        queryKey: getTransactionsControllerFindAllQueryKey(apiParams)
    };
};
