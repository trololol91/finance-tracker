// Frontend-specific types for the Transactions feature.
// Generated DTO/entity types live in @/api/model/ — do not redefine them here.

import type {TransactionsControllerFindAllIsActive} from '@/api/model/transactionsControllerFindAllIsActive.js';
import type {TransactionsControllerFindAllTransactionTypeItem} from '@/api/model/transactionsControllerFindAllTransactionTypeItem.js';
import type {TransactionsControllerGetTotalsTransactionTypeItem} from '@/api/model/transactionsControllerGetTotalsTransactionTypeItem.js';
import type {TransactionsControllerFindAllSortField} from '@/api/model/transactionsControllerFindAllSortField.js';
import type {TransactionsControllerFindAllSortDirection} from '@/api/model/transactionsControllerFindAllSortDirection.js';
import type {CreateTransactionDtoTransactionType} from '@/api/model/createTransactionDtoTransactionType.js';

export type {TransactionsControllerFindAllIsActive};
export type {TransactionsControllerFindAllTransactionTypeItem};
export type {TransactionsControllerGetTotalsTransactionTypeItem};
export type {TransactionsControllerFindAllSortField};
export type {TransactionsControllerFindAllSortDirection};
export type {CreateTransactionDtoTransactionType};

/** UI state for the filter bar. */
export interface TransactionFilterState {
    startDate: string;
    endDate: string;
    /** Empty array means 'no filter / show all'. */
    transactionType: TransactionsControllerFindAllTransactionTypeItem[];
    isActive: TransactionsControllerFindAllIsActive;
    search: string;
    /** UUIDs of selected categories. Empty array means 'all categories'. */
    categoryId: string[];
    /** UUIDs of selected accounts. Empty array means 'all accounts'. */
    accountId: string[];
    page: number;
    limit: number;
    sortField: TransactionsControllerFindAllSortField;
    sortDirection: TransactionsControllerFindAllSortDirection;
}

/** Keys of TransactionFilterState that hold scalar (non-array) values.
 *  Array-valued keys (transactionType, categoryId, accountId) must use setMultiFilter. */
export type ScalarFilterKey = Exclude<keyof TransactionFilterState,
    'transactionType' | 'categoryId' | 'accountId'>;

/** Keys of TransactionFilterState that hold array values. */
export type MultiFilterKey = 'transactionType' | 'categoryId' | 'accountId';

/** Form values (all strings for controlled inputs). */
export interface TransactionFormValues {
    amount: string;
    description: string;
    notes: string;
    transactionType: CreateTransactionDtoTransactionType;
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
