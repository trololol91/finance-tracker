import {
    describe, it, expect, vi, beforeEach, afterEach
} from 'vitest';
import {
    renderHook, act
} from '@testing-library/react';
import {
    QueryClient, QueryClientProvider
} from '@tanstack/react-query';
import React from 'react';
import {useCategoryForm} from '@features/categories/hooks/useCategoryForm.js';
import type {CategoryResponseDto} from '@/api/model/categoryResponseDto.js';

// Mock Orval mutation hooks
vi.mock('@/api/categories/categories.js', () => ({
    useCategoriesControllerCreate: vi.fn(),
    useCategoriesControllerUpdate: vi.fn(),
    getCategoriesControllerFindAllQueryKey: vi.fn(() => ['/categories'])
}));

// Imported after vi.mock — Vitest hoists the mock call above all imports at runtime
import {
    useCategoriesControllerCreate,
    useCategoriesControllerUpdate
} from '@/api/categories/categories.js';

const mockCreate = vi.mocked(useCategoriesControllerCreate);
const mockUpdate = vi.mocked(useCategoriesControllerUpdate);

// Shared arg types for testing mutation callbacks
type OnSuccessArgs = [unknown, {onSuccess: () => void}];
type OnErrorArgs = [unknown, {onError: (err: unknown) => void}];

const createWrapper = (): (({children}: {children: React.ReactNode}) => React.JSX.Element) => {
    const qc = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return ({children}: {children: React.ReactNode}) =>
        React.createElement(QueryClientProvider, {client: qc}, children);
};

type CreateReturn = ReturnType<typeof useCategoriesControllerCreate>;
type UpdateReturn = ReturnType<typeof useCategoriesControllerUpdate>;

const fakeEvent = (): React.FormEvent =>
    ({preventDefault: vi.fn()}) as unknown as React.FormEvent;

const makeCreate = (mutate = vi.fn(), isPending = false): CreateReturn =>
    ({mutate, isPending}) as CreateReturn;

const makeUpdate = (mutate = vi.fn(), isPending = false): UpdateReturn =>
    ({mutate, isPending}) as UpdateReturn;

type HookReturn = ReturnType<typeof useCategoryForm>;
type RenderedHook = ReturnType<typeof renderHook<HookReturn, unknown>>;

const setupHook = (onSuccess = vi.fn()): RenderedHook =>
    renderHook(() => useCategoryForm({onSuccess}), {wrapper: createWrapper()});

const mockCat: CategoryResponseDto = {
    id: 'cat-1',
    userId: 'user-1',
    name: 'Groceries',
    description: 'Food and drink',
    color: '#22c55e',
    icon: '🛒',
    parentId: null,
    isActive: true,
    transactionCount: 5,
    children: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
};

