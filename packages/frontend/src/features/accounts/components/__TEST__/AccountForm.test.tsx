import {
    render, screen
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
    describe, it, expect, vi, beforeEach
} from 'vitest';
import {AccountForm} from '@features/accounts/components/AccountForm.js';
import {CreateAccountDtoType} from '@/api/model/createAccountDtoType.js';
import type {
    AccountFormValues, AccountFormErrors
} from '@features/accounts/types/account.types.js';

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

const defaultValues: AccountFormValues = {
    name: '',
    type: CreateAccountDtoType.checking,
    institution: '',
    currency: 'CAD',
    openingBalance: '0',
    color: '',
    notes: '',
    isActive: true
};

const noErrors: AccountFormErrors = {};

const defaultProps = {
    values: defaultValues,
    errors: noErrors,
    isSubmitting: false,
    editMode: false,
    onChange: vi.fn(),
    onSubmit: vi.fn()
};

beforeEach(() => {
    vi.clearAllMocks();
});

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe('AccountForm', () => {
    describe('create mode', () => {
        it('renders the account form', () => {
            render(<AccountForm {...defaultProps} />);
            expect(screen.getByRole('form', {name: /new account/i})).toBeInTheDocument();
        });

        it('renders name input', () => {
            render(<AccountForm {...defaultProps} />);
            expect(screen.getByLabelText(/account name/i)).toBeInTheDocument();
        });

        it('renders type select', () => {
            render(<AccountForm {...defaultProps} />);
            expect(screen.getByLabelText(/^type/i)).toBeInTheDocument();
        });

        it('renders currency input', () => {
            render(<AccountForm {...defaultProps} />);
            expect(screen.getByLabelText(/currency/i)).toBeInTheDocument();
        });

        it('renders opening balance input', () => {
            render(<AccountForm {...defaultProps} />);
            expect(screen.getByLabelText(/opening balance/i)).toBeInTheDocument();
        });

        it('type select is not disabled in create mode', () => {
            render(<AccountForm {...defaultProps} />);
            expect(screen.getByLabelText(/^type/i)).not.toBeDisabled();
        });

        it('does not show isActive checkbox in create mode', () => {
            render(<AccountForm {...defaultProps} />);
            expect(screen.queryByLabelText(/active/i)).not.toBeInTheDocument();
        });

        it('shows "Create Account" on submit button in create mode', () => {
            render(<AccountForm {...defaultProps} />);
            expect(screen.getByRole('button', {name: /create account/i})).toBeInTheDocument();
        });

        it('does not show type-locked hint in create mode', () => {
            render(<AccountForm {...defaultProps} />);
            expect(screen.queryByText(/cannot be changed/i)).not.toBeInTheDocument();
        });
    });

    describe('edit mode', () => {
        const editProps = {
            ...defaultProps,
            editMode: true,
            values: {...defaultValues, name: 'My Savings', isActive: true}
        };

        it('renders the form with edit label', () => {
            render(<AccountForm {...editProps} />);
            expect(screen.getByRole('form', {name: /edit account/i})).toBeInTheDocument();
        });

        it('type select is disabled in edit mode', () => {
            render(<AccountForm {...editProps} />);
            expect(screen.getByLabelText(/^type/i)).toBeDisabled();
        });

        it('shows type-locked hint in edit mode', () => {
            render(<AccountForm {...editProps} />);
            expect(screen.getByText(/cannot be changed/i)).toBeInTheDocument();
        });

        it('shows isActive checkbox in edit mode', () => {
            render(<AccountForm {...editProps} />);
            expect(screen.getByRole('checkbox')).toBeInTheDocument();
        });

        it('shows "Save Changes" on submit button in edit mode', () => {
            render(<AccountForm {...editProps} />);
            expect(screen.getByRole('button', {name: /save changes/i})).toBeInTheDocument();
        });
    });

    describe('field interactions', () => {
        it('calls onChange with name field when name input changes', async () => {
            const onChange = vi.fn();
            render(<AccountForm {...defaultProps} onChange={onChange} />);
            await userEvent.type(screen.getByLabelText(/account name/i), 'A');
            expect(onChange).toHaveBeenCalledWith('name', expect.any(String));
        });

        it('calls onChange with institution field when institution input changes', async () => {
            const onChange = vi.fn();
            render(<AccountForm {...defaultProps} onChange={onChange} />);
            await userEvent.type(screen.getByLabelText(/institution/i), 'TD');
            expect(onChange).toHaveBeenCalledWith('institution', expect.any(String));
        });

        it('submit button is disabled when isSubmitting is true', () => {
            render(<AccountForm {...defaultProps} isSubmitting={true} />);
            expect(screen.getByRole('button', {name: /saving/i})).toBeDisabled();
        });
    });

    describe('validation errors', () => {
        it('shows name error when errors.name is set', () => {
            const errors: AccountFormErrors = {name: 'Name is required'};
            render(<AccountForm {...defaultProps} errors={errors} />);
            expect(screen.getByRole('alert')).toBeInTheDocument();
            expect(screen.getByText('Name is required')).toBeInTheDocument();
        });

        it('name input has aria-invalid when error is present', () => {
            const errors: AccountFormErrors = {name: 'Required'};
            render(<AccountForm {...defaultProps} errors={errors} />);
            expect(screen.getByLabelText(/account name/i)).toHaveAttribute('aria-invalid', 'true');
        });

        it('shows currency error when errors.currency is set', () => {
            const errors: AccountFormErrors = {currency: 'Invalid currency'};
            render(<AccountForm {...defaultProps} errors={errors} />);
            expect(screen.getByText('Invalid currency')).toBeInTheDocument();
        });

        it('shows institution error when errors.institution is set', () => {
            const errors: AccountFormErrors = {institution: 'Institution too long'};
            render(<AccountForm {...defaultProps} errors={errors} />);
            expect(screen.getByText('Institution too long')).toBeInTheDocument();
        });

        it('shows type error when errors.type is set', () => {
            const errors: AccountFormErrors = {type: 'Account type is required'};
            render(<AccountForm {...defaultProps} errors={errors} />);
            expect(screen.getByText('Account type is required')).toBeInTheDocument();
        });

        it('shows openingBalance error when errors.openingBalance is set', () => {
            const errors: AccountFormErrors = {openingBalance: 'Must be a number'};
            render(<AccountForm {...defaultProps} errors={errors} />);
            expect(screen.getByText('Must be a number')).toBeInTheDocument();
        });

        it('shows color error when errors.color is set', () => {
            const errors: AccountFormErrors = {color: 'Invalid hex code'};
            render(<AccountForm {...defaultProps} errors={errors} />);
            expect(screen.getByText('Invalid hex code')).toBeInTheDocument();
        });

        it('shows notes error when errors.notes is set', () => {
            const errors: AccountFormErrors = {notes: 'Notes too long'};
            render(<AccountForm {...defaultProps} errors={errors} />);
            expect(screen.getByText('Notes too long')).toBeInTheDocument();
        });
    });

    describe('field interactions (continued)', () => {
        it('calls onChange with color when color text input changes', async () => {
            const onChange = vi.fn();
            render(<AccountForm {...defaultProps} onChange={onChange} />);
            const colorInput = screen.getByPlaceholderText(/#RRGGBB/i);
            await userEvent.type(colorInput, '#');
            expect(onChange).toHaveBeenCalledWith('color', expect.any(String));
        });

        it('calls onChange with notes when textarea changes', async () => {
            const onChange = vi.fn();
            render(<AccountForm {...defaultProps} onChange={onChange} />);
            await userEvent.type(screen.getByLabelText(/notes/i), 'test note');
            expect(onChange).toHaveBeenCalledWith('notes', expect.any(String));
        });

        it('calls onChange with isActive when checkbox changes in edit mode', async () => {
            const onChange = vi.fn();
            render(<AccountForm {...defaultProps} editMode onChange={onChange}
                values={{...defaultProps.values, isActive: true}} />);
            await userEvent.click(screen.getByLabelText(/active account/i));
            expect(onChange).toHaveBeenCalledWith('isActive', false);
        });
    });

    describe('form content', () => {
        it('type select has options for all account types', () => {
            render(<AccountForm {...defaultProps} />);
            const typeSelect = screen.getByLabelText(/^type/i);
            expect(typeSelect).toBeInTheDocument();
            const options = screen.getAllByRole('option');
            const values = options.map((o) => (o as HTMLOptionElement).value);
            expect(values).toContain('checking');
            expect(values).toContain('savings');
            expect(values).toContain('credit');
        });
    });
});
