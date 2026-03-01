import {
    describe, it, expect, vi, beforeEach
} from 'vitest';
import {
    render, screen, act
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
    QueryClient, QueryClientProvider
} from '@tanstack/react-query';
import React from 'react';
import CategoriesPage from '@pages/CategoriesPage.js';
import type {CategoryResponseDto} from '@/api/model/categoryResponseDto.js';

// ---------------------------------------------------------------------------
// Component stubs
// ---------------------------------------------------------------------------

vi.mock('@features/categories/components/CategoryList.js', () => ({
    CategoryList: ({
        categories,
        isLoading,
        isError,
        showInactive,
        onEdit,
        onDelete,
        onToggleActive
    }: {
        categories: CategoryResponseDto[];
        isLoading: boolean;
        isError: boolean;
        showInactive: boolean;
        onEdit: (c: CategoryResponseDto) => void;
        onDelete: (id: string, name: string) => void;
        onToggleActive: (c: CategoryResponseDto) => void;
    }) => (
        <div data-testid="cat-list">
            {isLoading && <span data-testid="cat-loading" />}
            {isError && <span data-testid="cat-error" />}
            <span data-testid="show-inactive-state">
                {showInactive ? 'inactive-shown' : 'inactive-hidden'}
            </span>
            {categories.map((c) => (
                <div key={c.id}>
                    <button onClick={(): void => { onEdit(c); }}>Edit {c.id}</button>
                    <button onClick={(): void => { onDelete(c.id, c.name); }}>Delete {c.id}</button>
                    <button onClick={(): void => { onToggleActive(c); }}>Toggle {c.id}</button>
                </div>
            ))}
        </div>
    )
}));

vi.mock('@features/categories/components/CategoryModal.js', () => ({
    CategoryModal: ({
        mode,
        parentOptions,
        onClose
    }: {
        mode: string | null;
        parentOptions: CategoryResponseDto[];
        onClose: () => void;
        values: unknown;
        errors: unknown;
        isSubmitting: boolean;
        onChange: unknown;
        onSubmit: unknown;
    }) =>
        mode !== null ? (
            <dialog data-testid="cat-modal" open>
                <span data-testid="modal-mode">{mode}</span>
                <span data-testid="parent-options-count">{parentOptions.length}</span>
                <button onClick={onClose}>Close modal</button>
            </dialog>
        ) : null
}));

// ---------------------------------------------------------------------------
// Hook stubs
// ---------------------------------------------------------------------------

const mockOpenCreate = vi.fn();
const mockOpenEdit = vi.fn();
const mockHandleFieldChange = vi.fn();
const mockHandleSubmit = vi.fn();

vi.mock('@features/categories/hooks/useCategoryForm.js', () => ({
    useCategoryForm: vi.fn()
}));

import {useCategoryForm} from '@features/categories/hooks/useCategoryForm.js';
const mockUseCategoryForm = vi.mocked(useCategoryForm);

// ---------------------------------------------------------------------------
// API mocks
// ---------------------------------------------------------------------------

const mockUpdateMutate = vi.fn();
const mockDeleteMutate = vi.fn();

vi.mock('@/api/categories/categories.js', () => ({
    useCategoriesControllerFindAll: vi.fn(),
    useCategoriesControllerUpdate: vi.fn(),
    useCategoriesControllerRemove: vi.fn(),
    getCategoriesControllerFindAllQueryKey: vi.fn(() => ['/categories'])
}));

import {
    useCategoriesControllerFindAll,
    useCategoriesControllerUpdate,
    useCategoriesControllerRemove
} from '@/api/categories/categories.js';

const mockFindAll = vi.mocked(useCategoriesControllerFindAll);
const mockUpdate = vi.mocked(useCategoriesControllerUpdate);
const mockRemove = vi.mocked(useCategoriesControllerRemove);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type FindAllReturn = ReturnType<typeof useCategoriesControllerFindAll>;
type UpdateReturn = ReturnType<typeof useCategoriesControllerUpdate>;
type RemoveReturn = ReturnType<typeof useCategoriesControllerRemove>;