describe('useCategoryForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCreate.mockReturnValue(makeCreate());
        mockUpdate.mockReturnValue(makeUpdate());
    });

    describe('initial state', () => {
        it('has empty form values', () => {
            const {result} = setupHook();
            expect(result.current.formValues.name).toBe('');
            expect(result.current.formValues.description).toBe('');
            expect(result.current.formValues.color).toBe('');
            expect(result.current.formValues.icon).toBe('');
            expect(result.current.formValues.parentId).toBe('');
        });

        it('has no editTarget', () => {
            const {result} = setupHook();
            expect(result.current.editTarget).toBeNull();
        });

        it('is not submitting', () => {
            const {result} = setupHook();
            expect(result.current.isSubmitting).toBe(false);
        });

        it('has no errors', () => {
            const {result} = setupHook();
            expect(result.current.errors).toEqual({});
        });
    });

    describe('openCreate', () => {
        it('clears the form and editTarget', () => {
            const {result} = setupHook();
            act(() => { result.current.openEdit(mockCat); });
            act(() => { result.current.openCreate(); });
            expect(result.current.editTarget).toBeNull();
            expect(result.current.formValues.name).toBe('');
        });
    });

    describe('openEdit', () => {
        it('sets editTarget and populates form with category data', () => {
            const {result} = setupHook();
            act(() => { result.current.openEdit(mockCat); });
            expect(result.current.editTarget).toBe(mockCat);
            expect(result.current.formValues.name).toBe('Groceries');
            expect(result.current.formValues.description).toBe('Food and drink');
            expect(result.current.formValues.color).toBe('#22c55e');
            expect(result.current.formValues.icon).toBe('🛒');
            expect(result.current.formValues.parentId).toBe('');
        });

        it('maps null fields to empty strings', () => {
            const {result} = setupHook();
            const catWithNulls: CategoryResponseDto = {
                ...mockCat, description: null, color: null, icon: null, parentId: null
            };
            act(() => { result.current.openEdit(catWithNulls); });
            expect(result.current.formValues.description).toBe('');
            expect(result.current.formValues.color).toBe('');
            expect(result.current.formValues.icon).toBe('');
            expect(result.current.formValues.parentId).toBe('');
        });

        it('clears errors when opening edit', () => {
            const {result} = setupHook();
            // Trigger validation error first by submitting empty form
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.name).toBeDefined();
            act(() => { result.current.openEdit(mockCat); });
            expect(result.current.errors).toEqual({});
        });
    });

    describe('handleFieldChange', () => {
        it('updates the specified field', () => {
            const {result} = setupHook();
            act(() => { result.current.handleFieldChange('name', 'Transport'); });
            expect(result.current.formValues.name).toBe('Transport');
        });

        it('clears the error for the field when it changes', () => {
            const {result} = setupHook();
            // cause a validation error
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.name).toBeDefined();
            act(() => { result.current.handleFieldChange('name', 'Something'); });
            expect(result.current.errors.name).toBeUndefined();
        });
    });

    describe('validation', () => {
        it('sets name error when name is empty on submit', () => {
            const {result} = setupHook();
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.name).toBe('Name is required');
        });

        it('sets name error when name exceeds 100 characters', () => {
            const {result} = setupHook();
            act(() => { result.current.handleFieldChange('name', 'x'.repeat(101)); });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.name).toBe('Name must be 100 characters or fewer');
        });

        it('sets description error when description exceeds 255 characters', () => {
            const {result} = setupHook();
            act(() => {
                result.current.handleFieldChange('name', 'Valid');
                result.current.handleFieldChange('description', 'd'.repeat(256));
            });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.description).toBeDefined();
        });

        it('sets color error for invalid hex code', () => {
            const {result} = setupHook();
            act(() => {
                result.current.handleFieldChange('name', 'Valid');
                result.current.handleFieldChange('color', 'notahex');
            });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.color).toBeDefined();
        });

        it('accepts a valid hex color', () => {
            const mockMutate = vi.fn();
            mockCreate.mockReturnValue(makeCreate(mockMutate));
            const {result} = setupHook();
            act(() => {
                result.current.handleFieldChange('name', 'Valid');
                result.current.handleFieldChange('color', '#22c55e');
            });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.color).toBeUndefined();
            expect(mockMutate).toHaveBeenCalled();
        });

        it('accepts an empty color (optional field)', () => {
            const mockMutate = vi.fn();
            mockCreate.mockReturnValue(makeCreate(mockMutate));
            const {result} = setupHook();
            act(() => { result.current.handleFieldChange('name', 'Valid'); });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.color).toBeUndefined();
            expect(mockMutate).toHaveBeenCalled();
        });

        it('sets icon error when icon exceeds 10 characters', () => {
            const {result} = setupHook();
            act(() => {
                result.current.handleFieldChange('name', 'Valid');
                result.current.handleFieldChange('icon', 'x'.repeat(11));
            });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.icon).toBeDefined();
        });

        it('does not call create when validation fails', () => {
            const mockMutate = vi.fn();
            mockCreate.mockReturnValue(makeCreate(mockMutate));
            const {result} = setupHook();
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(mockMutate).not.toHaveBeenCalled();
        });
    });

    describe('handleSubmit – create', () => {
        it('calls createCategory with name and null for empty optional fields', () => {
            const mockMutate = vi.fn();
            mockCreate.mockReturnValue(makeCreate(mockMutate));
            const {result} = setupHook();
            act(() => { result.current.handleFieldChange('name', 'Groceries'); });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(mockMutate).toHaveBeenCalledWith(
                {data: expect.objectContaining({
                    name: 'Groceries',
                    description: null,
                    color: null,
                    icon: null,
                    parentId: null
                })},
                expect.objectContaining({
                    onSuccess: expect.any(Function), onError: expect.any(Function)
                })
            );
        });

        it('sends supplied optional fields through to the dto', () => {
            const mockMutate = vi.fn();
            mockCreate.mockReturnValue(makeCreate(mockMutate));
            const {result} = setupHook();
            act(() => {
                result.current.handleFieldChange('name', 'Groceries');
                result.current.handleFieldChange('color', '#22c55e');
                result.current.handleFieldChange('icon', '🛒');
                result.current.handleFieldChange('description', 'Food stuff');
            });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(mockMutate).toHaveBeenCalledWith(
                {data: expect.objectContaining({
                    name: 'Groceries',
                    color: '#22c55e',
                    icon: '🛒',
                    description: 'Food stuff'
                })},
                expect.any(Object)
            );
        });

        it('calls onSuccess after create succeeds', () => {
            const onSuccess = vi.fn();
            const mockMutate = vi.fn((...[, {onSuccess: cb}]: OnSuccessArgs) => { cb(); });
            mockCreate.mockReturnValue(makeCreate(mockMutate));
            const {result} = setupHook(onSuccess);
            act(() => { result.current.handleFieldChange('name', 'Groceries'); });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(onSuccess).toHaveBeenCalledOnce();
        });
    });

    describe('handleSubmit – update', () => {
        it('calls updateCategory (not create) in edit mode', () => {
            const mockCreateMutate = vi.fn();
            const mockUpdateMutate = vi.fn();
            mockCreate.mockReturnValue(makeCreate(mockCreateMutate));
            mockUpdate.mockReturnValue(makeUpdate(mockUpdateMutate));
            const {result} = setupHook();
            act(() => { result.current.openEdit(mockCat); });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(mockUpdateMutate).toHaveBeenCalledWith(
                {id: 'cat-1', data: expect.objectContaining({name: 'Groceries'})},
                expect.objectContaining({
                    onSuccess: expect.any(Function), onError: expect.any(Function)
                })
            );
            expect(mockCreateMutate).not.toHaveBeenCalled();
        });

        it('calls onSuccess after update succeeds', () => {
            const onSuccess = vi.fn();
            const mockUpdateMutate = vi.fn((...[, {onSuccess: cb}]: OnSuccessArgs) => { cb(); });
            mockUpdate.mockReturnValue(makeUpdate(mockUpdateMutate));
            const {result} = setupHook(onSuccess);
            act(() => { result.current.openEdit(mockCat); });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(onSuccess).toHaveBeenCalledOnce();
        });
    });

    describe('isSubmitting', () => {
        it('is true when create is pending', () => {
            mockCreate.mockReturnValue(makeCreate(vi.fn(), true));
            const {result} = setupHook();
            expect(result.current.isSubmitting).toBe(true);
        });

        it('is true when update is pending', () => {
            mockUpdate.mockReturnValue(makeUpdate(vi.fn(), true));
            const {result} = setupHook();
            expect(result.current.isSubmitting).toBe(true);
        });

        it('is false when neither is pending', () => {
            const {result} = setupHook();
            expect(result.current.isSubmitting).toBe(false);
        });
    });

    describe('handleSubmit – onError (create)', () => {
        beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
        afterEach(() => { vi.restoreAllMocks(); });

        it('sets errors.name to the server message when create fails with a message', () => {
            const mockMutate = vi.fn((...[, {onError: cb}]: OnErrorArgs) => {
                cb({message: 'Duplicate name'});
            });
            mockCreate.mockReturnValue(makeCreate(mockMutate));
            const {result} = setupHook();
            act(() => { result.current.handleFieldChange('name', 'Groceries'); });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.name).toBe('Duplicate name');
        });

        it('sets a fallback error message when create fails with no message property', () => {
            const mockMutate = vi.fn((...[, {onError: cb}]: OnErrorArgs) => { cb({}); });
            mockCreate.mockReturnValue(makeCreate(mockMutate));
            const {result} = setupHook();
            act(() => { result.current.handleFieldChange('name', 'Groceries'); });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.name).toBe('Failed to create category');
        });
    });

    describe('handleSubmit – onError (update)', () => {
        beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
        afterEach(() => { vi.restoreAllMocks(); });

        it('sets errors.name to the server message when update fails with a message', () => {
            const mockUpdateMutate = vi.fn((...[, {onError: cb}]: OnErrorArgs) => {
                cb({message: 'Name already taken'});
            });
            mockUpdate.mockReturnValue(makeUpdate(mockUpdateMutate));
            const {result} = setupHook();
            act(() => { result.current.openEdit(mockCat); });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.name).toBe('Name already taken');
        });

        it('sets a fallback error message when update fails with no message property', () => {
            const mockUpdateMutate = vi.fn((...[, {onError: cb}]: OnErrorArgs) => { cb({}); });
            mockUpdate.mockReturnValue(makeUpdate(mockUpdateMutate));
            const {result} = setupHook();
            act(() => { result.current.openEdit(mockCat); });
            act(() => { result.current.handleSubmit(fakeEvent()); });
            expect(result.current.errors.name).toBe('Failed to update category');
        });
    });
});
