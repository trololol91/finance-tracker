import {
    describe, it, expect, vi, beforeEach
} from 'vitest';
import {
    render, screen, waitFor
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
    QueryClient, QueryClientProvider
} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import React from 'react';
import {TransactionsPage} from '@pages/TransactionsPage.js';
import type {TransactionResponseDto} from '@/api/model/transactionResponseDto.js';
import {TransactionsControllerFindAllIsActive} from '@/api/model/transactionsControllerFindAllIsActive.js';

// ---------------------------------------------------------------------------
// Component stubs
// ---------------------------------------------------------------------------

vi.mock('@features/transactions/components/TransactionSummary.js', () => ({
    TransactionSummary: () => <div data-testid="tx-summary" />
}));

vi.mock('@features/transactions/components/TransactionFilters.js', () => ({
    TransactionFilters: ({
        onClear
    }: {
        onClear: () => void;
        onFilterChange: (key: string, value: string | number) => void;
        onDateRangeChange: (start: string, end: string) => void;
        filters: unknown;
    }) => (
        <div data-testid="tx-filters">
            <button onClick={onClear}>Clear filters</button>
        </div>
    )
}));

// TransactionList exposes stub buttons so tests can trigger onDelete / onToggleActive
vi.mock('@features/transactions/components/TransactionList.js', () => ({
    TransactionList: ({
        transactions,
        isLoading,
        isError,
        onEdit,
        onToggleActive,
        onDelete
    }: {
        transactions: TransactionResponseDto[];
        isLoading: boolean;
        isError: boolean;
        onEdit: (tx: TransactionResponseDto) => void;
        onToggleActive: (id: string) => void;
        onDelete: (id: string) => void;
    }) => (
        <div data-testid="tx-list">
            {isLoading && <span data-testid="loading" />}
            {isError && <span data-testid="error" />}
            {transactions.map((tx) => (
                <div key={tx.id}>
                    <button onClick={(): void => { onEdit(tx); }}>Edit {tx.id}</button>
                    <button onClick={(): void => { onToggleActive(tx.id); }}>Toggle {tx.id}</button>
                    <button onClick={(): void => { onDelete(tx.id); }}>Delete {tx.id}</button>
                </div>
            ))}
        </div>
    )
}));

vi.mock('@features/transactions/components/TransactionModal.js', () => ({
    TransactionModal: ({
        isOpen,
        onClose
    }: {
        isOpen: boolean;
        onClose: () => void;
        editTarget: TransactionResponseDto | null;
        formValues: unknown;
        errors: unknown;
        isSubmitting: boolean;
        onFieldChange: () => void;
        onSubmit: () => void;
    }) => (
        <dialog data-testid="tx-modal" open={isOpen || undefined}>
            <button onClick={onClose}>Close modal</button>
        </dialog>
    )
}));

vi.mock('@components/common/Pagination/Pagination.js', () => ({
    Pagination: ({
        page,
        onPageChange
    }: {
        page: number;
        total: number;
        limit: number;
        onPageChange: (p: number) => void;
    }) => (
        <div data-testid="pagination">
            <button onClick={(): void => { onPageChange(page + 1); }}>Next page</button>
        </div>
    )
}));

vi.mock('@components/common/Button/Button.js', () => ({
    Button: ({
        children,
        onClick
    }: {
        children: React.ReactNode;
        onClick?: () => void;
        variant?: string;
    }) => <button onClick={onClick}>{children}</button>
}));

// ---------------------------------------------------------------------------
// Hook stubs
// ---------------------------------------------------------------------------

const mockUpdateFilter = vi.fn();
const mockSetDateRange = vi.fn();
const mockClearFilters = vi.fn();
const mockSetPage = vi.fn();

const defaultFilterState: UseTransactionFiltersReturn = {
    filters: {
        startDate: '2026-02-01T00:00:00.000Z',
        endDate: '2026-02-28T23:59:59.999Z',
        isActive: TransactionsControllerFindAllIsActive.true,
        page: 1,
        limit: 50,
        search: '',
        transactionType: '',
        categoryId: '',
        accountId: ''
    },
    apiParams: {
        startDate: '2026-02-01T00:00:00.000Z',
        endDate: '2026-02-28T23:59:59.999Z',
        isActive: TransactionsControllerFindAllIsActive.true,
        search: undefined,
        page: 1,
        limit: 50
    },
    data: undefined, // no transactions loaded in default state
    isLoading: false,
    isError: false,
    updateFilter: mockUpdateFilter,
    setDateRange: mockSetDateRange,
    clearFilters: mockClearFilters,
    setPage: mockSetPage,
    queryKey: getTransactionsControllerFindAllQueryKey()
};