const makeFindAll = (
    data?: CategoryResponseDto[],
    isLoading = false,
    isError = false
): FindAllReturn => ({data, isLoading, isError}) as FindAllReturn;

const makeUpdate = (): UpdateReturn => ({mutate: mockUpdateMutate}) as UpdateReturn;
const makeRemove = (): RemoveReturn => ({mutate: mockDeleteMutate}) as RemoveReturn;

const defaultFormValues = {
    name: '',
    description: '',
    color: '',
    icon: '',
    parentId: ''
};

const buildFormState = (editTarget: CategoryResponseDto | null = null) => ({
    formValues: defaultFormValues,
    errors: {},
    editTarget,
    isSubmitting: false,
    openCreate: mockOpenCreate,
    openEdit: mockOpenEdit,
    handleFieldChange: mockHandleFieldChange,
    handleSubmit: mockHandleSubmit
});

type UseCategoryFormReturn = ReturnType<typeof useCategoryForm>;

const mockCat = (overrides: Partial<CategoryResponseDto> = {}): CategoryResponseDto => ({
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
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
});

const createWrapper = (qc = new QueryClient({defaultOptions: {queries: {retry: false}}})) =>
    ({children}: {children: React.ReactNode}): React.JSX.Element =>
        React.createElement(QueryClientProvider, {client: qc}, children);

