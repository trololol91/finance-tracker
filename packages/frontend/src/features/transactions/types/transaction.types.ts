// Frontend-specific types for the Transactions feature.
// Generated DTO/entity types live in @/api/model/ — do not redefine them here.

import type {TransactionsControllerFindAllIsActive} from '@/api/model/transactionsControllerFindAllIsActive.js';
import type {TransactionsControllerFindAllTransactionType} from '@/api/model/transactionsControllerFindAllTransactionType.js';
import type {TransactionsControllerGetTotalsTransactionType} from '@/api/model/transactionsControllerGetTotalsTransactionType.js';
import type {TransactionsControllerFindAllSortField} from '@/api/model/transactionsControllerFindAllSortField.js';
import type {TransactionsControllerFindAllSortDirection} from '@/api/model/transactionsControllerFindAllSortDirection.js';

export type {TransactionsControllerFindAllIsActive};
export type {TransactionsControllerFindAllTransactionType};
export type {TransactionsControllerGetTotalsTransactionType};
export type {TransactionsControllerFindAllSortField};
export type {TransactionsControllerFindAllSortDirection};

/** Valid transaction type strings. */
export type TransactionType = 'income' | 'expense' | 'transfer';

/** UI state for the filter bar. */
export interface TransactionFilterState {
    startDate: string;
    endDate: string;
    /** Empty string means 'no filter'. */
    transactionType: TransactionType | '';
    isActive: TransactionsControllerFindAllIsActive;
    search: string;
    /** UUID of the selected category filter, or empty string for 'all categories'. */
    categoryId: string;
    /** UUID of the selected account filter, or empty string for 'all accounts'. */
    accountId: string;
    page: number;
    limit: number;
    sortField: TransactionsControllerFindAllSortField;
    sortDirection: TransactionsControllerFindAllSortDirection;
}

/** Form values (all strings for controlled inputs). */
export interface TransactionFormValues {
    amount: string;
    description: string;
    notes: string;
    transactionType: TransactionType;
    /** 'in' | 'out' when type is transfer; empty string otherwise */
    transferDirection: 'in' | 'out' | '';
    date: string;
    categoryId: string;
    accountId: string;
}

/** Whether the modal is closed, creating, or editing. */
export type ModalMode = 'create' | 'edit' | null;

/** Preset labels for the DateRangePicker. */
export type DatePreset = 'today' | 'this-week' | 'this-month' | 'this-year' | 'custom';