vi.mock('@features/transactions/hooks/useTransactionFilters.js', () => ({
    useTransactionFilters: vi.fn(() => defaultFilterState)
}));

const mockOpenCreate = vi.fn();
const mockOpenEdit = vi.fn();
const mockHandleFieldChange = vi.fn();
const mockHandleSubmit = vi.fn();

vi.mock('@features/transactions/hooks/useTransactionForm.js', () => ({
    useTransactionForm: vi.fn(() => ({
        formValues: {
            amount: '',
            description: '',
            notes: '',
            transactionType: 'expense',
            date: '2026-02-15',
            categoryId: '',
            accountId: ''
        },
        errors: {},
        editTarget: null,
        isSubmitting: false,
        openCreate: mockOpenCreate,
        openEdit: mockOpenEdit,
        handleFieldChange: mockHandleFieldChange,
        handleSubmit: mockHandleSubmit
    }))
}));

// ---------------------------------------------------------------------------
// Orval API stubs — mutate immediately calls onSuccess
// ---------------------------------------------------------------------------

interface MutateOpts { onSuccess: () => void }

const mockRemoveMutate = vi.fn(
    (_args: unknown, opts: MutateOpts) => { opts.onSuccess(); }
);
const mockToggleMutate = vi.fn(
    (_args: unknown, opts: MutateOpts) => { opts.onSuccess(); }
);

vi.mock('@/api/transactions/transactions.js', () => ({
    useTransactionsControllerRemove: vi.fn(() => ({mutate: mockRemoveMutate})),
    useTransactionsControllerToggleActive: vi.fn(() => ({mutate: mockToggleMutate})),
    getTransactionsControllerFindAllQueryKey: vi.fn(
        (params?: unknown) => ['/transactions', params]
    ),
    getTransactionsControllerGetTotalsQueryKey: vi.fn(
        () => ['/transactions/totals']
    )
}));

vi.mock('@/api/categories/categories.js', () => ({
    useCategoriesControllerFindAll: vi.fn(() => ({data: [], isLoading: false, isError: false}))
}));

import {
    getTransactionsControllerFindAllQueryKey,
    getTransactionsControllerGetTotalsQueryKey,
    useTransactionsControllerRemove,
    useTransactionsControllerToggleActive
} from '@/api/transactions/transactions.js';
import {
    useTransactionFilters,
    type UseTransactionFiltersReturn
} from '@features/transactions/hooks/useTransactionFilters.js';

type RemoveReturn = ReturnType<typeof useTransactionsControllerRemove>;
type ToggleReturn = ReturnType<typeof useTransactionsControllerToggleActive>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeTx = (id: string): TransactionResponseDto => ({
    id,
    userId: 'u-1',
    amount: 50,
    description: `Transaction ${id}`,
    notes: null,
    categoryId: null,
    accountId: null,
    transactionType: 'expense',
    date: '2026-02-10T00:00:00.000Z',
    originalDate: '2026-02-10T00:00:00.000Z',
    isActive: true,
    isPending: false,
    createdAt: '2026-02-10T00:00:00.000Z',
    updatedAt: '2026-02-10T00:00:00.000Z'
});

const createWrapper = (qc: QueryClient) => {
    const Wrapper = ({children}: {children: React.ReactNode}): React.JSX.Element =>
        React.createElement(
            MemoryRouter,
            null,
            React.createElement(QueryClientProvider, {client: qc}, children)
        );
    return Wrapper;
};