// Pass a specific QueryClient when you need to spy on it (e.g. invalidateQueries tests).
// Otherwise let renderPage create a fresh one automatically.
const renderPage = (qc?: QueryClient) =>
    render(<CategoriesPage />, {wrapper: createWrapper(qc)});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CategoriesPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFindAll.mockReturnValue(makeFindAll());
        mockUpdate.mockReturnValue(makeUpdate());
        mockRemove.mockReturnValue(makeRemove());
        mockUseCategoryForm.mockReturnValue(
            buildFormState() as UseCategoryFormReturn
        );
    });

    // -------------------------------------------------------------------------
    // Layout
    // -------------------------------------------------------------------------
    describe('layout', () => {
        it('renders "Categories" as the page heading', () => {
            renderPage();
            expect(screen.getByRole('heading', {name: 'Categories'})).toBeInTheDocument();
        });

        it('renders the "+ New Category" button', () => {
            renderPage();
            expect(
                screen.getByRole('button', {name: /create new category/i})
            ).toBeInTheDocument();
        });

        it('renders the category list container', () => {
            renderPage();
            expect(screen.getByTestId('cat-list')).toBeInTheDocument();
        });

        it('renders the "Show inactive" checkbox', () => {
            renderPage();
            expect(
                screen.getByRole('checkbox', {name: /show inactive categories/i})
            ).toBeInTheDocument();
        });

        it('does not render the modal when no action has been taken', () => {
            renderPage();
            expect(screen.queryByTestId('cat-modal')).not.toBeInTheDocument();
        });
    });

    // -------------------------------------------------------------------------
    // New category action
    // -------------------------------------------------------------------------
    describe('"+ New Category" button', () => {
        it('calls openCreate when button is clicked', async () => {
            const user = userEvent.setup();
            renderPage();
            await user.click(screen.getByRole('button', {name: /create new category/i}));
            expect(mockOpenCreate).toHaveBeenCalledOnce();
        });

        it('opens the modal in "create" mode', async () => {
            const user = userEvent.setup();
            renderPage();
            await user.click(screen.getByRole('button', {name: /create new category/i}));
            expect(screen.getByTestId('modal-mode')).toHaveTextContent('create');
        });
    });

    // -------------------------------------------------------------------------
    // Show inactive toggle
    // -------------------------------------------------------------------------
    describe('show inactive checkbox', () => {
        it('passes showInactive=false to CategoryList initially', () => {
            renderPage();
            expect(screen.getByTestId('show-inactive-state')).toHaveTextContent('inactive-hidden');
        });

        it('passes showInactive=true to CategoryList after checkbox is checked', async () => {
            const user = userEvent.setup();
            renderPage();
            const checkbox = screen.getByRole('checkbox', {name: /show inactive categories/i});
            await user.click(checkbox);
            expect(screen.getByTestId('show-inactive-state')).toHaveTextContent('inactive-shown');
        });

        it('toggles back to inactive-hidden when unchecked', async () => {
            const user = userEvent.setup();
            renderPage();
            const checkbox = screen.getByRole('checkbox', {name: /show inactive categories/i});
            await user.click(checkbox); // check
            await user.click(checkbox); // uncheck
            expect(screen.getByTestId('show-inactive-state')).toHaveTextContent('inactive-hidden');
        });
    });

    // -------------------------------------------------------------------------
    // Category data
    // -------------------------------------------------------------------------
    describe('category data', () => {
        it('passes an empty array to CategoryList when data is undefined', () => {
            mockFindAll.mockReturnValue(makeFindAll(undefined));
            renderPage();
            // The stub renders no edit buttons when the array is empty
            expect(screen.queryByRole('button', {name: /^edit cat-/i})).not.toBeInTheDocument();
        });

        it('passes categories returned by the API to CategoryList', () => {
            const cats = [mockCat(), mockCat({id: 'cat-2', name: 'Transport'})];
            mockFindAll.mockReturnValue(makeFindAll(cats));
            renderPage();
            expect(screen.getByRole('button', {name: /edit cat-1/i})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /edit cat-2/i})).toBeInTheDocument();
        });

        it('passes isLoading=true to CategoryList when query is loading', () => {
            mockFindAll.mockReturnValue(makeFindAll(undefined, true));
            renderPage();
            expect(screen.getByTestId('cat-loading')).toBeInTheDocument();
        });

        it('passes isError=true to CategoryList when query errors', () => {
            mockFindAll.mockReturnValue(makeFindAll(undefined, false, true));
            renderPage();
            expect(screen.getByTestId('cat-error')).toBeInTheDocument();
        });
    });

    // -------------------------------------------------------------------------
    // Edit flow
    // -------------------------------------------------------------------------
    describe('edit category', () => {
        it('calls openEdit with the category when the edit button is clicked', async () => {
            const cat = mockCat();
            mockFindAll.mockReturnValue(makeFindAll([cat]));
            const user = userEvent.setup();
            renderPage();
            await user.click(screen.getByRole('button', {name: /edit cat-1/i}));
            expect(mockOpenEdit).toHaveBeenCalledWith(cat);
        });

        it('opens modal in "edit" mode when the edit button is clicked', async () => {
            const cat = mockCat();
            mockFindAll.mockReturnValue(makeFindAll([cat]));
            const user = userEvent.setup();
            renderPage();
            await user.click(screen.getByRole('button', {name: /edit cat-1/i}));
            expect(screen.getByTestId('modal-mode')).toHaveTextContent('edit');
        });
    });

    // -------------------------------------------------------------------------
    // Modal close
    // -------------------------------------------------------------------------
    describe('modal close', () => {
        it('closes the modal when the close button is clicked', async () => {
            const user = userEvent.setup();
            renderPage();
            // Open modal first
            await user.click(screen.getByRole('button', {name: /create new category/i}));
            expect(screen.getByTestId('cat-modal')).toBeInTheDocument();
            // Close it
            await user.click(screen.getByRole('button', {name: /close modal/i}));
            expect(screen.queryByTestId('cat-modal')).not.toBeInTheDocument();
        });

        it('closes the modal when useCategoryForm onSuccess fires', async () => {
            // Capture the onSuccess callback that was passed to useCategoryForm
            let capturedOnSuccess!: () => void;
            mockUseCategoryForm.mockImplementation((({onSuccess}) => {
                capturedOnSuccess = onSuccess as () => void;
                return buildFormState() as UseCategoryFormReturn;
            }) as typeof useCategoryForm);

            const user = userEvent.setup();
            renderPage();

            // Open the modal
            await user.click(screen.getByRole('button', {name: /create new category/i}));
            expect(screen.getByTestId('cat-modal')).toBeInTheDocument();

            // Simulate form hook calling onSuccess (e.g. after save)
            act(() => { capturedOnSuccess(); });

            expect(screen.queryByTestId('cat-modal')).not.toBeInTheDocument();
        });
    });

    // -------------------------------------------------------------------------
    // Delete
    // -------------------------------------------------------------------------
    describe('delete category', () => {
        it('calls deleteCategory mutation with the category id', async () => {
            const cat = mockCat();
            mockFindAll.mockReturnValue(makeFindAll([cat]));
            const user = userEvent.setup();
            renderPage();
            await user.click(screen.getByRole('button', {name: /delete cat-1/i}));
            expect(mockDeleteMutate).toHaveBeenCalledWith(
                {id: 'cat-1'},
                expect.objectContaining({onSuccess: expect.any(Function)})
            );
        });

        it('calls invalidateQueries on successful delete', async () => {
            const cat = mockCat();
            mockFindAll.mockReturnValue(makeFindAll([cat]));

            type DeleteArgs = [
                {id: string},
                {onSuccess: () => void, onError: (e: unknown) => void}
            ];
            mockDeleteMutate.mockImplementationOnce(
                (...[, {onSuccess}]: DeleteArgs) => { onSuccess(); }
            );

            const qc = new QueryClient({defaultOptions: {queries: {retry: false}}});
            const spy = vi.spyOn(qc, 'invalidateQueries');
            const user = userEvent.setup();
            renderPage(qc);

            await user.click(screen.getByRole('button', {name: /delete cat-1/i}));
            expect(spy).toHaveBeenCalled();
        });

        it('logs an error when delete fails', async () => {
            const cat = mockCat();
            mockFindAll.mockReturnValue(makeFindAll([cat]));
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            type DeleteArgs = [
                {id: string},
                {onSuccess: () => void, onError: (e: unknown) => void}
            ];
            mockDeleteMutate.mockImplementationOnce(
                (...[, {onError: cb}]: DeleteArgs) => { cb(new Error('Server error')); }
            );

            const user = userEvent.setup();
            renderPage();
            await user.click(screen.getByRole('button', {name: /delete cat-1/i}));

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to delete category'),
                expect.anything()
            );
            consoleSpy.mockRestore();
        });
    });

    // -------------------------------------------------------------------------
    // Toggle active
    // -------------------------------------------------------------------------
    describe('toggle active', () => {
        it('calls updateCategory with the negated isActive flag (active → inactive)', async () => {
            const cat = mockCat({isActive: true});
            mockFindAll.mockReturnValue(makeFindAll([cat]));
            const user = userEvent.setup();
            renderPage();
            await user.click(screen.getByRole('button', {name: /toggle cat-1/i}));
            expect(mockUpdateMutate).toHaveBeenCalledWith(
                {id: 'cat-1', data: {isActive: false}},
                expect.objectContaining({onSuccess: expect.any(Function)})
            );
        });

        it('calls updateCategory with the negated isActive flag (inactive → active)', async () => {
            const cat = mockCat({isActive: false});
            mockFindAll.mockReturnValue(makeFindAll([cat]));
            const user = userEvent.setup();
            renderPage();
            await user.click(screen.getByRole('button', {name: /toggle cat-1/i}));
            expect(mockUpdateMutate).toHaveBeenCalledWith(
                {id: 'cat-1', data: {isActive: true}},
                expect.any(Object)
            );
        });

        it('calls invalidateQueries on successful toggle', async () => {
            const cat = mockCat();
            mockFindAll.mockReturnValue(makeFindAll([cat]));

            type UpdateArgs = [
                {id: string, data: {isActive: boolean}},
                {onSuccess: () => void, onError: (e: unknown) => void}
            ];
            mockUpdateMutate.mockImplementationOnce(
                (...[, {onSuccess}]: UpdateArgs) => { onSuccess(); }
            );

            const qc = new QueryClient({defaultOptions: {queries: {retry: false}}});
            const spy = vi.spyOn(qc, 'invalidateQueries');
            const user = userEvent.setup();
            renderPage(qc);

            await user.click(screen.getByRole('button', {name: /toggle cat-1/i}));
            expect(spy).toHaveBeenCalled();
        });

        it('logs an error when toggle active fails', async () => {
            const cat = mockCat();
            mockFindAll.mockReturnValue(makeFindAll([cat]));
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            type UpdateArgs = [
                {id: string, data: {isActive: boolean}},
                {onSuccess: () => void, onError: (e: unknown) => void}
            ];
            mockUpdateMutate.mockImplementationOnce(
                (...[, {onError: cb}]: UpdateArgs) => { cb(new Error('Network error')); }
            );

            const user = userEvent.setup();
            renderPage();
            await user.click(screen.getByRole('button', {name: /toggle cat-1/i}));

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to toggle active state'),
                expect.anything()
            );
            consoleSpy.mockRestore();
        });
    });

    // -------------------------------------------------------------------------
    // Parent options filtering
    // -------------------------------------------------------------------------
    describe('parent options passed to CategoryModal', () => {
        const openAndCheckModal = async (cats: CategoryResponseDto[]) => {
            mockFindAll.mockReturnValue(makeFindAll(cats));
            const user = userEvent.setup();
            renderPage();
            await user.click(screen.getByRole('button', {name: /create new category/i}));
        };

        it('includes top-level active categories as parent options', async () => {
            const cats = [
                mockCat({id: 'cat-1', parentId: null, isActive: true}),
                mockCat({id: 'cat-2', parentId: null, isActive: true, name: 'Transport'})
            ];
            await openAndCheckModal(cats);
            expect(screen.getByTestId('parent-options-count')).toHaveTextContent('2');
        });

        it('excludes sub-categories (parentId !== null) from parent options', async () => {
            const cats = [
                mockCat({id: 'cat-1', parentId: null, isActive: true}),
                mockCat({id: 'cat-2', parentId: 'cat-1', isActive: true, name: 'Sub'})
            ];
            await openAndCheckModal(cats);
            // Only cat-1 qualifies (cat-2 has parentId)
            expect(screen.getByTestId('parent-options-count')).toHaveTextContent('1');
        });

        it('excludes inactive categories from parent options', async () => {
            const cats = [
                mockCat({id: 'cat-1', parentId: null, isActive: true}),
                mockCat({id: 'cat-2', parentId: null, isActive: false, name: 'Inactive'})
            ];
            await openAndCheckModal(cats);
            // Only cat-1 qualifies
            expect(screen.getByTestId('parent-options-count')).toHaveTextContent('1');
        });

        it('excludes the editTarget from parent options to prevent circular nesting', async () => {
            const cats = [
                mockCat({id: 'cat-1', parentId: null, isActive: true}),
                mockCat({id: 'cat-2', parentId: null, isActive: true, name: 'Transport'})
            ];
            mockFindAll.mockReturnValue(makeFindAll(cats));
            // editTarget = cat-1 is being edited
            mockUseCategoryForm.mockReturnValue(
                buildFormState(cats[0]) as UseCategoryFormReturn
            );
            const user = userEvent.setup();
            renderPage();
            await user.click(screen.getByRole('button', {name: /edit cat-1/i}));
            // cat-1 should be excluded from parent options since it is the editTarget
            expect(screen.getByTestId('parent-options-count')).toHaveTextContent('1');
        });
    });
});
