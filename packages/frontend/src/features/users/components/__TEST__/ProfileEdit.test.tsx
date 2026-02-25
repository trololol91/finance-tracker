import {
    describe,
    it,
    expect,
    vi,
    beforeEach
} from 'vitest';
import {
    render,
    screen,
    fireEvent
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ProfileEdit} from '@features/users/components/ProfileEdit.js';
import type {ProfileFormState} from '@features/users/types/user.types.js';
import {UpdateUserDtoCurrency} from '@/api/model/updateUserDtoCurrency.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const defaultForm: ProfileFormState = {
    firstName: 'Sarah',
    lastName: 'Johnson',
    timezone: 'America/New_York',
    currency: UpdateUserDtoCurrency.USD
};

const defaultProps = {
    form: defaultForm,
    email: 'sarah@example.com',
    apiError: '',
    isSaving: false,
    onFieldChange: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn()
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const renderProfileEdit = (overrides: Partial<typeof defaultProps> = {}): void => {
    render(<ProfileEdit {...{...defaultProps, ...overrides}} />);
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProfileEdit', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('rendering', () => {
        it('renders the Edit Profile heading', () => {
            renderProfileEdit();

            expect(
                screen.getByRole('heading', {name: /edit profile/i, level: 1})
            ).toBeInTheDocument();
        });

        it('renders First Name input with the current value', () => {
            renderProfileEdit();

            expect(screen.getByLabelText(/first name/i)).toHaveValue('Sarah');
        });

        it('renders Last Name input with the current value', () => {
            renderProfileEdit();

            expect(screen.getByLabelText(/last name/i)).toHaveValue('Johnson');
        });

        it('renders email as read-only text (not an input)', () => {
            renderProfileEdit();

            expect(screen.getByText('sarah@example.com')).toBeInTheDocument();
            expect(screen.queryByDisplayValue('sarah@example.com')).not.toBeInTheDocument();
        });

        it('renders Timezone select', () => {
            renderProfileEdit();

            expect(screen.getByLabelText(/timezone/i)).toBeInTheDocument();
        });

        it('renders Currency select', () => {
            renderProfileEdit();

            expect(screen.getByLabelText(/currency/i)).toBeInTheDocument();
        });

        it('renders Cancel and Save buttons', () => {
            renderProfileEdit();

            expect(screen.getByRole('button', {name: /cancel/i})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /save/i})).toBeInTheDocument();
        });

        it('renders Personal Information section heading', () => {
            renderProfileEdit();

            expect(
                screen.getByRole('heading', {name: /personal information/i})
            ).toBeInTheDocument();
        });

        it('renders Preferences section heading', () => {
            renderProfileEdit();

            expect(
                screen.getByRole('heading', {name: /preferences/i})
            ).toBeInTheDocument();
        });
    });

    describe('error state', () => {
        it('shows API error alert when apiError is set', () => {
            renderProfileEdit({apiError: 'Failed to save profile.'});

            expect(screen.getByRole('alert')).toHaveTextContent(
                'Failed to save profile.'
            );
        });

        it('does not render error alert when apiError is empty', () => {
            renderProfileEdit({apiError: ''});

            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });
    });

    describe('interactions', () => {
        it('calls onFieldChange with "firstName" when First Name changes', () => {
            const onFieldChange = vi.fn();
            renderProfileEdit({onFieldChange});

            fireEvent.change(screen.getByLabelText(/first name/i), {
                target: {value: 'Bob'}
            });

            expect(onFieldChange).toHaveBeenCalledWith('firstName', 'Bob');
        });

        it('calls onFieldChange with "lastName" when Last Name changes', () => {
            const onFieldChange = vi.fn();
            renderProfileEdit({onFieldChange});

            fireEvent.change(screen.getByLabelText(/last name/i), {
                target: {value: 'Smith'}
            });

            expect(onFieldChange).toHaveBeenCalledWith('lastName', 'Smith');
        });

        it('calls onFieldChange with "timezone" when Timezone select changes', () => {
            const onFieldChange = vi.fn();
            renderProfileEdit({onFieldChange});

            fireEvent.change(screen.getByLabelText(/timezone/i), {
                target: {value: 'Europe/London'}
            });

            expect(onFieldChange).toHaveBeenCalledWith('timezone', 'Europe/London');
        });

        it('calls onFieldChange with "currency" when Currency select changes', () => {
            const onFieldChange = vi.fn();
            renderProfileEdit({onFieldChange});

            fireEvent.change(screen.getByLabelText(/currency/i), {
                target: {value: 'CAD'}
            });

            expect(onFieldChange).toHaveBeenCalledWith('currency', 'CAD');
        });

        it('calls onCancel when Cancel button is clicked', async () => {
            const onCancel = vi.fn();
            renderProfileEdit({onCancel});

            await userEvent.click(screen.getByRole('button', {name: /cancel/i}));

            expect(onCancel).toHaveBeenCalledTimes(1);
        });

        it('calls onSave when the form is submitted', () => {
            const onSave = vi.fn((e: React.FormEvent) => { e.preventDefault(); });
            renderProfileEdit({onSave});

            fireEvent.submit(document.querySelector('#profile-form')!);

            expect(onSave).toHaveBeenCalledTimes(1);
        });
    });

    describe('loading state', () => {
        it('disables Cancel button when isSaving is true', () => {
            renderProfileEdit({isSaving: true});

            expect(screen.getByRole('button', {name: /cancel/i})).toBeDisabled();
        });
    });

    describe('accessibility', () => {
        it('auto-focuses the First Name input on mount', () => {
            renderProfileEdit();

            expect(screen.getByLabelText(/first name/i)).toHaveFocus();
        });
    });
});
