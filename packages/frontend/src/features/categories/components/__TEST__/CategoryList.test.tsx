import {
    describe, it, expect, vi, beforeEach
} from 'vitest';
import {
    render, screen
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {CategoryList} from '@features/categories/components/CategoryList.js';
import type {CategoryResponseDto} from '@/api/model/categoryResponseDto.js';

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

const defaultProps = {
    categories: [mockCat()],
    isLoading: false,
    isError: false,
    showInactive: false,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onToggleActive: vi.fn()
};

describe('CategoryList', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('renders the table with a category row', () => {
        render(<CategoryList {...defaultProps} />);
        expect(screen.getByRole('table', {name: /categories/i})).toBeInTheDocument();
        expect(screen.getByText('Groceries')).toBeInTheDocument();
    });

    it('renders all column headers', () => {
        render(<CategoryList {...defaultProps} />);
        expect(screen.getByRole('columnheader', {name: /^Color/i})).toBeInTheDocument();
        expect(screen.getByRole('columnheader', {name: /^Name$/i})).toBeInTheDocument();
        expect(screen.getByRole('columnheader', {name: /^Actions$/i})).toBeInTheDocument();
    });

    it('shows loading state', () => {
        render(<CategoryList {...defaultProps} categories={[]} isLoading />);
        expect(screen.getByText(/loading categories/i)).toBeInTheDocument();
    });

    it('shows error state with alert role', () => {
        render(<CategoryList {...defaultProps} categories={[]} isError />);
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });

    it('shows empty state when no categories', () => {
        render(<CategoryList {...defaultProps} categories={[]} />);
        expect(screen.getByText(/no active categories/i)).toBeInTheDocument();
    });

    it('shows inactive category when showInactive is true', () => {
        const inactive = mockCat({id: 'cat-2', name: 'Old Category', isActive: false});
        render(<CategoryList {...defaultProps} categories={[inactive]} showInactive />);
        expect(screen.getByText('Old Category')).toBeInTheDocument();
    });

    it('hides inactive category when showInactive is false', () => {
        const inactive = mockCat({id: 'cat-2', name: 'Old Category', isActive: false});
        render(<CategoryList {...defaultProps} categories={[inactive]} showInactive={false} />);
        expect(screen.queryByText('Old Category')).not.toBeInTheDocument();
    });

    it('renders edit button for a category', () => {
        render(<CategoryList {...defaultProps} />);
        expect(screen.getByRole('button', {name: /edit groceries/i})).toBeInTheDocument();
    });

    it('calls onEdit when the edit button is clicked', async () => {
        const onEdit = vi.fn();
        const user = userEvent.setup();
        render(<CategoryList {...defaultProps} onEdit={onEdit} />);
        await user.click(screen.getByRole('button', {name: /edit groceries/i}));
        expect(onEdit).toHaveBeenCalledWith(mockCat());
    });

    it('calls onToggleActive when the deactivate button is clicked', async () => {
        const onToggleActive = vi.fn();
        const user = userEvent.setup();
        render(<CategoryList {...defaultProps} onToggleActive={onToggleActive} />);
        await user.click(screen.getByRole('button', {name: /deactivate groceries/i}));
        expect(onToggleActive).toHaveBeenCalledWith(mockCat());
    });

    it('shows confirm buttons when delete is clicked', async () => {
        const user = userEvent.setup();
        render(<CategoryList {...defaultProps} />);
        await user.click(screen.getByRole('button', {name: /delete groceries/i}));
        expect(screen.getByRole('button', {name: /confirm delete groceries/i})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /cancel delete/i})).toBeInTheDocument();
    });

    it('calls onDelete with id and name after confirming deletion', async () => {
        const onDelete = vi.fn();
        const user = userEvent.setup();
        render(<CategoryList {...defaultProps} onDelete={onDelete} />);
        await user.click(screen.getByRole('button', {name: /delete groceries/i}));
        await user.click(screen.getByRole('button', {name: /confirm delete/i}));
        expect(onDelete).toHaveBeenCalledWith('cat-1', 'Groceries');
    });

    it('cancels deletion and does not call onDelete', async () => {
        const onDelete = vi.fn();
        const user = userEvent.setup();
        render(<CategoryList {...defaultProps} onDelete={onDelete} />);
        await user.click(screen.getByRole('button', {name: /delete groceries/i}));
        await user.click(screen.getByRole('button', {name: /cancel delete/i}));
        expect(onDelete).not.toHaveBeenCalled();
        expect(screen.getByRole('button', {name: /delete groceries/i})).toBeInTheDocument();
    });

    it('renders the category icon', () => {
        render(<CategoryList {...defaultProps} />);
        expect(screen.getByLabelText(/icon: 🛒/i)).toBeInTheDocument();
    });

    it('renders multiple categories', () => {
        const cats = [
            mockCat({id: 'cat-1', name: 'Groceries'}),
            mockCat({id: 'cat-2', name: 'Transport'})
        ];
        render(<CategoryList {...defaultProps} categories={cats} />);
        expect(screen.getByText('Groceries')).toBeInTheDocument();
        expect(screen.getByText('Transport')).toBeInTheDocument();
    });

    it('shows inactive badge when showInactive is true and category is inactive', () => {
        const inactive = mockCat({id: 'cat-2', name: 'Old Category', isActive: false});
        render(<CategoryList {...defaultProps} categories={[inactive]} showInactive />);
        expect(screen.getByLabelText(/inactive/i)).toBeInTheDocument();
    });

    it('shows "No categories found" when showInactive=true and categories list is empty', () => {
        render(<CategoryList {...defaultProps} categories={[]} showInactive />);
        expect(screen.getByText(/no categories found/i)).toBeInTheDocument();
    });

    it('shows parent as null when parentId does not match any category', () => {
        // Child with parentId that does not exist in the categories list
        const orphan = mockCat({id: 'orphan-1', name: 'Orphan', parentId: 'missing-parent'});
        render(<CategoryList {...defaultProps} categories={[orphan]} />);
        expect(screen.getByText('Orphan')).toBeInTheDocument();
    });
});
