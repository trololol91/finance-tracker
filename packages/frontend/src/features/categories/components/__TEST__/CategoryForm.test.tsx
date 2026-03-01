import {
    describe, it, expect, vi, beforeEach
} from 'vitest';
import {
    render, screen, fireEvent
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {CategoryForm} from '@features/categories/components/CategoryForm.js';
import type {
    CategoryFormValues, CategoryFormErrors
} from '@features/categories/types/category.types.js';
import type {CategoryResponseDto} from '@/api/model/categoryResponseDto.js';

const emptyValues: CategoryFormValues = {
    name: '',
    description: '',
    color: '',
    icon: '',
    parentId: ''
};

const filledValues: CategoryFormValues = {
    name: 'Groceries',
    description: 'Food and drink',
    color: '#22c55e',
    icon: '🛒',
    parentId: ''
};

const noop = vi.fn();

const defaultProps = {
    values: emptyValues,
    errors: {} as CategoryFormErrors,
    isSubmitting: false,
    parentOptions: [] as CategoryResponseDto[],
    onChange: noop,
    onSubmit: noop,
    editMode: false
};

const mockParent = (overrides: Partial<CategoryResponseDto> = {}): CategoryResponseDto => ({
    id: 'parent-1',
    userId: 'user-1',
    name: 'Food',
    description: null,
    color: null,
    icon: null,
    parentId: null,
    isActive: true,
    transactionCount: 0,
    children: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
});

describe('CategoryForm', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    describe('rendering', () => {
        it('renders the name field with required attribute', () => {
            render(<CategoryForm {...defaultProps} />);
            expect(screen.getByLabelText(/name/i)).toBeRequired();
        });

        it('renders the description field', () => {
            render(<CategoryForm {...defaultProps} />);
            expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
        });

        it('renders a color picker input', () => {
            render(<CategoryForm {...defaultProps} />);
            expect(screen.getByLabelText('Pick color')).toBeInTheDocument();
        });

        it('uses the color value in the color picker when color is set', () => {
            render(<CategoryForm {...defaultProps} values={filledValues} />);
            expect(screen.getByLabelText('Pick color')).toHaveValue('#22c55e');
        });

        it('renders the icon field', () => {
            render(<CategoryForm {...defaultProps} />);
            expect(screen.getByLabelText(/icon/i)).toBeInTheDocument();
        });

        it('renders "Create Category" submit button in create mode', () => {
            render(<CategoryForm {...defaultProps} editMode={false} />);
            expect(screen.getByRole('button', {name: /create category/i})).toBeInTheDocument();
        });

        it('renders "Save Changes" submit button in edit mode', () => {
            render(<CategoryForm {...defaultProps} editMode />);
            expect(screen.getByRole('button', {name: /save changes/i})).toBeInTheDocument();
        });

        it('disables submit button when isSubmitting is true', () => {
            render(<CategoryForm {...defaultProps} isSubmitting />);
            expect(screen.getByRole('button', {name: /saving/i})).toBeDisabled();
        });

        it('does not render the parent select when parentOptions is empty', () => {
            render(<CategoryForm {...defaultProps} />);
            expect(screen.queryByLabelText(/parent category/i)).not.toBeInTheDocument();
        });

        it('renders the parent select when parentOptions has items', () => {
            render(<CategoryForm {...defaultProps} parentOptions={[mockParent()]} />);
            expect(screen.getByLabelText(/parent category/i)).toBeInTheDocument();
            expect(screen.getByRole('option', {name: /food/i})).toBeInTheDocument();
        });
    });

    describe('values', () => {
        it('displays filled values correctly', () => {
            render(<CategoryForm {...defaultProps} values={filledValues} />);
            expect(screen.getByLabelText(/name/i)).toHaveValue('Groceries');
            expect(screen.getByLabelText(/description/i)).toHaveValue('Food and drink');
        });
    });

    describe('errors', () => {
        it('shows name error when errors.name is set', () => {
            render(<CategoryForm {...defaultProps} errors={{name: 'Name is required'}} />);
            expect(screen.getByRole('alert')).toHaveTextContent('Name is required');
            expect(screen.getByLabelText(/name/i)).toHaveAttribute('aria-invalid', 'true');
        });

        it('shows color error when errors.color is set', () => {
            render(<CategoryForm {...defaultProps} errors={{color: 'Invalid hex code'}} />);
            expect(screen.getByText(/invalid hex code/i)).toBeInTheDocument();
        });

        it('shows description error when too long', () => {
            render(<CategoryForm {...defaultProps} errors={{description: 'Too long'}} />);
            expect(screen.getByText(/too long/i)).toBeInTheDocument();
        });
    });

    describe('user interactions', () => {
        it('calls onChange when the name field is typed into', async () => {
            const onChange = vi.fn();
            const user = userEvent.setup();
            render(<CategoryForm {...defaultProps} onChange={onChange} />);
            await user.type(screen.getByLabelText(/name/i), 'G');
            expect(onChange).toHaveBeenCalledWith('name', 'G');
        });

        it('calls onChange when the description field changes', async () => {
            const onChange = vi.fn();
            const user = userEvent.setup();
            render(<CategoryForm {...defaultProps} onChange={onChange} />);
            await user.type(screen.getByLabelText(/description/i), 'A');
            expect(onChange).toHaveBeenCalledWith('description', 'A');
        });

        it('calls onChange when the icon field changes', async () => {
            const onChange = vi.fn();
            const user = userEvent.setup();
            render(<CategoryForm {...defaultProps} onChange={onChange} />);
            await user.type(screen.getByLabelText(/icon \(emoji\)/i), '🛒');
            expect(onChange).toHaveBeenCalled();
        });

        it('calls onSubmit when the form is submitted', async () => {
            const onSubmit = vi.fn((e: React.FormEvent) => { e.preventDefault(); });
            const user = userEvent.setup();
            render(<CategoryForm {...defaultProps} onSubmit={onSubmit} />);
            await user.click(screen.getByRole('button', {name: /create category/i}));
            expect(onSubmit).toHaveBeenCalledOnce();
        });

        it('calls onChange when parent select changes', async () => {
            const onChange = vi.fn();
            const user = userEvent.setup();
            render(
                <CategoryForm
                    {...defaultProps}
                    onChange={onChange}
                    parentOptions={[mockParent()]}
                />
            );
            await user.selectOptions(screen.getByLabelText(/parent category/i), 'parent-1');
            expect(onChange).toHaveBeenCalledWith('parentId', 'parent-1');
        });
    });

    describe('accessibility', () => {
        it('has accessible form label in create mode', () => {
            render(<CategoryForm {...defaultProps} />);
            expect(screen.getByRole('form', {name: /new category form/i})).toBeInTheDocument();
        });

        it('has accessible form label in edit mode', () => {
            render(<CategoryForm {...defaultProps} editMode />);
            expect(screen.getByRole('form', {name: /edit category form/i})).toBeInTheDocument();
        });
    });

    describe('color picker', () => {
        it('defaults color picker value to #6366f1 when color field is empty', () => {
            render(<CategoryForm {...defaultProps} values={{...emptyValues, color: ''}} />);
            expect(screen.getByLabelText('Pick color')).toHaveValue('#6366f1');
        });

        it('uses the provided color on the color picker input', () => {
            render(<CategoryForm {...defaultProps} values={{...emptyValues, color: '#ff0000'}} />);
            expect(screen.getByLabelText('Pick color')).toHaveValue('#ff0000');
        });

        it('calls onChange with "color" and the new hex when color picker changes', () => {
            const onChange = vi.fn();
            const {getByLabelText} = render(<CategoryForm {...defaultProps} onChange={onChange} />);
            fireEvent.change(getByLabelText('Pick color'), {target: {value: '#abcdef'}});
            expect(onChange).toHaveBeenCalledWith('color', '#abcdef');
        });

        it('calls onChange with "color" and the new value when color text input changes', () => {
            const onChange = vi.fn();
            const {getByLabelText} = render(<CategoryForm {...defaultProps} onChange={onChange} />);
            // The text label "Color" maps to the <input type="text" id="cat-color">
            fireEvent.change(getByLabelText('Color'), {target: {value: '#123456'}});
            expect(onChange).toHaveBeenCalledWith('color', '#123456');
        });
    });
});
