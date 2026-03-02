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
import {useAccountForm} from '@features/accounts/hooks/useAccountForm.js';
import type {AccountResponseDto} from '@/api/model/accountResponseDto.js';
import {CreateAccountDtoType} from '@/api/model/createAccountDtoType.js';

// Mock Orval-generated hooks
vi.mock('@/api/accounts/accounts.js', () => ({
    useAccountsControllerCreate: vi.fn(),
    useAccountsControllerUpdate: vi.fn(),
    useAccountsControllerRemove: vi.fn(),
    getAccountsControllerFindAllQueryKey: vi.fn(() => ['/accounts'])
}));

import {
    useAccountsControllerCreate,
    useAccountsControllerUpdate,
    useAccountsControllerRemove
} from '@/api/accounts/accounts.js';

const mockCreate = vi.mocked(useAccountsControllerCreate);
const mockUpdate = vi.mocked(useAccountsControllerUpdate);
const mockRemove = vi.mocked(useAccountsControllerRemove);

type CreateReturn = ReturnType<typeof useAccountsControllerCreate>;
type UpdateReturn = ReturnType<typeof useAccountsControllerUpdate>;
type RemoveReturn = ReturnType<typeof useAccountsControllerRemove>;

const makeCreate = (mutate = vi.fn(), isPending = false): CreateReturn =>
    ({mutate, isPending}) as unknown as CreateReturn;

const makeUpdate = (mutate = vi.fn(), isPending = false): UpdateReturn =>
    ({mutate, isPending}) as unknown as UpdateReturn;

const makeRemove = (mutate = vi.fn(), isPending = false): RemoveReturn =>
    ({mutate, isPending}) as unknown as RemoveReturn;

const createWrapper = (): (({children}: {children: React.ReactNode}) => React.JSX.Element) => {
    const qc = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return ({children}: {children: React.ReactNode}) =>
        React.createElement(QueryClientProvider, {client: qc}, children);
};

const fakeEvent = (): React.FormEvent =>
    ({preventDefault: vi.fn()}) as unknown as React.FormEvent;

const mockAccount: AccountResponseDto = {
    id: 'acct-1',
    userId: 'user-1',
    name: 'Savings',
    type: CreateAccountDtoType.savings,
    institution: 'TD Bank',
    currency: 'CAD',
    openingBalance: 0,
    currentBalance: 2500,
    transactionCount: 12,
    color: '#22c55e',
    notes: 'Main savings',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
};

