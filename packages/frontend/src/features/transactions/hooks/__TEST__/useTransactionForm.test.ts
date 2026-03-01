import {
    describe, it, expect, vi, beforeEach
} from 'vitest';
import {
    renderHook, act
} from '@testing-library/react';
import {
    QueryClient, QueryClientProvider
} from '@tanstack/react-query';
import React from 'react';
import {useTransactionForm} from '@features/transactions/hooks/useTransactionForm.js';
import type {TransactionResponseDto} from '@/api/model/transactionResponseDto.js';

// Mock Orval mutation hooks
vi.mock('@/api/transactions/transactions.js', () => ({
    useTransactionsControllerCreate: vi.fn(),
    useTransactionsControllerUpdate: vi.fn(),
    getTransactionsControllerFindAllQueryKey: vi.fn(() => ['/transactions']),
    getTransactionsControllerGetTotalsQueryKey: vi.fn(() => ['/transactions/totals'])
}));

// Imported after vi.mock — Vitest hoists the mock call above all imports at runtime
import {
    useTransactionsControllerCreate,
    useTransactionsControllerUpdate,
    getTransactionsControllerGetTotalsQueryKey
} from '@/api/transactions/transactions.js';

const mockCreate = vi.mocked(useTransactionsControllerCreate);
const mockUpdate = vi.mocked(useTransactionsControllerUpdate);

const createWrapper = () => {
    const qc = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return ({children}: {children: React.ReactNode}) =>
        React.createElement(QueryClientProvider, {client: qc}, children);
};


// Type aliases and helpers to keep lines short
type CreateReturn = ReturnType<typeof useTransactionsControllerCreate>;
type UpdateReturn = ReturnType<typeof useTransactionsControllerUpdate>;
type HookResult = ReturnType<typeof useTransactionForm>;

const fakeEvent = (): React.FormEvent =>
    ({preventDefault: vi.fn()}) as unknown as React.FormEvent;
const makeCreate = (mutate = vi.fn(), isPending = false): CreateReturn =>
    ({mutate, isPending}) as unknown as CreateReturn;
const makeUpdate = (mutate = vi.fn(), isPending = false): UpdateReturn =>
    ({mutate, isPending}) as unknown as UpdateReturn;
const setupHook = (onSuccess = vi.fn()) =>
    renderHook(() => useTransactionForm({onSuccess}), {wrapper: createWrapper()});
const mockTx: TransactionResponseDto = {
    id: 'tx-1',
    userId: 'u-1',
    amount: 99.99,
    description: 'Freelance payment',
    notes: 'Project X',
    categoryId: null,
    accountId: null,
    transactionType: 'income',
    date: '2026-01-10T12:00:00.000Z',
    originalDate: '2026-01-10T12:00:00.000Z',
    isActive: true,
    createdAt: '2026-01-10T12:00:00.000Z',
    updatedAt: '2026-01-10T12:00:00.000Z'
};

