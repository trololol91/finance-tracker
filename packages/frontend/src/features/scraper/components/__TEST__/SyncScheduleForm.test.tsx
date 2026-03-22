import {
    describe, it, expect, vi, beforeEach
} from 'vitest';
import {
    render, screen, within
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {SyncScheduleForm} from '@features/scraper/components/SyncScheduleForm.js';
import type {
    SyncScheduleFormValues, SyncScheduleFormErrors
} from '@features/scraper/types/scraper.types.js';
import type {ScraperInfoDto} from '@/api/model/scraperInfoDto.js';

vi.mock('@/api/scrapers/scrapers.js', () => ({
    useScraperControllerListScrapers: vi.fn()
}));
vi.mock('@/api/accounts/accounts.js', () => ({
    useAccountsControllerFindAll: vi.fn()
}));

import {useScraperControllerListScrapers} from '@/api/scrapers/scrapers.js';
import {useAccountsControllerFindAll} from '@/api/accounts/accounts.js';

const mockScrapers = vi.mocked(useScraperControllerListScrapers);
const mockAccounts = vi.mocked(useAccountsControllerFindAll);

interface AccountItem {id: string, name: string, isActive: boolean}

const tdScraper: ScraperInfoDto = {
    bankId: 'td',
    displayName: 'TD Bank',
    requiresMfaOnEveryRun: false,
    maxLookbackDays: 90,
    pendingTransactionsIncluded: false,
    inputSchema: [
        {key: 'username', label: 'Username', type: 'text', required: true, hint: 'Your TD EasyWeb username'},
        {key: 'password', label: 'Password', type: 'password', required: true}
    ]
};

const emptyValues: SyncScheduleFormValues = {
    accountId: '',
    bankId: '',
    inputs: {},
    cron: '0 8 * * *',
    lookbackDays: '3',
    enabled: true,
    autoCategorizeLlm: false
};

const defaultProps = {
    values: emptyValues,
    errors: {} as SyncScheduleFormErrors,
    isSubmitting: false,
    editMode: false,
    onChange: vi.fn(),
    onInputChange: vi.fn(),
    onSubmit: vi.fn()
};

beforeEach(() => {
    vi.clearAllMocks();
    mockScrapers.mockReturnValue({
        data: [tdScraper]
    } as ReturnType<typeof useScraperControllerListScrapers>);
    mockAccounts.mockReturnValue({
        data: [
            {id: 'acc-1', name: 'Chequing', isActive: true} as AccountItem
        ]
    } as ReturnType<typeof useAccountsControllerFindAll>);
});

describe('SyncScheduleForm', () => {
    describe('create mode', () => {
        it('renders form with "New sync schedule form" aria-label', () => {
            render(<SyncScheduleForm {...defaultProps} />);
            expect(screen.getByRole('form', {name: /new sync schedule form/i})).toBeInTheDocument();
        });

        it('shows Account and Bank fields', () => {
            render(<SyncScheduleForm {...defaultProps} />);
            expect(screen.getByLabelText(/account/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/bank/i)).toBeInTheDocument();
        });

        it('shows cron and lookback fields', () => {
            render(<SyncScheduleForm {...defaultProps} />);
            expect(screen.getByLabelText(/schedule.*cron/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/lookback days/i)).toBeInTheDocument();
        });

        it('shows "Create Schedule" submit button in create mode', () => {
            render(<SyncScheduleForm {...defaultProps} />);
            expect(screen.getByRole('button', {name: /create schedule/i})).toBeInTheDocument();
        });

        it('does not show enabled checkbox in create mode', () => {
            render(<SyncScheduleForm {...defaultProps} editMode={false} />);
            expect(screen.queryByLabelText(/schedule enabled/i)).not.toBeInTheDocument();
        });

        it('renders available scraper banks as options', () => {
            render(<SyncScheduleForm {...defaultProps} />);
            expect(screen.getByRole('option', {name: 'TD Bank'})).toBeInTheDocument();
        });

        it('renders active accounts as options', () => {
            render(<SyncScheduleForm {...defaultProps} />);
            expect(screen.getByRole('option', {name: 'Chequing'})).toBeInTheDocument();
        });

        it('does not show plugin input fields when no bank is selected', () => {
            render(<SyncScheduleForm {...defaultProps} />);
            // Without a bankId selected, no scraper is found and no input fields rendered
            expect(screen.queryByLabelText(/username/i)).not.toBeInTheDocument();
            expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
        });

        it('shows plugin input fields when a bank is selected', () => {
            const valuesWithBank: SyncScheduleFormValues = {...emptyValues, bankId: 'td'};
            render(<SyncScheduleForm {...defaultProps} values={valuesWithBank} />);
            expect(screen.getByLabelText(/^username/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
        });

        it('calls onInputChange when a plugin input field changes', async () => {
            const user = userEvent.setup();
            const onInputChange = vi.fn();
            const valuesWithBank: SyncScheduleFormValues = {...emptyValues, bankId: 'td'};
            render(
                <SyncScheduleForm
                    {...defaultProps}
                    values={valuesWithBank}
                    onInputChange={onInputChange}
                />
            );
            await user.type(screen.getByLabelText(/^username/i), 'bob');
            expect(onInputChange).toHaveBeenCalledWith('username', expect.any(String));
        });

        it('shows hint text for fields that have a hint', () => {
            const valuesWithBank: SyncScheduleFormValues = {...emptyValues, bankId: 'td'};
            render(<SyncScheduleForm {...defaultProps} values={valuesWithBank} />);
            expect(screen.getByText(/Your TD EasyWeb username/i)).toBeInTheDocument();
        });
    });

    describe('edit mode', () => {
        it('renders form with "Edit sync schedule form" aria-label', () => {
            render(<SyncScheduleForm {...defaultProps} editMode={true} />);
            expect(screen.getByRole('form', {name: /edit sync schedule form/i})).toBeInTheDocument();
        });

        it('shows "Save Changes" submit button in edit mode', () => {
            render(<SyncScheduleForm {...defaultProps} editMode={true} />);
            expect(screen.getByRole('button', {name: /save changes/i})).toBeInTheDocument();
        });

        it('shows "New Username" label in edit mode when bank is selected', () => {
            const valuesWithBank: SyncScheduleFormValues = {...emptyValues, bankId: 'td'};
            render(<SyncScheduleForm {...defaultProps} editMode={true} values={valuesWithBank} />);
            expect(screen.getByLabelText(/new username/i)).toBeInTheDocument();
        });

        it('shows enabled checkbox in edit mode', () => {
            render(<SyncScheduleForm {...defaultProps} editMode={true} />);
            expect(screen.getByLabelText(/schedule enabled/i)).toBeInTheDocument();
        });

        it('disables account and bank selects in edit mode', () => {
            render(<SyncScheduleForm {...defaultProps} editMode={true} />);
            expect(screen.getByLabelText(/account/i)).toBeDisabled();
            expect(screen.getByLabelText(/bank/i)).toBeDisabled();
        });

        it('shows hint that account cannot be changed', () => {
            render(<SyncScheduleForm {...defaultProps} editMode={true} />);
            expect(screen.getByText(/account cannot be changed/i)).toBeInTheDocument();
        });

        it('calls onChange when enabled checkbox toggled', async () => {
            const user = userEvent.setup();
            const onChange = vi.fn();
            render(
                <SyncScheduleForm
                    {...defaultProps}
                    editMode={true}
                    onChange={onChange}
                />
            );
            await user.click(screen.getByLabelText(/schedule enabled/i));
            expect(onChange).toHaveBeenCalledWith('enabled', expect.any(Boolean));
        });

        it('shows "Leave blank to keep unchanged" placeholder for password in edit mode', () => {
            const valuesWithBank: SyncScheduleFormValues = {...emptyValues, bankId: 'td'};
            render(<SyncScheduleForm {...defaultProps} editMode={true} values={valuesWithBank} />);
            const passwordInput = screen.getByLabelText(/new password/i);
            expect(passwordInput).toHaveAttribute('placeholder', 'Leave blank to keep unchanged');
        });
    });

    describe('error display', () => {
        it('shows accountId error when present', () => {
            render(
                <SyncScheduleForm
                    {...defaultProps}
                    errors={{accountId: 'Account is required'}}
                />
            );
            expect(screen.getByText('Account is required')).toBeInTheDocument();
        });

        it('shows bankId error when present', () => {
            render(
                <SyncScheduleForm
                    {...defaultProps}
                    errors={{bankId: 'Bank is required'}}
                />
            );
            expect(screen.getByText('Bank is required')).toBeInTheDocument();
        });

        it('shows cron error when present', () => {
            render(
                <SyncScheduleForm
                    {...defaultProps}
                    errors={{cron: 'Invalid cron'}}
                />
            );
            expect(screen.getByText('Invalid cron')).toBeInTheDocument();
        });

        it('shows plugin input error when present', () => {
            const valuesWithBank: SyncScheduleFormValues = {...emptyValues, bankId: 'td'};
            render(
                <SyncScheduleForm
                    {...defaultProps}
                    values={valuesWithBank}
                    errors={{'inputs.username': 'Username required'} as SyncScheduleFormErrors}
                />
            );
            expect(screen.getByText('Username required')).toBeInTheDocument();
        });

        it('shows lookbackDays error when present', () => {
            render(
                <SyncScheduleForm
                    {...defaultProps}
                    errors={{lookbackDays: 'Must be 1–365'}}
                />
            );
            expect(screen.getByText('Must be 1–365')).toBeInTheDocument();
        });

        it('marks lookback days as required in both create and edit mode', () => {
            const {rerender} = render(<SyncScheduleForm {...defaultProps} />);
            expect(screen.getByLabelText(/lookback days/i)).toHaveAttribute('required');

            rerender(<SyncScheduleForm {...defaultProps} editMode={true} />);
            expect(screen.getByLabelText(/lookback days/i)).toHaveAttribute('required');
        });
    });

    describe('submitting state', () => {
        it('shows "Creating…" when isSubmitting is true in create mode', () => {
            render(<SyncScheduleForm {...defaultProps} isSubmitting={true} />);
            expect(screen.getByRole('button', {name: /creating/i})).toBeInTheDocument();
        });

        it('shows "Saving…" when isSubmitting is true in edit mode', () => {
            render(<SyncScheduleForm {...defaultProps} isSubmitting={true} editMode={true} />);
            expect(screen.getByRole('button', {name: /saving/i})).toBeInTheDocument();
        });

        it('disables submit button when isSubmitting', () => {
            render(<SyncScheduleForm {...defaultProps} isSubmitting={true} />);
            expect(screen.getByRole('button', {name: /creating/i})).toBeDisabled();
        });
    });

    describe('when scrapers data is undefined', () => {
        it('renders bank select with no options (besides default)', () => {
            mockScrapers.mockReturnValue({
                data: undefined
            } as ReturnType<typeof useScraperControllerListScrapers>);
            render(<SyncScheduleForm {...defaultProps} />);
            // Only the "Select bank…" placeholder option should exist
            const bankSelect = screen.getByLabelText(/bank/i);
            expect(within(bankSelect).getAllByRole('option')).toHaveLength(1);
        });
    });

    describe('select-type plugin fields', () => {
        it('renders a <select> element for fields with type "select"', () => {
            const selectScraper: ScraperInfoDto = {
                bankId: 'cibc',
                displayName: 'CIBC',
                requiresMfaOnEveryRun: false,
                maxLookbackDays: 90,
                pendingTransactionsIncluded: false,
                inputSchema: [
                    {
                        key: 'accountType',
                        label: 'Account Type',
                        type: 'select',
                        required: true,
                        options: [
                            {value: 'chequing', label: 'Chequing'},
                            {value: 'savings', label: 'Savings'}
                        ]
                    }
                ]
            };
            mockScrapers.mockReturnValue({
                data: [selectScraper]
            } as ReturnType<typeof useScraperControllerListScrapers>);
            const valuesWithBank: SyncScheduleFormValues = {...emptyValues, bankId: 'cibc'};
            render(<SyncScheduleForm {...defaultProps} values={valuesWithBank} />);
            const selectEl = screen.getByLabelText(/account type/i);
            expect(selectEl.tagName).toBe('SELECT');
            // Scope to this select to avoid collision with the account select
            const withinSelect = within(selectEl);
            expect(withinSelect.getByRole('option', {name: 'Chequing'})).toBeInTheDocument();
            expect(withinSelect.getByRole('option', {name: 'Savings'})).toBeInTheDocument();
        });
    });
});