const renderPage = (qc: QueryClient) =>
    render(<TransactionsPage />, {wrapper: createWrapper(qc)});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TransactionsPage', () => {
    let qc: QueryClient;

    beforeEach(() => {
        qc = new QueryClient({defaultOptions: {queries: {retry: false}}});
        vi.clearAllMocks();
        // Reset mutate implementations after clearAllMocks
        vi.mocked(mockRemoveMutate).mockImplementation(
            (_args, opts) => { opts.onSuccess(); }
        );
        vi.mocked(mockToggleMutate).mockImplementation(
            (_args, opts) => { opts.onSuccess(); }
        );
        vi.mocked(useTransactionsControllerRemove).mockReturnValue(
            {mutate: mockRemoveMutate} as unknown as RemoveReturn
        );
        vi.mocked(useTransactionsControllerToggleActive).mockReturnValue(
            {mutate: mockToggleMutate} as unknown as ToggleReturn
        );
        vi.mocked(useTransactionFilters).mockReturnValue({
            ...defaultFilterState,
            updateFilter: mockUpdateFilter,
            setDateRange: mockSetDateRange,
            clearFilters: mockClearFilters,
            setPage: mockSetPage
        });
    });

    // -------------------------------------------------------------------------
    // Renders
    // -------------------------------------------------------------------------

    describe('renders', () => {
        it('renders the Transactions heading', () => {
            renderPage(qc);
            expect(
                screen.getByRole('heading', {name: /transactions/i})
            ).toBeInTheDocument();
        });

        it('renders the "+ Add Transaction" button', () => {
            renderPage(qc);
            expect(
                screen.getByRole('button', {name: /add transaction/i})
            ).toBeInTheDocument();
        });

        it('renders the summary section', () => {
            renderPage(qc);
            expect(screen.getByTestId('tx-summary')).toBeInTheDocument();
        });

        it('renders the filters section', () => {
            renderPage(qc);
            expect(screen.getByTestId('tx-filters')).toBeInTheDocument();
        });

        it('renders the transaction list', () => {
            renderPage(qc);
            expect(screen.getByTestId('tx-list')).toBeInTheDocument();
        });

        it('passes transactions from data to TransactionList', () => {
            const txns = [makeTx('tx-1'), makeTx('tx-2')];
            vi.mocked(useTransactionFilters).mockReturnValue({
                ...defaultFilterState,
                data: {data: txns, total: 2, page: 1, limit: 50},
                updateFilter: mockUpdateFilter,
                setDateRange: mockSetDateRange,
                clearFilters: mockClearFilters,
                setPage: mockSetPage
            });
            renderPage(qc);
            expect(screen.getByText('Delete tx-1')).toBeInTheDocument();
            expect(screen.getByText('Delete tx-2')).toBeInTheDocument();
        });

        it('passes isLoading to TransactionList', () => {
            vi.mocked(useTransactionFilters).mockReturnValue({
                ...defaultFilterState,
                isLoading: true,
                updateFilter: mockUpdateFilter,
                setDateRange: mockSetDateRange,
                clearFilters: mockClearFilters,
                setPage: mockSetPage
            });
            renderPage(qc);
            expect(screen.getByTestId('loading')).toBeInTheDocument();
        });

        it('passes isError to TransactionList', () => {
            vi.mocked(useTransactionFilters).mockReturnValue({
                ...defaultFilterState,
                isError: true,
                updateFilter: mockUpdateFilter,
                setDateRange: mockSetDateRange,
                clearFilters: mockClearFilters,
                setPage: mockSetPage
            });
            renderPage(qc);
            expect(screen.getByTestId('error')).toBeInTheDocument();
        });
    });

    // -------------------------------------------------------------------------
    // Pagination
    // -------------------------------------------------------------------------

    describe('pagination', () => {
        it('does not render Pagination when total is within one page', () => {
            vi.mocked(useTransactionFilters).mockReturnValue({
                ...defaultFilterState,
                data: {data: [], total: 10, page: 1, limit: 50},
                updateFilter: mockUpdateFilter,
                setDateRange: mockSetDateRange,
                clearFilters: mockClearFilters,
                setPage: mockSetPage
            });
            renderPage(qc);
            expect(screen.queryByTestId('pagination')).not.toBeInTheDocument();
        });

        it('renders Pagination when total exceeds the limit', () => {
            vi.mocked(useTransactionFilters).mockReturnValue({
                ...defaultFilterState,
                data: {data: [], total: 100, page: 1, limit: 50},
                isLoading: false,
                updateFilter: mockUpdateFilter,
                setDateRange: mockSetDateRange,
                clearFilters: mockClearFilters,
                setPage: mockSetPage
            });
            renderPage(qc);
            expect(screen.getByTestId('pagination')).toBeInTheDocument();
        });

        it('calls setPage when Pagination emits a page change', async () => {
            const user = userEvent.setup();
            vi.mocked(useTransactionFilters).mockReturnValue({
                ...defaultFilterState,
                data: {data: [], total: 100, page: 1, limit: 50},
                isLoading: false,
                updateFilter: mockUpdateFilter,
                setDateRange: mockSetDateRange,
                clearFilters: mockClearFilters,
                setPage: mockSetPage
            });
            renderPage(qc);
            await user.click(screen.getByRole('button', {name: /next page/i}));
            expect(mockSetPage).toHaveBeenCalledWith(2);
        });
    });

    // -------------------------------------------------------------------------
    // Modal
    // -------------------------------------------------------------------------

    describe('modal', () => {
        it('modal is closed on initial render', () => {
            renderPage(qc);
            expect(screen.getByTestId('tx-modal')).not.toHaveAttribute('open');
        });

        it('opens the modal when "+ Add Transaction" is clicked', async () => {
            const user = userEvent.setup();
            renderPage(qc);
            await user.click(screen.getByRole('button', {name: /add transaction/i}));
            expect(screen.getByTestId('tx-modal')).toHaveAttribute('open');
        });

        it('calls openCreate when "+ Add Transaction" is clicked', async () => {
            const user = userEvent.setup();
            renderPage(qc);
            await user.click(screen.getByRole('button', {name: /add transaction/i}));
            expect(mockOpenCreate).toHaveBeenCalledOnce();
        });

        it('opens the modal when Edit is triggered from the list', async () => {
            const user = userEvent.setup();
            const txns = [makeTx('tx-1')];
            vi.mocked(useTransactionFilters).mockReturnValue({
                ...defaultFilterState,
                data: {data: txns, total: 1, page: 1, limit: 50},
                updateFilter: mockUpdateFilter,
                setDateRange: mockSetDateRange,
                clearFilters: mockClearFilters,
                setPage: mockSetPage
            });
            renderPage(qc);
            await user.click(screen.getByRole('button', {name: /edit tx-1/i}));
            expect(mockOpenEdit).toHaveBeenCalledWith(txns[0]);
            expect(screen.getByTestId('tx-modal')).toHaveAttribute('open');
        });

        it('closes the modal when onClose is called', async () => {
            const user = userEvent.setup();
            renderPage(qc);
            // Open first
            await user.click(screen.getByRole('button', {name: /add transaction/i}));
            expect(screen.getByTestId('tx-modal')).toHaveAttribute('open');
            // Close
            await user.click(screen.getByRole('button', {name: /close modal/i}));
            expect(screen.getByTestId('tx-modal')).not.toHaveAttribute('open');
        });
    });

    // -------------------------------------------------------------------------
    // handleDelete — BUG-03
    // -------------------------------------------------------------------------

    describe('handleDelete (BUG-03)', () => {
        const txns = [makeTx('tx-abc')];

        beforeEach(() => {
            vi.mocked(useTransactionFilters).mockReturnValue({
                ...defaultFilterState,
                data: {data: txns, total: 1, page: 1, limit: 50},
                updateFilter: mockUpdateFilter,
                setDateRange: mockSetDateRange,
                clearFilters: mockClearFilters,
                setPage: mockSetPage
            });
        });

        it('calls removeTransaction mutate with the correct id', async () => {
            const user = userEvent.setup();
            renderPage(qc);
            await user.click(screen.getByRole('button', {name: /delete tx-abc/i}));
            expect(mockRemoveMutate).toHaveBeenCalledWith(
                {id: 'tx-abc'},
                {onSuccess: expect.any(Function)}
            );
        });

        it('invalidates the totals query key on successful delete', async () => {
            const user = userEvent.setup();
            const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
            renderPage(qc);
            await user.click(screen.getByRole('button', {name: /delete tx-abc/i}));
            await waitFor(() => {
                const totalsKey = vi.mocked(getTransactionsControllerGetTotalsQueryKey)();
                expect(invalidateSpy).toHaveBeenCalledWith(
                    expect.objectContaining({queryKey: totalsKey})
                );
            });
        });

        it('invalidates the list query key on successful delete', async () => {
            const user = userEvent.setup();
            const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
            renderPage(qc);
            await user.click(screen.getByRole('button', {name: /delete tx-abc/i}));
            await waitFor(() => {
                const listKey = vi.mocked(getTransactionsControllerFindAllQueryKey)(
                    defaultFilterState.apiParams
                );
                expect(invalidateSpy).toHaveBeenCalledWith(
                    expect.objectContaining({queryKey: listKey})
                );
            });
        });

        it('invalidates both list and totals keys — not just one (BUG-03 regression)', async () => {
            const user = userEvent.setup();
            const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
            renderPage(qc);
            await user.click(screen.getByRole('button', {name: /delete tx-abc/i}));
            await waitFor(() => {
                // Both invalidateQueries calls must have fired
                expect(invalidateSpy).toHaveBeenCalledTimes(2);
            });
        });
    });

    // -------------------------------------------------------------------------
    // handleToggleActive — BUG-03
    // -------------------------------------------------------------------------

    describe('handleToggleActive (BUG-03)', () => {
        const txns = [makeTx('tx-xyz')];

        beforeEach(() => {
            vi.mocked(useTransactionFilters).mockReturnValue({
                ...defaultFilterState,
                data: {data: txns, total: 1, page: 1, limit: 50},
                updateFilter: mockUpdateFilter,
                setDateRange: mockSetDateRange,
                clearFilters: mockClearFilters,
                setPage: mockSetPage
            });
        });

        it('calls toggleActive mutate with the correct id', async () => {
            const user = userEvent.setup();
            renderPage(qc);
            await user.click(screen.getByRole('button', {name: /toggle tx-xyz/i}));
            expect(mockToggleMutate).toHaveBeenCalledWith(
                {id: 'tx-xyz'},
                {onSuccess: expect.any(Function)}
            );
        });

        it('invalidates the totals query key on successful toggle', async () => {
            const user = userEvent.setup();
            const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
            renderPage(qc);
            await user.click(screen.getByRole('button', {name: /toggle tx-xyz/i}));
            await waitFor(() => {
                const totalsKey = vi.mocked(getTransactionsControllerGetTotalsQueryKey)();
                expect(invalidateSpy).toHaveBeenCalledWith(
                    expect.objectContaining({queryKey: totalsKey})
                );
            });
        });

        it('invalidates the list query key on successful toggle', async () => {
            const user = userEvent.setup();
            const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
            renderPage(qc);
            await user.click(screen.getByRole('button', {name: /toggle tx-xyz/i}));
            await waitFor(() => {
                const listKey = vi.mocked(getTransactionsControllerFindAllQueryKey)(
                    defaultFilterState.apiParams
                );
                expect(invalidateSpy).toHaveBeenCalledWith(
                    expect.objectContaining({queryKey: listKey})
                );
            });
        });

        it('invalidates both list and totals keys — not just one (BUG-03 regression)', async () => {
            const user = userEvent.setup();
            const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
            renderPage(qc);
            await user.click(screen.getByRole('button', {name: /toggle tx-xyz/i}));
            await waitFor(() => {
                expect(invalidateSpy).toHaveBeenCalledTimes(2);
            });
        });
    });

    // -------------------------------------------------------------------------
    // delete and toggle are independent — mutations do not cross-fire
    // -------------------------------------------------------------------------

    describe('mutation isolation', () => {
        const txns = [makeTx('tx-1'), makeTx('tx-2')];

        beforeEach(() => {
            vi.mocked(useTransactionFilters).mockReturnValue({
                ...defaultFilterState,
                data: {data: txns, total: 2, page: 1, limit: 50},
                updateFilter: mockUpdateFilter,
                setDateRange: mockSetDateRange,
                clearFilters: mockClearFilters,
                setPage: mockSetPage
            });
        });

        it('delete only calls remove mutate, not toggle mutate', async () => {
            const user = userEvent.setup();
            renderPage(qc);
            await user.click(screen.getByRole('button', {name: /delete tx-1/i}));
            expect(mockRemoveMutate).toHaveBeenCalledOnce();
            expect(mockToggleMutate).not.toHaveBeenCalled();
        });

        it('toggle only calls toggle mutate, not remove mutate', async () => {
            const user = userEvent.setup();
            renderPage(qc);
            await user.click(screen.getByRole('button', {name: /toggle tx-1/i}));
            expect(mockToggleMutate).toHaveBeenCalledOnce();
            expect(mockRemoveMutate).not.toHaveBeenCalled();
        });
    });
});