describe('useTransactionForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCreate.mockReturnValue(makeCreate());
        mockUpdate.mockReturnValue(makeUpdate());
    });

    describe('initial state', () => {
        it('has empty form values', () => {
            const {result} = setupHook();
            expect(result.current.formValues.amount).toBe('');
            expect(result.current.formValues.description).toBe('');
            expect(result.current.formValues.notes).toBe('');
        });

        it('defaults transactionType to expense', () => {
            const {result} = setupHook();
            expect(result.current.formValues.transactionType).toBe('expense');
        });

        it('has no editTarget', () => {
            const {result} = setupHook();
            expect(result.current.editTarget).toBeNull();
        });

        it('is not submitting', () => {
            const {result} = setupHook();
            expect(result.current.isSubmitting).toBe(false);
        });
    });

    describe('openCreate', () => {
        it('clears the form and editTarget', () => {
            const {result} = setupHook();

            // First load an edit state
            act(() => { result.current.openEdit(mockTx); });
            expect(result.current.editTarget).not.toBeNull();

            // Now reset to create
            act(() => { result.current.openCreate(); });
            expect(result.current.editTarget).toBeNull();
            expect(result.current.formValues.amount).toBe('');
            expect(result.current.formValues.description).toBe('');
            expect(result.current.formValues.transactionType).toBe('expense');
            expect(result.current.formValues.categoryId).toBe('');
            expect(result.current.formValues.accountId).toBe('');
        });

        it('populates date with today', () => {
            // Capture before act to avoid midnight boundary flakiness
            const today = new Date().toISOString().substring(0, 10);
            const {result} = setupHook();
            act(() => { result.current.openCreate(); });
            expect(result.current.formValues.date).toBe(today);
        });
    });

    describe('openEdit', () => {
        it('sets editTarget to the transaction', () => {
            const {result} = setupHook();
            act(() => { result.current.openEdit(mockTx); });
            expect(result.current.editTarget).toEqual(mockTx);
        });

        it('populates formValues from the transaction', () => {
            const {result} = setupHook();
            act(() => { result.current.openEdit(mockTx); });
            expect(result.current.formValues.amount).toBe('99.99');
            expect(result.current.formValues.description).toBe('Freelance payment');
            expect(result.current.formValues.notes).toBe('Project X');
            expect(result.current.formValues.transactionType).toBe('income');
        });

        it('truncates date to YYYY-MM-DD', () => {
            const {result} = setupHook();
            act(() => { result.current.openEdit(mockTx); });
            expect(result.current.formValues.date).toBe('2026-01-10');
        });

        it('sets notes to empty string when transaction.notes is null', () => {
            const {result} = setupHook();
            act(() => { result.current.openEdit({...mockTx, notes: null}); });
            expect(result.current.formValues.notes).toBe('');
        });

        it('clears existing errors', () => {
            const {result} = setupHook();

            // Trigger a validation error first
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.description).toBeDefined();

            // openEdit should clear them
            act(() => { result.current.openEdit(mockTx); });
            expect(result.current.errors).toEqual({});
        });
    });

    describe('handleFieldChange', () => {
        it('updates the changed field', () => {
            const {result} = setupHook();
            act(() => { result.current.handleFieldChange('description', 'Coffee'); });
            expect(result.current.formValues.description).toBe('Coffee');
        });

        it('does not overwrite other fields', () => {
            const {result} = setupHook();
            act(() => { result.current.handleFieldChange('amount', '10'); });
            act(() => { result.current.handleFieldChange('description', 'Lunch'); });
            expect(result.current.formValues.amount).toBe('10');
            expect(result.current.formValues.description).toBe('Lunch');
        });

        it('clears the error for the changed field', () => {
            const {result} = setupHook();

            // Submit empty form to trigger validation errors
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.description).toBeDefined();

            // Changing description should clear that error
            act(() => { result.current.handleFieldChange('description', 'Fixed'); });
            expect(result.current.errors.description).toBeUndefined();
        });
    });

    describe('handleSubmit – validation', () => {
        it('sets an error when amount is empty', () => {
            const {result} = setupHook();
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.amount).toMatch(/positive/i);
        });

        it('sets an error when amount is zero', () => {
            const {result} = setupHook();
            act(() => { result.current.handleFieldChange('amount', '0'); });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.amount).toMatch(/positive/i);
        });

        it('sets an error when description is empty', () => {
            const {result} = setupHook();
            act(() => { result.current.handleFieldChange('amount', '10'); });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.description).toMatch(/required/i);
        });

        it('sets an error when date is empty', () => {
            const {result} = setupHook();
            act(() => {
                result.current.handleFieldChange('amount', '10');
                result.current.handleFieldChange('description', 'Item');
                result.current.handleFieldChange('date', '');
            });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.date).toMatch(/required/i);
        });

        it('sets an error when amount is a non-numeric string', () => {
            const {result} = setupHook();
            act(() => { result.current.handleFieldChange('amount', 'abc'); });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.amount).toMatch(/positive/i);
        });

        it('does not call createTransaction when validation fails', () => {
            const mockMutate = vi.fn();
            mockCreate.mockReturnValue(makeCreate(mockMutate));
            const {result} = setupHook();
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(mockMutate).not.toHaveBeenCalled();
        });
    });

    describe('handleSubmit – create', () => {
        const fillValidForm = (result: {current: HookResult}): void => {
            act(() => {
                result.current.handleFieldChange('amount', '42.50');
                result.current.handleFieldChange('description', 'Test item');
                result.current.handleFieldChange('date', '2026-02-15');
            });
        };

        it('calls createTransaction with correct payload', () => {
            const mockMutate = vi.fn();
            mockCreate.mockReturnValue(makeCreate(mockMutate));
            const {result} = setupHook();
            fillValidForm(result);
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(mockMutate).toHaveBeenCalledWith(
                {data: expect.objectContaining({amount: 42.5, description: 'Test item'})},
                {onSuccess: expect.any(Function)}
            );
        });

        it('trims whitespace from description', () => {
            const mockMutate = vi.fn();
            mockCreate.mockReturnValue(makeCreate(mockMutate));
            const {result} = setupHook();
            act(() => {
                result.current.handleFieldChange('amount', '10');
                result.current.handleFieldChange('description', '  Trimmed  ');
                result.current.handleFieldChange('date', '2026-02-15');
            });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            const [{data}] = mockMutate.mock.calls[0] as [{data: {description: string}}];
            expect(data.description).toBe('Trimmed');
        });

        it('sets notes to null when notes field is empty', () => {
            const mockMutate = vi.fn();
            mockCreate.mockReturnValue(makeCreate(mockMutate));
            const {result} = setupHook();
            act(() => {
                result.current.handleFieldChange('amount', '10');
                result.current.handleFieldChange('description', 'Item');
                result.current.handleFieldChange('date', '2026-02-15');
                result.current.handleFieldChange('notes', '');
            });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            const [{data}] = mockMutate.mock.calls[0] as [{data: {notes: string | null}}];
            expect(data.notes).toBeNull();
        });

        it('passes non-empty notes through to the payload', () => {
            const mockMutate = vi.fn();
            mockCreate.mockReturnValue(makeCreate(mockMutate));
            const {result} = setupHook();
            act(() => {
                result.current.handleFieldChange('amount', '10');
                result.current.handleFieldChange('description', 'Item');
                result.current.handleFieldChange('date', '2026-02-15');
                result.current.handleFieldChange('notes', 'A note');
            });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            const [{data}] = mockMutate.mock.calls[0] as [{data: {notes: string | null}}];
            expect(data.notes).toBe('A note');
        });

        it('sends non-empty categoryId and accountId in the payload', () => {
            const mockMutate = vi.fn();
            mockCreate.mockReturnValue(makeCreate(mockMutate));
            const {result} = setupHook();
            act(() => {
                result.current.handleFieldChange('amount', '10');
                result.current.handleFieldChange('description', 'Item');
                result.current.handleFieldChange('date', '2026-02-15');
                result.current.handleFieldChange('categoryId', 'cat-1');
                result.current.handleFieldChange('accountId', 'acc-1');
            });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(mockMutate).toHaveBeenCalledWith(
                {data: expect.objectContaining(
                    {categoryId: 'cat-1', accountId: 'acc-1'}
                )},
                {onSuccess: expect.any(Function)}
            );
        });

        it('calls onSuccess after the mutation succeeds', () => {
            const onSuccess = vi.fn();
            type MutateArgs = [unknown, {onSuccess: () => void}];
            const mockMutate = vi.fn((...[, {onSuccess: cb}]: MutateArgs) => { cb(); });
            mockCreate.mockReturnValue(makeCreate(mockMutate));
            const {result} = setupHook(onSuccess);
            act(() => {
                result.current.handleFieldChange('amount', '10');
                result.current.handleFieldChange('description', 'Item');
                result.current.handleFieldChange('date', '2026-02-15');
            });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(onSuccess).toHaveBeenCalledOnce();
        });
    });

    describe('handleSubmit – update', () => {
        it('calls updateTransaction (not createTransaction) in edit mode', () => {
            const mockCreateMutate = vi.fn();
            const mockUpdateMutate = vi.fn();
            mockCreate.mockReturnValue(makeCreate(mockCreateMutate));
            mockUpdate.mockReturnValue(makeUpdate(mockUpdateMutate));

            const {result} = setupHook();
            act(() => { result.current.openEdit(mockTx); });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(mockUpdateMutate).toHaveBeenCalledWith(
                {id: 'tx-1', data: expect.objectContaining({amount: 99.99})},
                {onSuccess: expect.any(Function)}
            );
            expect(mockCreateMutate).not.toHaveBeenCalled();
        });

        it('calls onSuccess after successful update', () => {
            const onSuccess = vi.fn();
            type MutateArgs = [unknown, {onSuccess: () => void}];
            const mockUpdateMutate = vi.fn((...[, {onSuccess: cb}]: MutateArgs) => { cb(); });
            mockUpdate.mockReturnValue(makeUpdate(mockUpdateMutate));

            const {result} = setupHook(onSuccess);
            act(() => { result.current.openEdit(mockTx); });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(onSuccess).toHaveBeenCalledOnce();
        });
    });

    describe('isSubmitting', () => {
        it('is true when createTransaction is pending', () => {
            mockCreate.mockReturnValue(makeCreate(vi.fn(), true));
            const {result} = setupHook();
            expect(result.current.isSubmitting).toBe(true);
        });

        it('is true when updateTransaction is pending', () => {
            mockUpdate.mockReturnValue(makeUpdate(vi.fn(), true));
            const {result} = setupHook();
            expect(result.current.isSubmitting).toBe(true);
        });

        it('is false when neither mutation is pending', () => {
            const {result} = setupHook();
            expect(result.current.isSubmitting).toBe(false);
        });
    });

    describe('custom queryKey', () => {
        it('uses provided queryKey when invalidating after successful create', () => {
            const onSuccess = vi.fn();
            type MutateArgs = [unknown, {onSuccess: () => void}];
            const mockMutate = vi.fn((...[, {onSuccess: cb}]: MutateArgs) => { cb(); });
            mockCreate.mockReturnValue(makeCreate(mockMutate));

            // Expose the QueryClient so we can spy on it
            const qc = new QueryClient({defaultOptions: {queries: {retry: false}}});
            const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
            const wrapper = ({children}: {children: React.ReactNode}): React.JSX.Element =>
                React.createElement(QueryClientProvider, {client: qc}, children);

            const {result} = renderHook(
                () => useTransactionForm({onSuccess, queryKey: ['custom-key']}),
                {wrapper}
            );
            act(() => {
                result.current.handleFieldChange('amount', '10');
                result.current.handleFieldChange('description', 'Item');
                result.current.handleFieldChange('date', '2026-02-15');
            });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(invalidateSpy).toHaveBeenCalledWith(
                expect.objectContaining({queryKey: ['custom-key']})
            );
            expect(onSuccess).toHaveBeenCalledOnce();
        });
    });

    describe('totals query invalidation (BUG-03)', () => {
        it('always invalidates the totals query key after a successful create', () => {
            const onSuccess = vi.fn();
            type MutateArgs = [unknown, {onSuccess: () => void}];
            const mockMutate = vi.fn((...[, {onSuccess: cb}]: MutateArgs) => { cb(); });
            mockCreate.mockReturnValue(makeCreate(mockMutate));

            const qc = new QueryClient({defaultOptions: {queries: {retry: false}}});
            const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
            const wrapper = ({children}: {children: React.ReactNode}): React.JSX.Element =>
                React.createElement(QueryClientProvider, {client: qc}, children);

            const {result} = renderHook(
                () => useTransactionForm({onSuccess}),
                {wrapper}
            );
            act(() => {
                result.current.handleFieldChange('amount', '15');
                result.current.handleFieldChange('description', 'Coffee');
                result.current.handleFieldChange('date', '2026-02-15');
            });
            act(() => { result.current.handleSubmit(fakeEvent()); });

            const totalsKey = vi.mocked(getTransactionsControllerGetTotalsQueryKey)();
            expect(invalidateSpy).toHaveBeenCalledWith(
                expect.objectContaining({queryKey: totalsKey})
            );
        });

        it('always invalidates the totals query key after a successful update', () => {
            const onSuccess = vi.fn();
            type MutateArgs = [unknown, {onSuccess: () => void}];
            const mockUpdateMutate = vi.fn((...[, {onSuccess: cb}]: MutateArgs) => { cb(); });
            mockUpdate.mockReturnValue(makeUpdate(mockUpdateMutate));

            const qc = new QueryClient({defaultOptions: {queries: {retry: false}}});
            const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
            const wrapper = ({children}: {children: React.ReactNode}): React.JSX.Element =>
                React.createElement(QueryClientProvider, {client: qc}, children);

            const {result} = renderHook(
                () => useTransactionForm({onSuccess}),
                {wrapper}
            );
            act(() => { result.current.openEdit(mockTx); });
            act(() => { result.current.handleSubmit(fakeEvent()); });

            const totalsKey = vi.mocked(getTransactionsControllerGetTotalsQueryKey)();
            expect(invalidateSpy).toHaveBeenCalledWith(
                expect.objectContaining({queryKey: totalsKey})
            );
        });
    });
});