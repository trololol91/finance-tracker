import {
    useCallback, useMemo
} from 'react';
import {useSearchParams} from 'react-router-dom';
import {
    useTransactionsControllerFindAll,
    getTransactionsControllerFindAllQueryKey
} from '@/api/transactions/transactions.js';
// Value imports — needed for enum coercion/filtering at runtime (cannot be import type)
import {TransactionsControllerFindAllIsActive} from '@/api/model/transactionsControllerFindAllIsActive.js';
import {TransactionsControllerFindAllSortField} from '@/api/model/transactionsControllerFindAllSortField.js';
import {TransactionsControllerFindAllSortDirection} from '@/api/model/transactionsControllerFindAllSortDirection.js';
import {TransactionsControllerFindAllTransactionTypeItem} from '@/api/model/transactionsControllerFindAllTransactionTypeItem.js';
import type {TransactionsControllerFindAllParams} from '@/api/model/transactionsControllerFindAllParams.js';
import type {PaginatedTransactionsResponseDto} from '@/api/model/paginatedTransactionsResponseDto.js';
import type {
    TransactionFilterState, ScalarFilterKey, MultiFilterKey
} from '@features/transactions/types/transaction.types.js';

/** Filters raw URL param strings against a known enum const object. */
const filterByEnum = <T extends string>(
    values: string[],
    enumObj: Record<string, T>
): T[] => {
    const valid = new Set(Object.values(enumObj));
    return values.filter((v): v is T => valid.has(v as T));
};

/** Returns the value if it belongs to the enum, otherwise the fallback. */
const coerceEnum = <T extends string>(
    value: string | null,
    enumObj: Record<string, T>,
    fallback: T
): T => {
    const valid = new Set(Object.values(enumObj));
    return value !== null && valid.has(value as T) ? (value as T) : fallback;
};

/** Filters raw URL param strings to valid UUID v4 values only. */
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const filterByUuid = (values: string[]): string[] => values.filter((v) => UUID_V4_REGEX.test(v));

/** Guards that a string is a full ISO 8601 UTC datetime (e.g. 2026-03-01T00:00:00.000Z). */
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const isIsoDate = (value: string): boolean => ISO_DATE_REGEX.test(value);

/** Returns the URL param value if it passes ISO validation, otherwise returns the fallback. */
const getValidIsoParam = (params: URLSearchParams, key: string, fallback: string): string => {
    const v = params.get(key);
    return v !== null && isIsoDate(v) ? v : fallback;
};

/** Returns the ISO range for the current calendar month using local date to determine the month. */
const getThisMonthRange = (): {startDate: string, endDate: string} => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    return {
        startDate: new Date(Date.UTC(y, m, 1, 0, 0, 0, 0)).toISOString(),
        endDate: new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999)).toISOString()
    };
};

export interface UseTransactionFiltersReturn {
    filters: TransactionFilterState;
    apiParams: TransactionsControllerFindAllParams;
    data: PaginatedTransactionsResponseDto | undefined;
    isLoading: boolean;
    isError: boolean;
    updateFilter: (key: ScalarFilterKey, value: string | number) => void;
    setMultiFilter: (key: MultiFilterKey, values: string[]) => void;
    setDateRange: (startDate: string, endDate: string) => void;
    clearFilters: () => void;
    setPage: (page: number) => void;
    setSort: (
        field: TransactionsControllerFindAllSortField,
        direction: TransactionsControllerFindAllSortDirection
    ) => void;
    queryKey: ReturnType<typeof getTransactionsControllerFindAllQueryKey>;
}

/**
 * Manages transaction filter state (mirrored to URL search params) and
 * calls the Orval-generated useTransactionsControllerFindAll hook.
 */
export const useTransactionFilters = (): UseTransactionFiltersReturn => {
    const [searchParams, setSearchParams] = useSearchParams();

    const {startDate: defaultStart, endDate: defaultEnd} = useMemo(
        (): {startDate: string, endDate: string} => getThisMonthRange(), []
    );

    const filters: TransactionFilterState = {
        startDate: getValidIsoParam(searchParams, 'startDate', defaultStart),
        endDate: getValidIsoParam(searchParams, 'endDate', defaultEnd),
        transactionType: filterByEnum(
            searchParams.getAll('transactionType'),
            TransactionsControllerFindAllTransactionTypeItem
        ),
        isActive: coerceEnum(
            searchParams.get('isActive'),
            TransactionsControllerFindAllIsActive,
            TransactionsControllerFindAllIsActive.true
        ),
        search: searchParams.get('search') ?? '',
        categoryId: filterByUuid(searchParams.getAll('categoryId')),
        accountId: filterByUuid(searchParams.getAll('accountId')),
        page: Math.max(1, Number(searchParams.get('page') ?? '1') || 1),
        limit: Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50') || 50)),
        sortField: coerceEnum(
            searchParams.get('sortField'),
            TransactionsControllerFindAllSortField,
            TransactionsControllerFindAllSortField.date
        ),
        sortDirection: coerceEnum(
            searchParams.get('sortDirection'),
            TransactionsControllerFindAllSortDirection,
            TransactionsControllerFindAllSortDirection.desc
        )
    };

    const apiParams: TransactionsControllerFindAllParams = {
        startDate: filters.startDate,
        endDate: filters.endDate,
        transactionType: filters.transactionType.length ? filters.transactionType : undefined,
        isActive: filters.isActive,
        search: filters.search || undefined,
        categoryId: filters.categoryId.length ? filters.categoryId : undefined,
        accountId: filters.accountId.length ? filters.accountId : undefined,
        page: filters.page,
        limit: filters.limit,
        sortField: filters.sortField,
        sortDirection: filters.sortDirection
    };

    const {data, isLoading, isError} = useTransactionsControllerFindAll(apiParams);

    const updateFilter = useCallback(
        (key: ScalarFilterKey, value: string | number): void => {
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

    const setMultiFilter = useCallback(
        (key: MultiFilterKey, values: string[]): void => {
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete(key);
                values.forEach((v) => { next.append(key, v); });
                next.set('page', '1');
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
        setSearchParams({
            startDate: defaultStart,
            endDate: defaultEnd,
            isActive: TransactionsControllerFindAllIsActive.true,
            page: '1',
            limit: '50',
            sortField: TransactionsControllerFindAllSortField.date,
            sortDirection: TransactionsControllerFindAllSortDirection.desc
        });
    }, [setSearchParams, defaultStart, defaultEnd]);

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

    const setSort = useCallback(
        (
            field: TransactionsControllerFindAllSortField,
            direction: TransactionsControllerFindAllSortDirection
        ): void => {
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set('sortField', field);
                next.set('sortDirection', direction);
                next.set('page', '1');
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
        setMultiFilter,
        setDateRange,
        clearFilters,
        setPage,
        setSort,
        queryKey: getTransactionsControllerFindAllQueryKey(apiParams)
    };
};