describe('useAccountForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCreate.mockReturnValue(makeCreate());
        mockUpdate.mockReturnValue(makeUpdate());
        mockRemove.mockReturnValue(makeRemove());
    });

    describe('initial state', () => {
        it('starts with modalMode null', () => {
            const {result} = renderHook(() => useAccountForm(), {wrapper: createWrapper()});
            expect(result.current.modalMode).toBeNull();
        });

        it('starts with empty form values', () => {
            const {result} = renderHook(() => useAccountForm(), {wrapper: createWrapper()});
            expect(result.current.formValues.name).toBe('');
            expect(result.current.formValues.currency).toBe('CAD');
        });

        it('openingBalance defaults to empty string (not "0")', () => {
            const {result} = renderHook(() => useAccountForm(), {wrapper: createWrapper()});
            expect(result.current.formValues.openingBalance).toBe('');
        });

        it('openingBalance is still empty string after openCreate', () => {
            const {result} = renderHook(() => useAccountForm(), {wrapper: createWrapper()});
            act(() => { result.current.handleFieldChange('openingBalance', '500'); });
            act(() => { result.current.openCreate(); });
            expect(result.current.formValues.openingBalance).toBe('');
        });

        it('starts with no errors', () => {
            const {result} = renderHook(() => useAccountForm(), {wrapper: createWrapper()});
            expect(result.current.errors).toEqual({});
        });

        it('starts with editTarget null', () => {
            const {result} = renderHook(() => useAccountForm(), {wrapper: createWrapper()});
            expect(result.current.editTarget).toBeNull();
        });

        it('isSubmitting is false initially', () => {
            const {result} = renderHook(() => useAccountForm(), {wrapper: createWrapper()});
            expect(result.current.isSubmitting).toBe(false);
        });
    });

    describe('openCreate', () => {
        it('sets modalMode to "create"', () => {
            const {result} = renderHook(() => useAccountForm(), {wrapper: createWrapper()});
            act(() => { result.current.openCreate(); });
            expect(result.current.modalMode).toBe('create');
        });

        it('resets form values to defaults', () => {
            const {result} = renderHook(() => useAccountForm(), {wrapper: createWrapper()});
            act(() => { result.current.handleFieldChange('name', 'Test'); });
            act(() => { result.current.openCreate(); });
            expect(result.current.formValues.name).toBe('');
        });

        it('clears errors', () => {
            const {result} = renderHook(() => useAccountForm(), {wrapper: createWrapper()});
            // Force a validation error by submitting empty form
            act(() => { result.current.openCreate(); });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.name).toBeTruthy();
            act(() => { result.current.openCreate(); });
            expect(result.current.errors).toEqual({});
        });
    });

    describe('openEdit', () => {
        it('sets modalMode to "edit"', () => {
            const {result} = renderHook(() => useAccountForm(), {wrapper: createWrapper()});
            act(() => { result.current.openEdit(mockAccount); });
            expect(result.current.modalMode).toBe('edit');
        });

        it('populates form values from the account', () => {
            const {result} = renderHook(() => useAccountForm(), {wrapper: createWrapper()});
            act(() => { result.current.openEdit(mockAccount); });
            expect(result.current.formValues.name).toBe('Savings');
            expect(result.current.formValues.institution).toBe('TD Bank');
            expect(result.current.formValues.color).toBe('#22c55e');
        });

        it('sets editTarget to the account', () => {
            const {result} = renderHook(() => useAccountForm(), {wrapper: createWrapper()});
            act(() => { result.current.openEdit(mockAccount); });
            expect(result.current.editTarget).toBe(mockAccount);
        });

        it('maps null institution to empty string', () => {
            const {result} = renderHook(() => useAccountForm(), {wrapper: createWrapper()});
            act(() => { result.current.openEdit({...mockAccount, institution: null}); });
            expect(result.current.formValues.institution).toBe('');
        });
    });

    describe('closeModal', () => {
        it('sets modalMode to null', () => {
            const {result} = renderHook(() => useAccountForm(), {wrapper: createWrapper()});
            act(() => { result.current.openCreate(); });
            act(() => { result.current.closeModal(); });
            expect(result.current.modalMode).toBeNull();
        });
    });

    describe('handleFieldChange', () => {
        it('updates the specified field', () => {
            const {result} = renderHook(() => useAccountForm(), {wrapper: createWrapper()});
            act(() => { result.current.handleFieldChange('name', 'My Account'); });
            expect(result.current.formValues.name).toBe('My Account');
        });

        it('clears the field error when value changes', () => {
            const {result} = renderHook(() => useAccountForm(), {wrapper: createWrapper()});
            act(() => { result.current.openCreate(); });
            // Trigger name error
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.name).toBeTruthy();
            // Clear it by typing
            act(() => { result.current.handleFieldChange('name', 'Fixed'); });
            expect(result.current.errors.name).toBeUndefined();
        });

        it('handles boolean values for isActive', () => {
            const {result} = renderHook(() => useAccountForm(), {wrapper: createWrapper()});
            act(() => { result.current.openEdit(mockAccount); });
            act(() => { result.current.handleFieldChange('isActive', false); });
            expect(result.current.formValues.isActive).toBe(false);
        });
    });

    describe('handleSubmit — validation', () => {
        it('sets name error when name is empty', () => {
            const {result} = renderHook(() => useAccountForm(), {wrapper: createWrapper()});
            act(() => { result.current.openCreate(); });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.name).toMatch(/required/i);
        });

        it('does not call create when validation fails', () => {
            const mutateFn = vi.fn();
            mockCreate.mockReturnValue(makeCreate(mutateFn));
            const {result} = renderHook(() => useAccountForm(), {wrapper: createWrapper()});
            act(() => { result.current.openCreate(); });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(mutateFn).not.toHaveBeenCalled();
        });

        it('sets currency error for invalid currency code', () => {
            const {result} = renderHook(() => useAccountForm(), {wrapper: createWrapper()});
            act(() => { result.current.openCreate(); });
            act(() => { result.current.handleFieldChange('name', 'My Account'); });
            act(() => { result.current.handleFieldChange('currency', 'ca'); });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.currency).toBeTruthy();
        });

        it('sets color error for invalid hex color', () => {
            const {result} = renderHook(() => useAccountForm(), {wrapper: createWrapper()});
            act(() => { result.current.openCreate(); });
            act(() => { result.current.handleFieldChange('name', 'My Account'); });
            act(() => { result.current.handleFieldChange('color', 'notahex'); });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.color).toBeTruthy();
        });
    });

    describe('handleSubmit — create', () => {
        it('calls create.mutate with form data on valid submit', () => {
            const mutateFn = vi.fn();
            mockCreate.mockReturnValue(makeCreate(mutateFn));
            const {result} = renderHook(() => useAccountForm(), {wrapper: createWrapper()});
            act(() => { result.current.openCreate(); });
            act(() => { result.current.handleFieldChange('name', 'New Checking'); });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(mutateFn).toHaveBeenCalledOnce();
            const [callArg] = mutateFn.mock.calls[0] as [{data: {name: string}}];
            expect(callArg.data.name).toBe('New Checking');
        });

        it('calls onSuccess callback when create succeeds', () => {
            const onSuccess = vi.fn();
            const mutateFn = vi.fn(
                (_args: unknown, {onSuccess: cb}: {onSuccess: () => void}) => { cb(); }
            );
            mockCreate.mockReturnValue(makeCreate(mutateFn));
            const {result} = renderHook(
                () => useAccountForm({onSuccess}),
                {wrapper: createWrapper()}
            );
            act(() => { result.current.openCreate(); });
            act(() => { result.current.handleFieldChange('name', 'Savings'); });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(onSuccess).toHaveBeenCalledOnce();
        });

        it('sets modal mode to null when create succeeds', () => {
            const mutateFn = vi.fn(
                (_args: unknown, {onSuccess: cb}: {onSuccess: () => void}) => { cb(); }
            );
            mockCreate.mockReturnValue(makeCreate(mutateFn));
            const {result} = renderHook(() => useAccountForm(), {wrapper: createWrapper()});
            act(() => { result.current.openCreate(); });
            act(() => { result.current.handleFieldChange('name', 'Savings'); });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.modalMode).toBeNull();
        });

        it('sets name error when create fails', () => {
            const mutateFn = vi.fn(
                (_args: unknown, {onError: cb}: {onError: (e: unknown) => void}) => {
                    cb(new Error('Server error'));
                }
            );
            mockCreate.mockReturnValue(makeCreate(mutateFn));
            const {result} = renderHook(() => useAccountForm(), {wrapper: createWrapper()});
            act(() => { result.current.openCreate(); });
            act(() => { result.current.handleFieldChange('name', 'Account'); });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.name).toBe('Server error');
        });
    });

    describe('handleSubmit — update', () => {
        it('calls update.mutate when editTarget is set', () => {
            const mutateFn = vi.fn();
            mockUpdate.mockReturnValue(makeUpdate(mutateFn));
            const {result} = renderHook(() => useAccountForm(), {wrapper: createWrapper()});
            act(() => { result.current.openEdit(mockAccount); });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(mutateFn).toHaveBeenCalledOnce();
        });

        it('passes account id to update call', () => {
            const mutateFn = vi.fn();
            mockUpdate.mockReturnValue(makeUpdate(mutateFn));
            const {result} = renderHook(() => useAccountForm(), {wrapper: createWrapper()});
            act(() => { result.current.openEdit(mockAccount); });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            const [callArg] = mutateFn.mock.calls[0] as [{id: string}];
            expect(callArg.id).toBe('acct-1');
        });
    });

    describe('handleDelete', () => {
        it('calls remove.mutate with the account id', () => {
            const mutateFn = vi.fn();
            mockRemove.mockReturnValue(makeRemove(mutateFn));
            const {result} = renderHook(() => useAccountForm(), {wrapper: createWrapper()});
            act(() => { result.current.handleDelete('acct-1'); });
            expect(mutateFn).toHaveBeenCalledOnce();
            const [callArg] = mutateFn.mock.calls[0] as [{id: string}];
            expect(callArg.id).toBe('acct-1');
        });

        it('isDeleting reflects remove pending state', () => {
            mockRemove.mockReturnValue(makeRemove(vi.fn(), true));
            const {result} = renderHook(() => useAccountForm(), {wrapper: createWrapper()});
            expect(result.current.isDeleting).toBe(true);
        });
    });
});
