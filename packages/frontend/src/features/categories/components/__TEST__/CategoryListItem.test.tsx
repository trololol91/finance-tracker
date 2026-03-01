import {
    describe, it, expect, vi, beforeEach
} from 'vitest';
import {
    render, screen
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {ComponentProps} from 'react';
import {CategoryListItem} from '@features/categories/components/CategoryListItem.js';
import type {CategoryResponseDto} from '@/api/model/categoryResponseDto.js';

// Minimal factory — each test only overrides what it cares about.
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

const defaultProps: ComponentProps<typeof CategoryListItem> = {
    category: mockCat(),
    parentName: null,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onToggleActive: vi.fn()
};

// Helper – render inside a <table><tbody> so the <tr> is valid HTML
const renderItem = (props = defaultProps) =>
    render(
        <table><tbody>
            <CategoryListItem {...props} />
        </tbody></table>
    );

describe('CategoryListItem', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    // -------------------------------------------------------------------------
    // Rendering — color swatch
    // -------------------------------------------------------------------------
    describe('color swatch', () => {
        it('renders a colored swatch with the correct background when color is non-null', () => {
            renderItem();
            const swatch = screen.getByTestId('color-swatch');
            expect(swatch).toBeInTheDocument();
            expect(swatch).toHaveStyle({backgroundColor: '#22c55e'});
        });

        it('renders the empty swatch element when category.color is null', () => {
            renderItem({...defaultProps, category: mockCat({color: null})});
            expect(screen.getByTestId('color-swatch-empty')).toBeInTheDocument();
            expect(screen.queryByTestId('color-swatch')).not.toBeInTheDocument();
        });
    });

    // -------------------------------------------------------------------------
    // Rendering — icon
    // -------------------------------------------------------------------------
    describe('icon', () => {
        it('renders the icon when category.icon is non-null', () => {
            renderItem();
            expect(screen.getByLabelText(/icon: 🛒/i)).toBeInTheDocument();
        });

        it('does not render an icon element when category.icon is null', () => {
            renderItem({...defaultProps, category: mockCat({icon: null})});
            expect(screen.queryByLabelText(/icon:/i)).not.toBeInTheDocument();
        });
    });

    // -------------------------------------------------------------------------
    // Rendering — name
    // -------------------------------------------------------------------------
    describe('name', () => {
        it('renders the category name', () => {
            renderItem();
            expect(screen.getByText('Groceries')).toBeInTheDocument();
        });

        it('does NOT show the inactive badge when isActive is true', () => {
            renderItem();
            expect(screen.queryByLabelText(/inactive/i)).not.toBeInTheDocument();
        });

        it('shows the inactive badge when isActive is false', () => {
            renderItem({
                ...defaultProps, category: mockCat({isActive: false})
            });
            expect(screen.getByLabelText(/inactive/i)).toBeInTheDocument();
        });
    });

    // -------------------------------------------------------------------------
    // Rendering — parent name
    // -------------------------------------------------------------------------
    describe('parent name', () => {
        it('shows parentName when provided', () => {
            renderItem({...defaultProps, parentName: 'Food'});
            expect(screen.getByText('Food')).toBeInTheDocument();
        });

        it('shows an em-dash when parentName is null', () => {
            renderItem({...defaultProps, parentName: null});
            // The <span className={styles.none}>—</span> renders "—"
            expect(screen.getByText('—')).toBeInTheDocument();
        });
    });

    // -------------------------------------------------------------------------
    // Rendering — transaction count
    // -------------------------------------------------------------------------
    it('renders the transaction count', () => {
        renderItem();
        expect(screen.getByText('5')).toBeInTheDocument();
    });

    // -------------------------------------------------------------------------
    // Rendering — row state classes
    // -------------------------------------------------------------------------
    it('does not apply the inactive class when isActive is true', () => {
        renderItem();
        const row = screen.getByTestId('category-row-cat-1');
        // Row class should not contain the word "Inactive"
        expect(row.className.toLowerCase()).not.toContain('inactive');
    });

    it('applies an inactive class when isActive is false', () => {
        renderItem({...defaultProps, category: mockCat({isActive: false})});
        const row = screen.getByTestId('category-row-cat-1');
        expect(row.className.toLowerCase()).toContain('inactive');
    });

    // -------------------------------------------------------------------------
    // Actions — normal state
    // -------------------------------------------------------------------------
    describe('action buttons (normal state)', () => {
        it('shows "Deactivate" when isActive is true', () => {
            renderItem();
            expect(screen.getByRole('button', {name: /deactivate groceries/i})).toBeInTheDocument();
        });

        it('shows "Activate" when isActive is false', () => {
            renderItem({...defaultProps, category: mockCat({isActive: false})});
            expect(screen.getByRole('button', {name: /activate groceries/i})).toBeInTheDocument();
        });

        it('shows an edit button', () => {
            renderItem();
            expect(screen.getByRole('button', {name: /edit groceries/i})).toBeInTheDocument();
        });

        it('shows a delete button', () => {
            renderItem();
            expect(screen.getByRole('button', {name: /delete groceries/i})).toBeInTheDocument();
        });

        it('calls onEdit when edit is clicked', async () => {
            const onEdit = vi.fn();
            const user = userEvent.setup();
            renderItem({...defaultProps, onEdit});
            await user.click(screen.getByRole('button', {name: /edit groceries/i}));
            expect(onEdit).toHaveBeenCalledWith(mockCat());
        });

        it('calls onToggleActive with the category when deactivate is clicked', async () => {
            const onToggleActive = vi.fn();
            const user = userEvent.setup();
            renderItem({...defaultProps, onToggleActive});
            await user.click(screen.getByRole('button', {name: /deactivate groceries/i}));
            expect(onToggleActive).toHaveBeenCalledWith(mockCat());
        });

        it('calls onToggleActive for an inactive category (activate)', async () => {
            const onToggleActive = vi.fn();
            const user = userEvent.setup();
            const inactiveCat = mockCat({isActive: false});
            renderItem({...defaultProps, category: inactiveCat, onToggleActive});
            await user.click(screen.getByRole('button', {name: /activate groceries/i}));
            expect(onToggleActive).toHaveBeenCalledWith(inactiveCat);
        });
    });

    // -------------------------------------------------------------------------
    // Actions — delete confirmation flow
    // -------------------------------------------------------------------------
    describe('delete confirmation flow', () => {
        it('shows "Yes" and "No" confirmation buttons after clicking delete', async () => {
            const user = userEvent.setup();
            renderItem();
            await user.click(screen.getByRole('button', {name: /delete groceries/i}));
            expect(screen.getByRole('button', {name: /confirm delete groceries/i})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /cancel delete/i})).toBeInTheDocument();
        });

        it('hides the normal action buttons while confirming', async () => {
            const user = userEvent.setup();
            renderItem();
            await user.click(screen.getByRole('button', {name: /delete groceries/i}));
            expect(screen.queryByRole('button', {name: /^edit groceries/i})).not.toBeInTheDocument();
        });

        it('calls onDelete with id and name when "Yes" is clicked', async () => {
            const onDelete = vi.fn();
            const user = userEvent.setup();
            renderItem({...defaultProps, onDelete});
            await user.click(screen.getByRole('button', {name: /delete groceries/i}));
            await user.click(screen.getByRole('button', {name: /confirm delete/i}));
            expect(onDelete).toHaveBeenCalledWith('cat-1', 'Groceries');
        });

        it('does NOT call onDelete when "No" is clicked', async () => {
            const onDelete = vi.fn();
            const user = userEvent.setup();
            renderItem({...defaultProps, onDelete});
            await user.click(screen.getByRole('button', {name: /delete groceries/i}));
            await user.click(screen.getByRole('button', {name: /cancel delete/i}));
            expect(onDelete).not.toHaveBeenCalled();
        });

        it('restores the normal action buttons after "No" is clicked', async () => {
            const user = userEvent.setup();
            renderItem();
            await user.click(screen.getByRole('button', {name: /delete groceries/i}));
            await user.click(screen.getByRole('button', {name: /cancel delete/i}));
            expect(screen.getByRole('button', {name: /edit groceries/i})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /delete groceries/i})).toBeInTheDocument();
        });
    });

    // -------------------------------------------------------------------------
    // Accessibility
    // -------------------------------------------------------------------------
    describe('accessibility', () => {
        it('confirmation group has accessible group role', async () => {
            const user = userEvent.setup();
            renderItem();
            await user.click(screen.getByRole('button', {name: /delete groceries/i}));
            expect(screen.getByRole('group', {name: /confirm deletion/i})).toBeInTheDocument();
        });

        it('uses aria-label for the deactivate button that includes the category name', () => {
            renderItem();
            expect(
                screen.getByRole('button', {name: /deactivate groceries/i})
            ).toHaveAttribute('aria-label', 'Deactivate Groceries');
        });
    });
});
